const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LIMIT_POOL_DEFINITIONS,
  mergeLimitPools,
  parseExchangeBreadthPayload,
  parseLimitPoolPayload
} = require("../electron/breadth.js");

test("limit pools keep exchange date and zero counts", () => {
  const entry = parseLimitPoolPayload(
    { rc: 0, data: { tc: 0, qdate: 20260904, pool: [] } },
    LIMIT_POOL_DEFINITIONS[0]
  );
  assert.deepEqual(entry, { key: "limitUpCount", count: 0, date: "2026-09-04" });
  assert.equal(parseLimitPoolPayload({ rc: 102, data: null }, LIMIT_POOL_DEFINITIONS[0]), null);
});

test("exchange breadth aggregates Shanghai and Shenzhen without industry duplication", () => {
  const result = parseExchangeBreadthPayload({ data: { diff: [
    { f12: "000001", f14: "上证指数", f104: 1041, f105: 1228, f106: 86 },
    { f12: "399001", f14: "深证成指", f104: 1249, f105: 1567, f106: 113 }
  ] } });
  assert.equal(result.upCount, 2290);
  assert.equal(result.downCount, 2795);
  assert.equal(result.flatCount, 199);
  assert.equal(result.measuredStocks, 5284);
  assert.ok(result.advancingRate > 0.45 && result.advancingRate < 0.46);
});

test("limit pool merge reports partial data without inventing counts", () => {
  const result = mergeLimitPools([
    { key: "limitUpCount", count: 39, date: "2026-09-04" },
    { key: "limitDownCount", count: 9, date: "2026-09-04" },
    null
  ]);
  assert.equal(result.limitUpCount, 39);
  assert.equal(result.brokenBoardCount, null);
  assert.equal(result.partial, true);
});
