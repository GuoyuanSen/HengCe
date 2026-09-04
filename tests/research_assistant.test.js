const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CONTEXT_ANSWER_SCHEMA,
  contextAssistantInstructions,
  localContextAnswer,
  normalizeContextAnswer
} = require("../src/research_assistant.js");

test("local context answer combines stock, portfolio and event facts", () => {
  const answer = localContextAnswer("现在可以买入吗", {
    stockFacts: {
      code: "600001",
      name: "示例",
      industry: "软件",
      quote: { price: 10, percentChange: 1.2 },
      technical: { score: 72, trend: "偏强" },
      observationPlan: { invalidation: 9.2 },
      sources: ["腾讯行情"]
    },
    stockReport: { risks: ["波动偏高"], nextChecks: ["观察量能"] },
    portfolioRisk: { positionCount: 2, riskLevel: "中等", maxWeight: 0.45, maxDrawdown: 0.12 },
    intelligence: { themes: [{ label: "AI算力", phase: { label: "升温" }, newsCount: 4, activityScore: 70 }] },
    marketBreadth: { regime: { label: "均衡", positionCeiling: 50 }, breadth: { advancingRate: 0.45 }, limitPools: { limitUpCount: 39, limitDownCount: 9, brokenBoardCount: 48 } }
  });
  assert.ok(answer.perspectives.length >= 4);
  assert.match(answer.perspectives.map((item) => item.role).join(" "), /市场宽度/);
  assert.match(answer.risks.join(" "), /买卖|仓位|流动性/);
  assert.equal(answer.sourceLabels[0], "腾讯行情");
  assert.equal(CONTEXT_ANSWER_SCHEMA.additionalProperties, false);
  assert.match(contextAssistantInstructions(), /不得编造/);
});

test("context answer normalization limits untrusted output", () => {
  const answer = normalizeContextAnswer({ summary: "结论", perspectives: [{ role: "技术", conclusion: "观察", evidence: ["量价"] }] });
  assert.equal(answer.summary, "结论");
  assert.deepEqual(answer.perspectives[0].evidence, ["量价"]);
});
