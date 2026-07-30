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

module.exports = {
  INDEX_DEFINITIONS,
  normalizeCode,
  parseTencentKLines,
  parseTencentQuote,
  secidFor,
  tencentSymbolFor,
  validatedCode
};
