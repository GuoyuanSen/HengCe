const test = require("node:test");
const assert = require("node:assert/strict");
const {
  eventMatches,
  isQuietTime,
  normalizeAlertPreferences,
  selectAlertEvent
} = require("../src/alerts.js");

test("alert preferences normalize keywords and overnight quiet hours", () => {
  const preferences = normalizeAlertPreferences({ keywords: "AI， 黄金,AI", quietStart: "22:30", quietEnd: "08:00" });
  assert.deepEqual(preferences.keywords, ["AI", "黄金"]);
  assert.equal(isQuietTime(preferences, new Date(2026, 8, 4, 23, 0)), true);
  assert.equal(isQuietTime(preferences, new Date(2026, 8, 4, 12, 0)), false);
});

test("alerts respect importance, holdings impact and explicit keywords", () => {
  const events = [
    { title: "普通行业消息", importance: 80, themeKey: "x" },
    { title: "黄金价格出现异动", importance: 75, themeKey: "gold" }
  ];
  const preferences = normalizeAlertPreferences({ keywords: ["黄金"], portfolioOnly: true, quietStart: "00:00", quietEnd: "00:00" });
  assert.equal(eventMatches(events[0], [], preferences, new Date(2026, 8, 4, 12, 0)), false);
  assert.equal(selectAlertEvent(events, [], preferences, new Date(2026, 8, 4, 12, 0)).themeKey, "gold");
  assert.equal(eventMatches(events[0], [{ themeKey: "x" }], preferences, new Date(2026, 8, 4, 12, 0)), true);
  assert.equal(eventMatches(events[0], [], { ...preferences, portfolioOnly: false }, new Date(2026, 8, 4, 12, 0)), true);
});
