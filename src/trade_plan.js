(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HengCeTradePlan = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function roundPrice(value) {
    return Math.round(value * 100) / 100;
  }

  function buildObservationPlan({ quote, model, valuation, settings = {} } = {}) {
    const price = finite(quote?.price);
    const support = finite(model?.support);
    const sma20 = finite(model?.sma20);
    const pressure = finite(model?.pressure);
    const riskLine = finite(model?.riskLine);
    const score = finite(model?.score);
    if (![price, support, sma20, pressure, riskLine, score].every(Number.isFinite)) {
      return {
        available: false,
        status: "数据不足",
        reason: "等待价格、均线、支撑压力与风险线完整后再生成计划"
      };
    }

    const atr = Math.max(finite(model?.atr14) || price * 0.015, price * 0.005);
    const center = Math.max(support, Math.min(sma20, price));
    let low = Math.max(riskLine, center - atr * 0.35);
    let high = Math.min(pressure - atr * 0.1, center + atr * 0.35);
    const valuationCap =
      valuation?.applicable &&
      finite(valuation?.fairRange?.base) > 0 &&
      finite(valuation?.confidence?.score) >= 55
        ? finite(valuation.fairRange.base)
        : null;
    if (valuationCap) high = Math.min(high, valuationCap);

    low = roundPrice(low);
    high = roundPrice(high);
    const breakout = roundPrice(pressure + atr * 0.1);
    const invalidation = roundPrice(riskLine);
    const zoneAvailable = score >= 55 && price > riskLine && high > low;
    const capital = Math.max(0, finite(settings.initialCapital) || 100000);
    const riskPercent = Math.max(0.1, finite(settings.riskPerTradePercent) || 0.75);
    const maxPositionPercent = Math.max(1, finite(settings.maxPositionPercent) || 25);
    const referenceEntry = zoneAvailable ? high : null;
    const riskPerShare = referenceEntry && referenceEntry > invalidation
      ? referenceEntry - invalidation
      : null;
    const riskBudget = capital * riskPercent / 100;
    const riskShares = riskPerShare ? Math.floor(riskBudget / riskPerShare / 100) * 100 : 0;
    const positionShares = referenceEntry
      ? Math.floor((capital * maxPositionPercent / 100) / referenceEntry / 100) * 100
      : 0;
    const suggestedShares = Math.max(0, Math.min(riskShares, positionShares));
    const positionValue = referenceEntry ? suggestedShares * referenceEntry : 0;
    const capitalAtRisk = riskPerShare ? suggestedShares * riskPerShare : 0;
    let status = "等待条件";
    let reason = "技术结构或估值约束暂未形成有效交集";
    if (score < 55) {
      reason = "综合评分低于观察门槛";
    } else if (price <= riskLine) {
      reason = "价格已触及模型失效位置";
    } else if (zoneAvailable && price >= low && price <= high) {
      status = "区间内观察";
      reason = "价格进入回踩观察区，仍需量能与趋势确认";
    } else if (zoneAvailable && price < low) {
      status = "等待企稳";
      reason = "价格低于观察区，先等待重新站稳";
    } else if (price >= breakout && finite(model?.volumeRatio) >= 1.2) {
      status = "突破待确认";
      reason = "价格与量能达到突破条件，避免盘中瞬时假突破";
    } else if (zoneAvailable) {
      status = "等待回踩";
      reason = "价格位于观察区上方、突破条件尚未完整确认";
    }

    return {
      available: zoneAvailable,
      status,
      reason,
      pullbackRange: zoneAvailable ? { low, high } : null,
      breakout,
      valuationCap: valuationCap ? roundPrice(valuationCap) : null,
      invalidation,
      riskPlan: zoneAvailable
        ? {
            capital,
            riskPercent,
            maxPositionPercent,
            riskBudget,
            referenceEntry,
            riskPerShare,
            suggestedShares,
            positionValue,
            positionPercent: capital ? positionValue / capital : 0,
            capitalAtRisk,
            executable: suggestedShares >= 100,
            note: suggestedShares >= 100
              ? "按观察区上沿和失效位估算，取风险预算、仓位上限两者较小值"
              : "按当前风险预算不足100股，应等待或调整研究资金基准"
          }
        : null,
      confidence: valuation?.confidence || null,
      method: "支撑与MA20构成回踩锚点，ATR控制区间宽度，压力位定义突破触发；仓位按风险预算与最大仓位双重约束"
    };
  }

  return { buildObservationPlan };
});
