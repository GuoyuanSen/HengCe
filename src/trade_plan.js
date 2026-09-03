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

  function buildObservationPlan({ quote, model, valuation } = {}) {
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
      confidence: valuation?.confidence || null,
      method: "支撑与MA20构成回踩锚点，ATR控制区间宽度，压力位定义突破触发，估值基准限制上沿"
    };
  }

  return { buildObservationPlan };
});
