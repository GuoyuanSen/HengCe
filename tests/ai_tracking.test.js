const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TRACKING_REPORT_SCHEMA,
  buildLocalTrackingReport,
  buildTrackingInput,
  filterTrackingSnapshots,
  normalizeTrackingHistory,
  normalizeTrackingReport,
  trackingSnapshotTone,
  trackingSnapshotTrust,
  upsertTrackingSnapshot,
  trackingTargets
} = require("../src/ai_tracking.js");
const {
  normalizeAiSettings,
  parseJsonResponse,
  publicAiSettings,
  responsesUrl,
  safeApiError,
  shouldRetryAiStatus
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
  assert.match(safeApiError(401, {}), /暂未识别/);
  assert.equal(shouldRetryAiStatus(401, 0), true);
  assert.equal(shouldRetryAiStatus(401, 1), false);
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

function trackingSnapshot({
  code = "600001",
  name = "样本股份",
  createdAt = "2026-09-07T01:30:00.000Z",
  price = 10,
  score = 70,
  stance = "中性观察",
  changeType = "neutral",
  source = "local",
  pinned = false
} = {}) {
  return {
    code,
    name,
    createdAt,
    source,
    pinned,
    facts: {
      code,
      name,
      observedAt: createdAt,
      quote: { price, percentChange: 1, timestamp: createdAt, source: "腾讯行情" },
      technical: { score, trend: "均线多头" }
    },
    report: {
      stance,
      confidence: "中等",
      summary: "结构等待确认",
      changes: [{ type: changeType, title: "量化评分持平", detail: "变化不大" }],
      catalysts: [],
      risks: [],
      observationPlan: { zoneLow: 9.6, zoneHigh: 9.9, breakout: 10.5, invalidation: 9.2, rationale: "等待确认" },
      invalidations: [],
      nextChecks: [],
      dataLimitations: []
    }
  };
}

test("tracking history migrates legacy snapshots and keeps pinned records outside the ordinary limit", () => {
  const values = Array.from({ length: 4 }, (_, index) => trackingSnapshot({
    code: `60000${index}`,
    createdAt: `2026-09-07T01:${String(30 + index).padStart(2, "0")}:00.000Z`,
    pinned: index === 0
  }));
  const history = normalizeTrackingHistory(values, 2);
  assert.equal(history.length, 3);
  assert.ok(history.every((item) => item.id.startsWith("track-")));
  assert.ok(history.some((item) => item.code === "600000" && item.pinned));
});

test("similar tracking runs within 30 minutes merge without losing pin state", () => {
  const previous = normalizeTrackingHistory([trackingSnapshot({ pinned: true })]);
  const result = upsertTrackingSnapshot(previous, trackingSnapshot({
    createdAt: "2026-09-07T01:45:00.000Z",
    price: 10.02,
    score: 71
  }));
  assert.equal(result.merged, true);
  assert.equal(result.snapshots.length, 1);
  assert.equal(result.snapshot.pinned, true);
  assert.equal(result.snapshot.mergedCount, 2);
  const changed = upsertTrackingSnapshot(result.snapshots, trackingSnapshot({
    createdAt: "2026-09-07T01:50:00.000Z",
    price: 10.5,
    score: 76,
    changeType: "positive"
  }));
  assert.equal(changed.merged, false);
  assert.equal(changed.snapshots.length, 2);
  const reverted = upsertTrackingSnapshot(changed.snapshots, trackingSnapshot({
    createdAt: "2026-09-07T01:55:00.000Z",
    price: 10.02,
    score: 71
  }));
  assert.equal(reverted.merged, false);
  assert.equal(reverted.snapshots.length, 3);
});

test("tracking filters combine scope, tone, holdings, pins and stock search", () => {
  const history = normalizeTrackingHistory([
    trackingSnapshot({ code: "600001", name: "转强样本", changeType: "positive" }),
    trackingSnapshot({ code: "000001", name: "防守样本", stance: "谨慎防守", changeType: "negative", createdAt: "2026-09-07T01:20:00.000Z" }),
    trackingSnapshot({ code: "300001", name: "置顶样本", pinned: true, createdAt: "2026-09-07T01:10:00.000Z" })
  ]);
  assert.deepEqual(filterTrackingSnapshots(history, { scope: "current", currentCode: "600001" }).map((item) => item.code), ["600001"]);
  assert.deepEqual(filterTrackingSnapshots(history, { scope: "holdings", holdingCodes: ["000001"] }).map((item) => item.code), ["000001"]);
  assert.deepEqual(filterTrackingSnapshots(history, { scope: "pinned" }).map((item) => item.code), ["300001"]);
  assert.deepEqual(filterTrackingSnapshots(history, { scope: "all", tone: "defensive" }).map((item) => item.code), ["000001"]);
  assert.deepEqual(filterTrackingSnapshots(history, { scope: "all", query: "转强" }).map((item) => item.code), ["600001"]);
  assert.equal(trackingSnapshotTone(trackingSnapshot({ stance: "谨慎防守" })), "neutral");
});

test("tracking data trust compares quote time with snapshot time and detects incomplete facts", () => {
  assert.equal(trackingSnapshotTrust(trackingSnapshot()).status, "aligned");
  const lagged = trackingSnapshot({ createdAt: "2026-09-07T03:00:00.000Z" });
  lagged.facts.quote.timestamp = "2026-09-07T01:00:00.000Z";
  assert.equal(trackingSnapshotTrust(lagged).status, "lagged");
  delete lagged.facts.quote.source;
  assert.equal(trackingSnapshotTrust(lagged).status, "partial");
});
