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
          shares: Number(holding.shares || 0),
          cost: Number(holding.cost || 0),
          value: quote?.price > 0 ? quote.price * holding.shares : 0,
          costValue: holding.cost > 0 ? holding.cost * holding.shares : 0,
          currentPnl: quote?.price > 0 && holding.cost > 0
            ? (quote.price - holding.cost) * holding.shares
            : null,
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
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    const equityCurve = commonDates.map((date, index) => {
      equity *= 1 + portfolioReturns[index];
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak > 0 ? 1 - equity / peak : 0);
      return { date, value: equity };
    });
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
      const current = industries.get(position.industry) || {
        name: position.industry,
        weight: 0,
        value: 0,
        currentPnl: 0
      };
      current.weight += position.weight;
      current.value += position.value;
      current.currentPnl += Number(position.currentPnl || 0);
      industries.set(position.industry, current);
    });
    positions.forEach((position) => {
      const periodReturn = commonDates.reduce(
        (value, date) => value * (1 + position.returns.get(date)),
        1
      ) - 1;
      position.periodReturn = periodReturn;
      position.returnContribution = position.weight * periodReturn;
      const industry = industries.get(position.industry);
      industry.returnContribution = Number(industry.returnContribution || 0) + position.returnContribution;
    });
    const totalCurrentPnl = positions.reduce(
      (sum, position) => sum + Number(position.currentPnl || 0),
      0
    );
    const returnContributions = positions
      .map((position) => ({
        code: position.code,
        name: position.name,
        industry: position.industry,
        weight: position.weight,
        periodReturn: position.periodReturn,
        contribution: position.returnContribution,
        currentPnl: position.currentPnl,
        pnlShare: totalCurrentPnl === 0 || position.currentPnl == null
          ? null
          : position.currentPnl / Math.abs(totalCurrentPnl)
      }))
      .sort((left, right) => right.contribution - left.contribution);
    const maxWeight = Math.max(0, ...positions.map((position) => position.weight));
    const industryRows = [...industries.values()]
      .sort((left, right) => right.weight - left.weight);
    const maxIndustryWeight = industryRows[0]?.weight || 0;
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
      maxIndustryWeight,
      totalReturn: commonDates.length ? equity - 1 : null,
      maxDrawdown: commonDates.length ? maxDrawdown : null,
      equityCurve,
      totalCurrentPnl,
      returnContributions,
      diversificationScore: positions.length > 1
        ? Math.round((1 - concentration) * 100)
        : 0,
      riskLevel,
      sampleDays: commonDates.length,
      industries: industryRows,
      riskAlerts: [
        maxWeight > 0.4 ? "单只股票权重超过40%" : null,
        maxIndustryWeight > 0.55 ? "单一行业权重超过55%" : null,
        annualizedVolatility != null && annualizedVolatility > 0.4 ? "组合历史波动偏高" : null,
        commonDates.length && maxDrawdown > 0.18 ? "近120日代理回撤超过18%" : null
      ].filter(Boolean),
      positions
    };
  }

  return { buildPortfolioRisk, correlation, dailyReturns };
});
