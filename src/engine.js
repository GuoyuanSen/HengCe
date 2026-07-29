(function exposeEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HengCeEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEngine() {
  function average(values) {
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  }

  function smaSeries(values, period) {
    const result = Array(values.length).fill(null);
    if (period <= 0) return result;
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
      sum += values[index];
      if (index >= period) sum -= values[index - period];
      if (index >= period - 1) result[index] = sum / period;
    }
    return result;
  }

  function emaSeries(values, period) {
    if (!values.length || period <= 0) return [];
    const multiplier = 2 / (period + 1);
    const output = [values[0]];
    for (let index = 1; index < values.length; index += 1) {
      output.push(
        values[index] * multiplier + output[index - 1] * (1 - multiplier)
      );
    }
    return output;
  }

  function rsiSeries(values, period = 14) {
    const result = Array(values.length).fill(null);
    if (values.length <= period) return result;
    let gains = 0;
    let losses = 0;
    for (let index = 1; index <= period; index += 1) {
      const change = values[index] - values[index - 1];
      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const value = () =>
      avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
    result[period] = value();
    for (let index = period + 1; index < values.length; index += 1) {
      const change = values[index] - values[index - 1];
      avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
      result[index] = value();
    }
    return result;
  }

  function trueRanges(bars) {
    if (!bars.length) return [];
    const result = [bars[0].high - bars[0].low];
    for (let index = 1; index < bars.length; index += 1) {
      result.push(
        Math.max(
          bars[index].high - bars[index].low,
          Math.abs(bars[index].high - bars[index - 1].close),
          Math.abs(bars[index].low - bars[index - 1].close)
        )
      );
    }
    return result;
  }

  function annualizedVolatility(values, period = 20) {
    const selected = values.slice(-(period + 1));
    if (selected.length < 3) return 0;
    const returns = selected.slice(1).map((value, index) =>
      selected[index] > 0 ? Math.log(value / selected[index]) : 0
    );
    const mean = average(returns);
    const variance =
      returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(1, returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252);
  }

  function analyze(bars) {
    if (bars.length < 60) {
      return {
        score: 0,
        trend: "等待数据",
        signal: "观察",
        summary: "至少需要60个交易日数据。",
        positives: [],
        risks: []
      };
    }

    const closes = bars.map((bar) => bar.close);
    const volumes = bars.map((bar) => bar.volume);
    const current = closes.at(-1);
    const sma5 = average(closes.slice(-5));
    const sma10 = average(closes.slice(-10));
    const sma20 = average(closes.slice(-20));
    const sma60 = average(closes.slice(-60));
    const rsi14 = rsiSeries(closes, 14).at(-1) ?? 50;
    const fast = emaSeries(closes, 12);
    const slow = emaSeries(closes, 26);
    const macdSeries = fast.map((value, index) => value - slow[index]);
    const signalSeries = emaSeries(macdSeries, 9);
    const macd = macdSeries.at(-1) ?? 0;
    const macdSignal = signalSeries.at(-1) ?? 0;
    const macdHistogram = macd - macdSignal;
    const atr14 = average(trueRanges(bars).slice(-14));
    const volume5 = average(volumes.slice(-5));
    const volume20 = average(volumes.slice(-20));
    const volumeRatio = volume20 > 0 ? volume5 / volume20 : 1;
    const momentum20 =
      closes.length > 20 ? current / closes[closes.length - 21] - 1 : 0;
    const volatility = annualizedVolatility(closes, 20);
    const recent = bars.slice(-10);
    const recentLow = Math.min(...recent.map((bar) => bar.low));
    const priorHigh = Math.max(...recent.slice(0, -1).map((bar) => bar.high));
    const support = Math.max(recentLow, Math.min(current, sma20 * 0.98));
    const pressure = Math.max(current, priorHigh);
    const riskLine = Math.max(recentLow * 0.985, current - 2 * atr14);

    let score = 50;
    const positives = [];
    const risks = [];
    if (current > sma20) {
      score += 12;
      positives.push("价格位于20日均线上方");
    } else {
      score -= 12;
      risks.push("尚未收复20日均线");
    }
    if (sma5 > sma10) {
      score += 8;
      positives.push("短期均线多头排列");
    } else {
      score -= 5;
      risks.push("5日均线仍弱于10日均线");
    }
    if (sma10 > sma20) {
      score += 8;
      positives.push("10日趋势强于20日趋势");
    }
    if (current > sma60) {
      score += 8;
      positives.push("价格站上60日均线");
    } else {
      score -= 6;
      risks.push("中期仍受60日均线压制");
    }
    if (macdHistogram > 0) {
      score += 8;
      positives.push("MACD动能转正");
    } else {
      score -= 6;
      risks.push("MACD动能仍为负");
    }
    if (rsi14 >= 48 && rsi14 <= 68) {
      score += 7;
      positives.push("RSI处于健康强势区");
    } else if (rsi14 > 75) {
      score -= 6;
      risks.push("RSI偏热，追高风险增加");
    } else if (rsi14 < 35) {
      score -= 5;
      risks.push("RSI偏弱，承接尚未稳定");
    }
    if (volumeRatio >= 1.15) {
      score += 7;
      positives.push("近5日量能高于20日均量");
    } else if (volumeRatio < 0.75) {
      score -= 4;
      risks.push("量能不足，信号可信度下降");
    }
    if (momentum20 > 0.08) {
      score += 6;
      positives.push("20日动量较强");
    } else if (momentum20 < -0.08) {
      score -= 6;
      risks.push("20日动量仍偏弱");
    }
    if (volatility > 0.55) {
      score -= 5;
      risks.push("波动率较高，需缩小仓位");
    }
    score = Math.min(100, Math.max(0, score));

    let trend = "弱势";
    let signal = "回避追高";
    if (score >= 75) {
      trend = "强势";
      signal = "顺势观察";
    } else if (score >= 60) {
      trend = "修复";
      signal = "等待确认";
    } else if (score >= 42) {
      trend = "震荡";
      signal = "控制仓位";
    }

    let summary;
    if (score >= 75) {
      summary = `趋势占优。放量站稳 ${pressure.toFixed(2)} 可继续观察，跌破 ${riskLine.toFixed(2)} 应优先控制风险。`;
    } else if (score >= 60) {
      summary = `处于修复段。先确认能否守住 ${sma20.toFixed(2)}，不宜在压力位 ${pressure.toFixed(2)} 附近追高。`;
    } else {
      summary = `结构仍弱。未重新站稳 ${sma20.toFixed(2)} 前以防守为主，${riskLine.toFixed(2)} 是模型风险线。`;
    }

    return {
      score,
      trend,
      signal,
      summary,
      sma5,
      sma10,
      sma20,
      sma60,
      rsi14,
      macd,
      macdSignal,
      macdHistogram,
      atr14,
      volumeRatio,
      volatility,
      momentum20,
      support,
      pressure,
      riskLine,
      positives: positives.slice(0, 4),
      risks: risks.slice(0, 4)
    };
  }

  function runBacktest(bars, strategy = "movingAverage", settings = {}) {
    const config = {
      initialCapital: 100000,
      commissionRate: 0.00025,
      stampDutyRate: 0.0005,
      slippageRate: 0.0005,
      fastPeriod: 10,
      slowPeriod: 30,
      breakoutPeriod: 20,
      stopLossPercent: 8,
      ...settings
    };
    if (bars.length < 80) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        benchmarkReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        tradeCount: 0,
        equityCurve: [],
        trades: []
      };
    }

    const closes = bars.map((bar) => bar.close);
    const fastMA = smaSeries(closes, Math.max(2, config.fastPeriod));
    const slowMA = smaSeries(
      closes,
      Math.max(config.fastPeriod + 1, config.slowPeriod)
    );
    const rsi = rsiSeries(closes, 14);
    const ranges = trueRanges(bars);
    let cash = config.initialCapital;
    let shares = 0;
    let entryPrice = 0;
    let entryCost = 0;
    let entryDate = null;
    let pendingBuy = false;
    let pendingSell = false;
    const equityCurve = [];
    const trades = [];
    const start = Math.max(60, config.slowPeriod + 2);

    const shouldEnter = (index) => {
      if (strategy === "movingAverage") {
        return (
          fastMA[index] != null &&
          slowMA[index] != null &&
          fastMA[index - 1] != null &&
          slowMA[index - 1] != null &&
          fastMA[index] > slowMA[index] &&
          fastMA[index - 1] <= slowMA[index - 1]
        );
      }
      if (strategy === "breakout") {
        const period = Math.max(10, config.breakoutPeriod);
        if (index < period) return false;
        const priorHigh = Math.max(
          ...bars.slice(index - period, index).map((bar) => bar.high)
        );
        const rangeWindow = ranges.slice(Math.max(0, index - 14), index + 1);
        return (
          bars[index].close > priorHigh &&
          bars[index].high - bars[index].low >= average(rangeWindow) * 0.8
        );
      }
      return (
        rsi[index] > 35 &&
        rsi[index - 1] <= 35 &&
        bars[index].close > bars[index - 1].close
      );
    };

    const shouldExit = (index) => {
      if (strategy === "movingAverage") {
        return fastMA[index] != null && slowMA[index] != null &&
          fastMA[index] < slowMA[index];
      }
      if (strategy === "breakout") {
        const exitMA = average(closes.slice(Math.max(0, index - 9), index + 1));
        return bars[index].close < exitMA;
      }
      return (rsi[index] ?? 0) >= 65;
    };

    for (let index = start; index < bars.length; index += 1) {
      const bar = bars[index];
      if (pendingSell && shares > 0) {
        const exitPrice = bar.open * (1 - config.slippageRate);
        const gross = exitPrice * shares;
        const fee = Math.max(5, gross * config.commissionRate);
        const stamp = gross * config.stampDutyRate;
        const profit = gross - fee - stamp - entryCost;
        cash += gross - fee - stamp;
        trades.push({
          entryDate,
          exitDate: bar.date,
          entryPrice,
          exitPrice,
          shares,
          profit,
          returnPercent: profit / entryCost
        });
        shares = 0;
        entryPrice = 0;
        entryCost = 0;
        entryDate = null;
        pendingSell = false;
      }
      if (pendingBuy && shares === 0) {
        const executionPrice = bar.open * (1 + config.slippageRate);
        const estimatedFee = Math.max(5, cash * config.commissionRate);
        shares = Math.floor((cash - estimatedFee) / executionPrice / 100) * 100;
        if (shares > 0) {
          const gross = executionPrice * shares;
          const fee = Math.max(5, gross * config.commissionRate);
          cash -= gross + fee;
          entryPrice = executionPrice;
          entryCost = gross + fee;
          entryDate = bar.date;
        }
        pendingBuy = false;
      }

      const stop = shares > 0 &&
        bar.close <= entryPrice * (1 - config.stopLossPercent / 100);
      if (shares > 0) pendingSell = stop || shouldExit(index);
      else pendingBuy = shouldEnter(index);
      equityCurve.push({ date: bar.date, value: cash + shares * bar.close });
    }

    const first = equityCurve[0];
    const last = equityCurve.at(-1);
    const totalReturn = last.value / config.initialCapital - 1;
    const days = Math.max(
      1,
      (new Date(last.date) - new Date(first.date)) / 86400000
    );
    const annualizedReturn = (1 + totalReturn) ** (365 / days) - 1;
    const benchmarkReturn = bars.at(-1).close / bars[start].open - 1;
    let peak = first.value;
    let maxDrawdown = 0;
    for (const point of equityCurve) {
      peak = Math.max(peak, point.value);
      maxDrawdown = Math.max(maxDrawdown, (peak - point.value) / peak);
    }
    const returns = equityCurve.slice(1).map(
      (point, index) => point.value / equityCurve[index].value - 1
    );
    const mean = average(returns);
    const variance = average(returns.map((value) => (value - mean) ** 2));
    const deviation = Math.sqrt(variance);
    const sharpeRatio = deviation > 0 ? (mean / deviation) * Math.sqrt(252) : 0;
    const wins = trades.filter((trade) => trade.profit > 0).length;
    const markPrice = shares > 0 ? bars.at(-1).close : 0;
    const unrealizedProfit = shares > 0 ? markPrice * shares - entryCost : 0;

    return {
      totalReturn,
      annualizedReturn,
      benchmarkReturn,
      maxDrawdown,
      sharpeRatio,
      winRate: trades.length ? wins / trades.length : 0,
      tradeCount: trades.length,
      equityCurve,
      trades,
      openPosition: shares > 0
        ? {
            entryDate,
            entryPrice,
            shares,
            markPrice,
            unrealizedProfit,
            returnPercent: unrealizedProfit / entryCost
          }
        : null
    };
  }

  return {
    analyze,
    runBacktest,
    smaSeries,
    rsiSeries,
    trueRanges
  };
});
