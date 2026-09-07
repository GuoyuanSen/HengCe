const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOvernightExecutionPlan,
  buildSwingExecutionPlan,
  compareRecommendationRanks,
  distanceToExecutionPlan,
  evaluateCatalystRisk,
  evaluatePortfolioConstraint,
  recordRankingSnapshot,
  settleExecutionPlan,
  summarizePlanOutcomes,
  watchPlanState
} = require("../src/execution_plan.js");

function swing(overrides = {}) {
  return {
    code: "600001",
    name: "样本股份",
    industry: "软件开发",
    price: 10.4,
    score: 76,
    support: 9.8,
    sma20: 10,
    pressure: 11,
    riskLine: 9.2,
    atr14: 0.4,
    volumeRatio: 1.1,
    ...overrides
  };
}

test("swing execution plan separates pullback, breakout, chase cap and invalidation", () => {
  const plan = buildSwingExecutionPlan(swing(), {
    initialCapital: 100000,
    riskPerTradePercent: 1,
    maxPositionPercent: 25
  });
  assert.equal(plan.generatedBy, "quant");
  assert.equal(plan.available, true);
  assert.ok(plan.range.low > plan.invalidation);
  assert.ok(plan.range.high < plan.breakout);
  assert.ok(plan.chaseCap > plan.breakout);
  assert.ok(plan.target > plan.range.high);
  assert.ok(plan.sizing.suggestedShares % 100 === 0);
  assert.equal(buildSwingExecutionPlan(swing({ price: plan.range.high })).status, "in-zone");
  assert.equal(buildSwingExecutionPlan(swing({ price: 12 })).status, "overextended");
  assert.equal(buildSwingExecutionPlan(swing({ price: 9.1 })).status, "invalid");
});

test("overnight execution plan stays above average and refuses prices near the five percent cap", () => {
  const plan = buildOvernightExecutionPlan({
    price: 10.4,
    changePercent: 4,
    intraday: { currentAveragePrice: 10.32, aboveRatio: 0.98, currentAbove: true }
  });
  assert.equal(plan.status, "in-zone");
  assert.ok(plan.range.low >= 10.32);
  assert.ok(plan.range.high <= plan.chaseCap);
  assert.equal(plan.exitRule.includes("半小时"), true);
  const noChase = buildOvernightExecutionPlan({
    price: 10.498,
    changePercent: 4.98,
    intraday: { currentAveragePrice: 10.4, aboveRatio: 1, currentAbove: true }
  });
  assert.equal(noChase.status, "no-chase");
  assert.equal(noChase.actionable, false);
});

test("watch state reports distance, zone entry, breakout and invalidation", () => {
  const plan = buildSwingExecutionPlan(swing({ price: 10.4 }));
  const item = { code: "600001", baselineScore: 70, executionPlan: plan };
  const near = watchPlanState(item, { quote: { price: plan.range.high * 1.005 }, model: { score: 72, volumeRatio: 1 } });
  assert.equal(near.label, "接近观察区");
  const inside = watchPlanState(item, { quote: { price: plan.range.high }, model: { score: 72, volumeRatio: 1 } });
  assert.equal(inside.key, "in-zone");
  const breakout = watchPlanState(item, { quote: { price: plan.breakout }, model: { score: 75, volumeRatio: 1.3 } });
  assert.equal(breakout.key, "breakout");
  const invalid = watchPlanState(item, { quote: { price: plan.invalidation }, model: { score: 50, volumeRatio: 0.8 } });
  assert.equal(invalid.key, "invalid");
  assert.equal(distanceToExecutionPlan(plan, plan.range.low).state, "inside");
});

test("portfolio constraint accounts for existing stock and industry exposure", () => {
  const plan = buildSwingExecutionPlan(swing(), { initialCapital: 100000, riskPerTradePercent: 1, maxPositionPercent: 25 });
  const blocked = evaluatePortfolioConstraint({ ...swing(), executionPlan: plan }, {
    holdings: [{ code: "600001", shares: 2500, cost: 10, industry: "软件开发" }],
    quotes: new Map([["600001", { price: 10 }]]),
    profiles: new Map([["600001", { industry: "软件开发" }]]),
    settings: { initialCapital: 100000, riskPerTradePercent: 1, maxPositionPercent: 25 }
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.suggestedShares, 0);
  const clear = evaluatePortfolioConstraint({ ...swing(), executionPlan: plan }, {
    holdings: [],
    settings: { initialCapital: 100000, riskPerTradePercent: 1, maxPositionPercent: 25 }
  });
  assert.equal(clear.status, "clear");
  assert.ok(clear.suggestedShares >= 100);
});

test("catalyst risk distinguishes missing data, clear windows and near negative events", () => {
  const now = new Date("2026-09-07T09:00:00+08:00");
  assert.equal(evaluateCatalystRisk("600001", [], { now, loaded: false }).status, "unknown");
  assert.equal(evaluateCatalystRisk("600001", [], { now }).status, "clear");
  const risk = evaluateCatalystRisk("600001", [{
    code: "600001",
    scheduledAt: "2026-09-09",
    title: "限售解禁",
    impact: "negative"
  }], { now });
  assert.equal(risk.status, "risk");
  assert.match(risk.detail, /限售解禁/);
});

test("recommendation rank comparison exposes new, rising and falling candidates", () => {
  const previous = { rows: [
    { code: "600001", rank: 1, score: 80 },
    { code: "600002", rank: 2, score: 75 }
  ] };
  const rows = compareRecommendationRanks([
    { code: "600002", score: 78 },
    { code: "600003", score: 72 },
    { code: "600001", score: 76 }
  ], previous);
  assert.equal(rows[0].rankState, "up");
  assert.equal(rows[0].rankChange, 1);
  assert.equal(rows[1].rankState, "new");
  assert.equal(rows[2].rankState, "down");
  const history = recordRankingSnapshot([], { asOf: "2026-09-07T09:00:00+08:00", recommendations: rows });
  assert.equal(history[0].rows.length, 3);
});

test("execution plan journal records first range touch and post-touch drawdown", () => {
  const plan = { version: "swing-v1", entryMode: "range-touch", range: { low: 10, high: 10.2 }, invalidation: 9.4 };
  const signal = { signalAt: "2026-09-01T15:00:00+08:00", price: 10.6, executionPlan: plan };
  const bars = [
    { date: "2026-09-01", open: 10.5, high: 10.7, low: 10.4, close: 10.6 },
    { date: "2026-09-02", open: 10.5, high: 10.6, low: 10.3, close: 10.4 },
    ...Array.from({ length: 10 }, (_, index) => ({
      date: `2026-09-${String(index + 3).padStart(2, "0")}`,
      open: 10.15 + index * 0.05,
      high: 10.35 + index * 0.05,
      low: 9.9 + index * 0.04,
      close: 10.2 + index * 0.05
    }))
  ];
  const result = settleExecutionPlan(signal, bars, { commissionRate: 0, stampDutyRate: 0, slippageRate: 0 });
  assert.equal(result.touchDate, "2026-09-03");
  assert.equal(result.daysToTouch, 2);
  assert.ok(result.outcomes[5].netReturn > 0);
  assert.ok(result.outcomes[5].maxAdverse < 0);
  const summary = summarizePlanOutcomes([{ ...signal, planOutcome: result }], 5);
  assert.equal(summary.touchRate, 1);
  assert.equal(summary.settled, 1);
});

test("execution validation stays conservative for ambiguous daily bars and delegates overnight exits", () => {
  const ambiguous = settleExecutionPlan({
    signalAt: "2026-09-01T15:00:00+08:00",
    price: 10.6,
    executionPlan: { version: "swing-v1", entryMode: "range-touch", range: { low: 10, high: 10.2 }, invalidation: 9.4 }
  }, [
    { date: "2026-09-02", open: 10.3, high: 10.4, low: 9.3, close: 10 }
  ]);
  assert.equal(ambiguous.status, "ambiguous");
  assert.deepEqual(ambiguous.outcomes, {});

  const overnight = settleExecutionPlan({
    signalAt: "2026-09-01T14:50:00+08:00",
    price: 10.4,
    executionPlan: { version: "overnight-v1", horizon: "overnight", entryMode: "signal-price" }
  }, [
    { date: "2026-09-02", open: 10.5, high: 10.8, low: 10.3, close: 10.7 }
  ]);
  assert.equal(overnight.status, "external");
  assert.equal(overnight.validation, "overnight-forward-journal");
  assert.equal(summarizePlanOutcomes([{ executionPlan: { entryMode: "signal-price" }, planOutcome: overnight }]).total, 0);
});
