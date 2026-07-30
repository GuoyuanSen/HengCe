const test = require("node:test");
const assert = require("node:assert/strict");
const {
  INDEX_DEFINITIONS,
  normalizeCode,
  parseTencentKLines,
  parseTencentQuote,
  secidFor,
  tencentSymbolFor,
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
  assert.equal(tencentSymbolFor("603039"), "sh603039");
  assert.equal(tencentSymbolFor("000001"), "sz000001");
  assert.deepEqual(INDEX_DEFINITIONS, [
    {
      code: "000001",
      name: "上证指数",
      secid: "1.000001",
      tencentSymbol: "sh000001"
    },
    {
      code: "399001",
      name: "深证成指",
      secid: "0.399001",
      tencentSymbol: "sz399001"
    },
    {
      code: "399006",
      name: "创业板指",
      secid: "0.399006",
      tencentSymbol: "sz399006"
    }
  ]);
});

test("parses Tencent quote payload with exact amount and A-share volume", () => {
  const fields = Array(39).fill("");
  Object.assign(fields, {
    0: "1",
    1: "泛微网络",
    2: "603039",
    3: "31.30",
    4: "30.93",
    5: "30.70",
    6: "8964",
    30: "20260730093531",
    31: "0.37",
    32: "1.20",
    33: "31.47",
    34: "30.65",
    35: "31.30/8964/27911793",
    36: "8964",
    37: "2791"
  });
  const payload = `v_sh603039="${fields.join("~")}";`;
  const quote = parseTencentQuote(payload, "603039");

  assert.equal(quote.name, "泛微网络");
  assert.equal(quote.price, 31.3);
  assert.equal(quote.previousClose, 30.93);
  assert.equal(quote.high, 31.47);
  assert.equal(quote.low, 30.65);
  assert.equal(quote.volume, 896400);
  assert.equal(quote.amount, 27911793);
});

test("parses Tencent forward-adjusted daily bars", () => {
  const bars = parseTencentKLines(
    {
      data: {
        sh603039: {
          qfqday: [
            ["2026-07-28", "29.20", "29.94", "30.20", "29.00", "88588"],
            ["2026-07-29", "30.02", "30.93", "31.05", "29.50", "112909"]
          ]
        }
      }
    },
    "sh603039"
  );

  assert.equal(bars.length, 2);
  assert.equal(bars[0].volume, 8858800);
  assert.equal(bars[1].close, 30.93);
  assert.ok(Math.abs(bars[1].percentChange - 3.3066) < 0.001);
});
