(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HengCePreferences = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function normalizeCode(value) {
    const code = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^(sh|sz)/, "");
    return /^\d{6}$/.test(code) ? code : null;
  }

  function holdingValue(holding) {
    const shares = Number(holding?.shares);
    const cost = Number(holding?.cost);
    return Number.isFinite(shares) && Number.isFinite(cost) && shares > 0 && cost > 0
      ? shares * cost
      : 0;
  }

  function preferredHolding(holdings = []) {
    const valid = holdings.filter((holding) => normalizeCode(holding?.code));
    return (
      valid.find((holding) => holding.primary) ||
      [...valid].sort((left, right) => holdingValue(right) - holdingValue(left))[0] ||
      null
    );
  }

  function initialCodeCandidates(options = {}) {
    const holding = preferredHolding(options.holdings);
    const candidates = [
      options.defaultCode,
      options.lastCode,
      holding?.code,
      options.watchlist?.[0]?.code,
      options.fallbackCode || "603039"
    ];
    return [...new Set(candidates.map(normalizeCode).filter(Boolean))];
  }

  function resolveInitialCode(options = {}) {
    return initialCodeCandidates(options)[0] || "603039";
  }

  function setPrimaryHolding(holdings = [], code) {
    const normalized = normalizeCode(code);
    if (!normalized) return holdings.map((holding) => ({ ...holding, primary: false }));
    return holdings.map((holding) => ({
      ...holding,
      primary: normalizeCode(holding.code) === normalized
    }));
  }

  return {
    holdingValue,
    initialCodeCandidates,
    normalizeCode,
    preferredHolding,
    resolveInitialCode,
    setPrimaryHolding
  };
});
