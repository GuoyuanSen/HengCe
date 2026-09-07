(function exposeOvernightJournal(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HengCeOvernightJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOvernightJournal() {
  function checkpointFor(parts) {
    const minutes = Number(parts?.hour) * 60 + Number(parts?.minute);
    if (minutes >= 14 * 60 + 50 && minutes < 15 * 60) return "14:50";
    if (minutes >= 14 * 60 + 40 && minutes < 14 * 60 + 50) return "14:40";
    if (minutes >= 14 * 60 + 30 && minutes < 14 * 60 + 40) return "14:30";
    return null;
  }

  function compactCandidate(item = {}) {
    return {
      code: String(item.code || ""),
      name: String(item.name || item.code || ""),
      industry: String(item.industry || "未分类"),
      price: Number(item.price),
      score: Number(item.score),
      changePercent: Number(item.changePercent),
      volumeRatio: Number(item.volumeRatio),
      turnoverRate: Number(item.turnoverRate),
      floatMarketCap: Number(item.floatMarketCap),
      aboveAverageRatio: Number(item.intraday?.aboveRatio),
      recentLimitUpDate: item.limitUp?.date || null,
      confirmations: Number(item.confirmations || 0),
      executionPlan: item.executionPlan && typeof item.executionPlan === "object"
        ? item.executionPlan
        : null
    };
  }

  function upsertForwardRecord(records, snapshot, options = {}) {
    const list = Array.isArray(records) ? records : [];
    const checkpoint = options.checkpoint;
    const date = String(options.date || "");
    if (!checkpoint || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return list;
    const marketScope = String(options.marketScope || snapshot?.rules?.marketScope || "main");
    const id = `${date}:${marketScope}:${checkpoint}`;
    const candidates = (snapshot?.picks || []).map(compactCandidate).filter((item) => /^\d{6}$/.test(item.code));
    const record = {
      id,
      date,
      checkpoint,
      marketScope,
      nextTradingDate: options.nextTradingDate || null,
      capturedAt: options.capturedAt || new Date().toISOString(),
      ruleVersion: "overnight-v2",
      rules: snapshot?.rules || null,
      status: candidates.length ? "pending" : "no-signal",
      candidates
    };
    return [record, ...list.filter((item) => item?.id !== id)]
      .sort((left, right) => String(right.id).localeCompare(String(left.id)))
      .slice(0, 180);
  }

  function netReturn(entry, exit, costs = {}) {
    if (!(entry > 0) || !(exit > 0)) return null;
    const commission = Number(costs.commissionRate ?? 0.00025);
    const stampDuty = Number(costs.stampDutyRate ?? 0.0005);
    const slippage = Number(costs.slippageRate ?? 0.0005);
    return exit * (1 - slippage) / (entry * (1 + slippage)) - 1 - commission * 2 - stampDuty;
  }

  function settleForwardRecords(records, tradingDate, marketDataByCode, costs = {}) {
    const lookup = marketDataByCode instanceof Map
      ? marketDataByCode
      : new Map(Object.entries(marketDataByCode || {}));
    return (Array.isArray(records) ? records : []).map((record) => {
      if (record.status !== "pending" || record.nextTradingDate !== tradingDate) return record;
      const candidates = (record.candidates || []).map((candidate) => {
        const market = lookup.get(candidate.code);
        if (!market?.open || !market?.exit1000) return candidate;
        return {
          ...candidate,
          outcome: {
            tradingDate,
            open: Number(market.open),
            exit1000: Number(market.exit1000),
            first30High: Number(market.first30High),
            first30Low: Number(market.first30Low),
            openReturn: netReturn(candidate.price, Number(market.open), costs),
            exit1000Return: netReturn(candidate.price, Number(market.exit1000), costs),
            source: String(market.source || "公开行情")
          }
        };
      });
      const complete = candidates.every((candidate) => candidate.outcome);
      return {
        ...record,
        candidates,
        status: complete ? "settled" : "pending",
        settledAt: complete ? new Date().toISOString() : record.settledAt
      };
    });
  }

  function expireMissedRecords(records, tradingDate) {
    return (Array.isArray(records) ? records : []).map((record) =>
      record.status === "pending" && record.nextTradingDate && record.nextTradingDate < tradingDate
        ? { ...record, status: "missed", missedReason: "未在次一交易日10:00后打开软件，无法可靠补取当时分时" }
        : record
    );
  }

  function journalStats(records) {
    const list = Array.isArray(records) ? records : [];
    const settledCandidates = list.flatMap((record) =>
      (record.candidates || []).filter((candidate) => candidate.outcome)
    );
    const returns = settledCandidates.map((item) => item.outcome.exit1000Return).filter(Number.isFinite);
    return {
      checkpointCount: list.length,
      signalCheckpointCount: list.filter((item) => (item.candidates || []).length > 0).length,
      sampleCount: returns.length,
      hitRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      worstReturn: returns.length ? Math.min(...returns) : null
    };
  }

  return {
    checkpointFor,
    expireMissedRecords,
    journalStats,
    netReturn,
    settleForwardRecords,
    upsertForwardRecord
  };
});
