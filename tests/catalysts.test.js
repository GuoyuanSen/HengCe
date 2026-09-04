const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCatalystSnapshot,
  parseDividends,
  parseReportAppointments,
  parseShareholderChanges,
  parseUnlocks
} = require("../electron/catalysts.js");

const now = new Date("2026-09-04T08:00:00+08:00");

test("catalyst parsers keep only selected stocks and useful dates", () => {
  const appointments = { result: { data: [
    { SECURITY_CODE: "600519", SECURITY_NAME_ABBR: "贵州茅台", APPOINT_PUBLISH_DATE: "2026-10-30 00:00:00", REPORT_TYPE_NAME: "2026年 三季报", IS_PUBLISH: "0", QUARTER: "2026q3" },
    { SECURITY_CODE: "000001", SECURITY_NAME_ABBR: "平安银行", APPOINT_PUBLISH_DATE: "2026-10-20 00:00:00", REPORT_TYPE_NAME: "2026年 三季报", IS_PUBLISH: "0" }
  ] } };
  const events = parseReportAppointments(appointments, ["600519"], now);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "earnings");
  assert.match(events[0].title, /预约披露/);
});

test("shareholder reduction is treated as a disclosed risk event", () => {
  const rows = parseShareholderChanges({ result: { data: [
    { SECURITY_CODE: "600519", SECURITY_NAME_ABBR: "贵州茅台", HOLDER_NAME: "示例股东", DIRECTION: "减持", NOTICE_DATE: "2026-09-04", CHANGE_NUM: 100, CHANGE_FREE_RATIO: 0.8, MARKET: "二级市场" },
    { SECURITY_CODE: "600519", SECURITY_NAME_ABBR: "贵州茅台", HOLDER_NAME: "示例机构", DIRECTION: "保存/核查意见", NOTICE_DATE: "2026-09-04" }
  ] } }, ["600519"], now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].impact, "negative");
  assert.match(rows[0].title, /减持/);
});

test("unlock and dividend events expose risk context without claiming direction", () => {
  const unlocks = parseUnlocks({ result: { data: [{
    SECURITY_CODE: "600519", SECURITY_NAME_ABBR: "贵州茅台", FREE_DATE: "2026-09-20", FREE_SHARES_TYPE: "定向增发机构配售股份", TOTAL_RATIO: 0.03, ABLE_FREE_SHARES: 1200
  }] } }, ["600519"], now);
  assert.equal(unlocks[0].impact, "negative");
  assert.match(unlocks[0].detail, /3\.00%/);

  const dividends = parseDividends({ result: { data: [{
    SECURITY_CODE: "600519", SECURITY_NAME_ABBR: "贵州茅台", EQUITY_RECORD_DATE: "2026-09-24", EX_DIVIDEND_DATE: "2026-09-25", IMPL_PLAN_PROFILE: "10派100元"
  }] } }, ["600519"], now);
  assert.equal(dividends[0].impact, "neutral");
  assert.match(dividends[0].detail, /除权日/);
});

test("catalyst snapshot merges official event types and reports partial sources", () => {
  const snapshot = buildCatalystSnapshot({
    appointments: { result: { data: [{ SECURITY_CODE: "600519", APPOINT_PUBLISH_DATE: "2026-10-30", REPORT_TYPE_NAME: "三季报", IS_PUBLISH: "0" }] } },
    unlocks: { result: { data: [] } },
    dividends: { result: { data: [] } }
  }, { codes: ["600519"], now, sourceStatus: { loaded: 2, requested: 3, partial: true } });
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.sourceStatus.partial, true);
});
