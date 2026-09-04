const LIMIT_POOL_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "limitUpCount", endpoint: "getTopicZTPool", sort: "fbt:asc" }),
  Object.freeze({ key: "limitDownCount", endpoint: "getTopicDTPool", sort: "fund:asc" }),
  Object.freeze({ key: "brokenBoardCount", endpoint: "getTopicZBPool", sort: "fbt:asc" })
]);

function parseLimitPoolPayload(payload, definition) {
  const count = Number(payload?.data?.tc);
  const rawDate = String(payload?.data?.qdate || "");
  if (payload?.rc !== 0 || !Number.isFinite(count) || !/^\d{8}$/.test(rawDate)) return null;
  return {
    key: definition.key,
    count,
    date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
  };
}

function mergeLimitPools(entries = []) {
  const output = {
    date: entries.find(Boolean)?.date || "",
    limitUpCount: null,
    limitDownCount: null,
    brokenBoardCount: null
  };
  entries.filter(Boolean).forEach((entry) => {
    output[entry.key] = entry.count;
  });
  output.partial = entries.filter(Boolean).length < LIMIT_POOL_DEFINITIONS.length;
  return output;
}

function parseExchangeBreadthPayload(payload) {
  const rows = payload?.data?.diff;
  if (!Array.isArray(rows) || !rows.length) return null;
  const exchanges = rows.map((row) => ({
    code: String(row?.f12 || ""),
    name: String(row?.f14 || ""),
    upCount: Number(row?.f104),
    downCount: Number(row?.f105),
    flatCount: Number(row?.f106)
  })).filter((row) =>
    row.code && row.name && [row.upCount, row.downCount, row.flatCount].every(Number.isFinite)
  );
  if (!exchanges.length) return null;
  const upCount = exchanges.reduce((sum, row) => sum + row.upCount, 0);
  const downCount = exchanges.reduce((sum, row) => sum + row.downCount, 0);
  const flatCount = exchanges.reduce((sum, row) => sum + row.flatCount, 0);
  const directional = upCount + downCount;
  return {
    upCount,
    downCount,
    flatCount,
    measuredStocks: directional + flatCount,
    advancingRate: directional ? upCount / directional : null,
    exchanges
  };
}

module.exports = {
  LIMIT_POOL_DEFINITIONS,
  mergeLimitPools,
  parseExchangeBreadthPayload,
  parseLimitPoolPayload
};
