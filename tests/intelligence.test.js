const test = require("node:test");
const assert = require("node:assert/strict");
const {
  GLOBAL_OFFICIAL_FEEDS,
  attachMarketConfirmation,
  buildIntelligenceSnapshot,
  classifyEvent,
  dedupeEvents,
  parseSinaRoll,
  parseOfficialRss,
  parseWallstreetLives,
  titleSimilarity
} = require("../electron/intelligence.js");
const {
  EVENT_INTERPRETATION_SCHEMA,
  answerIntelligenceQuestion,
  buildMacroPulse,
  lifecycleChanges,
  localEventInterpretation,
  marketBriefs,
  portfolioImpacts
} = require("../src/intelligence.js");

test("parses official global RSS with exact source time and host allowlist", () => {
  const source = GLOBAL_OFFICIAL_FEEDS.find((item) => item.key === "fed");
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title><![CDATA[FOMC issues monetary policy statement]]></title>
    <link><![CDATA[https://www.federalreserve.gov/newsevents/pressreleases/monetary20260904a.htm]]></link>
    <description>Federal Reserve updates its interest rate decision.</description>
    <category>Monetary Policy</category>
    <pubDate>Fri, 04 Sep 2026 18:00:00 GMT</pubDate>
  </item><item><title>Blocked host</title><link>https://example.com/x</link><pubDate>Fri, 04 Sep 2026 18:00:00 GMT</pubDate></item></channel></rss>`;
  const events = parseOfficialRss(xml, source);
  assert.equal(events.length, 1);
  assert.equal(events[0].sourceTier, "一手官方");
  assert.equal(events[0].publishedAt, "2026-09-04T18:00:00.000Z");
  assert.equal(events[0].category, "Monetary Policy");
  assert.equal(events[0].categoryZh, "美联储货币政策");
  const snapshot = buildIntelligenceSnapshot([...events, {
    id: "cn-1",
    title: "美联储公布最新利率决定",
    summary: "市场等待政策路径说明",
    source: "公开快讯",
    publishedAt: "2026-09-04T19:00:00.000Z",
    url: "https://example.com/fed",
    providerScore: 2
  }], { asOf: "2026-09-04T19:10:00Z" });
  const official = snapshot.events.find((item) => item.official);
  assert.equal(official.themeKey, "macro-policy");
  assert.deepEqual(official.corroboratedBy, ["公开快讯"]);
  assert.equal(snapshot.summary.officialCount, 1);
});

test("parses public Wallstreet and Sina event feeds with source links", () => {
  const wallstreet = parseWallstreetLives({ data: { items: [{
    id: 12,
    title: "固态电池进入装车验证",
    content_text: "企业计划开展固态电池装车验证。（公司公告）",
    display_time: 1788426000,
    score: 2,
    uri: "https://wallstreetcn.com/livenews/12"
  }] } });
  const sina = parseSinaRoll({ result: { data: [{
    docid: "abc",
    title: "央行公布最新社融数据",
    intro: "新增信贷保持平稳",
    ctime: 1788426100,
    level: 2,
    media_name: "新浪财经",
    url: "https://finance.sina.com.cn/test.shtml"
  }] } });
  assert.equal(wallstreet[0].source, "华尔街见闻");
  assert.equal(wallstreet[0].origin, "公司公告");
  assert.equal(sina[0].source, "新浪财经");
  assert.match(sina[0].url, /^https:/);
});

test("classifies themes, sentiment and importance without treating text as instructions", () => {
  const event = classifyEvent({
    id: "e1",
    title: "固态电池扩产计划获批",
    summary: "新能源车产业链获得政策支持",
    publishedAt: new Date("2026-09-03T06:00:00Z").toISOString(),
    source: "测试",
    url: "https://example.com",
    providerScore: 2
  }, new Date("2026-09-03T07:00:00Z").getTime());
  assert.equal(event.themeKey, "new-energy");
  assert.equal(event.sentiment, "positive");
  assert.ok(event.importance >= 50);
});

test("deduplicates similar headlines and preserves independent source names", () => {
  const base = {
    summary: "",
    publishedAt: "2026-09-03T06:00:00Z",
    importance: 70
  };
  const items = dedupeEvents([
    { ...base, id: "1", title: "央行公布最新社会融资规模数据", source: "甲" },
    { ...base, id: "2", title: "央行发布最新社会融资规模数据", source: "乙" }
  ]);
  assert.ok(titleSimilarity("央行公布最新社会融资规模数据", "央行发布最新社会融资规模数据") > 0.7);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].alsoReportedBy, ["乙"]);
});

test("builds explainable lifecycle themes and compares prior activity", () => {
  const events = Array.from({ length: 5 }, (_, index) => ({
    id: `e${index}`,
    title: `AI服务器扩产与算力订单增长 ${index}`,
    summary: "数据中心和光模块需求增长",
    publishedAt: new Date(Date.parse("2026-09-03T07:00:00Z") - index * 120000).toISOString(),
    source: "公开快讯",
    url: `https://example.com/${index}`,
    providerScore: 2
  }));
  const snapshot = buildIntelligenceSnapshot(events, { asOf: "2026-09-03T07:10:00Z" });
  assert.equal(snapshot.themes[0].key, "ai-computing");
  assert.ok(snapshot.themes[0].newsCount >= 1);
  assert.ok(snapshot.themes[0].reason);
  assert.equal(snapshot.summary.themeCount, 1);
  const confirmed = attachMarketConfirmation(snapshot, {
    sourceStatus: { partial: false },
    composite: [{ name: "光模块", score: 82, strength: "强势", changePercent: 3.2, todayNetFlow: 2e8 }],
    todayFlow: [],
    threeDayFlow: []
  });
  assert.equal(confirmed.themes[0].marketConfirmation.key, "confirmed");
  assert.equal(confirmed.summary.confirmedCount, 1);
});

test("high-frequency public feeds cannot crowd official events out of the radar", () => {
  const asOf = "2026-09-04T18:00:00Z";
  const publicEvents = Array.from({ length: 90 }, (_, index) => ({
    id: `public-${index}`,
    title: `${Array.from({ length: 12 }, (_, offset) => String.fromCharCode(0x4e00 + index * 13 + offset)).join("")} 机器人订单变化`,
    summary: "机器人产业公开信息",
    source: "聚合快讯",
    publishedAt: new Date(Date.parse(asOf) - index * 60000).toISOString(),
    url: `https://example.com/${index}`,
    providerScore: 1
  }));
  const official = {
    id: "official-old",
    title: "Federal Reserve publishes monetary policy minutes",
    summary: "Official monetary policy material",
    source: "美联储",
    origin: "Federal Reserve Board",
    publishedAt: "2026-09-03T18:00:00Z",
    url: "https://www.federalreserve.gov/example",
    providerScore: 1.5,
    official: true,
    sourceTier: "一手官方"
  };
  const snapshot = buildIntelligenceSnapshot([...publicEvents, official], { asOf });
  assert.equal(snapshot.events.some((item) => item.id === "official-old"), true);
  assert.equal(snapshot.summary.officialCount, 1);
  assert.ok(snapshot.events.length <= 90);
});

test("maps themes to holdings and produces local briefs and event interpretation", () => {
  const theme = {
    key: "finance-property",
    label: "金融与地产",
    phase: { key: "warming", label: "升温" },
    activityScore: 68,
    sentimentCounts: { positive: 2, negative: 0 },
    industryTerms: ["保险", "银行"],
    representatives: [{ code: "601318", name: "中国平安" }]
  };
  const event = {
    id: "e1",
    title: "保险行业保费增长",
    summary: "保险公司披露经营数据",
    themeKey: theme.key,
    theme: theme.label,
    importance: 66,
    sentiment: "positive",
    publishedAt: "2026-09-03T02:00:00Z"
  };
  const impacts = portfolioImpacts([theme], [event], [{ code: "601318", name: "中国平安", industry: "保险Ⅱ" }], []);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].direction, "偏积极");
  const report = localEventInterpretation(event, theme);
  assert.match(report.conclusion, /金融与地产/);
  assert.equal(EVENT_INTERPRETATION_SCHEMA.additionalProperties, false);
  const briefs = marketBriefs({ events: [event] }, new Date("2026-09-03T09:00:00Z"));
  assert.equal(briefs.length, 3);
  assert.match(answerIntelligenceQuestion("portfolio", { themes: [theme], events: [event] }, impacts).summary, /1 条/);
  assert.equal(buildMacroPulse({ events: [] }, { regime: { label: "风险偏好回升", score: 0.5, confidence: "较高" } }).regime, "风险偏好回升");
  assert.deepEqual(
    lifecycleChanges(
      [{ key: "x", label: "主题", phase: { key: "hot", label: "高热" }, activityScore: 80 }],
      [{ key: "x", label: "主题", phase: { key: "warming", label: "升温" }, activityScore: 65 }]
    )[0].text,
    "升温 → 高热"
  );
});
