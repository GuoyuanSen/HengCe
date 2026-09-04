const test = require("node:test");
const assert = require("node:assert/strict");
const {
  marketParts,
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
