const { isEligibleCode, isRiskName } = require("./recommendations.js");

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function scanWindow(now = new Date()) {
  const weekday = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (weekday === 0 || weekday === 6) {
    return { state: "closed", label: "非交易日", canScan: false, locked: true };
  }
  if (minutes < 14 * 60 + 30) {
    return { state: "waiting", label: "14:30 开始扫描", canScan: false, locked: false };
  }
  if (minutes < 14 * 60 + 40) {
    return { state: "scanning", label: "动态扫描中", canScan: true, locked: false };
  }
  if (minutes < 15 * 60) {
    return { state: "locked", label: "最终名单已锁定", canScan: false, locked: true };
  }
  return { state: "closed", label: "今日扫描已结束", canScan: false, locked: true };
}

function parseOvernightCandidatePayload(payload) {
  const rows = payload?.data?.diff;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => {
      const candidate = {
        code: String(item?.f12 || "").trim(),
        name: String(item?.f14 || "").trim(),
        price: finiteNumber(item?.f2),
        changePercent: finiteNumber(item?.f3),
        amount: finiteNumber(item?.f6),
        turnoverRate: finiteNumber(item?.f8),
        volumeRatio: finiteNumber(item?.f10),
        totalMarketCap: finiteNumber(item?.f20),
        floatMarketCap: finiteNumber(item?.f21),
        industry: String(item?.f100 || "未分类").trim() || "未分类"
      };
      if (
        !isEligibleCode(candidate.code) ||
        !candidate.name ||
        isRiskName(candidate.name) ||
        candidate.price == null ||
        candidate.price <= 0 ||
        candidate.changePercent == null ||
        candidate.changePercent < 3 ||
        candidate.changePercent > 5 ||
        candidate.volumeRatio == null ||
        candidate.volumeRatio < 1 ||
        candidate.turnoverRate == null ||
        candidate.turnoverRate < 5 ||
        candidate.turnoverRate > 10 ||
        candidate.floatMarketCap == null ||
        candidate.floatMarketCap <= 0 ||
        candidate.floatMarketCap > 30e9
      ) {
        return null;
      }
      return candidate;
    })
    .filter(Boolean);
}

function limitUpThreshold(code) {
  return /^(30|68)/.test(String(code || "")) ? 19.5 : 9.5;
}

function recentLimitUp(bars, code, lookback = 20) {
  const history = bars.slice(-(lookback + 1), -1);
  const threshold = limitUpThreshold(code);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const bar = history[index];
    if (Number(bar.percentChange) >= threshold) {
      return {
        found: true,
        date: bar.date,
        sessionsAgo: history.length - index
      };
    }
  }
  return { found: false, date: null, sessionsAgo: null };
}

function parseIntradayTrends(payload) {
  const rows = payload?.data?.trends;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const values = String(row).split(",");
      const price = finiteNumber(values[2]);
      const averagePrice = finiteNumber(values[7]);
      if (!values[0] || price == null || averagePrice == null || averagePrice <= 0) {
        return null;
      }
      return { time: values[0], price, averagePrice };
    })
    .filter(Boolean);
}

function intradayAverageState(points, minimumRatio = 0.95) {
  if (!points.length) {
    return { passes: false, aboveRatio: null, currentAbove: false, samples: 0 };
  }
  const aboveCount = points.filter((point) => point.price >= point.averagePrice).length;
  const latest = points.at(-1);
  const aboveRatio = aboveCount / points.length;
  return {
    passes: aboveRatio >= minimumRatio && latest.price >= latest.averagePrice,
    aboveRatio,
    currentAbove: latest.price >= latest.averagePrice,
    currentAveragePrice: latest.averagePrice,
    samples: points.length
  };
}

function overnightScore(candidate, intraday, limitUp) {
  const stability = (intraday.aboveRatio || 0) * 45;
  const volume = clamp((candidate.volumeRatio - 1) * 30, 0, 20);
  const turnover = clamp(15 - Math.abs(candidate.turnoverRate - 7.5) * 4, 0, 15);
  const recency = clamp(15 - Math.max(0, limitUp.sessionsAgo - 1) * 0.6, 4, 15);
  const change = clamp(10 - Math.abs(candidate.changePercent - 4) * 5, 0, 10);
  return Math.round(clamp(stability + volume + turnover + recency + change));
}

function validateOvernightProxy(bars, code, costs = {}) {
  const commissionRate = Number(costs.commissionRate || 0.00025);
  const stampDutyRate = Number(costs.stampDutyRate || 0.0005);
  const slippageRate = Number(costs.slippageRate || 0.0005);
  const values = [];
  for (let index = 21; index < bars.length - 1; index += 1) {
    const bar = bars[index];
    if (bar.percentChange < 3 || bar.percentChange > 5) continue;
    const prior = recentLimitUp(bars.slice(0, index + 1), code);
    if (!prior.found || !bar.close || !bars[index + 1]?.open) continue;
    const entry = bar.close * (1 + slippageRate);
    const exit = bars[index + 1].open * (1 - slippageRate);
    const grossReturn = exit / entry - 1;
    const netReturn = grossReturn - commissionRate * 2 - stampDutyRate;
    values.push(netReturn);
  }
  return {
    sampleCount: values.length,
    averageReturn: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    hitRate: values.length
      ? values.filter((value) => value > 0).length / values.length
      : null,
    worstReturn: values.length ? Math.min(...values) : null,
    method: "日线结构代理：当日收盘买入、次日开盘卖出，未复刻历史分时条件"
  };
}

function buildOvernightSnapshot(items, options = {}) {
  const ranked = items
    .filter((item) => item.limitUp?.found && item.intraday?.passes)
    .map((item) => ({
      ...item.candidate,
      limitUp: item.limitUp,
      intraday: item.intraday,
      validation: item.validation,
      score: overnightScore(item.candidate, item.intraday, item.limitUp)
    }))
    .sort((left, right) => right.score - left.score || right.amount - left.amount);
  const counts = new Map();
  const picks = [];
  for (const item of ranked) {
    const count = counts.get(item.industry) || 0;
    if (item.industry !== "未分类" && count >= 2) continue;
    picks.push(item);
    counts.set(item.industry, count + 1);
    if (picks.length >= 10) break;
  }
  return {
    asOf: options.asOf || new Date().toISOString(),
    window: options.window || scanWindow(),
    summary: {
      poolSize: options.poolSize || 0,
      prefilteredCount: options.prefilteredCount || items.length,
      checkedCount: items.length,
      qualifiedCount: ranked.length
    },
    rules: {
      changePercent: [3, 5],
      recentLimitUpSessions: 20,
      minimumVolumeRatio: 1,
      maximumFloatMarketCap: 30e9,
      turnoverRate: [5, 10],
      minimumAboveAverageRatio: 0.95
    },
    picks
  };
}

module.exports = {
  buildOvernightSnapshot,
  intradayAverageState,
  limitUpThreshold,
  parseIntradayTrends,
  parseOvernightCandidatePayload,
  recentLimitUp,
  scanWindow,
  validateOvernightProxy
};
