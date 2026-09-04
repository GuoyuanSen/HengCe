const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDataHealth, evaluateSource, timestamp } = require("../src/data_health.js");

test("data health distinguishes idle, stale, degraded and healthy sources", () => {
  const now = new Date("2026-09-04T08:00:00Z");
  const result = buildDataHealth([
    { key: "a", loaded: false },
    { key: "b", loaded: true, available: true, asOf: "2026-09-04T07:58:00Z", staleAfterMinutes: 10 },
    { key: "c", loaded: true, available: true, partial: true, asOf: "2026-09-04T07:00:00Z", staleAfterMinutes: 10 },
    { key: "d", loaded: true, available: true, asOf: "2026-09-04T07:00:00Z", staleAfterMinutes: 10 }
  ], { now });
  assert.deepEqual(result.items.map((item) => item.status), ["idle", "healthy", "degraded", "stale"]);
  assert.equal(result.summary.idle, 1);
  assert.ok(result.score > 0 && result.score < 100);
});

test("data health parses compact A-share timestamps", () => {
  assert.ok(timestamp("20260904150000"));
  assert.equal(evaluateSource({ loaded: true, available: false }).status, "unavailable");
});
