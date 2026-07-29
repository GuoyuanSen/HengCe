const INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({ code: "000001", name: "上证指数", secid: "1.000001" }),
  Object.freeze({ code: "399001", name: "深证成指", secid: "0.399001" }),
  Object.freeze({ code: "399006", name: "创业板指", secid: "0.399006" })
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

function validatedCode(value) {
  const code = normalizeCode(value);
  if (!/^\d{6}$/.test(code)) {
    throw new Error("请输入6位A股代码");
  }
  return code;
}

module.exports = {
  INDEX_DEFINITIONS,
  normalizeCode,
  secidFor,
  validatedCode
};
