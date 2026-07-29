const test = require("node:test");
const assert = require("node:assert/strict");
const {
  analyze,
  runBacktest,
  rsiSeries,
  smaSeries,
  trueRanges
} = require("../src/engine.js");

function sampleBars(count = 500) {
  const start = new Date("2023-01-02T00:00:00Z");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const trend = 18 + index * 0.035;
    const cycle = Math.sin(index / 12) * 2.4;
    const close = trend + cycle;
    const open = close - Math.sin(index / 4) * 0.35;
    return {
      date: date.toISOString().slice(0, 10),
      open,
      close,
      high: Math.max(open, close) + 0.55,
      low: Math.min(open, close) - 0.55,
      volume: 850000 + Math.cos(index / 8) * 180000 + index * 800,
      amount: close * 1000000,
      percentChange: index ? (close / (trend - 0.035 + Math.sin((index - 1) / 12) * 2.4) - 1) * 100 : 0
    };
  });
}

test("indicator series preserve input length and warm-up values", () => {
  const values = Array.from({ length: 30 }, (_, index) => index + 1);
  const sma = smaSeries(values, 5);
  const rsi = rsiSeries(values, 14);
  assert.equal(sma.length, values.length);
  assert.equal(rsi.length, values.length);
  assert.equal(sma[3], null);
  assert.equal(sma[4], 3);
  assert.equal(rsi[14], 100);
});

test("quant analysis produces bounded score and executable levels", () => {
  const bars = sampleBars(180);
  const result = analyze(bars);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(result.support > 0);
  assert.ok(result.pressure >= bars.at(-1).close);
  assert.ok(result.riskLine > 0);
  assert.ok(Number.isFinite(result.rsi14));
  assert.ok(result.summary.includes(result.riskLine.toFixed(2)));
});

test("true range includes overnight gaps", () => {
  const bars = [
    {
      date: "2026-01-01",
      open: 10,
      close: 10,
      high: 11,
      low: 9,
      volume: 1,
      amount: 1,
      percentChange: 0
    },
    {
      date: "2026-01-02",
      open: 13,
      close: 13,
      high: 14,
      low: 12,
      volume: 1,
      amount: 1,
      percentChange: 30
    }
  ];
  assert.deepEqual(trueRanges(bars), [2, 4]);
});

test("backtest accounts for lots, fees and next-day execution", () => {
  const result = runBacktest(sampleBars(), "movingAverage", {
    initialCapital: 100000,
    fastPeriod: 5,
    slowPeriod: 20
  });
  assert.ok(result.equityCurve.length > 300);
  assert.ok(result.tradeCount > 0);
  assert.ok(result.trades.every((trade) => trade.shares % 100 === 0));
  assert.ok(Number.isFinite(result.totalReturn));
  assert.ok(result.maxDrawdown >= 0);
});
