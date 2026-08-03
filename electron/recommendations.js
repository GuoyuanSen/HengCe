function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
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
        pb: finiteNumber(item?.f23)
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

function recommendationFor(candidate, model) {
  const liquidityScore = clamp((Math.log10(candidate.amount) - 8) * 32 + 42);
  const valuationBonus =
    candidate.peDynamic > 0 && candidate.peDynamic <= 50 ? 2 : 0;
  const intradayPenalty = candidate.changePercent > 5 ? 5 : 0;
  const score = Math.round(
    clamp(model.score * 0.84 + liquidityScore * 0.16 + valuationBonus - intradayPenalty)
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

function buildRecommendationSnapshot(
  candidates,
  { asOf = new Date().toISOString(), candidatePool = candidates.length } = {}
) {
  const ranked = candidates
    .map(({ candidate, model }) => recommendationFor(candidate, model))
    .filter((item) => item.score >= 55)
    .sort(
      (left, right) =>
        right.score - left.score || right.amount - left.amount
    );
  return {
    asOf,
    summary: {
      candidatePool,
      scannedCount: candidates.length,
      qualifiedCount: ranked.length,
      leadingStock: ranked[0]?.name || "--"
    },
    recommendations: ranked.slice(0, 12)
  };
}

module.exports = {
  buildRecommendationSnapshot,
  isEligibleCode,
  isRiskName,
  parseCandidatePayload,
  recommendationFor
};
