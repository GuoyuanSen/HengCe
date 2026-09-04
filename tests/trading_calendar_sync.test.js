const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CALENDAR_SOURCE_URL,
  normalizeCalendarPayload,
  parseSseCalendarHtml
} = require("../electron/trading_calendar_sync.js");

const officialFixture = `<!doctype html><html><head><meta name="author" content="上海证券交易所"></head><body>
  <strong>2027年休市安排</strong><div><table><tbody>
    <tr><td>元旦：</td><td>1月1日（星期五）至1月3日（星期日）休市，1月4日起照常开市。</td></tr>
    <tr><td>春节：</td><td>2月8日（星期一）至2月14日（星期日）休市，2月15日起照常开市。另外，2月6日为周末休市。</td></tr>
    <tr><td>清明节：</td><td>4月5日休市，4月6日起照常开市。</td></tr>
  </tbody></table></div>${"<!-- official-calendar-padding -->".repeat(20)}
</body></html>`;

test("official calendar parser expands closure ranges and ignores later weekend notes", () => {
  const calendar = parseSseCalendarHtml(officialFixture, "2026-12-22T08:00:00.000Z");
  assert.equal(calendar.year, 2027);
  assert.ok(calendar.closedDates.includes("2027-01-02"));
  assert.ok(calendar.closedDates.includes("2027-02-14"));
  assert.ok(calendar.closedDates.includes("2027-04-05"));
  assert.equal(calendar.closedDates.includes("2027-02-06"), false);
  assert.equal(calendar.sourceUrl, CALENDAR_SOURCE_URL);
});

test("calendar cache accepts only complete data from the official URL", () => {
  const valid = parseSseCalendarHtml(officialFixture);
  assert.ok(normalizeCalendarPayload(valid));
  assert.equal(normalizeCalendarPayload({ ...valid, sourceUrl: "https://example.com/calendar" }), null);
  assert.equal(normalizeCalendarPayload({ ...valid, closedDates: ["2027-01-01"] }), null);
});
