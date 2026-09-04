const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMarketRegime } = require("../src/market_regime.js");

test("market regime maps broad participation to an offensive ceiling", () => {
  const result = buildMarketRegime({
    breadth: { upCount: 3600, downCount: 1400, advancingRate: 0.72 },
    limitPools: { limitUpCount: 82, limitDownCount: 4, brokenBoardCount: 18 },
    hotspotSummary: { strongCount: 16, marketTone: "热点扩散" },
    compassRegime: { score: 0.8, label: "风险偏好回升" }
  });
  assert.equal(result.regime.key, "offensive");
  assert.equal(result.regime.positionCeiling, 70);
  assert.equal(result.confidence, "较高");
});

test("weak breadth and failed breakouts force a defensive ceiling", () => {
  const result = buildMarketRegime({
    breadth: { upCount: 1200, downCount: 3600, advancingRate: 0.25 },
    limitPools: { limitUpCount: 12, limitDownCount: 28, brokenBoardCount: 35 },
    hotspotSummary: { strongCount: 3, marketTone: "热点收缩" },
    compassRegime: { score: 0.4, label: "均衡观察" }
  });
  assert.equal(result.regime.key, "defensive");
  assert.equal(result.regime.positionCeiling, 30);
  assert.ok(result.limitPools.brokenRate > 0.65);
});

test("partial limit pools remain missing instead of being displayed as zero", () => {
  const result = buildMarketRegime({
    breadth: { upCount: 2000, downCount: 2000, advancingRate: 0.5 },
    limitPools: { limitUpCount: 20, limitDownCount: null, brokenBoardCount: null }
  });
  assert.match(result.signals[1], /跌停 --/);
  assert.doesNotMatch(result.signals[1], /跌停 0/);
});
