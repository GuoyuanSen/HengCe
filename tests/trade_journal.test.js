const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyTradeToHoldings,
  buildTradeReview,
  estimateFees,
  normalizeTrade
} = require("../src/trade_journal.js");

test("trade journal validates records and estimates A-share fees", () => {
  assert.equal(normalizeTrade({ code: "bad", side: "buy" }), null);
  const trade = normalizeTrade({
    id: "t1",
    code: "sh600519",
    name: "贵州茅台",
    side: "buy",
    tradeAt: "2026-09-04T14:50:00+08:00",
    price: 1500,
    shares: 100
  });
  assert.equal(trade.code, "600519");
  assert.equal(trade.amount, 150000);
  assert.equal(estimateFees(trade, { commissionRate: 0.00025, stampDutyRate: 0.0005 }), 37.5);
  assert.equal(estimateFees({ ...trade, side: "sell" }, { commissionRate: 0.00025, stampDutyRate: 0.0005 }), 112.5);
});

test("buy and partial sell update holdings without duplicate entry", () => {
  const buy = applyTradeToHoldings([], {
    id: "buy",
    code: "600519",
    name: "贵州茅台",
    industry: "白酒",
    side: "buy",
    tradeAt: "2026-09-01",
    price: 100,
    shares: 200,
    fees: 5
  });
  assert.equal(buy.ok, true);
  assert.equal(buy.holdings[0].shares, 200);
  assert.equal(buy.holdings[0].cost, 100.025);
  assert.equal(buy.trade.realizedPnl, null);
  assert.equal(buy.trade.holdingDays, null);

  const sell = applyTradeToHoldings(buy.holdings, {
    id: "sell",
    code: "600519",
    name: "贵州茅台",
    industry: "白酒",
    side: "sell",
    tradeAt: "2026-09-04",
    price: 110,
    shares: 100,
    fees: 8,
    strategy: "回踩计划",
    mistakeTags: "过早卖出"
  });
  assert.equal(sell.ok, true);
  assert.equal(sell.holdings[0].shares, 100);
  assert.equal(sell.trade.holdingDays, 3);
  assert.ok(sell.trade.realizedPnl > 980 && sell.trade.realizedPnl < 1000);
  assert.equal(applyTradeToHoldings(sell.holdings, { ...sell.trade, shares: 200 }).ok, false);
});

test("review reports real realized pnl by strategy, industry and error", () => {
  const review = buildTradeReview([
    { id: "a", code: "600519", name: "甲", industry: "消费", side: "sell", tradeAt: "2026-08-01", price: 10, shares: 100, fees: 5, strategy: "趋势", realizedPnl: 200, holdingDays: 5 },
    { id: "b", code: "000001", name: "乙", industry: "银行", side: "sell", tradeAt: "2026-08-03", price: 8, shares: 100, fees: 5, strategy: "趋势", realizedPnl: -100, holdingDays: 12, mistakeTags: ["追高"] }
  ]);
  assert.equal(review.summary.completedCount, 2);
  assert.equal(review.summary.totalRealizedPnl, 100);
  assert.equal(review.summary.winRate, 0.5);
  assert.equal(review.summary.payoffRatio, 2);
  assert.equal(review.byStrategy[0].key, "趋势");
  assert.equal(review.byMistake[0].key, "追高");
});
