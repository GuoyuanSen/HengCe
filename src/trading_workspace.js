(function exposeTradingWorkspace(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HengCeTradingWorkspace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTradingWorkspace() {
  const SIGNAL_HORIZONS = [1, 3, 5, 10];

  function finite(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function safeText(value, maximum = 240) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
  }

  function normalizeCode(value) {
    const code = String(value || "").trim().replace(/^(sh|sz)/i, "");
    return /^\d{6}$/.test(code) ? code : null;
  }

  function validDate(value) {
    const text = String(value || "").trim();
    return Number.isFinite(Date.parse(text)) ? text : null;
  }

  function dateKey(value) {
    const date = validDate(value);
    return date ? date.slice(0, 10) : "";
  }

  function daysFrom(value, now = new Date()) {
    const timestamp = Date.parse(value);
    const current = now instanceof Date ? now.getTime() : Date.parse(now);
    return Number.isFinite(timestamp) && Number.isFinite(current)
      ? Math.ceil((timestamp - current) / 86400000)
      : null;
  }

  function roundPrice(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function normalizePlan(value = {}) {
    const code = normalizeCode(value.code);
    const entryLow = finite(value.entryLow);
    const entryHigh = finite(value.entryHigh);
    const stop = finite(value.stop);
    const target = finite(value.target);
    const shares = Math.max(0, Math.floor(finite(value.shares) || 0));
    const createdAt = validDate(value.createdAt) || new Date().toISOString();
    const expiresAt = validDate(value.expiresAt);
    if (!code || !(entryLow > 0) || !(entryHigh >= entryLow) || !(stop > 0) || !(target > 0) || !expiresAt) return null;
    const referenceEntry = (entryLow + entryHigh) / 2;
    const riskPerShare = referenceEntry - stop;
    const rewardRisk = riskPerShare > 0 ? (target - referenceEntry) / riskPerShare : null;
    return {
      id: safeText(value.id, 80) || `${code}-${createdAt}`,
      code,
      name: safeText(value.name, 40) || code,
      industry: safeText(value.industry, 60) || "未分类",
      createdAt,
      expiresAt,
      entryLow,
      entryHigh,
      referenceEntry,
      stop,
      target,
      target2: finite(value.target2),
      shares,
      riskAmount: riskPerShare > 0 ? riskPerShare * shares : null,
      positionValue: referenceEntry * shares,
      rewardRisk,
      trigger: safeText(value.trigger, 180) || "价格进入计划区间后，继续确认趋势与量能",
      reason: safeText(value.reason, 500),
      status: ["active", "executed", "cancelled", "expired"].includes(value.status) ? value.status : "active",
      source: safeText(value.source, 40) || "量化看板"
    };
  }

  function buildPlanDraft({ quote, model, observationPlan, valuation, settings = {}, industry = "" } = {}) {
    if (!quote || !model || !observationPlan?.pullbackRange || !observationPlan?.invalidation) return null;
    const entryLow = roundPrice(observationPlan.pullbackRange.low);
    const entryHigh = roundPrice(observationPlan.pullbackRange.high);
    const referenceEntry = (entryLow + entryHigh) / 2;
    const stop = roundPrice(observationPlan.invalidation);
    const riskPerShare = referenceEntry - stop;
    if (!(riskPerShare > 0)) return null;
    const technicalTarget = referenceEntry + riskPerShare * 2;
    const pressure = finite(model.pressure) || 0;
    const valuationBase = valuation?.applicable ? finite(valuation?.fairRange?.base) : null;
    const valuationHigh = valuation?.applicable ? finite(valuation?.fairRange?.high) : null;
    const target = roundPrice(Math.max(technicalTarget, pressure));
    const suggestedShares = Math.max(0, Math.floor(finite(observationPlan?.riskPlan?.suggestedShares) || 0));
    const createdAt = new Date().toISOString();
    const expires = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    return normalizePlan({
      code: quote.code,
      name: quote.name,
      industry,
      createdAt,
      expiresAt: expires,
      entryLow,
      entryHigh,
      stop,
      target: valuationBase && valuationBase > referenceEntry ? Math.min(target, valuationBase) : target,
      target2: valuationHigh && valuationHigh > target ? valuationHigh : null,
      shares: suggestedShares,
      trigger: `回踩 ${entryLow}–${entryHigh} 后企稳，或放量站稳 ${roundPrice(observationPlan.breakout || pressure)}`,
      reason: observationPlan.reason,
      source: "量化看板"
    });
  }

  function evaluateTradePlan(planValue, context = {}, now = new Date()) {
    const plan = normalizePlan(planValue);
    if (!plan) {
      return {
        status: "blocked",
        label: "计划不完整",
        checks: [{ key: "required", label: "必要参数", status: "fail", detail: "请填写入场区间、止损、目标和有效期" }]
      };
    }
    const checks = [];
    const add = (key, label, status, detail) => checks.push({ key, label, status, detail });
    add(
      "price-structure",
      "价格结构",
      plan.stop < plan.entryLow && plan.target > plan.entryHigh ? "pass" : "fail",
      plan.stop < plan.entryLow && plan.target > plan.entryHigh ? "止损在入场区下方，目标在入场区上方" : "止损、入场和目标的顺序不合理"
    );
    add(
      "reward-risk",
      "盈亏比",
      plan.rewardRisk >= 2 ? "pass" : plan.rewardRisk >= 1.5 ? "warn" : "fail",
      Number.isFinite(plan.rewardRisk) ? `计划盈亏比 ${plan.rewardRisk.toFixed(2)}，基准建议不低于 2` : "无法计算计划盈亏比"
    );
    const score = finite(context.analysis?.score);
    add(
      "model",
      "量化结构",
      score == null ? "warn" : score >= 55 ? "pass" : "fail",
      score == null ? "尚未加载当前量化评分" : `当前评分 ${Math.round(score)} 分`
    );
    const quoteAt = Date.parse(context.quote?.timestamp || "");
    const ageMinutes = Number.isFinite(quoteAt) ? Math.max(0, (now.getTime() - quoteAt) / 60000) : null;
    add(
      "freshness",
      "行情时效",
      ageMinutes == null ? "warn" : ageMinutes <= 30 ? "pass" : "warn",
      ageMinutes == null ? "行情时间未知，执行前应刷新" : ageMinutes <= 30 ? `行情约 ${Math.round(ageMinutes)} 分钟内` : `行情已约 ${Math.round(ageMinutes)} 分钟，执行前必须刷新`
    );
    const regime = context.breadth?.regime;
    add(
      "market",
      "市场环境",
      !regime ? "warn" : regime.key === "defensive" ? "warn" : "pass",
      regime ? `${regime.label} · 模型仓位上限 ${regime.positionCeiling}%` : "尚未加载市场宽度"
    );
    const riskBudget = finite(context.settings?.initialCapital) * (finite(context.settings?.riskPerTradePercent) || 0) / 100;
    const maxPosition = finite(context.settings?.initialCapital) * (finite(context.settings?.maxPositionPercent) || 0) / 100;
    const sizingPass = plan.shares > 0 && (!riskBudget || plan.riskAmount <= riskBudget + 0.01) && (!maxPosition || plan.positionValue <= maxPosition + 0.01);
    add(
      "sizing",
      "风险仓位",
      plan.shares <= 0 ? "warn" : sizingPass ? "pass" : "fail",
      plan.shares <= 0 ? "尚未填写参考股数" : `参考 ${plan.shares} 股 · 计划风险约 ¥${Math.round(plan.riskAmount || 0).toLocaleString("zh-CN")}`
    );
    const nearCatalysts = (context.catalysts || []).filter((item) => {
      if (item.code && item.code !== plan.code) return false;
      const days = daysFrom(item.scheduledAt, now);
      return days != null && days >= 0 && days <= 3;
    });
    add(
      "catalyst",
      "近期事件",
      nearCatalysts.length ? "warn" : "pass",
      nearCatalysts.length ? `未来3天有 ${nearCatalysts.length} 项事件，需核对跳空风险` : "未来3天未记录重大催化事件"
    );
    const concentration = finite(context.portfolioRisk?.maxWeight);
    add(
      "portfolio",
      "组合集中度",
      concentration != null && concentration > 0.4 ? "warn" : "pass",
      concentration == null ? "暂无可用组合风险样本" : `当前最大单股权重 ${(concentration * 100).toFixed(1)}%`
    );
    const expired = daysFrom(plan.expiresAt, now);
    add(
      "expiry",
      "计划有效期",
      expired == null || expired < 0 ? "fail" : expired <= 2 ? "warn" : "pass",
      expired == null ? "有效期不可识别" : expired < 0 ? "计划已过期" : `距离到期 ${expired} 天`
    );
    const failed = checks.filter((item) => item.status === "fail").length;
    const warnings = checks.filter((item) => item.status === "warn").length;
    return {
      plan,
      status: failed ? "blocked" : warnings ? "caution" : "ready",
      label: failed ? "暂不执行" : warnings ? "需要确认" : "条件完整",
      failed,
      warnings,
      checks
    };
  }

  function normalizeCatalyst(value = {}) {
    const scheduledAt = validDate(value.scheduledAt || value.date);
    const title = safeText(value.title, 220);
    if (!scheduledAt || !title) return null;
    const code = normalizeCode(value.code);
    return {
      id: safeText(value.id, 120) || `${code || "market"}-${dateKey(scheduledAt)}-${title}`,
      code: code || "",
      name: safeText(value.name, 40),
      title,
      type: safeText(value.type, 32) || "other",
      typeLabel: safeText(value.typeLabel, 32) || "其他事件",
      scheduledAt,
      impact: ["positive", "negative", "mixed", "neutral"].includes(value.impact) ? value.impact : "neutral",
      detail: safeText(value.detail, 420),
      source: safeText(value.source, 80) || "手工记录",
      sourceUrl: /^https:\/\//.test(String(value.sourceUrl || "")) ? String(value.sourceUrl) : "",
      manual: value.manual !== false,
      createdAt: validDate(value.createdAt) || new Date().toISOString()
    };
  }

  function mergeCatalysts(...collections) {
    const unique = new Map();
    collections.flat().map(normalizeCatalyst).filter(Boolean).forEach((item) => {
      const key = item.id || `${item.code}:${item.type}:${dateKey(item.scheduledAt)}:${item.title}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()].sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  }

  function normalizeSignal(value = {}) {
    const code = normalizeCode(value.code);
    const signalAt = validDate(value.signalAt || value.asOf);
    const price = finite(value.price);
    if (!code || !signalAt || !(price > 0)) return null;
    return {
      id: safeText(value.id, 100) || `${safeText(value.source, 40) || "analysis"}-${dateKey(signalAt)}-${code}`,
      code,
      name: safeText(value.name, 40) || code,
      industry: safeText(value.industry, 60) || "未分类",
      source: safeText(value.source, 40) || "量化分析",
      signalAt,
      price,
      score: finite(value.score),
      riskLine: finite(value.riskLine),
      benchmark: ["shanghai", "shenzhen"].includes(value.benchmark)
        ? value.benchmark
        : /^6/.test(code)
          ? "shanghai"
          : "shenzhen",
      outcomes: value.outcomes && typeof value.outcomes === "object" ? value.outcomes : {},
      entry: value.entry && typeof value.entry === "object" ? value.entry : null,
      status: value.status === "complete" ? "complete" : "tracking",
      capturedAt: validDate(value.capturedAt) || new Date().toISOString()
    };
  }

  function captureSignals(existing = [], items = [], { source = "量化分析", asOf = new Date().toISOString(), limit = 300 } = {}) {
    const current = existing.map(normalizeSignal).filter(Boolean);
    const additions = items.map((item) => normalizeSignal({ ...item, source, signalAt: item.signalAt || asOf })).filter(Boolean);
    const seen = new Set(current.map((item) => item.id));
    const next = [...current];
    additions.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        next.unshift(item);
      }
    });
    return next.sort((left, right) => Date.parse(right.signalAt) - Date.parse(left.signalAt)).slice(0, limit);
  }

  function settleSignal(signalValue, stockBars = [], benchmarkBars = [], costs = {}) {
    const signal = normalizeSignal(signalValue);
    if (!signal) return null;
    const bars = stockBars.filter((item) => item?.date && finite(item.open) > 0 && finite(item.close) > 0)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));
    const signalDate = dateKey(signal.signalAt);
    const entryIndex = bars.findIndex((bar) => String(bar.date) > signalDate);
    if (entryIndex < 0) return signal;
    const entryBar = bars[entryIndex];
    if (Date.parse(entryBar.date) - Date.parse(signalDate) > 10 * 86400000) return signal;
    const slippage = Math.max(0, finite(costs.slippageRate) ?? 0.0005);
    const commission = Math.max(0, finite(costs.commissionRate) ?? 0.00025);
    const stamp = Math.max(0, finite(costs.stampDutyRate) ?? 0.0005);
    const entryPrice = Number(entryBar.open) * (1 + slippage);
    const benchmarkMap = new Map(benchmarkBars.map((bar) => [String(bar.date), bar]));
    const benchmarkEntry = finite(benchmarkMap.get(String(entryBar.date))?.open);
    const outcomes = {};
    SIGNAL_HORIZONS.forEach((horizon) => {
      const exitIndex = entryIndex + horizon - 1;
      const exitBar = bars[exitIndex];
      if (!exitBar) return;
      const exitPrice = Number(exitBar.close) * (1 - slippage);
      const netReturn = exitPrice / entryPrice - 1 - commission * 2 - stamp;
      const window = bars.slice(entryIndex, exitIndex + 1);
      const maximumPrice = Math.max(...window.map((bar) => finite(bar.high) || finite(bar.close) || entryPrice));
      const minimumPrice = Math.min(...window.map((bar) => finite(bar.low) || finite(bar.close) || entryPrice));
      const benchmarkExit = finite(benchmarkMap.get(String(exitBar.date))?.close);
      const benchmarkReturn = benchmarkEntry > 0 && benchmarkExit > 0 ? benchmarkExit / benchmarkEntry - 1 : null;
      outcomes[horizon] = {
        horizon,
        exitDate: String(exitBar.date),
        exitPrice,
        netReturn,
        benchmarkReturn,
        excessReturn: benchmarkReturn == null ? null : netReturn - benchmarkReturn,
        maxFavorable: maximumPrice / entryPrice - 1,
        maxAdverse: minimumPrice / entryPrice - 1
      };
    });
    return {
      ...signal,
      entry: { date: String(entryBar.date), price: entryPrice },
      outcomes,
      status: outcomes[10] ? "complete" : "tracking"
    };
  }

  function summarizeSignals(values = [], horizon = 5) {
    const signals = values.map(normalizeSignal).filter(Boolean);
    const settled = signals.filter((item) => Number.isFinite(item.outcomes?.[horizon]?.netReturn));
    const returns = settled.map((item) => item.outcomes[horizon].netReturn);
    const excess = settled.map((item) => item.outcomes[horizon].excessReturn).filter(Number.isFinite);
    return {
      total: signals.length,
      settled: settled.length,
      tracking: signals.length - settled.length,
      hitRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      averageExcessReturn: excess.length ? excess.reduce((sum, value) => sum + value, 0) / excess.length : null,
      bySource: [...new Set(signals.map((item) => item.source))].map((source) => {
        const rows = signals.filter((item) => item.source === source && Number.isFinite(item.outcomes?.[horizon]?.netReturn));
        return {
          source,
          count: rows.length,
          hitRate: rows.length ? rows.filter((item) => item.outcomes[horizon].netReturn > 0).length / rows.length : null,
          averageReturn: rows.length ? rows.reduce((sum, item) => sum + item.outcomes[horizon].netReturn, 0) / rows.length : null
        };
      }).sort((left, right) => right.count - left.count)
    };
  }

  function buildActionCenter({ plans = [], catalysts = [], signals = [], portfolioRisk = null } = {}, now = new Date()) {
    const items = [];
    (portfolioRisk?.riskAlerts || []).forEach((detail) => items.push({
      id: `risk-${detail}`,
      priority: 95,
      tone: "negative",
      kind: "组合风险",
      title: detail,
      detail: "先核对集中度和计划风险，再考虑新增仓位"
    }));
    catalysts.forEach((event) => {
      const days = daysFrom(event.scheduledAt, now);
      if (days == null || days < 0 || days > 7) return;
      items.push({
        id: `catalyst-${event.id}`,
        priority: days <= 1 ? 90 : 72,
        tone: event.impact === "negative" ? "negative" : "warning",
        kind: "催化日历",
        title: `${event.name || event.code || "市场"} · ${event.title}`,
        detail: days === 0 ? "今天发生，注意价格是否提前反应" : `${days} 天后 · ${event.source}`
      });
    });
    plans.map(normalizePlan).filter(Boolean).filter((plan) => plan.status === "active").forEach((plan) => {
      const days = daysFrom(plan.expiresAt, now);
      if (days != null && days <= 3) items.push({
        id: `plan-${plan.id}`,
        priority: days < 0 ? 88 : 64,
        tone: days < 0 ? "negative" : "warning",
        kind: "交易计划",
        title: `${plan.name} 的计划${days < 0 ? "已过期" : "即将到期"}`,
        detail: days < 0 ? "不要沿用过期价格，重新分析后再建计划" : `剩余 ${days} 天，请核对触发条件`
      });
    });
    const tracking = signals.map(normalizeSignal).filter(Boolean).filter((item) => item.status !== "complete");
    if (tracking.length) items.push({
      id: "signals-tracking",
      priority: 45,
      tone: "neutral",
      kind: "前向验证",
      title: `${tracking.length} 条真实信号正在跟踪`,
      detail: "交易日数据到齐后自动补充 1/3/5/10 日结果"
    });
    return items.sort((left, right) => right.priority - left.priority).slice(0, 12);
  }

  return {
    SIGNAL_HORIZONS,
    buildActionCenter,
    buildPlanDraft,
    captureSignals,
    daysFrom,
    evaluateTradePlan,
    mergeCatalysts,
    normalizeCatalyst,
    normalizePlan,
    normalizeSignal,
    settleSignal,
    summarizeSignals
  };
});
