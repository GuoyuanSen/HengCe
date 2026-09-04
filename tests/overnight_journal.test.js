const test = require("node:test");
const assert = require("node:assert/strict");
const {
  checkpointFor,
  journalStats,
  settleForwardRecords,
  upsertForwardRecord
} = require("../src/overnight_journal.js");

test("forward journal uses fixed intraday checkpoints", () => {
  assert.equal(checkpointFor({ hour: 14, minute: 31 }), "14:30");
  assert.equal(checkpointFor({ hour: 14, minute: 45 }), "14:40");
  assert.equal(checkpointFor({ hour: 14, minute: 50 }), "14:50");
  assert.equal(checkpointFor({ hour: 13, minute: 50 }), null);
});

test("forward journal replaces the same checkpoint and records zero-signal samples", () => {
  const base = { rules: { marketScope: "main" }, picks: [] };
  const first = upsertForwardRecord([], base, {
    checkpoint: "14:30",
    date: "2026-08-03",
    nextTradingDate: "2026-08-04"
  });
  assert.equal(first[0].status, "no-signal");
  const updated = upsertForwardRecord(first, {
    ...base,
    picks: [{ code: "600000", name: "样本", price: 10, score: 80 }]
  }, {
    checkpoint: "14:30",
    date: "2026-08-03",
    nextTradingDate: "2026-08-04"
  });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].status, "pending");
});

test("forward journal settles the fixed 10am outcome with costs", () => {
  const records = upsertForwardRecord([], {
    picks: [{ code: "600000", name: "样本", price: 10, score: 80 }]
  }, {
    checkpoint: "14:50",
    date: "2026-08-03",
    nextTradingDate: "2026-08-04"
  });
  const settled = settleForwardRecords(records, "2026-08-04", new Map([
    ["600000", { open: 10.1, exit1000: 10.2, first30High: 10.3, first30Low: 10, source: "测试" }]
  ]), { commissionRate: 0, stampDutyRate: 0, slippageRate: 0 });
  assert.equal(settled[0].status, "settled");
  assert.ok(settled[0].candidates[0].outcome.exit1000Return > 0);
  assert.equal(journalStats(settled).sampleCount, 1);
});
