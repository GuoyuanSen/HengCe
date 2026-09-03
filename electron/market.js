const INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: "000001",
    name: "上证指数",
    secid: "1.000001",
    tencentSymbol: "sh000001"
  }),
  Object.freeze({
    code: "399001",
    name: "深证成指",
    secid: "0.399001",
    tencentSymbol: "sz399001"
  }),
  Object.freeze({
    code: "399006",
    name: "创业板指",
    secid: "0.399006",
    tencentSymbol: "sz399006"
  })
]);

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(sh|sz)/, "");
}

function secidFor(code) {
  return /^[659]/.test(code) ? `1.${code}` : `0.${code}`;
}

function tencentSymbolFor(code) {
  return `${/^[659]/.test(code) ? "sh" : "sz"}${code}`;
}

function validatedCode(value) {
  const code = normalizeCode(value);
  if (!/^\d{6}$/.test(code)) {
    throw new Error("请输入6位A股代码");
  }
  return code;
}

function requiredNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label}数据无效`);
  }
  return parsed;
}

function parseTencentQuote(text, expectedCode, nameOverride) {
  const match = String(text || "").match(/="([^"]*)";?/);
  if (!match) {
    throw new Error("腾讯行情格式无效");
  }

  const fields = match[1].split("~");
  const code = String(fields[2] || expectedCode);
  if (!/^\d{6}$/.test(code) || (expectedCode && code !== expectedCode)) {
    throw new Error("腾讯行情代码不匹配");
  }

  const price = requiredNumber(fields[3], "最新价");
  const tradeSummary = String(fields[35] || "").split("/");
  const amount = Number(tradeSummary[2] || 0);
  return {
    code,
    name: nameOverride || fields[1] || code,
    price,
    previousClose: requiredNumber(fields[4] || price, "昨收"),
    open: requiredNumber(fields[5] || price, "今开"),
    high: requiredNumber(fields[33] || price, "最高价"),
    low: requiredNumber(fields[34] || price, "最低价"),
    percentChange: requiredNumber(fields[32] || 0, "涨跌幅"),
    volume: requiredNumber(fields[6] || 0, "成交量") * 100,
    amount: Number.isFinite(amount) ? amount : 0,
    timestamp: fields[30] || new Date().toISOString()
  };
}

function parseTencentKLines(payload, symbol) {
  const stock = payload?.data?.[symbol];
  const lines = stock?.qfqday || stock?.day;
  if (!Array.isArray(lines)) {
    throw new Error("腾讯历史行情格式无效");
  }

  let previousClose = null;
  return lines
    .map((line) => {
      if (!Array.isArray(line) || line.length < 6) return null;
      const bar = {
        date: String(line[0]),
        open: Number(line[1]),
        close: Number(line[2]),
        high: Number(line[3]),
        low: Number(line[4]),
        volume: Number(line[5]) * 100,
        amount: 0,
        percentChange:
          previousClose && Number(line[2])
            ? (Number(line[2]) / previousClose - 1) * 100
            : 0
      };
      previousClose = bar.close;
      return Object.values(bar).some((value) =>
        typeof value === "number" ? !Number.isFinite(value) : false
      )
        ? null
        : bar;
    })
    .filter(Boolean);
}

function parseTencentMinutePayload(payload, symbol) {
  const stock = payload?.data?.[symbol]?.data;
  const lines = stock?.data;
  const rawDate = String(stock?.date || "");
  if (!Array.isArray(lines) || !/^\d{8}$/.test(rawDate)) {
    throw new Error("腾讯分时行情格式无效");
  }
  const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
  return lines
    .map((line) => {
      const [rawTime, rawPrice, rawVolume, rawAmount] = String(line || "").trim().split(/\s+/);
      if (!/^\d{4}$/.test(rawTime)) return null;
      const minutes = Number(rawTime.slice(0, 2)) * 60 + Number(rawTime.slice(2));
      const inTradingSession =
        (minutes >= 570 && minutes <= 690) ||
        (minutes >= 780 && minutes <= 900);
      if (!inTradingSession) return null;
      const price = Number(rawPrice);
      const cumulativeLots = Number(rawVolume);
      const cumulativeAmount = Number(rawAmount);
      const averagePrice = cumulativeLots > 0 && cumulativeAmount > 0
        ? cumulativeAmount / (cumulativeLots * 100)
        : price;
      if (![price, averagePrice].every(Number.isFinite) || price <= 0 || averagePrice <= 0) {
        return null;
      }
      return {
        time: `${date} ${rawTime.slice(0, 2)}:${rawTime.slice(2)}`,
        price,
        averagePrice,
        source: "腾讯行情"
      };
    })
    .filter(Boolean);
}

module.exports = {
  INDEX_DEFINITIONS,
  normalizeCode,
  parseTencentKLines,
  parseTencentMinutePayload,
  parseTencentQuote,
  secidFor,
  tencentSymbolFor,
  validatedCode
};
