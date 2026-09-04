(function exposeMarketRegime(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HengCeMarketRegime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMarketRegime() {
  function finite(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, minimum = 0, maximum = 100) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function buildMarketRegime(input = {}) {
    const breadth = input.breadth || {};
    const pools = input.limitPools || {};
    const hotspots = input.hotspotSummary || {};
    const compass = input.compassRegime || {};
    const advancingRate = finite(breadth.advancingRate);
    const limitUp = finite(pools.limitUpCount);
    const limitDown = finite(pools.limitDownCount);
    const broken = finite(pools.brokenBoardCount);
    const components = [];
    if (advancingRate != null) components.push({ key: "breadth", score: clamp(advancingRate * 100), weight: 45 });
    if (limitUp != null && limitDown != null && broken != null) {
      const denominator = Math.max(10, limitUp + limitDown + broken);
      components.push({
        key: "limits",
        score: clamp(50 + ((limitUp - limitDown - broken * 0.35) / denominator) * 50),
        weight: 30
      });
    }
    if (finite(hotspots.strongCount) != null) {
      components.push({ key: "themes", score: clamp((hotspots.strongCount / 18) * 100), weight: 15 });
    }
    if (finite(compass.score) != null) {
      components.push({ key: "global", score: clamp(50 + compass.score * 10), weight: 10 });
    }
    const weight = components.reduce((sum, item) => sum + item.weight, 0);
    let score = weight
      ? Math.round(components.reduce((sum, item) => sum + item.score * item.weight, 0) / weight)
      : null;
    const brokenRate = limitUp != null && broken != null && limitUp + broken > 0
      ? broken / (limitUp + broken)
      : null;
    const defensiveOverride =
      advancingRate != null && advancingRate < 0.42 &&
      ((limitDown != null && limitUp != null && limitDown > limitUp) || (brokenRate != null && brokenRate > 0.65));
    if (defensiveOverride && score != null) score = Math.min(score, 38);
    const regime = score == null
      ? { key: "waiting", label: "等待数据", tone: "neutral", positionCeiling: null }
      : score >= 65
        ? { key: "offensive", label: "进攻", tone: "positive", positionCeiling: 70 }
        : score >= 42
          ? { key: "balanced", label: "均衡", tone: "neutral", positionCeiling: 50 }
          : { key: "defensive", label: "防守", tone: "negative", positionCeiling: 30 };
    const confidence = components.length >= 4 ? "较高" : components.length >= 3 ? "中等" : "偏低";
    const signals = [
      advancingRate == null
        ? "上涨/下跌家数暂缺"
        : `上涨 ${breadth.upCount || 0} / 下跌 ${breadth.downCount || 0}，上涨占比 ${(advancingRate * 100).toFixed(1)}%`,
      [limitUp, limitDown, broken].some((value) => value == null)
        ? `涨跌停数据部分缺失（涨停 ${limitUp ?? "--"} / 跌停 ${limitDown ?? "--"} / 炸板 ${broken ?? "--"}）`
        : `涨停 ${limitUp} / 跌停 ${limitDown} / 炸板 ${broken}${brokenRate == null ? "" : `，炸板率 ${(brokenRate * 100).toFixed(1)}%`}`,
      finite(hotspots.strongCount) == null
        ? "热点扩散数据暂缺"
        : `强势板块 ${hotspots.strongCount} 个，市场状态 ${hotspots.marketTone || "等待判断"}`,
      finite(compass.score) == null
        ? "全球风险环境暂缺"
        : `全球与A股指数环境：${compass.label || "等待判断"}`
    ];
    return {
      asOf: input.asOf || new Date().toISOString(),
      score,
      regime,
      confidence,
      breadth,
      limitPools: { ...pools, brokenRate },
      components,
      signals,
      sourceStatus: input.sourceStatus || {},
      dataLimitations: [
        "仓位档位是市场环境上限参考，不代表必须持有该仓位",
        "涨跌家数使用沪深市场统计；接口失败时才使用行业成分汇总作为降级口径",
        "不包含个人现金需求、持仓相关性和单只股票事件风险"
      ]
    };
  }

  return { buildMarketRegime, clamp };
});
