function compactText(value, maximum = 1200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function profileSecucode(code) {
  const normalized = String(code || "").trim();
  if (!/^\d{6}$/.test(normalized)) throw new Error("股票代码格式不正确");
  return `${normalized}.${/^(6|9)/.test(normalized) ? "SH" : "SZ"}`;
}

function parseCompanyOrganization(payload, fallback = {}) {
  const item = payload?.result?.data?.[0];
  if (!item) return null;
  return {
    fullName: compactText(item.ORG_NAME, 100) || fallback.name || "",
    shortName: compactText(item.SECURITY_NAME_ABBR, 40) || fallback.name || "",
    tradeBoard: compactText(item.TRADE_MARKETT || item.SECURITY_TYPE, 60),
    industryPath: compactText(item.BOARD_NAME_LEVEL || item.EM2016, 160),
    regulatorIndustry: compactText(item.INDUSTRYCSRC1, 160),
    mainBusiness: compactText(item.MAIN_BUSINESS, 600),
    companyProfile: compactText(item.ORG_PROFILE, 1800),
    businessScope: compactText(item.BUSINESS_SCOPE, 1200),
    province: compactText(item.PROVINCE, 30),
    website: compactText(item.ORG_WEB, 160),
    employees: Number.isFinite(Number(item.EMP_NUM)) ? Number(item.EMP_NUM) : null,
    foundedAt: compactText(item.FOUND_DATE, 20).slice(0, 10) || null,
    listedAt: compactText(item.LISTING_DATE, 20).slice(0, 10) || null
  };
}

module.exports = { compactText, parseCompanyOrganization, profileSecucode };
