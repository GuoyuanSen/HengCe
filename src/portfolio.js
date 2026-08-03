(function exposePortfolio(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HengCePortfolio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPortfolio() {
  function average(values) {
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  }

  function dailyReturns(bars) {
    const result = new Map();
    for (let index = 1; index < bars.length; index += 1) {
      const previous = bars[index - 1].close;
      if (previous > 0 && bars[index].close > 0) {
        result.set(bars[index].date, bars[index].close / previous - 1);
      }
    }
    return result;
  }

  function correlation(left, right) {
    if (left.length !== right.length || left.length < 3) return null;
    const leftMean = average(left);
    const rightMean = average(right);
    let covariance = 0;
    let leftVariance = 0;
    let rightVariance = 0;
    for (let index = 0; index < left.length; index += 1) {
      const leftDelta = left[index] - leftMean;
      const rightDelta = right[index] - rightMean;
      covariance += leftDelta * rightDelta;
      leftVariance += leftDelta ** 2;
      rightVariance += rightDelta ** 2;
    }
    const denominator = Math.sqrt(leftVariance * rightVariance);
    return denominator ? covariance / denominator : null;
  }

  function valueFor(container, key) {
    return container instanceof Map ? container.get(key) : container?.[key];
  }

  function buildPortfolioRisk(holdings, quotes, histories, profiles = {}) {
    const positions = holdings
      .map((holding) => {
        const quote = valueFor(quotes, holding.code);
        const bars = valueFor(histories, holding.code) || [];
        const profile = valueFor(profiles, holding.code) || {};
        return {
          code: holding.code,
          name: holding.name || quote?.name || holding.code,
          industry: profile.industry || "未分类",
          value: quote?.price > 0 ? quote.price * holding.shares : 0,
          returns: dailyReturns(bars)
        };
      })
      .filter((position) => position.value > 0);
    const totalValue = positions.reduce((sum, item) => sum + item.value, 0);
    positions.forEach((position) => {
      position.weight = totalValue ? position.value / totalValue : 0;
    });
    const commonDates = positions.length
      ? [...positions[0].returns.keys()].filter((date) =>
          positions.every((position) => position.returns.has(date))
        )
      : [];
    const portfolioReturns = commonDates.map((date) =>
      positions.reduce(
        (sum, position) => sum + position.weight * position.returns.get(date),
        0
      )
    );
    const mean = average(portfolioReturns);
    const variance = portfolioReturns.length > 1
      ? portfolioReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (portfolioReturns.length - 1)
      : 0;
    const annualizedVolatility = portfolioReturns.length >= 10
      ? Math.sqrt(variance) * Math.sqrt(252)
      : null;
    const correlations = [];
    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        const leftValues = commonDates.map((date) => positions[left].returns.get(date));
        const rightValues = commonDates.map((date) => positions[right].returns.get(date));
        const value = correlation(leftValues, rightValues);
        if (value != null) correlations.push(value);
      }
    }
    const concentration = positions.reduce(
      (sum, position) => sum + position.weight ** 2,
      0
    );
    const industries = new Map();
    positions.forEach((position) => {
      industries.set(
        position.industry,
        (industries.get(position.industry) || 0) + position.weight
      );
    });
    const maxWeight = Math.max(0, ...positions.map((position) => position.weight));
    const riskLevel =
      annualizedVolatility == null
        ? "等待数据"
        : annualizedVolatility > 0.45 || maxWeight > 0.5
          ? "较高"
          : annualizedVolatility > 0.28 || maxWeight > 0.35
            ? "中等"
            : "较低";
    return {
      totalValue,
      positionCount: positions.length,
      annualizedVolatility,
      averageCorrelation: correlations.length ? average(correlations) : null,
      maxWeight,
      diversificationScore: positions.length > 1
        ? Math.round((1 - concentration) * 100)
        : 0,
      riskLevel,
      sampleDays: commonDates.length,
      industries: [...industries.entries()]
        .map(([name, weight]) => ({ name, weight }))
        .sort((left, right) => right.weight - left.weight),
      positions
    };
  }

  return { buildPortfolioRisk, correlation, dailyReturns };
});
