const test = require("node:test");
const assert = require("node:assert/strict");
const {
  initialCodeCandidates,
  preferredHolding,
  resolveInitialCode,
  setPrimaryHolding
} = require("../src/preferences.js");

test("initial stock respects explicit, recent, holding, watchlist, then fallback order", () => {
  const holdings = [{ code: "600001", shares: 100, cost: 8 }];
  const watchlist = [{ code: "300001" }];
  assert.equal(resolveInitialCode({ defaultCode: "000001", lastCode: "002001", holdings, watchlist }), "000001");
  assert.equal(resolveInitialCode({ lastCode: "002001", holdings, watchlist }), "002001");
  assert.equal(resolveInitialCode({ holdings, watchlist }), "600001");
  assert.equal(resolveInitialCode({ watchlist }), "300001");
  assert.equal(resolveInitialCode({}), "603039");
  assert.deepEqual(
    initialCodeCandidates({ defaultCode: "600001", lastCode: "600001", watchlist: [{ code: "300001" }] }),
    ["600001", "300001", "603039"]
  );
});

test("primary holding wins, otherwise the largest recorded position is selected", () => {
  const holdings = [
    { code: "600001", shares: 100, cost: 10 },
    { code: "600002", shares: 200, cost: 12 },
    { code: "600003", shares: 10, cost: 50, primary: true }
  ];
  assert.equal(preferredHolding(holdings).code, "600003");
  const withoutPrimary = holdings.map(({ primary, ...holding }) => holding);
  assert.equal(preferredHolding(withoutPrimary).code, "600002");
  assert.equal(setPrimaryHolding(withoutPrimary, "600001").find((item) => item.primary).code, "600001");
});
