const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ASIA_MARKETS,
  buildCompassSnapshot,
  parseEastmoneyGlobalQuotes,
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

test("Eastmoney supplementary parser reads Japan, Korea and semiconductor chain quotes", () => {
  const payload = { data: { diff: [
    { f13: 100, f12: "N225", f14: "日经225", f2: 4200123, f18: 4180000, f3: 48, f124: 1788503400 },
    { f13: 100, f12: "KS11", f14: "韩国KOSPI", f2: 320000, f18: 316800, f3: 101, f124: 1788503400 },
    { f13: 251, f12: "SOX", f14: "费城半导体指数", f2: 580012, f18: 570000, f3: 176, f124: 1788465600 }
  ] } };
  const definitions = [
    ...ASIA_MARKETS,
    { secid: "251.SOX", symbol: "usSOX", name: "费城半导体指数", chainRole: "全球风险偏好" }
  ];
  const rows = parseEastmoneyGlobalQuotes(payload, definitions);
  assert.equal(rows.length, 3);
  assert.equal(rows[1].name, "韩国KOSPI");
  assert.equal(rows[1].percentChange, 1.01);
  assert.equal(rows[2].price, 5800.12);
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
    ],
    semiconductorMarkets: [
      { symbol: "usSOX", name: "费城半导体指数", percentChange: 1.5 },
      { symbol: "krHynix", name: "SK海力士", percentChange: 2 }
    ]
  });
  assert.equal(snapshot.regime.key, "risk-on");
  assert.ok(snapshot.signals.length >= 2);
  assert.match(snapshot.signals.at(-1), /大盘核心.*科技成长/);
  assert.equal(snapshot.semiconductorPulse.label, "偏强");
});
