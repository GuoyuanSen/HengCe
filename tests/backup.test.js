const test = require("node:test");
const assert = require("node:assert/strict");
const { createBackupEnvelope, openBackupEnvelope } = require("../electron/backup.js");
const { collectBackup, restoreBackup, validateBackup } = require("../src/local_backup.js");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  };
}

test("backup only collects durable local records and never API keys", () => {
  const storage = memoryStorage({
    "hengce.holdings.v2": JSON.stringify([{ code: "600519" }]),
    "hengce.tradeJournal.v1": JSON.stringify([{ id: "trade" }]),
    "hengce.dashboard.snapshots.v1": JSON.stringify([{ cached: true }]),
    "hengce.ai.apiKey": "secret"
  });
  const backup = collectBackup(storage, new Date("2026-09-04T00:00:00Z"));
  assert.deepEqual(Object.keys(backup.entries).sort(), ["hengce.holdings.v2", "hengce.tradeJournal.v1"]);
  assert.doesNotMatch(JSON.stringify(backup), /secret/);
});

test("encrypted backup round-trips and rejects a wrong password", () => {
  const payload = { app: "HengCe", schemaVersion: 1, exportedAt: "2026-09-04", entries: { "hengce.settings.v1": "{}" } };
  const envelope = createBackupEnvelope(payload, "strong-password", new Date("2026-09-04T00:00:00Z"));
  assert.equal(envelope.encrypted, true);
  assert.deepEqual(openBackupEnvelope(envelope, "strong-password"), payload);
  assert.throws(() => openBackupEnvelope(envelope, "wrong"), /密码错误|损坏/);
});

test("restore ignores unknown and malformed keys before replacing durable state", () => {
  const storage = memoryStorage({ "hengce.holdings.v2": "[]", "unrelated": "keep" });
  const payload = validateBackup({
    app: "HengCe",
    schemaVersion: 1,
    exportedAt: "2026-09-04",
    entries: {
      "hengce.holdings.v2": JSON.stringify([{ code: "000001" }]),
      "hengce.settings.v1": "not-json",
      "unknown": "{}"
    }
  });
  const result = restoreBackup(storage, payload);
  assert.deepEqual(result.restoredKeys, ["hengce.holdings.v2"]);
  assert.equal(storage.getItem("unrelated"), "keep");
  assert.match(storage.getItem("hengce.holdings.v2"), /000001/);
});
