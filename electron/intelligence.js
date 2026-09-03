const THEMES = Object.freeze([
  {
    key: "ai-computing",
    label: "AI算力与通信",
    keywords: ["人工智能", "AI", "算力", "GPU", "英伟达", "服务器", "光模块", "CPO", "数据中心", "液冷"],
    industryTerms: ["通信", "计算机", "软件", "电子"],
    representatives: [{ code: "601138", name: "工业富联" }, { code: "000977", name: "浪潮信息" }]
  },
  {
    key: "semiconductor",
    label: "半导体与存储",
    keywords: ["半导体", "芯片", "存储", "HBM", "NAND", "晶圆", "光刻", "先进封装"],
    industryTerms: ["半导体", "电子", "元件"],
    representatives: [{ code: "688981", name: "中芯国际" }, { code: "603986", name: "兆易创新" }]
  },
  {
    key: "robotics",
    label: "机器人与高端制造",
    keywords: ["机器人", "人形", "工业母机", "自动化", "减速器", "丝杠", "智能制造"],
    industryTerms: ["自动化", "机械", "通用设备", "专用设备"],
    representatives: [{ code: "002747", name: "埃斯顿" }, { code: "603667", name: "五洲新春" }]
  },
  {
    key: "new-energy",
    label: "新能源与汽车",
    keywords: ["新能源", "锂电", "固态电池", "储能", "光伏", "风电", "新能源汽车", "充电桩"],
    industryTerms: ["电池", "光伏", "风电", "汽车", "电力设备"],
    representatives: [{ code: "300750", name: "宁德时代" }, { code: "002594", name: "比亚迪" }]
  },
  {
    key: "power-grid",
    label: "电力与电网",
    keywords: ["电网", "特高压", "电力", "绿电", "核电", "变压器", "电价", "用电负荷"],
    industryTerms: ["电力", "电网", "电气设备"],
    representatives: [{ code: "600406", name: "国电南瑞" }, { code: "601179", name: "中国西电" }]
  },
  {
    key: "defense",
    label: "国防军工与航空",
    keywords: ["军工", "国防", "航空", "航天", "无人机", "卫星", "大飞机", "发动机"],
    industryTerms: ["军工", "航空", "航天", "船舶"],
    representatives: [{ code: "600760", name: "中航沈飞" }, { code: "600893", name: "航发动力" }]
  },
  {
    key: "healthcare",
    label: "创新药与医疗",
    keywords: ["创新药", "医药", "医疗", "疫苗", "临床", "医保", "生物科技", "医疗器械"],
    industryTerms: ["医药", "医疗", "生物制品"],
    representatives: [{ code: "600276", name: "恒瑞医药" }, { code: "603259", name: "药明康德" }]
  },
  {
    key: "finance-property",
    label: "金融与地产",
    keywords: ["银行", "保险", "券商", "房地产", "房贷", "融资", "降准", "社融", "信贷"],
    industryTerms: ["银行", "保险", "证券", "房地产", "非银金融"],
    representatives: [{ code: "601318", name: "中国平安" }, { code: "600036", name: "招商银行" }]
  },
  {
    key: "resources",
    label: "资源品与航运",
    keywords: ["原油", "油价", "煤炭", "黄金", "白银", "铜", "铝", "稀土", "航运", "运价"],
    industryTerms: ["石油", "煤炭", "有色", "贵金属", "航运"],
    representatives: [{ code: "600938", name: "中国海油" }, { code: "601899", name: "紫金矿业" }]
  },
  {
    key: "consumption",
    label: "消费与农业",
    keywords: ["消费", "零售", "白酒", "食品", "旅游", "农业", "粮食", "猪价", "家电"],
    industryTerms: ["消费", "食品", "饮料", "农业", "零售", "家电"],
    representatives: [{ code: "600519", name: "贵州茅台" }, { code: "000333", name: "美的集团" }]
  },
  {
    key: "macro-policy",
    label: "宏观政策与海外",
    keywords: ["国务院", "央行", "证监会", "美联储", "利率", "汇率", "关税", "制裁", "通胀", "PMI", "CPI", "PPI"],
    industryTerms: [],
    representatives: []
  }
]);

const POSITIVE_WORDS = ["增长", "超预期", "突破", "中标", "回购", "增持", "获批", "上调", "支持", "扩产", "降息", "降准"];
const NEGATIVE_WORDS = ["减持", "处罚", "调查", "退市", "亏损", "下滑", "终止", "风险", "冲突", "制裁", "加息", "暴跌", "违约"];
const HIGH_IMPACT_WORDS = ["国务院", "央行", "证监会", "美联储", "财报", "业绩", "重大", "关税", "制裁", "降息", "加息", "退市", "停牌"];

function plainText(value, maximum = 320) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#39;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function safeUrl(value, allowedHosts = []) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    if (allowedHosts.length && !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function isoFromSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function parseWallstreetLives(payload) {
  const rows = payload?.data?.items;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const summary = plainText(item.content_text || item.content, 360);
    const title = plainText(item.title, 180) || plainText(summary.split(/[。；]/)[0], 100);
    if (!title) return null;
    return {
      id: `wscn-${String(item.id || "")}`,
      title,
      summary,
      source: "华尔街见闻",
      origin: plainText(summary.match(/[（(]([^（）()]{2,20})[）)]\s*$/)?.[1], 30),
      publishedAt: isoFromSeconds(item.display_time),
      url: safeUrl(item.uri, ["wallstreetcn.com"]),
      providerScore: Number(item.score || 0),
      category: item.is_calendar ? "宏观数据" : "7×24快讯"
    };
  }).filter((item) => item?.publishedAt && item.url);
}

function parseSinaRoll(payload) {
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const title = plainText(item.title, 180);
    if (!title) return null;
    return {
      id: `sina-${String(item.docid || item.oid || "")}`,
      title,
      summary: plainText(item.intro || item.summary, 360),
      source: "新浪财经",
      origin: plainText(item.media_name, 30),
      publishedAt: isoFromSeconds(item.ctime || item.intime),
      url: safeUrl(item.url || item.wapurl, ["sina.com.cn", "sina.cn"]),
      providerScore: Number(item.level || 0),
      category: "财经资讯"
    };
  }).filter((item) => item?.publishedAt && item.url);
}

function keywordHits(text, words) {
  const upper = text.toUpperCase();
  return words.filter((word) => upper.includes(word.toUpperCase()));
}

function classifyEvent(item, now = Date.now()) {
  const text = `${item.title} ${item.summary}`;
  let selected = null;
  let selectedHits = [];
  for (const theme of THEMES) {
    const hits = keywordHits(text, theme.keywords);
    if (hits.length > selectedHits.length) {
      selected = theme;
      selectedHits = hits;
    }
  }
  const positiveHits = keywordHits(text, POSITIVE_WORDS);
  const negativeHits = keywordHits(text, NEGATIVE_WORDS);
  const sentiment = positiveHits.length && negativeHits.length
    ? "mixed"
    : positiveHits.length
      ? "positive"
      : negativeHits.length
        ? "negative"
        : "neutral";
  const ageHours = Math.max(0, (now - new Date(item.publishedAt).getTime()) / 3600000);
  const freshness = Math.max(0, 22 - ageHours * 1.5);
  const importance = Math.round(Math.min(100,
    22 +
    freshness +
    Math.min(24, Number(item.providerScore || 0) * 8) +
    Math.min(20, keywordHits(text, HIGH_IMPACT_WORDS).length * 10) +
    (selected ? 10 : 0) +
    (/\b\d{6}\b/.test(text) ? 8 : 0)
  ));
  return {
    ...item,
    themeKey: selected?.key || "market-general",
    theme: selected?.label || "市场综合",
    industryTerms: selected?.industryTerms || [],
    representatives: selected?.representatives || [],
    tags: selectedHits.slice(0, 4),
    sentiment,
    importance,
    importanceLabel: importance >= 70 ? "重要" : importance >= 50 ? "关注" : "一般"
  };
}

function titleKey(value) {
  return plainText(value, 200).toLowerCase().replace(/[\s\p{P}\p{S}\d]/gu, "");
}

function bigrams(value) {
  const clean = titleKey(value);
  const output = new Set();
  for (let index = 0; index < clean.length - 1; index += 1) output.add(clean.slice(index, index + 2));
  return output;
}

function titleSimilarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return titleKey(left) === titleKey(right) ? 1 : 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / Math.max(a.size, b.size);
}

function dedupeEvents(events) {
  const sorted = [...events].sort((left, right) =>
    new Date(right.publishedAt) - new Date(left.publishedAt) || right.importance - left.importance
  );
  const output = [];
  for (const event of sorted) {
    const duplicate = output.find((item) => titleSimilarity(item.title, event.title) >= 0.72);
    if (!duplicate) output.push(event);
    else if (!duplicate.alsoReportedBy?.includes(event.source)) {
      duplicate.alsoReportedBy = [...(duplicate.alsoReportedBy || []), event.source];
    }
  }
  return output;
}

function themePhase(activityScore, delta, sentimentCounts, count, latestAgeHours) {
  if (latestAgeHours > 14 || delta <= -15) return { key: "declining", label: "衰退" };
  const directionalCount = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.mixed;
  const conflicting = sentimentCounts.positive >= 2 &&
    sentimentCounts.negative >= 2 &&
    directionalCount >= 4 &&
    Math.min(sentimentCounts.positive, sentimentCounts.negative) / directionalCount >= 0.25;
  if (conflicting && count >= 4) {
    return { key: "diverging", label: "分化" };
  }
  if (activityScore >= 72 && delta < 8) return { key: "hot", label: "高热" };
  if (activityScore >= 45 || delta >= 8) return { key: "warming", label: "升温" };
  return { key: "emerging", label: "萌芽" };
}

function buildIntelligenceSnapshot(rawEvents, options = {}) {
  const now = new Date(options.asOf || Date.now());
  const nowMs = now.getTime();
  const previous = new Map((options.previousThemes || []).map((item) => [item.key, item]));
  const events = dedupeEvents(rawEvents
    .filter(Boolean)
    .map((item) => classifyEvent(item, nowMs))
    .filter((item) => nowMs - new Date(item.publishedAt).getTime() <= 72 * 3600000)
  ).slice(0, 80);
  const groups = new Map();
  for (const event of events) {
    if (!groups.has(event.themeKey)) groups.set(event.themeKey, []);
    groups.get(event.themeKey).push(event);
  }
  const themes = [...groups.entries()].map(([key, items]) => {
    const weighted = items.reduce((sum, item) => {
      const age = Math.max(0, (nowMs - new Date(item.publishedAt).getTime()) / 3600000);
      return sum + item.importance * Math.max(0.15, 1 - age / 36);
    }, 0);
    const averageWeightedImportance = weighted / Math.max(1, items.length);
    const recentCount = items.filter((item) => nowMs - new Date(item.publishedAt).getTime() <= 2 * 3600000).length;
    const activityScore = Math.round(Math.min(100,
      averageWeightedImportance * 0.58 +
      Math.min(28, items.length * 3.5) +
      Math.min(12, recentCount * 2.5)
    ));
    const previousScore = Number(previous.get(key)?.activityScore || 0);
    const delta = previous.has(key) ? activityScore - previousScore : 0;
    const sentimentCounts = {
      positive: items.filter((item) => item.sentiment === "positive").length,
      negative: items.filter((item) => item.sentiment === "negative").length,
      mixed: items.filter((item) => item.sentiment === "mixed").length
    };
    const latestAgeHours = Math.max(0, (nowMs - new Date(items[0].publishedAt).getTime()) / 3600000);
    const phase = themePhase(activityScore, delta, sentimentCounts, items.length, latestAgeHours);
    return {
      key,
      label: items[0].theme,
      phase,
      activityScore,
      delta,
      newsCount: items.length,
      latestAt: items[0].publishedAt,
      leadEventId: items[0].id,
      sentimentCounts,
      industryTerms: items[0].industryTerms,
      representatives: items[0].representatives,
      tags: [...new Set(items.flatMap((item) => item.tags))].slice(0, 6),
      reason: phase.key === "declining"
        ? "最新事件间隔拉长或热度较上次明显回落"
        : phase.key === "diverging"
          ? "正负事件同时出现，方向尚未形成一致"
          : phase.key === "hot"
            ? "事件密度和重要度均处于较高水平"
            : phase.key === "warming"
              ? "事件密度上升，需要结合板块量价继续确认"
              : "刚出现少量相关事件，先建立观察基线"
    };
  })
    .filter((theme) => theme.key !== "market-general")
    .sort((left, right) => right.activityScore - left.activityScore);
  return {
    asOf: now.toISOString(),
    summary: {
      eventCount: events.length,
      importantCount: events.filter((item) => item.importance >= 70).length,
      themeCount: themes.length,
      warmingCount: themes.filter((item) => ["warming", "hot"].includes(item.phase.key)).length
    },
    sourceStatus: options.sourceStatus || {},
    themes,
    events
  };
}

function attachMarketConfirmation(snapshot, hotspotSnapshot) {
  if (!hotspotSnapshot) {
    return {
      ...snapshot,
      themes: (snapshot.themes || []).map((theme) => ({
        ...theme,
        marketConfirmation: { key: "unavailable", label: "量价待验证", score: null, boards: [] }
      }))
    };
  }
  const boards = [];
  const seen = new Set();
  for (const board of [
    ...(hotspotSnapshot.composite || []),
    ...(hotspotSnapshot.todayFlow || []),
    ...(hotspotSnapshot.threeDayFlow || [])
  ]) {
    if (!board?.name || seen.has(board.name)) continue;
    seen.add(board.name);
    boards.push(board);
  }
  const themes = (snapshot.themes || []).map((theme) => {
    const definition = THEMES.find((item) => item.key === theme.key);
    const terms = [...new Set([
      ...(theme.tags || []),
      ...(theme.industryTerms || []),
      ...(definition?.keywords || [])
    ].map((item) => String(item).toUpperCase()).filter((item) => item.length >= 2))];
    const matched = boards.filter((board) => {
      const name = String(board.name || "").toUpperCase();
      return terms.some((term) => name.includes(term) || term.includes(name));
    }).slice(0, 4);
    if (!matched.length) {
      return {
        ...theme,
        marketConfirmation: { key: "unmatched", label: "暂无对应板块", score: null, boards: [] }
      };
    }
    const score = Math.round(matched.reduce((sum, board) => sum + Number(board.score || 0), 0) / matched.length);
    const advancing = matched.filter((board) => Number(board.changePercent || 0) > 0).length;
    const positiveFlow = matched.filter((board) => Number(board.todayNetFlow || board.netFlow3Day || 0) > 0).length;
    const confirmed = score >= 60 && advancing >= Math.ceil(matched.length / 2);
    const weak = score < 45 || advancing === 0;
    const marketConfirmation = {
      key: confirmed ? "confirmed" : weak ? "weak" : "mixed",
      label: confirmed ? "量价确认" : weak ? "量价偏弱" : "量价分化",
      score,
      boards: matched.map((board) => ({
        name: board.name,
        score: board.score,
        strength: board.strength,
        changePercent: board.changePercent,
        todayNetFlow: board.todayNetFlow,
        netFlow3Day: board.netFlow3Day
      })),
      positiveFlowCount: positiveFlow
    };
    let phase = theme.phase;
    let reason = theme.reason;
    if (["hot", "warming"].includes(phase?.key) && weak) {
      phase = { key: "diverging", label: "分化" };
      reason = "事件热度上升，但对应板块量价尚未确认";
    } else if (phase?.key === "warming" && confirmed && score >= 75) {
      phase = { key: "hot", label: "高热" };
      reason = "事件密度上升且对应板块量价同步走强";
    }
    return { ...theme, phase, reason, marketConfirmation };
  });
  return {
    ...snapshot,
    summary: {
      ...snapshot.summary,
      warmingCount: themes.filter((item) => ["warming", "hot"].includes(item.phase?.key)).length,
      confirmedCount: themes.filter((item) => item.marketConfirmation?.key === "confirmed").length
    },
    sourceStatus: {
      ...snapshot.sourceStatus,
      marketValidation: hotspotSnapshot.sourceStatus?.partial ? "部分板块数据" : "公开板块量价"
    },
    themes
  };
}

module.exports = {
  THEMES,
  attachMarketConfirmation,
  buildIntelligenceSnapshot,
  classifyEvent,
  dedupeEvents,
  parseSinaRoll,
  parseWallstreetLives,
  titleSimilarity
};
