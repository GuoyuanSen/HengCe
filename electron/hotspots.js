function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeBoardName(value) {
  return String(value || "")
    .trim()
    .replace(/[ⅠⅡⅢⅣⅤ]+$/u, "")
    .replace(/\s+/g, "");
}

function isNoisyConcept(name) {
  return /昨日|连板|首板|涨停|跌停|打板|新高|新低|破净股|股价小于/u.test(
    String(name || "")
  );
}

function parseBoardPayload(payload, type) {
  const rows = payload?.data?.diff;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => {
      const name = String(item?.f14 || "").trim();
      const normalizedName = normalizeBoardName(name);
      const code = String(item?.f12 || "").trim();
      if (!code || !normalizedName) return null;
      if (type === "概念" && isNoisyConcept(name)) return null;
      return {
        code,
        name: normalizedName,
        sourceName: name,
        type,
        index: finiteNumber(item.f2),
        changePercent: finiteNumber(item.f3),
        todayNetFlow: finiteNumber(item.f62),
        todayFlowRate: finiteNumber(item.f184),
        upCount: finiteNumber(item.f104),
        downCount: finiteNumber(item.f105),
        leaderName: String(item.f128 || "").trim(),
        leaderChangePercent: finiteNumber(item.f136),
        leaderCode: String(item.f140 || "").trim(),
        netFlow3Day: finiteNumber(item.f267),
        flowRate3Day: finiteNumber(item.f268)
      };
    })
    .filter(Boolean);
}

function parseBoardMembersPayload(payload) {
  const rows = payload?.data?.diff;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => {
      const code = String(item?.f12 || "").trim();
      const name = String(item?.f14 || "").trim();
      const price = finiteNumber(item?.f2);
      const changePercent = finiteNumber(item?.f3);
      if (!/^\d{6}$/.test(code) || !name || price == null) return null;
      return {
        code,
        name,
        price,
        changePercent,
        amount: finiteNumber(item?.f6),
        turnoverRate: finiteNumber(item?.f8),
        volumeRatio: finiteNumber(item?.f10),
        todayNetFlow: finiteNumber(item?.f62),
        industry: String(item?.f100 || "").trim()
      };
    })
    .filter(Boolean);
}

function boardScore(board) {
  const upCount = board.upCount || 0;
  const downCount = board.downCount || 0;
  const breadthTotal = upCount + downCount;
  const breadth = breadthTotal ? (upCount - downCount) / breadthTotal : 0;
  const trend = clamp(((board.changePercent ?? -2) + 2) / 8);
  const todayFlow = clamp(((board.todayFlowRate ?? -5) + 5) / 15);
  const threeDayFlow = clamp(((board.flowRate3Day ?? -5) + 5) / 15);
  const breadthScore = (clamp(breadth, -1, 1) + 1) / 2;
  const consistencyBonus =
    board.todayNetFlow > 0 && board.netFlow3Day > 0 ? 5 : 0;
  return Math.round(
    clamp(
      trend * 35 +
        todayFlow * 25 +
        threeDayFlow * 25 +
        breadthScore * 15 +
        consistencyBonus,
      0,
      100
    )
  );
}

function strengthLabel(score) {
  if (score >= 75) return "强势";
  if (score >= 60) return "活跃";
  if (score >= 45) return "观察";
  return "退潮";
}

function mergeBoards(sources) {
  const byCode = new Map();
  for (const source of sources) {
    for (const board of parseBoardPayload(source.payload, source.type)) {
      const key = `${board.type}:${board.code}`;
      const current = byCode.get(key);
      byCode.set(key, current ? { ...current, ...board } : board);
    }
  }

  const byName = new Map();
  for (const board of byCode.values()) {
    const scored = {
      ...board,
      score: boardScore(board)
    };
    scored.strength = strengthLabel(scored.score);
    const current = byName.get(board.name);
    if (
      !current ||
      scored.score > current.score ||
      (scored.score === current.score &&
        scored.type === "行业" &&
        current.type !== "行业")
    ) {
      byName.set(board.name, scored);
    }
  }
  return [...byName.values()];
}

function buildHotspotSnapshot(
  sources,
  { asOf = new Date().toISOString(), requestedSources = sources.length } = {}
) {
  const boards = mergeBoards(sources);
  const composite = boards
    .filter((item) => item.upCount != null && item.downCount != null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.changePercent ?? -Infinity) -
          (left.changePercent ?? -Infinity)
    )
    .slice(0, 12);
  const todayFlow = boards
    .filter((item) => item.todayNetFlow > 0)
    .sort((left, right) => right.todayNetFlow - left.todayNetFlow)
    .slice(0, 12);
  const threeDayFlow = boards
    .filter((item) => item.netFlow3Day > 0)
    .sort((left, right) => right.netFlow3Day - left.netFlow3Day)
    .slice(0, 12);

  const strongCount = boards.filter((item) => item.score >= 65).length;
  const measurableBoards = boards.filter(
    (item) => item.changePercent != null
  );
  const advancingCount = measurableBoards.filter(
    (item) => item.changePercent > 0
  ).length;
  const advancingRate = measurableBoards.length
    ? advancingCount / measurableBoards.length
    : 0;
  const positive3DayCount = boards.filter(
    (item) => item.netFlow3Day > 0
  ).length;
  const marketTone =
    strongCount >= 15 && advancingRate >= 0.6
      ? "热点扩散"
      : strongCount >= 6 && advancingRate >= 0.45
        ? "结构轮动"
        : "热点收缩";

  return {
    asOf,
    sourceStatus: {
      loaded: sources.length,
      requested: requestedSources,
      partial: sources.length < requestedSources
    },
    summary: {
      totalBoards: boards.length,
      strongCount,
      positive3DayCount,
      leadingTheme: composite[0]?.name || "--",
      marketTone
    },
    composite,
    todayFlow,
    threeDayFlow
  };
}

module.exports = {
  boardScore,
  buildHotspotSnapshot,
  isNoisyConcept,
  normalizeBoardName,
  parseBoardPayload,
  parseBoardMembersPayload,
  strengthLabel
};
