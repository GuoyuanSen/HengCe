const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPortfolioRisk,
  correlation,
  dailyReturns
} = require("../src/portfolio.js");

function bars(multiplier = 1) {
  return Array.from({ length: 40 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    close: 10 * (1 + index * 0.01 * multiplier + Math.sin(index / 4) * 0.005)
  }));
}

test("daily returns preserve dated observations", () => {
  const returns = dailyReturns(bars());
  assert.equal(returns.size, 39);
  assert.ok(Number.isFinite(returns.get("2026-01-02")));
});

test("correlation identifies matching and opposite series", () => {
  assert.ok(correlation([1, 2, 3], [2, 4, 6]) > 0.99);
  assert.ok(correlation([1, 2, 3], [6, 4, 2]) < -0.99);
});

test("portfolio risk calculates weights, volatility, and industry exposure", () => {
  const holdings = [
    { code: "600001", name: "甲", shares: 1000 },
    { code: "000001", name: "乙", shares: 500 }
  ];
  const quotes = new Map([
    ["600001", { price: 10 }],
    ["000001", { price: 20 }]
  ]);
  const histories = new Map([
    ["600001", bars(1)],
    ["000001", bars(0.7)]
  ]);
  const profiles = new Map([
    ["600001", { industry: "软件" }],
    ["000001", { industry: "银行" }]
  ]);
  const risk = buildPortfolioRisk(holdings, quotes, histories, profiles);
  assert.equal(risk.positionCount, 2);
  assert.equal(risk.maxWeight, 0.5);
  assert.ok(risk.annualizedVolatility > 0);
  assert.equal(risk.industries.length, 2);
  assert.equal(risk.industries[0].weight, 0.5);
});
