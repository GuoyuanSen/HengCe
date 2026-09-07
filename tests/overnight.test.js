const test = require("node:test");
const assert = require("node:assert/strict");
const {
  allowsMarketScope,
  analyzeOvernightCandidatePayload,
  buildOvernightSnapshot,
  intradayAverageState,
  limitUpThreshold,
  parseIntradayTrends,
  parseOvernightCandidatePayload,
  recentLimitUp,
  scanWindow,
  validateOvernightProxy
} = require("../electron/overnight.js");

test("tail scan defaults to main board while allowing explicit growth and STAR scopes", () => {
  assert.equal(allowsMarketScope("600000", "main"), true);
  assert.equal(allowsMarketScope("002001", "main"), true);
  assert.equal(allowsMarketScope("300001", "main"), false);
  assert.equal(allowsMarketScope("688001", "main"), false);
  assert.equal(allowsMarketScope("300001", "main-growth"), true);
  assert.equal(allowsMarketScope("688001", "main-star"), true);
  const row = (code) => ({ f12: code, f14: code, f2: 10, f3: 4, f8: 7, f10: 1.2, f21: 10e9 });
  const payload = { data: { diff: [row("600000"), row("300001"), row("688001")] } };
  const main = analyzeOvernightCandidatePayload(payload);
  assert.deepEqual(main.candidates.map((item) => item.code), ["600000"]);
  assert.equal(main.funnel.market, 1);
  assert.deepEqual(
    analyzeOvernightCandidatePayload(payload, { marketScope: "all" }).candidates.map((item) => item.code),
    ["600000", "300001", "688001"]
  );
});

test("tail scan window opens at 14:30 and locks at 14:50", () => {
  assert.equal(scanWindow(new Date("2026-08-03T14:29:00+08:00")).state, "waiting");
  assert.equal(scanWindow(new Date("2026-08-03T14:30:00+08:00")).state, "scanning");
  assert.equal(scanWindow(new Date("2026-08-03T14:49:00+08:00")).state, "scanning");
  const locked = scanWindow(new Date("2026-08-03T14:50:00+08:00"));
  assert.equal(locked.state, "locked");
  assert.equal(locked.canScan, false);
});

test("tail scan remains closed on an official weekday holiday", () => {
  const holiday = scanWindow(new Date("2026-10-05T14:35:00+08:00"));
  assert.equal(holiday.state, "closed");
  assert.equal(holiday.label, "交易所休市");
  assert.equal(holiday.nextTradingDate, "2026-10-08");
});

test("candidate parser enforces the six snapshot filters", () => {
  const payload = { data: { diff: [
    { f12: "603039", f14: "泛微网络", f2: 41, f3: 4, f6: 2e9, f8: 7, f10: 1.4, f20: 35e9, f21: 25e9, f100: "软件" },
    { f12: "600001", f14: "换手不足", f2: 10, f3: 4, f6: 1e9, f8: 4, f10: 1.2, f21: 10e9 },
    { f12: "600002", f14: "市值过大", f2: 10, f3: 4, f6: 1e9, f8: 7, f10: 1.2, f21: 31e9 }
  ] } };
  const rows = parseOvernightCandidatePayload(payload);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "603039");
});

test("candidate analysis exposes the sequential rejection funnel", () => {
  const payload = { data: { diff: [
    { f12: "603039", f14: "通过", f2: 41, f3: 4, f8: 7, f10: 1.4, f21: 25e9 },
    { f12: "600001", f14: "涨幅不足", f2: 10, f3: 2, f8: 7, f10: 1.4, f21: 10e9 },
    { f12: "600002", f14: "量比不足", f2: 10, f3: 4, f8: 7, f10: 0.8, f21: 10e9 }
  ] } };
  const result = analyzeOvernightCandidatePayload(payload);
  assert.equal(result.funnel.raw, 3);
  assert.equal(result.funnel.change, 2);
  assert.equal(result.funnel.volumeRatio, 1);
  assert.equal(result.candidates.length, 1);
});

test("recent limit-up uses board-specific thresholds", () => {
  assert.equal(limitUpThreshold("600000"), 9.5);
  assert.equal(limitUpThreshold("300001"), 19.5);
  const bars = Array.from({ length: 25 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    percentChange: index === 18 ? 10.01 : 0
  }));
  const result = recentLimitUp(bars, "600000");
  assert.equal(result.found, true);
  assert.equal(result.sessionsAgo, 6);
});

test("intraday rule requires 95 percent of points and the latest price above average", () => {
  const points = Array.from({ length: 20 }, (_, index) => ({
    price: index === 0 ? 9.99 : 10.1,
    averagePrice: 10
  }));
  const state = intradayAverageState(points);
  assert.equal(state.passes, true);
  assert.equal(state.aboveRatio, 0.95);
  points[19].price = 9.9;
  assert.equal(intradayAverageState(points).passes, false);
});

test("trend parser reads minute close and yellow average price", () => {
  const points = parseIntradayTrends({ data: { trends: [
    "2026-08-03 14:30,10.00,10.20,10.25,9.98,2000,20400,10.08"
  ] } });
  assert.deepEqual(points[0], {
    time: "2026-08-03 14:30",
    price: 10.2,
    averagePrice: 10.08
  });
});

test("snapshot allows zero signals and caps an industry at two", () => {
  const candidate = (code, industry, passes = true) => ({
    candidate: { code, name: code, industry, price: 10.4, changePercent: 4, volumeRatio: 1.5, turnoverRate: 7.5, amount: 1e9, floatMarketCap: 1e10 },
    limitUp: { found: true, sessionsAgo: 2 },
    intraday: { passes, aboveRatio: 1, currentAbove: passes, currentAveragePrice: 10.3 }
  });
  assert.equal(buildOvernightSnapshot([candidate("600000", "银行", false)]).picks.length, 0);
  const snapshot = buildOvernightSnapshot([
    candidate("600000", "软件"), candidate("600001", "软件"), candidate("600002", "软件"), candidate("600003", "银行")
  ]);
  assert.deepEqual(snapshot.picks.map((item) => item.code), ["600000", "600001", "600003"]);
  assert.equal(snapshot.picks.every((item) => item.executionPlan?.generatedBy === "quant"), true);
  assert.equal(snapshot.summary.funnel.executionPlan, 4);
  const nearMiss = buildOvernightSnapshot([
    candidate("600004", "软件", false)
  ]);
  assert.equal(nearMiss.nearMisses.length, 1);
  assert.match(nearMiss.nearMisses[0].failedRules[0], /均价线上方/);

  const capped = candidate("600005", "软件");
  capped.candidate.price = 10.498;
  capped.candidate.changePercent = 4.98;
  capped.intraday.currentAveragePrice = 10.4;
  const cappedSnapshot = buildOvernightSnapshot([capped]);
  assert.equal(cappedSnapshot.picks.length, 0);
  assert.equal(cappedSnapshot.nearMisses[0].executionPlan.status, "no-chase");
});

test("overnight validation exits at next open and deducts costs", () => {
  const bars = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    open: 10,
    close: 10,
    percentChange: index === 10 ? 10 : index === 25 ? 4 : 0
  }));
  bars[26].open = 10.2;
  const result = validateOvernightProxy(bars, "600000", {
    commissionRate: 0,
    stampDutyRate: 0,
    slippageRate: 0
  });
  assert.equal(result.sampleCount, 1);
  assert.ok(result.averageReturn > 0);
});
