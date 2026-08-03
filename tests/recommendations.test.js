const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRecommendationSnapshot,
  isEligibleCode,
  isRiskName,
  parseCandidatePayload,
  recommendationFor
} = require("../electron/recommendations.js");

test("candidate pool keeps regular Shanghai and Shenzhen A shares", () => {
  assert.equal(isEligibleCode("603039"), true);
  assert.equal(isEligibleCode("300750"), true);
  assert.equal(isEligibleCode("430047"), false);
  assert.equal(isRiskName("*ST示例"), true);
  assert.equal(isRiskName("退市示例"), true);
  assert.equal(isRiskName("泛微网络"), false);
});

test("candidate parser removes risky and extreme rows", () => {
  const payload = {
    data: {
      diff: [
        {
          f12: "603039",
          f14: "泛微网络",
          f2: 41.16,
          f3: 3.2,
          f6: 1.25e9,
          f8: 4.2,
          f9: 39,
          f20: 1e10,
          f21: 8e9,
          f23: 3.8
        },
        { f12: "600001", f14: "*ST示例", f2: 2, f3: 1, f6: 2e8, f8: 2 },
        { f12: "300001", f14: "涨幅过大", f2: 20, f3: 12, f6: 8e8, f8: 5 }
      ]
    }
  };
  const rows = parseCandidatePayload(payload);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "603039");
});

test("recommendation scoring rewards technical structure without exceeding 100", () => {
  const result = recommendationFor(
    {
      code: "603039",
      name: "泛微网络",
      price: 41.16,
      changePercent: 3.2,
      amount: 1.25e9,
      peDynamic: 30
    },
    {
      score: 88,
      volatility: 0.3,
      trend: "强势",
      rsi14: 62,
      momentum20: 0.1,
      support: 38,
      pressure: 42,
      riskLine: 36,
      positives: ["价格位于20日均线上方", "MACD动能转正"]
    }
  );
  assert.ok(result.score >= 80 && result.score <= 100);
  assert.equal(result.risk, "较低");
  assert.ok(result.reasons.some((item) => item.includes("动态PE")));
});

test("snapshot sorts recommendations and limits the observation pool", () => {
  const baseModel = {
    score: 70,
    volatility: 0.35,
    trend: "修复",
    rsi14: 55,
    momentum20: 0.04,
    support: 9,
    pressure: 11,
    riskLine: 8,
    positives: ["价格位于20日均线上方"]
  };
  const candidates = Array.from({ length: 15 }, (_, index) => ({
    candidate: {
      code: `600${String(index).padStart(3, "0")}`,
      name: `样本${index}`,
      price: 10,
      changePercent: 1,
      amount: 1e9 + index * 1e8,
      peDynamic: 25
    },
    model: { ...baseModel, score: 70 + index }
  }));
  const snapshot = buildRecommendationSnapshot(candidates, { candidatePool: 88 });
  assert.equal(snapshot.summary.candidatePool, 88);
  assert.equal(snapshot.recommendations.length, 12);
  assert.ok(snapshot.recommendations[0].score >= snapshot.recommendations[1].score);
});
