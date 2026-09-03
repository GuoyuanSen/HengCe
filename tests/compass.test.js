const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCompassSnapshot,
  parseTencentGlobalQuotes
} = require("../electron/compass.js");

test("global quote parser reads Tencent US and Hong Kong index payloads", () => {
  const line = (symbol, code, price, previousClose, change) => {
    const fields = Array(40).fill("0");
    fields[2] = code;
    fields[3] = String(price);
    fields[4] = String(previousClose);
    fields[30] = "2026-09-02 16:00:00";
    fields[32] = String(change);
    fields[35] = "USD";
    return `v_${symbol}="${fields.join("~")}";`;
  };
  const payload = [
    line("usIXIC", ".IXIC", 18000, 17900, 0.56),
    line("hkHSTECH", "HSTECH", 4500, 4450, 1.12)
  ].join("\n");
  const quotes = parseTencentGlobalQuotes(payload);
  assert.equal(quotes.length, 2);
  assert.equal(quotes[0].name, "纳斯达克");
  assert.equal(quotes[0].percentChange, 0.56);
});

test("market compass summarizes global and domestic risk environment", () => {
  const snapshot = buildCompassSnapshot({
    globalMarkets: [
      { symbol: "usIXIC", name: "纳斯达克", percentChange: 1.2, weight: 0.6 },
      { symbol: "hkHSTECH", name: "恒生科技", percentChange: 1, weight: 0.4 }
    ],
    domesticMarkets: [
      { name: "上证指数", percentChange: 1 },
      { name: "深证成指", percentChange: 0.8 },
      { name: "创业板指", percentChange: 1.1 }
    ],
    styleMarkets: [
      { name: "沪深300", style: "大盘核心", percentChange: 1.1 },
      { name: "科创50", style: "科技成长", percentChange: -0.3 }
    ]
  });
  assert.equal(snapshot.regime.key, "risk-on");
  assert.ok(snapshot.signals.length >= 2);
  assert.match(snapshot.signals.at(-1), /大盘核心.*科技成长/);
});
