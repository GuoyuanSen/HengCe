const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MACRO_SERIES,
  buildMacroSnapshot,
  parseMacroPayload
} = require("../electron/macro.js");

function payload(data) {
  return { success: true, result: { data } };
}

test("macro parser sorts valid observations and ignores malformed values", () => {
  const definition = MACRO_SERIES.find((item) => item.key === "cpi");
  const rows = parseMacroPayload(definition, payload([
    { REPORT_DATE: "2026-07-01 00:00:00", NATIONAL_SAME: 0.5 },
    { REPORT_DATE: "2026-06-01 00:00:00", NATIONAL_SAME: 1 },
    { REPORT_DATE: "bad", NATIONAL_SAME: 2 }
  ]));
  assert.deepEqual(rows.map((item) => item.date), ["2026-06-01", "2026-07-01"]);
  assert.equal(rows[1].value, 0.5);
});

test("macro snapshot keeps original publisher and period-level signals", () => {
  const snapshot = buildMacroSnapshot({
    RPT_ECONOMY_CPI: payload([
      { REPORT_DATE: "2026-07-01", NATIONAL_SAME: 0.5 },
      { REPORT_DATE: "2026-06-01", NATIONAL_SAME: 1 }
    ]),
    RPT_ECONOMY_PMI: payload([
      { REPORT_DATE: "2026-08-01", MAKE_INDEX: 49.8 },
      { REPORT_DATE: "2026-07-01", MAKE_INDEX: 49.2 }
    ])
  }, { now: new Date("2026-09-04T00:00:00+08:00") });
  assert.equal(snapshot.indicators.find((item) => item.key === "cpi").originalSource, "国家统计局");
  assert.equal(snapshot.indicators.find((item) => item.key === "pmi").signal.label, "收缩区间");
  assert.equal(snapshot.sourceStatus.partial, true);
  assert.ok(snapshot.sourceStatus.missing.includes("M2"));
});

test("Shibor parser selects the overnight tenor from mixed daily rows", () => {
  const definition = MACRO_SERIES.find((item) => item.key === "shiborOn");
  const rows = parseMacroPayload(definition, payload([
    { REPORT_DATE: "2026-09-04", MARKET_CODE: "001", CURRENCY_CODE: "CNY", INDICATOR_ID: "101", IR_RATE: 1.376 },
    { REPORT_DATE: "2026-09-04", MARKET_CODE: "002", CURRENCY_CODE: "USD", INDICATOR_ID: "001", IR_RATE: 2.22 },
    { REPORT_DATE: "2026-09-04", MARKET_CODE: "001", CURRENCY_CODE: "CNY", INDICATOR_ID: "001", IR_RATE: 1.362 },
    { REPORT_DATE: "2026-09-03", MARKET_CODE: "001", CURRENCY_CODE: "CNY", INDICATOR_ID: "001", IR_RATE: 1.363 }
  ]));
  assert.deepEqual(rows.map((item) => item.value), [1.363, 1.362]);
});
