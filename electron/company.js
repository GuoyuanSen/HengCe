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

function announcementKind(title, columns = []) {
  const text = `${title} ${columns.join(" ")}`;
  if (/立案|处罚|退市|违规|诉讼|风险提示/.test(text)) return { key: "risk", label: "风险事项", importance: 85 };
  if (/减持|质押|解禁/.test(text)) return { key: "holding", label: "股东变动", importance: 78 };
  if (/年度报告|半年度报告|季度报告|业绩预告|业绩快报/.test(text)) return { key: "earnings", label: "业绩财报", importance: 76 };
  if (/回购|增持|分红|利润分配/.test(text)) return { key: "capital", label: "资本动作", importance: 70 };
  if (/中标|合同|投资|收购|重组|扩产/.test(text)) return { key: "operation", label: "经营事项", importance: 66 };
  return { key: "general", label: columns[0] || "公司公告", importance: 45 };
}

function parseStockAnnouncements(payload, expectedCode) {
  const rows = payload?.data?.list;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const code = String(item?.codes?.[0]?.stock_code || expectedCode || "").trim();
    if (!/^\d{6}$/.test(code) || (expectedCode && code !== expectedCode)) return null;
    const columns = (item.columns || []).map((column) => compactText(column.column_name, 50)).filter(Boolean);
    const rawTitle = compactText(item.title_ch || item.title, 220);
    const shortName = compactText(item?.codes?.[0]?.short_name, 40);
    const title = shortName && (rawTitle.startsWith(`${shortName}:`) || rawTitle.startsWith(`${shortName}：`))
      ? rawTitle.slice(shortName.length + 1)
      : rawTitle;
    const artCode = compactText(item.art_code, 40);
    const kind = announcementKind(title, columns);
    return {
      id: artCode,
      code,
      title,
      publishedAt: compactText(item.notice_date || item.display_time, 24).slice(0, 10),
      columns: columns.slice(0, 4),
      kind,
      url: artCode ? `https://data.eastmoney.com/notices/detail/${code}/${artCode}.html` : ""
    };
  }).filter((item) => item?.id && item.title && item.url);
}

module.exports = {
  announcementKind,
  compactText,
  parseCompanyOrganization,
  parseStockAnnouncements,
  profileSecucode
};
