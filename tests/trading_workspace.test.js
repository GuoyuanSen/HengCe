const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildActionCenter,
  buildPlanDraft,
  captureSignals,
  evaluateTradePlan,
  mergeCatalysts,
  settleSignal,
  summarizeSignals
} = require("../src/trading_workspace.js");

test("plan draft and pre-trade gate keep risk before direction", () => {
  const draft = buildPlanDraft({
    quote: { code: "600519", name: "贵州茅台", price: 100, timestamp: "2026-09-04T14:30:00+08:00" },
    model: { score: 72, pressure: 105 },
    observationPlan: {
      pullbackRange: { low: 98, high: 100 },
      invalidation: 95,
      breakout: 106,
      reason: "回踩结构完整",
      riskPlan: { suggestedShares: 300 }
    },
    valuation: { applicable: true, fairRange: { base: 118, high: 132 } },
    industry: "白酒"
  });
  assert.equal(draft.code, "600519");
  assert.ok(draft.rewardRisk >= 2);
  const gate = evaluateTradePlan(draft, {
    quote: { timestamp: "2026-09-04T14:30:00+08:00" },
    analysis: { score: 72 },
    breadth: { regime: { key: "balanced", label: "均衡", positionCeiling: 50 } },
    settings: { initialCapital: 1000000, riskPerTradePercent: 1, maxPositionPercent: 50 },
    catalysts: []
  }, new Date("2026-09-04T14:35:00+08:00"));
  assert.equal(gate.status, "ready");
  assert.equal(gate.checks.some((item) => item.status === "fail"), false);
});

test("near catalyst and stale market cause caution while bad geometry blocks", () => {
  const base = { id: "p", code: "000001", name: "平安银行", entryLow: 10, entryHigh: 10.2, stop: 9.5, target: 11.5, shares: 1000, createdAt: "2026-09-01", expiresAt: "2026-09-20" };
  const caution = evaluateTradePlan(base, {
    quote: { timestamp: "2026-09-01" },
    analysis: { score: 70 },
    catalysts: [{ code: "000001", scheduledAt: "2026-09-05", title: "业绩披露" }]
  }, new Date("2026-09-04T12:00:00+08:00"));
  assert.equal(caution.status, "caution");
  assert.equal(evaluateTradePlan({ ...base, stop: 10.5 }, {}, new Date("2026-09-04")).status, "blocked");
  assert.equal(evaluateTradePlan({ ...base, expiresAt: "invalid" }, {}, new Date("2026-09-04")).status, "blocked");
});

test("signal journal freezes timestamp and settles forward outcomes without hindsight", () => {
  const signals = captureSignals([], [{ code: "600519", name: "贵州茅台", price: 100, score: 75 }], {
    source: "A股优选",
    asOf: "2026-09-01T15:00:00+08:00"
  });
  const bars = [
    { date: "2026-09-01", open: 99, close: 100, high: 101, low: 98 },
    ...Array.from({ length: 10 }, (_, index) => ({
      date: `2026-09-${String(index + 2).padStart(2, "0")}`,
      open: 101 + index,
      close: 102 + index,
      high: 103 + index,
      low: 100 + index
    }))
  ];
  const benchmark = bars.map((bar) => ({ ...bar, open: 100, close: 100, high: 100, low: 100 }));
  const settled = settleSignal(signals[0], bars, benchmark, { commissionRate: 0, stampDutyRate: 0, slippageRate: 0 });
  assert.equal(settled.entry.date, "2026-09-02");
  assert.equal(settled.status, "complete");
  assert.ok(settled.outcomes[5].netReturn > 0);
  const summary = summarizeSignals([settled], 5);
  assert.equal(summary.settled, 1);
  assert.equal(summary.hitRate, 1);

  const tooOld = settleSignal({ ...signals[0], signalAt: "2025-01-01" }, bars, benchmark, {});
  assert.equal(tooOld.entry, null);
  assert.deepEqual(tooOld.outcomes, {});
});

test("catalysts merge and action center prioritize immediate risk", () => {
  const catalysts = mergeCatalysts([
    { id: "e1", code: "600519", title: "半年报", type: "earnings", scheduledAt: "2026-09-05", source: "交易所披露" },
    { id: "e1", code: "600519", title: "半年报", type: "earnings", scheduledAt: "2026-09-05", source: "交易所披露" }
  ]);
  assert.equal(catalysts.length, 1);
  const actions = buildActionCenter({
    catalysts,
    portfolioRisk: { riskAlerts: ["单只股票权重超过40%"] }
  }, new Date("2026-09-04T08:00:00+08:00"));
  assert.equal(actions[0].kind, "组合风险");
  assert.equal(actions.some((item) => item.kind === "催化日历"), true);
});
