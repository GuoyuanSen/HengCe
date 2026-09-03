const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCompanyOrganization, profileSecucode } = require("../electron/company.js");

test("company profile maps exchange suffixes and public business fields", () => {
  assert.equal(profileSecucode("688239"), "688239.SH");
  assert.equal(profileSecucode("300750"), "300750.SZ");
  const profile = parseCompanyOrganization({ result: { data: [{
    ORG_NAME: " 贵州航宇科技发展股份有限公司 ",
    TRADE_MARKETT: "上交所科创板",
    BOARD_NAME_LEVEL: "国防军工-航空装备Ⅱ-航空装备Ⅲ",
    MAIN_BUSINESS: "航空环形锻件研发、生产和销售",
    ORG_PROFILE: " 公司简介\n包含换行 ",
    EMP_NUM: 939,
    LISTING_DATE: "2021-07-05 00:00:00"
  }] } });
  assert.equal(profile.tradeBoard, "上交所科创板");
  assert.match(profile.industryPath, /航空装备/);
  assert.equal(profile.companyProfile, "公司简介 包含换行");
  assert.equal(profile.employees, 939);
  assert.equal(profile.listedAt, "2021-07-05");
});
