const test = require("node:test");
const assert = require("node:assert/strict");
const { buildObservationPlan } = require("../src/trade_plan.js");

const model = {
  score: 72,
  support: 9.8,
  sma20: 10,
  pressure: 10.8,
  riskLine: 9.4,
  atr14: 0.5,
  volumeRatio: 1.3
};

test("observation plan exposes pullback, breakout, valuation cap and invalidation", () => {
  const plan = buildObservationPlan({
    quote: { price: 10 },
    model,
    valuation: { applicable: true, fairRange: { base: 10.6 }, confidence: { score: 80, label: "较高" } },
    settings: { initialCapital: 100000, riskPerTradePercent: 1, maxPositionPercent: 20 }
  });
  assert.equal(plan.available, true);
  assert.ok(plan.pullbackRange.low < plan.pullbackRange.high);
  assert.ok(plan.breakout > model.pressure);
  assert.equal(plan.valuationCap, 10.6);
  assert.equal(plan.invalidation, 9.4);
  assert.ok(plan.riskPlan.suggestedShares >= 100);
  assert.ok(plan.riskPlan.capitalAtRisk <= plan.riskPlan.riskBudget);
  assert.ok(plan.riskPlan.positionPercent <= 0.2);
});

test("weak or invalidated structures do not produce an observation range", () => {
  assert.equal(buildObservationPlan({ quote: { price: 10 }, model: { ...model, score: 40 } }).available, false);
  assert.equal(buildObservationPlan({ quote: { price: 9.3 }, model }).available, false);
});
