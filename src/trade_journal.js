(function exposeTradeJournal(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HengCeTradeJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTradeJournal() {
  const SIDE_LABELS = { buy: "买入", sell: "卖出" };

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

  function dayDifference(start, end) {
    const left = Date.parse(start);
    const right = Date.parse(end);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right < left) return null;
    return Math.max(0, Math.round((right - left) / 86400000));
  }

  function normalizeTags(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(/[，,、]/);
    return [...new Set(values.map((item) => safeText(item, 24)).filter(Boolean))].slice(0, 8);
  }

  function normalizeTrade(value = {}) {
    const code = normalizeCode(value.code);
    const side = value.side === "sell" ? "sell" : value.side === "buy" ? "buy" : null;
    const price = finite(value.price);
    const shares = Math.floor(finite(value.shares) || 0);
    const fees = Math.max(0, finite(value.fees) || 0);
    const tradeAt = validDate(value.tradeAt || value.date);
    if (!code || !side || !(price > 0) || shares <= 0 || !tradeAt) return null;
    return {
      id: safeText(value.id, 80) || `${code}-${side}-${tradeAt}-${price}-${shares}`,
      code,
      name: safeText(value.name, 40) || code,
      industry: safeText(value.industry, 60) || "未分类",
      side,
      sideLabel: SIDE_LABELS[side],
      tradeAt,
      price,
      shares,
      fees,
      amount: price * shares,
      strategy: safeText(value.strategy, 40) || "未标记",
      reason: safeText(value.reason, 500),
      review: safeText(value.review, 500),
      mistakeTags: normalizeTags(value.mistakeTags),
      planId: safeText(value.planId, 80),
      costBasis: finite(value.costBasis),
      realizedPnl: finite(value.realizedPnl),
      holdingDays: finite(value.holdingDays),
      positionSharesBefore: finite(value.positionSharesBefore),
      positionSharesAfter: finite(value.positionSharesAfter),
      createdAt: validDate(value.createdAt) || new Date().toISOString()
    };
  }

  function estimateFees(trade = {}, settings = {}) {
    const amount = Math.max(0, (finite(trade.price) || 0) * (finite(trade.shares) || 0));
    if (!amount) return 0;
    const commissionRate = Math.max(0, finite(settings.commissionRate) ?? 0.00025);
    const stampDutyRate = Math.max(0, finite(settings.stampDutyRate) ?? 0.0005);
    const commission = Math.max(5, amount * commissionRate);
    const stampDuty = trade.side === "sell" ? amount * stampDutyRate : 0;
    return Math.round((commission + stampDuty) * 100) / 100;
  }

  function applyTradeToHoldings(holdings = [], rawTrade = {}) {
    const trade = normalizeTrade(rawTrade);
    if (!trade) return { ok: false, reason: "交易日期、股票、方向、价格或股数不完整" };
    const next = holdings.map((item) => ({ ...item }));
    const index = next.findIndex((item) => normalizeCode(item.code) === trade.code);
    const current = index >= 0 ? next[index] : null;
    const currentShares = Math.max(0, Math.floor(finite(current?.shares) || 0));
    const currentCost = Math.max(0, finite(current?.cost) || 0);
    const enriched = {
      ...trade,
      positionSharesBefore: currentShares,
      costBasis: currentCost || null
    };

    if (trade.side === "buy") {
      const totalShares = currentShares + trade.shares;
      const totalCost = currentCost * currentShares + trade.amount + trade.fees;
      const holding = {
        ...(current || {}),
        code: trade.code,
        name: trade.name,
        industry: trade.industry,
        shares: totalShares,
        cost: totalShares ? totalCost / totalShares : trade.price,
        openedAt: validDate(current?.openedAt) || trade.tradeAt,
        primary: Boolean(current?.primary)
      };
      if (index >= 0) next[index] = holding;
      else next.push(holding);
      enriched.positionSharesAfter = totalShares;
      enriched.costBasis = holding.cost;
      enriched.realizedPnl = null;
      enriched.holdingDays = null;
      return { ok: true, holdings: next, trade: enriched, holding };
    }

    if (!current || currentShares < trade.shares) {
      return {
        ok: false,
        reason: current
          ? `当前仅记录 ${currentShares} 股，不能卖出 ${trade.shares} 股`
          : "当前没有可供卖出的持仓记录"
      };
    }
    const remaining = currentShares - trade.shares;
    const realizedPnl = (trade.price - currentCost) * trade.shares - trade.fees;
    enriched.positionSharesAfter = remaining;
    enriched.costBasis = currentCost;
    enriched.realizedPnl = realizedPnl;
    enriched.holdingDays = dayDifference(current.openedAt, trade.tradeAt);
    if (remaining > 0) next[index] = { ...current, shares: remaining };
    else next.splice(index, 1);
    return { ok: true, holdings: next, trade: enriched, holding: remaining > 0 ? next[index] : null };
  }

  function holdingBucket(days) {
    if (!Number.isFinite(Number(days))) return "时间未知";
    if (days <= 1) return "1日以内";
    if (days <= 3) return "2–3日";
    if (days <= 10) return "4–10日";
    if (days <= 30) return "11–30日";
    return "30日以上";
  }

  function summarizeRows(rows, keySelector) {
    const groups = new Map();
    rows.forEach((row) => {
      const keys = [].concat(keySelector(row) || "未标记");
      keys.forEach((rawKey) => {
        const key = safeText(rawKey, 60) || "未标记";
        const group = groups.get(key) || { key, count: 0, wins: 0, pnl: 0 };
        group.count += 1;
        group.pnl += Number(row.realizedPnl || 0);
        if (row.realizedPnl > 0) group.wins += 1;
        groups.set(key, group);
      });
    });
    return [...groups.values()]
      .map((item) => ({ ...item, winRate: item.count ? item.wins / item.count : null }))
      .sort((left, right) => right.pnl - left.pnl || right.count - left.count);
  }

  function buildTradeReview(values = []) {
    const trades = values
      .map(normalizeTrade)
      .filter(Boolean)
      .sort((left, right) => Date.parse(left.tradeAt) - Date.parse(right.tradeAt) || left.createdAt.localeCompare(right.createdAt));
    const closed = trades.filter((item) => item.side === "sell" && Number.isFinite(item.realizedPnl));
    const wins = closed.filter((item) => item.realizedPnl > 0);
    const losses = closed.filter((item) => item.realizedPnl < 0);
    const totalRealizedPnl = closed.reduce((sum, item) => sum + item.realizedPnl, 0);
    const grossProfit = wins.reduce((sum, item) => sum + item.realizedPnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, item) => sum + item.realizedPnl, 0));
    const averageWin = wins.length ? grossProfit / wins.length : null;
    const averageLoss = losses.length ? grossLoss / losses.length : null;
    const holdingSamples = closed.map((item) => item.holdingDays).filter(Number.isFinite);
    let cumulative = 0;
    let peak = 0;
    let maxDrawdownAmount = 0;
    const realizedCurve = closed.map((item) => {
      cumulative += item.realizedPnl;
      peak = Math.max(peak, cumulative);
      maxDrawdownAmount = Math.max(maxDrawdownAmount, peak - cumulative);
      return { date: item.tradeAt.slice(0, 10), value: cumulative, tradeId: item.id };
    });
    return {
      summary: {
        transactionCount: trades.length,
        completedCount: closed.length,
        totalRealizedPnl,
        winRate: closed.length ? wins.length / closed.length : null,
        payoffRatio: averageWin != null && averageLoss ? averageWin / averageLoss : null,
        profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
        averageHoldingDays: holdingSamples.length
          ? holdingSamples.reduce((sum, value) => sum + value, 0) / holdingSamples.length
          : null,
        maxDrawdownAmount,
        unreviewedCount: closed.filter((item) => !item.review && !item.mistakeTags.length).length,
        turnover: trades.reduce((sum, item) => sum + item.amount, 0),
        fees: trades.reduce((sum, item) => sum + item.fees, 0)
      },
      byStrategy: summarizeRows(closed, (item) => item.strategy),
      byIndustry: summarizeRows(closed, (item) => item.industry),
      byHoldingPeriod: summarizeRows(closed, (item) => holdingBucket(item.holdingDays)),
      byMistake: summarizeRows(closed.filter((item) => item.mistakeTags.length), (item) => item.mistakeTags),
      realizedCurve,
      trades: [...trades].reverse()
    };
  }

  return {
    SIDE_LABELS,
    applyTradeToHoldings,
    buildTradeReview,
    dayDifference,
    estimateFees,
    holdingBucket,
    normalizeTrade
  };
});
