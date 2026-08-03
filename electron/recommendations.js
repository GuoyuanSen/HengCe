function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function factorBreakdown(candidate, model) {
  const trend = clamp(
    50 +
      (candidate.price > model.sma20 ? 18 : -18) +
      (model.sma5 > model.sma10 ? 14 : -10) +
      (candidate.price > model.sma60 ? 18 : -14)
  );
  const momentum = clamp(
    50 +
      clamp((model.momentum20 || 0) * 240, -25, 25) +
      (model.macdHistogram > 0 ? 12 : -12) +
      (model.rsi14 >= 48 && model.rsi14 <= 68 ? 13 : model.rsi14 > 75 ? -15 : 0)
  );
  const volume = clamp(50 + ((model.volumeRatio || 1) - 1) * 65);
  const liquidity = clamp((Math.log10(candidate.amount) - 8) * 32 + 42);
  const risk = clamp(100 - Math.max(0, (model.volatility || 0) - 0.12) * 145);
  const valuation =
    candidate.peDynamic > 0
      ? clamp(100 - Math.max(0, candidate.peDynamic - 18) * 1.7)
      : 45;
  return {
    trend: Math.round(trend),
    momentum: Math.round(momentum),
    volume: Math.round(volume),
    liquidity: Math.round(liquidity),
    risk: Math.round(risk),
    valuation: Math.round(valuation)
  };
}

function validateHistoricalSignals(bars, analyze, threshold = 55) {
  const horizons = [5, 10, 20];
  const samples = [];
  for (let index = 60; index < bars.length - 20; index += 5) {
    const model = analyze(bars.slice(0, index + 1));
    if (model.score < threshold || !bars[index + 1]?.open) continue;
    const entryPrice = bars[index + 1].open;
    const returns = Object.fromEntries(
      horizons.map((horizon) => [
        horizon,
        bars[index + horizon]?.close
          ? bars[index + horizon].close / entryPrice - 1
          : null
      ])
    );
    samples.push({ date: bars[index].date, returns });
  }
  const summarize = (horizon) => {
    const values = samples
      .map((sample) => sample.returns[horizon])
      .filter(Number.isFinite);
    return {
      averageReturn: values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null,
      hitRate: values.length
        ? values.filter((value) => value > 0).length / values.length
        : null,
      sampleCount: values.length
    };
  };
  return {
    signalCount: samples.length,
    fiveDay: summarize(5),
    tenDay: summarize(10),
    twentyDay: summarize(20)
  };
}

function isEligibleCode(code) {
  return /^(00|30|60|68)\d{4}$/.test(String(code || ""));
}

function isRiskName(name) {
  return /(?:^|\*)ST|退(?:市)?/iu.test(String(name || ""));
}

function parseCandidatePayload(payload) {
  const rows = payload?.data?.diff;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => {
      const code = String(item?.f12 || "").trim();
      const name = String(item?.f14 || "").trim();
      const candidate = {
        code,
        name,
        price: finiteNumber(item?.f2),
        changePercent: finiteNumber(item?.f3),
        amount: finiteNumber(item?.f6),
        turnoverRate: finiteNumber(item?.f8),
        peDynamic: finiteNumber(item?.f9),
        totalMarketCap: finiteNumber(item?.f20),
        floatMarketCap: finiteNumber(item?.f21),
        pb: finiteNumber(item?.f23),
        industry: String(item?.f100 || "未分类").trim() || "未分类"
      };
      if (
        !isEligibleCode(code) ||
        !name ||
        isRiskName(name) ||
        candidate.price == null ||
        candidate.price <= 0 ||
        candidate.amount == null ||
        candidate.amount < 1e8 ||
        candidate.turnoverRate == null ||
        candidate.turnoverRate < 0.2 ||
        candidate.turnoverRate > 20 ||
        candidate.changePercent == null ||
        candidate.changePercent < -5 ||
        candidate.changePercent > 8
      ) {
        return null;
      }
      return candidate;
    })
    .filter(Boolean);
}

function recommendationFor(candidate, model, validation = null) {
  const factors = factorBreakdown(candidate, model);
  const intradayPenalty = candidate.changePercent > 5 ? 5 : 0;
  const score = Math.round(
    clamp(
      factors.trend * 0.3 +
        factors.momentum * 0.2 +
        factors.volume * 0.15 +
        factors.liquidity * 0.1 +
        factors.risk * 0.15 +
        factors.valuation * 0.1 -
        intradayPenalty
    )
  );
  const risk =
    model.volatility > 0.5
      ? "较高"
      : model.volatility > 0.32
        ? "中等"
        : "较低";
  const reasons = model.positives.slice(0, 3);
  if (candidate.peDynamic > 0 && candidate.peDynamic <= 35) {
    reasons.push(`动态PE ${candidate.peDynamic.toFixed(1)} 倍`);
  }
  return {
    ...candidate,
    score,
    technicalScore: model.score,
    factors,
    validation,
    trend: model.trend,
    risk,
    rsi14: model.rsi14,
    momentum20: model.momentum20,
    volatility: model.volatility,
    support: model.support,
    pressure: model.pressure,
    riskLine: model.riskLine,
    reasons: reasons.slice(0, 3)
  };
}

function diversifyRecommendations(items, limit = 12, perIndustry = 2) {
  const counts = new Map();
  const selected = [];
  for (const item of items) {
    const industry = item.industry || "未分类";
    const count = counts.get(industry) || 0;
    if (industry !== "未分类" && count >= perIndustry) continue;
    selected.push(item);
    counts.set(industry, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

function buildRecommendationSnapshot(
  candidates,
  { asOf = new Date().toISOString(), candidatePool = candidates.length } = {}
) {
  const ranked = candidates
    .map(({ candidate, model, validation }) =>
      recommendationFor(candidate, model, validation)
    )
    .filter((item) => item.score >= 55)
    .sort(
      (left, right) =>
        right.score - left.score || right.amount - left.amount
    );
  const recommendations = diversifyRecommendations(ranked);
  return {
    asOf,
    summary: {
      candidatePool,
      scannedCount: candidates.length,
      qualifiedCount: ranked.length,
      leadingStock: ranked[0]?.name || "--"
    },
    diversification: { perIndustry: 2 },
    recommendations
  };
}

module.exports = {
  buildRecommendationSnapshot,
  diversifyRecommendations,
  factorBreakdown,
  isEligibleCode,
  isRiskName,
  parseCandidatePayload,
  recommendationFor,
  validateHistoricalSignals
};
