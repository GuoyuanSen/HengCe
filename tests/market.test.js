const test = require("node:test");
const assert = require("node:assert/strict");
const {
  INDEX_DEFINITIONS,
  normalizeCode,
  secidFor,
  validatedCode
} = require("../electron/market.js");

test("normalizes supported A-share code input", () => {
  assert.equal(normalizeCode(" SH603039 "), "603039");
  assert.equal(normalizeCode("sz000001"), "000001");
  assert.equal(validatedCode("600000"), "600000");
  assert.throws(() => validatedCode("123"), /6位A股代码/);
});

test("maps stock markets and indices to correct Eastmoney secids", () => {
  assert.equal(secidFor("603039"), "1.603039");
  assert.equal(secidFor("000001"), "0.000001");
  assert.deepEqual(INDEX_DEFINITIONS, [
    { code: "000001", name: "上证指数", secid: "1.000001" },
    { code: "399001", name: "深证成指", secid: "0.399001" },
    { code: "399006", name: "创业板指", secid: "0.399006" }
  ]);
});
