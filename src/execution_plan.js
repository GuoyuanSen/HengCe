(function exposeExecutionPlan(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HengCeExecutionPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createExecutionPlan() {
  const PLAN_HORIZONS = [1, 3, 5, 10];

  function finite(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function roundPrice(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function validDate(value) {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
  }

  function dateKey(value) {
    const date = validDate(value);
    return date ? date.slice(0, 10) : "";
  }

  function sizeExecutionPlan(plan = {}, settings = {}, existingValue = 0) {
    const entry = finite(plan.range?.high);
    const invalidation = finite(plan.invalidation);
    const capital = finite(settings.initialCapital);
    if (!(entry > 0) || !(invalidation > 0) || !(entry > invalidation) || !(capital > 0)) return null;
    const riskPercent = Math.max(0.1, finite(settings.riskPerTradePercent) || 0.75);
    const maxPositionPercent = Math.max(1, finite(settings.maxPositionPercent) || 25);
    const riskPerShare = entry - invalidation;
    const riskBudget = capital * riskPercent / 100;
    const maxPositionValue = capital * maxPositionPercent / 100;
    const remainingPositionValue = Math.max(0, maxPositionValue - Math.max(0, finite(existingValue) || 0));
    const riskShares = Math.floor(riskBudget / riskPerShare / 100) * 100;
    const positionShares = Math.floor(remainingPositionValue / entry / 100) * 100;
    const suggestedShares = Math.max(0, Math.min(riskShares, positionShares));
    return {
      capital,
      riskPercent,
      maxPositionPercent,
      riskBudget,
      maxPositionValue,
      remainingPositionValue,
      riskPerShare,
      suggestedShares,
      positionValue: suggestedShares * entry,
      capitalAtRisk: suggestedShares * riskPerShare,
      executable: suggestedShares >= 100
    };
  }

  function buildSwingExecutionPlan(value = {}, settings = {}) {
    const price = finite(value.price);
    const support = finite(value.support);
    const sma20 = finite(value.sma20);
    const pressure = finite(value.pressure);
    const invalidation = finite(value.riskLine ?? value.invalidation);
    const score = finite(value.score);
    if (![price, support, sma20, pressure, invalidation, score].every(Number.isFinite)) {
      return {
        version: "swing-v1",
        horizon: "swing",
        generatedBy: "quant",
        available: false,
        actionable: false,
        status: "insufficient",
        label: "数据不足",
        reason: "价格、MA20、支撑、压力或风险线尚未完整"
      };
    }
    const atr = Math.max(finite(value.atr14) || price * 0.015, price * 0.005);
    const center = Math.max(support, Math.min(sma20, price));
    const low = roundPrice(Math.max(invalidation, center - atr * 0.35));
    const high = roundPrice(Math.min(pressure - atr * 0.1, center + atr * 0.35));
    const breakout = roundPrice(pressure + atr * 0.1);
    const chaseCap = roundPrice(breakout + atr * 0.25);
    const rangeAvailable = score >= 55 && price > invalidation && high > low;
    const referenceEntry = rangeAvailable ? (low + high) / 2 : null;
    const riskPerShare = referenceEntry != null ? referenceEntry - invalidation : null;
    const target = riskPerShare > 0 ? roundPrice(Math.max(pressure, referenceEntry + riskPerShare * 2)) : null;
    const rewardRisk = riskPerShare > 0 && target != null ? (target - referenceEntry) / riskPerShare : null;
    let status = "wait-pullback";
    let label = "等待回踩";
    let tone = "neutral";
    let reason = "现价位于回踩区上方，突破条件尚未完整确认";
    if (score < 55) {
      status = "low-score";
      label = "评分不足";
      tone = "negative";
      reason = "综合评分低于观察门槛，不生成可执行区间";
    } else if (price <= invalidation) {
      status = "invalid";
      label = "结构失效";
      tone = "negative";
      reason = "现价已触及或跌破量化风险线";
    } else if (!rangeAvailable) {
      status = "no-range";
      label = "等待结构形成";
      tone = "warning";
      reason = "支撑、压力与波动区间暂未形成有效交集";
    } else if (price > chaseCap) {
      status = "overextended";
      label = "价格偏高";
      tone = "warning";
      reason = "现价超过量化不追高上限，等待回落或重新计算";
    } else if (price >= low && price <= high) {
      status = "in-zone";
      label = "进入观察区";
      tone = "positive";
      reason = "价格进入回踩观察区，仍需收盘结构与量能确认";
    } else if (price < low) {
      status = "wait-stabilize";
      label = "等待企稳";
      tone = "warning";
      reason = "价格低于观察区，先确认重新站稳而不是抄底";
    } else if (price >= breakout && finite(value.volumeRatio) >= 1.2) {
      status = "breakout";
      label = "突破待确认";
      tone = "positive";
      reason = "价格和量能达到突破条件，等待收盘确认避免瞬时假突破";
    }
    const plan = {
      version: "swing-v1",
      horizon: "swing",
      generatedBy: "quant",
      available: rangeAvailable,
      actionable: ["in-zone", "breakout"].includes(status),
      status,
      label,
      tone,
      reason,
      price: roundPrice(price),
      range: rangeAvailable ? { low, high } : null,
      breakout,
      chaseCap,
      invalidation: roundPrice(invalidation),
      target,
      rewardRisk,
      atr: roundPrice(atr),
      entryMode: "range-touch",
      method: "支撑与MA20确定回踩锚点，ATR控制宽度，压力位定义突破，不追高上限和风险线约束执行"
    };
    return { ...plan, sizing: sizeExecutionPlan(plan, settings) };
  }

  function buildOvernightExecutionPlan(value = {}) {
    const price = finite(value.price);
    const changePercent = finite(value.changePercent);
    const averagePrice = finite(value.intraday?.currentAveragePrice ?? value.currentAveragePrice);
    const aboveRatio = finite(value.intraday?.aboveRatio ?? value.aboveRatio);
    if (!(price > 0) || changePercent == null || !(averagePrice > 0)) {
      return {
        version: "overnight-v1",
        horizon: "overnight",
        generatedBy: "quant",
        available: false,
        actionable: false,
        status: "insufficient",
        label: "区间待计算",
        reason: "现价、涨幅或分时均价不完整"
      };
    }
    const previousClose = price / (1 + changePercent / 100);
    const chaseCap = roundPrice(previousClose * 1.05);
    const low = roundPrice(Math.max(averagePrice, price * 0.995));
    const high = roundPrice(Math.min(price * 1.003, chaseCap));
    const invalidation = roundPrice(Math.max(averagePrice, previousClose * 1.03));
    const capDistance = chaseCap / price - 1;
    const currentAbove = value.intraday?.currentAbove !== false && price >= averagePrice;
    const rulesPass = changePercent >= 3 && changePercent <= 5 && currentAbove && aboveRatio >= 0.95;
    const rangeAvailable = rulesPass && high - low >= 0.01;
    let status = "in-zone";
    let label = "区间内观察";
    let tone = "positive";
    let reason = "现价位于分时均价上方且距离策略涨幅上限仍有空间";
    if (!rulesPass) {
      status = "invalid";
      label = "条件失效";
      tone = "negative";
      reason = "涨幅或分时均价条件已不再满足尾盘规则";
    } else if (capDistance <= 0.0015 || high <= low) {
      status = "no-chase";
      label = "接近上限不追";
      tone = "warning";
      reason = "现价已逼近5%策略上限，剩余区间不足以覆盖追价风险";
    }
    return {
      version: "overnight-v1",
      horizon: "overnight",
      generatedBy: "quant",
      available: rangeAvailable,
      actionable: status === "in-zone" && rangeAvailable,
      status,
      label,
      tone,
      reason,
      price: roundPrice(price),
      range: rangeAvailable ? { low, high } : null,
      averagePrice: roundPrice(averagePrice),
      chaseCap,
      invalidation,
      previousClose: roundPrice(previousClose),
      capDistance,
      entryMode: "signal-price",
      exitRule: "次一交易日开盘后半小时内完成退出",
      abandonConditions: ["跌破分时均价", "涨幅回落至3%以下", "现价逼近或超过5%策略上限"],
      method: "分时均价和现价回撤带确定下沿，现价微幅容忍与5%策略上限共同确定上沿"
    };
  }

  function distanceToExecutionPlan(plan = {}, rawPrice) {
    const price = finite(rawPrice ?? plan.price);
    const low = finite(plan.range?.low);
    const high = finite(plan.range?.high);
    const breakout = finite(plan.breakout);
    const invalidation = finite(plan.invalidation);
    if (!(price > 0)) return { state: "unknown", distanceRatio: null, label: "等待现价" };
    let state = "unavailable";
    let distanceRatio = null;
    let label = "区间不可用";
    if (low != null && high != null) {
      if (price < low) {
        state = "below";
        distanceRatio = (low - price) / price;
        label = `距观察区下沿 ${(distanceRatio * 100).toFixed(2)}%`;
      } else if (price > high) {
        state = "above";
        distanceRatio = (price - high) / price;
        label = `高于观察区上沿 ${(distanceRatio * 100).toFixed(2)}%`;
      } else {
        state = "inside";
        distanceRatio = 0;
        label = "现价已进入观察区";
      }
    }
    return {
      state,
      distanceRatio,
      label,
      toBreakout: breakout != null ? (breakout - price) / price : null,
      toInvalidation: invalidation != null ? (price - invalidation) / price : null
    };
  }

  function watchPlanState(item = {}, data = {}) {
    const price = finite(data.quote?.price);
    const model = data.model || {};
    const plan = item.executionPlan || buildSwingExecutionPlan({
      price,
      score: model.score,
      support: model.support,
      sma20: model.sma20,
      pressure: item.pressure ?? model.pressure,
      riskLine: item.riskLine ?? model.riskLine,
      atr14: model.atr14,
      volumeRatio: model.volumeRatio
    });
    if (!(price > 0)) return { key: "waiting", label: "等待行情", tone: "neutral", actionable: false, notify: false, detail: "尚未取得最新报价", plan };
    const distance = distanceToExecutionPlan(plan, price);
    const invalidation = finite(plan.invalidation ?? item.riskLine);
    const breakout = finite(plan.breakout ?? item.pressure);
    if (invalidation != null && price <= invalidation) {
      return { key: "invalid", label: "跌破失效位", tone: "negative", actionable: true, notify: true, detail: `现价 ${price.toFixed(2)} ≤ ${invalidation.toFixed(2)}`, distance, plan };
    }
    if (distance.state === "inside") {
      return { key: "in-zone", label: "进入观察区", tone: "positive", actionable: true, notify: true, detail: `${plan.range.low.toFixed(2)}–${plan.range.high.toFixed(2)}`, distance, plan };
    }
    if (breakout != null && price >= breakout && finite(model.volumeRatio) >= 1.2) {
      return { key: "breakout", label: "突破待确认", tone: "positive", actionable: true, notify: true, detail: `现价站上 ${breakout.toFixed(2)} · 量比 ${finite(model.volumeRatio).toFixed(2)}`, distance, plan };
    }
    if (["above", "below"].includes(distance.state) && distance.distanceRatio != null && distance.distanceRatio <= 0.01) {
      return { key: `near-${distance.state}`, label: "接近观察区", tone: "warning", actionable: true, notify: true, detail: distance.label, distance, plan };
    }
    if (finite(plan.chaseCap) != null && price > plan.chaseCap) {
      return { key: "overextended", label: "价格偏高", tone: "warning", actionable: false, notify: false, detail: `超过不追高上限 ${plan.chaseCap.toFixed(2)}`, distance, plan };
    }
    const scoreChange = finite(model.score) - (finite(item.baselineScore) ?? finite(model.score));
    if (scoreChange >= 10) return { key: "score-up", label: "评分明显提升", tone: "positive", actionable: true, notify: true, detail: `较加入时 +${Math.round(scoreChange)} 分`, distance, plan };
    if (scoreChange <= -10) return { key: "score-down", label: "评分明显下降", tone: "negative", actionable: true, notify: true, detail: `较加入时 ${Math.round(scoreChange)} 分`, distance, plan };
    return { key: "watching", label: "观察中", tone: "neutral", actionable: false, notify: false, detail: distance.label, distance, plan };
  }

  function mapValue(container, key) {
    return container instanceof Map ? container.get(key) : container?.[key];
  }

  function evaluatePortfolioConstraint(candidate = {}, context = {}) {
    const holdings = Array.isArray(context.holdings) ? context.holdings : [];
    const quotes = context.quotes || {};
    const profiles = context.profiles || {};
    const settings = context.settings || {};
    const capital = Math.max(1, finite(settings.initialCapital) || 100000);
    const maxPositionPercent = Math.max(1, finite(settings.maxPositionPercent) || 25);
    const code = String(candidate.code || "");
    const industry = String(candidate.industry || "未分类");
    let currentStockValue = 0;
    let currentIndustryValue = 0;
    holdings.forEach((holding) => {
      const quote = mapValue(quotes, holding.code);
      const profile = mapValue(profiles, holding.code) || {};
      const value = (finite(quote?.price) || finite(holding.cost) || 0) * Math.max(0, finite(holding.shares) || 0);
      if (holding.code === code) currentStockValue += value;
      if ((profile.industry || holding.industry || "未分类") === industry) currentIndustryValue += value;
    });
    const plan = candidate.executionPlan || {};
    const sizing = sizeExecutionPlan(plan, settings, currentStockValue);
    const proposedValue = sizing?.positionValue || 0;
    const projectedStockWeight = (currentStockValue + proposedValue) / capital;
    const projectedIndustryWeight = (currentIndustryValue + proposedValue) / capital;
    const reasons = [];
    let status = "clear";
    let label = "组合约束通过";
    if (currentStockValue / capital >= maxPositionPercent / 100 || (sizing && !sizing.executable)) {
      status = "blocked";
      label = "单股仓位已满";
      reasons.push(`当前或计划后单股仓位达到 ${maxPositionPercent}% 上限`);
    } else {
      if (currentStockValue > 0) reasons.push("已有持仓，新增前需合并计算成本与风险");
      if (projectedIndustryWeight > 0.55) reasons.push(`计划后行业暴露约 ${(projectedIndustryWeight * 100).toFixed(1)}%`);
      if (context.portfolioRisk?.riskLevel === "较高") reasons.push("当前组合风险等级较高");
      if (context.breadth?.regime?.key === "defensive") reasons.push(`市场处于${context.breadth.regime.label}档位`);
      if (reasons.length) {
        status = "caution";
        label = currentStockValue > 0 ? "已有持仓需合并" : "组合约束需确认";
      }
    }
    return {
      status,
      label,
      reasons,
      currentStockValue,
      currentIndustryValue,
      projectedStockWeight,
      projectedIndustryWeight,
      suggestedShares: sizing?.suggestedShares || 0,
      sizing
    };
  }

  function evaluateCatalystRisk(code, events, { now = new Date(), horizonDays = 5, loaded = true } = {}) {
    if (!loaded) return { status: "unknown", label: "事件待核对", events: [], nearestDays: null };
    const current = now instanceof Date ? now.getTime() : Date.parse(now);
    const rows = (Array.isArray(events) ? events : [])
      .filter((event) => !event.code || event.code === code)
      .map((event) => ({ ...event, days: Math.ceil((Date.parse(event.scheduledAt) - current) / 86400000) }))
      .filter((event) => Number.isFinite(event.days) && event.days >= 0 && event.days <= horizonDays)
      .sort((left, right) => left.days - right.days);
    if (!rows.length) return { status: "clear", label: `${horizonDays}日内无事件`, events: [], nearestDays: null };
    const highRisk = rows.some((event) => event.impact === "negative" && event.days <= 3);
    return {
      status: highRisk ? "risk" : "caution",
      label: highRisk ? "临近风险事件" : "临近催化事件",
      events: rows,
      nearestDays: rows[0].days,
      detail: `${rows[0].days === 0 ? "今天" : `${rows[0].days}天后`} · ${rows[0].title}`
    };
  }

  function rankingRows(snapshot) {
    if (Array.isArray(snapshot)) return snapshot;
    if (Array.isArray(snapshot?.rows)) return snapshot.rows;
    return Array.isArray(snapshot?.recommendations) ? snapshot.recommendations : [];
  }

  function compareRecommendationRanks(current, previous) {
    const currentRows = rankingRows(current);
    const previousRows = rankingRows(previous);
    const hasBaseline = previousRows.length > 0;
    const previousByCode = new Map(previousRows.map((item, index) => [item.code, { rank: item.rank || index + 1, score: finite(item.score) }]));
    return currentRows.map((item, index) => {
      const rank = index + 1;
      const prior = previousByCode.get(item.code);
      const rankChange = prior ? prior.rank - rank : null;
      const scoreChange = prior && finite(item.score) != null && prior.score != null ? finite(item.score) - prior.score : null;
      const rankState = !hasBaseline ? "baseline" : !prior ? "new" : rankChange > 0 ? "up" : rankChange < 0 ? "down" : "flat";
      return {
        ...item,
        rank,
        previousRank: prior?.rank || null,
        rankChange,
        scoreChange,
        rankState,
        rankLabel: rankState === "baseline" ? "建立基线" : rankState === "new" ? "新入选" : rankState === "up" ? `上升${rankChange}` : rankState === "down" ? `下降${Math.abs(rankChange)}` : "持平"
      };
    });
  }

  function compactRankingSnapshot(snapshot = {}) {
    return {
      asOf: validDate(snapshot.asOf) || new Date().toISOString(),
      rows: rankingRows(snapshot).slice(0, 20).map((item, index) => ({
        code: String(item.code || ""),
        name: String(item.name || item.code || "").slice(0, 40),
        industry: String(item.industry || "未分类").slice(0, 60),
        rank: index + 1,
        score: finite(item.score),
        price: finite(item.price)
      })).filter((item) => /^\d{6}$/.test(item.code))
    };
  }

  function recordRankingSnapshot(history, snapshot, { limit = 24, mergeMinutes = 5 } = {}) {
    const current = compactRankingSnapshot(snapshot);
    const rows = Array.isArray(history) ? history.map(compactRankingSnapshot) : [];
    const latest = rows[0];
    const minutes = latest ? (Date.parse(current.asOf) - Date.parse(latest.asOf)) / 60000 : Number.POSITIVE_INFINITY;
    return (minutes >= 0 && minutes <= mergeMinutes ? [current, ...rows.slice(1)] : [current, ...rows]).slice(0, limit);
  }

  function executionFillPrice(bar, range) {
    const open = finite(bar?.open);
    if (!(open > 0)) return null;
    if (open < range.low) return range.low;
    if (open > range.high) return range.high;
    return open;
  }

  function settleExecutionPlan(signal = {}, stockBars = [], costs = {}) {
    const plan = signal.executionPlan;
    if (!plan || !dateKey(signal.signalAt)) return null;
    if (plan.horizon === "overnight" || plan.entryMode === "signal-price") {
      return {
        status: "external",
        validation: "overnight-forward-journal",
        touchDate: dateKey(signal.signalAt),
        entryPrice: finite(signal.price),
        outcomes: {}
      };
    }
    const bars = (Array.isArray(stockBars) ? stockBars : [])
      .filter((bar) => bar?.date && finite(bar.open) > 0 && finite(bar.close) > 0)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));
    const signalDate = dateKey(signal.signalAt);
    const futureStart = bars.findIndex((bar) => String(bar.date) > signalDate);
    const low = finite(plan.range?.low);
    const high = finite(plan.range?.high);
    const invalidation = finite(plan.invalidation);
    if (!(low > 0) || !(high >= low) || futureStart < 0) return { status: "tracking", touchDate: null, entryPrice: null, outcomes: {} };
    const available = bars.slice(futureStart, futureStart + 10);
    for (let offset = 0; offset < available.length; offset += 1) {
      const bar = available[offset];
      const barLow = finite(bar.low);
      const barHigh = finite(bar.high);
      const touchesRange = barLow != null && barHigh != null && barLow <= high && barHigh >= low;
      const touchesInvalidation = invalidation != null && barLow != null && barLow <= invalidation;
      if (touchesRange && touchesInvalidation) {
        return {
          status: "ambiguous",
          touchDate: String(bar.date),
          entryPrice: null,
          outcomes: {},
          invalidatedAt: String(bar.date),
          reason: "同一交易日同时触及观察区与失效位，日线无法判断先后"
        };
      }
      if (touchesInvalidation) {
        return { status: "invalidated", touchDate: null, entryPrice: null, outcomes: {}, invalidatedAt: String(bar.date) };
      }
      if (touchesRange) {
        return planOutcomeFromEntry(plan, bars, futureStart + offset, String(bar.date), executionFillPrice(bar, { low, high }), costs, offset + 1);
      }
    }
    return {
      status: available.length >= 10 ? "missed" : "tracking",
      touchDate: null,
      entryPrice: null,
      daysToTouch: null,
      outcomes: {}
    };
  }

  function planOutcomeFromEntry(plan, bars, entryIndex, touchDate, rawEntryPrice, costs = {}, daysToTouch = 0) {
    const slippage = Math.max(0, finite(costs.slippageRate) ?? 0.0005);
    const commission = Math.max(0, finite(costs.commissionRate) ?? 0.00025);
    const stamp = Math.max(0, finite(costs.stampDutyRate) ?? 0.0005);
    const entryPrice = finite(rawEntryPrice) * (1 + slippage);
    if (!(entryPrice > 0) || entryIndex < 0) return { status: "tracking", touchDate, entryPrice: null, outcomes: {} };
    const outcomes = {};
    PLAN_HORIZONS.forEach((horizon) => {
      const exitIndex = entryIndex + horizon - 1;
      const exitBar = bars[exitIndex];
      if (!exitBar) return;
      const exitPrice = finite(exitBar.close) * (1 - slippage);
      const window = bars.slice(entryIndex, exitIndex + 1);
      const maximum = Math.max(...window.map((bar) => finite(bar.high) || finite(bar.close)));
      const minimum = Math.min(...window.map((bar) => finite(bar.low) || finite(bar.close)));
      outcomes[horizon] = {
        horizon,
        exitDate: String(exitBar.date),
        exitPrice,
        netReturn: exitPrice / entryPrice - 1 - commission * 2 - stamp,
        maxFavorable: maximum / entryPrice - 1,
        maxAdverse: minimum / entryPrice - 1
      };
    });
    return {
      status: outcomes[10] ? "complete" : "touched",
      touchDate,
      entryPrice,
      daysToTouch,
      outcomes,
      planVersion: plan.version,
      entryMode: plan.entryMode
    };
  }

  function summarizePlanOutcomes(signals = [], horizon = 5) {
    const planned = (Array.isArray(signals) ? signals : []).filter((item) => item?.executionPlan?.entryMode === "range-touch");
    const touched = planned.filter((item) => ["touched", "complete"].includes(item.planOutcome?.status));
    const settled = touched.filter((item) => Number.isFinite(item.planOutcome?.outcomes?.[horizon]?.netReturn));
    const returns = settled.map((item) => item.planOutcome.outcomes[horizon].netReturn);
    const adverse = settled.map((item) => item.planOutcome.outcomes[horizon].maxAdverse).filter(Number.isFinite);
    return {
      total: planned.length,
      touched: touched.length,
      tracking: planned.filter((item) => [null, undefined, "tracking", "touched"].includes(item.planOutcome?.status)).length,
      missed: planned.filter((item) => item.planOutcome?.status === "missed").length,
      invalidated: planned.filter((item) => item.planOutcome?.status === "invalidated").length,
      ambiguous: planned.filter((item) => item.planOutcome?.status === "ambiguous").length,
      touchRate: planned.length ? touched.length / planned.length : null,
      settled: settled.length,
      hitRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      worstAdverse: adverse.length ? Math.min(...adverse) : null
    };
  }

  return {
    PLAN_HORIZONS,
    buildOvernightExecutionPlan,
    buildSwingExecutionPlan,
    compareRecommendationRanks,
    compactRankingSnapshot,
    distanceToExecutionPlan,
    evaluateCatalystRisk,
    evaluatePortfolioConstraint,
    recordRankingSnapshot,
    settleExecutionPlan,
    sizeExecutionPlan,
    summarizePlanOutcomes,
    watchPlanState
  };
});
