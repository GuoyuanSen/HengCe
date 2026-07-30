const test = require("node:test");
const assert = require("node:assert/strict");
const {
  boardScore,
  buildHotspotSnapshot,
  isNoisyConcept,
  normalizeBoardName,
  parseBoardPayload
} = require("../electron/hotspots.js");

function payload(rows) {
  return { data: { diff: rows } };
}

test("normalizes industry levels and removes technical concept buckets", () => {
  assert.equal(normalizeBoardName("白酒Ⅲ"), "白酒");
  assert.equal(isNoisyConcept("昨日连板_含一字"), true);
  assert.equal(isNoisyConcept("人工智能"), false);

  const rows = parseBoardPayload(
    payload([
      { f12: "BK0001", f14: "机器人", f3: 2.5 },
      { f12: "BK0002", f14: "昨日涨停", f3: 6.2 }
    ]),
    "概念"
  );
  assert.deepEqual(
    rows.map((item) => item.name),
    ["机器人"]
  );
});

test("scores sustained flow and breadth above a weak board", () => {
  const strong = boardScore({
    changePercent: 4,
    todayNetFlow: 2e9,
    todayFlowRate: 8,
    netFlow3Day: 5e9,
    flowRate3Day: 9,
    upCount: 30,
    downCount: 4
  });
  const weak = boardScore({
    changePercent: -1,
    todayNetFlow: -2e9,
    todayFlowRate: -4,
    netFlow3Day: -3e9,
    flowRate3Day: -3,
    upCount: 4,
    downCount: 25
  });
  assert.ok(strong >= 75);
  assert.ok(weak < 45);
  assert.ok(strong > weak);
});

test("builds composite and flow rankings with de-duplication and partial status", () => {
  const sources = [
    {
      type: "行业",
      payload: payload([
        {
          f12: "BK1001",
          f14: "白酒Ⅱ",
          f3: 3.2,
          f62: 2e9,
          f184: 7,
          f104: 28,
          f105: 3,
          f128: "领涨甲",
          f136: 9.9,
          f267: 5e9,
          f268: 8
        },
        {
          f12: "BK1002",
          f14: "软件开发",
          f3: 1.5,
          f62: 1e9,
          f184: 3,
          f104: 40,
          f105: 20,
          f267: 2e9,
          f268: 4
        }
      ])
    },
    {
      type: "行业",
      payload: payload([
        {
          f12: "BK1003",
          f14: "白酒Ⅲ",
          f3: 2.9,
          f62: 1.8e9,
          f184: 6,
          f104: 24,
          f105: 5,
          f267: 4.8e9,
          f268: 7
        }
      ])
    },
    {
      type: "概念",
      payload: payload([
        {
          f12: "BK2001",
          f14: "机器人",
          f3: 2.7,
          f62: 2.5e9,
          f184: 6,
          f104: 45,
          f105: 10,
          f267: 6e9,
          f268: 8
        },
        {
          f12: "BK2002",
          f14: "昨日连板",
          f3: 8,
          f62: 9e9,
          f184: 12,
          f104: 50,
          f105: 0,
          f267: 12e9,
          f268: 15
        }
      ])
    }
  ];
  const snapshot = buildHotspotSnapshot(sources, {
    asOf: "2026-07-30T02:00:00.000Z",
    requestedSources: 6
  });

  assert.equal(snapshot.sourceStatus.partial, true);
  assert.equal(snapshot.sourceStatus.loaded, 3);
  assert.equal(snapshot.summary.totalBoards, 3);
  assert.equal(
    snapshot.composite.filter((item) => item.name === "白酒").length,
    1
  );
  assert.equal(
    snapshot.composite.some((item) => item.name.includes("昨日")),
    false
  );
  assert.equal(snapshot.threeDayFlow[0].name, "机器人");
  assert.ok(snapshot.composite[0].score >= snapshot.composite[1].score);
});
