const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TRACKING_REPORT_SCHEMA,
  buildLocalTrackingReport,
  buildTrackingInput,
  normalizeTrackingReport,
  trackingTargets
} = require("../src/ai_tracking.js");
const {
  normalizeAiSettings,
  parseJsonResponse,
  publicAiSettings,
  responsesUrl,
  safeApiError
} = require("../electron/ai_service.js");

test("AI settings require HTTPS and expose only masked key state", () => {
  assert.deepEqual(normalizeAiSettings({ baseUrl: "https://api.openai.com/v1/", model: "gpt-test" }), {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-test",
    sendHoldings: false
  });
  assert.throws(() => normalizeAiSettings({ baseUrl: "http://example.com" }), /HTTPS/);
  assert.equal(responsesUrl("https://api.openai.com/v1"), "https://api.openai.com/v1/responses");
  assert.deepEqual(publicAiSettings({}, { hasApiKey: true, secureStorage: true }).hasApiKey, true);
  assert.equal("apiKey" in publicAiSettings({}, { hasApiKey: true }), false);
});

test("AI response parser handles raw Responses API content", () => {
  const report = { stance: "中性观察" };
  assert.deepEqual(parseJsonResponse({ output_text: JSON.stringify(report) }), report);
  assert.deepEqual(parseJsonResponse({ output: [{ content: [{ text: JSON.stringify(report) }] }] }), report);
  assert.throws(() => parseJsonResponse({ output: [] }), /可解析/);
  assert.match(safeApiError(401, {}), /无效/);
  assert.match(safeApiError(403, {}), /没有该模型/);
  assert.match(safeApiError(404, { error: { code: "model_not_found" } }), /模型名称/);
  assert.match(safeApiError(429, {}), /额度不足/);
});

test("tracking targets deduplicate current, holdings and watchlist", () => {
  assert.deepEqual(
    trackingTargets({
      current: { code: "600001", name: "当前" },
      holdings: [{ code: "600001", name: "重复" }, { code: "000001", name: "持仓", primary: true }],
      watchlist: [{ code: "300001", name: "观察" }]
    }).map((item) => [item.code, item.source]),
    [["600001", "当前标的"], ["000001", "主仓"], ["300001", "观察"]]
  );
});

test("local tracking report compares snapshots and preserves engine price levels", () => {
  const facts = {
    quote: { price: 12 },
    technical: {
      score: 78,
      summary: "趋势占优",
      riskLine: 10.5,
      sma20: 11.2,
      positives: ["价格位于20日均线上方"],
      risks: ["波动偏高"]
    },
    observationPlan: {
      pullbackRange: { low: 11.1, high: 11.6 },
      breakout: 12.4,
      invalidation: 10.5,
      reason: "等待回踩"
    }
  };
  const previous = { facts: { quote: { price: 11 }, technical: { score: 70 } } };
  const report = buildLocalTrackingReport(facts, previous);
  assert.equal(report.stance, "积极观察");
  assert.equal(report.observationPlan.zoneLow, 11.1);
  assert.equal(report.observationPlan.invalidation, 10.5);
  assert.match(report.changes[0].detail, /70/);
  assert.equal(TRACKING_REPORT_SCHEMA.additionalProperties, false);
  assert.match(buildTrackingInput(facts, previous), /previousSnapshot/);
  assert.equal(normalizeTrackingReport({ stance: "随便" }).stance, "等待数据");
});
