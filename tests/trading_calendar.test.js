const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calendarCoverage,
  marketParts,
  mergeOfficialCalendar,
  nextTradingDateKey,
  tradingDayStatus
} = require("../src/trading_calendar.js");

test("calendar evaluates dates and time in Asia Shanghai", () => {
  const parts = marketParts(new Date("2026-08-03T14:35:00+08:00"));
  assert.equal(parts.dateKey, "2026-08-03");
  assert.equal(parts.hour, 14);
  assert.equal(parts.minute, 35);
});

test("calendar closes official holidays and weekends", () => {
  const holiday = tradingDayStatus(new Date("2026-10-05T14:35:00+08:00"));
  assert.equal(holiday.isTradingDay, false);
  assert.equal(holiday.reason, "holiday");
  const weekend = tradingDayStatus(new Date("2026-08-08T14:35:00+08:00"));
  assert.equal(weekend.reason, "weekend");
});

test("calendar returns the next exchange trading date", () => {
  assert.equal(nextTradingDateKey(new Date("2026-09-24T15:01:00+08:00")), "2026-09-28");
  assert.equal(nextTradingDateKey(new Date("2026-10-07T15:01:00+08:00")), "2026-10-08");
});

test("unknown years fail closed until an official calendar is installed", () => {
  const before = tradingDayStatus(new Date("2027-01-04T14:35:00+08:00"));
  assert.equal(before.isTradingDay, false);
  assert.equal(before.reason, "calendar-unverified");
  assert.equal(mergeOfficialCalendar({
    year: 2027,
    closedDates: ["2027-01-01", "2027-02-08", "2027-02-09", "2027-02-10", "2027-04-05"],
    sourceName: "上海证券交易所",
    sourceUrl: "https://www.sse.com.cn/disclosure/dealinstruc/closed/",
    fetchedAt: "2026-12-22T08:00:00.000Z"
  }), true);
  assert.equal(calendarCoverage(2027).covered, true);
  assert.equal(tradingDayStatus(new Date("2027-01-04T14:35:00+08:00")).isTradingDay, true);
  assert.equal(tradingDayStatus(new Date("2027-04-05T14:35:00+08:00")).reason, "holiday");
});
