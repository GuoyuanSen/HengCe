const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildValuationModel,
  parseAnalystForecast,
  parseCompanyForecast,
  parseFinancialReports,
  parseIndustryMembers,
  parseValuationSnapshot
} = require("../electron/valuation.js");

test("parses valuation, reports, guidance, and analyst estimates", () => {
  const snapshot = parseValuationSnapshot(
    {
      data: {
        f43: 32.27,
        f57: "603039",
        f58: "泛微网络",
        f116: 9927515241.42,
        f162: 39.95,
        f163: 34.39,
        f164: 30.57,
        f167: 3.78
      }
    },
    "603039"
  );
  assert.equal(snapshot.peTtm, 30.57);

  const reports = parseFinancialReports({
    result: {
      data: [
        {
          REPORTDATE: "2025-12-31 00:00:00",
          DATATYPE: "2025年 年报",
          QDATE: "2025Q4",
          BASIC_EPS: 1.14,
          YSTZ: -3.17,
          SJLTZ: 42.25,
          WEIGHTAVG_ROE: 12.55,
          MGJYXJJE: 1.09,
          BOARD_NAME: "软件开发",
          BOARD_CODE: "BK0737"
        },
        {
          REPORTDATE: "2026-03-31 00:00:00",
          DATATYPE: "2026年 一季报",
          QDATE: "2026Q1",
          BASIC_EPS: 0.24,
          YSTZ: 1.29,
          SJLTZ: 137.91,
          WEIGHTAVG_ROE: 2.42,
          BOARD_NAME: "软件开发",
          BOARD_CODE: "BK0737"
        }
      ]
    }
  });
  assert.equal(reports[0].reportDate, "2026-03-31");

  const guidance = parseCompanyForecast({
    result: {
      data: [
        {
          NOTICE_DATE: "2026-07-15",
          REPORT_DATE: "2026-06-30",
          PREDICT_FINANCE_CODE: "004",
          PREDICT_FINANCE: "归母净利润",
          ADD_AMP_LOWER: 52.22,
          ADD_AMP_UPPER: 82.66,
          PREDICT_TYPE: "预增"
        },
        {
          NOTICE_DATE: "2026-07-15",
          REPORT_DATE: "2026-06-30",
          PREDICT_FINANCE_CODE: "005",
          PREDICT_FINANCE: "扣非净利润",
          ADD_AMP_LOWER: 48.54,
          ADD_AMP_UPPER: 83.09,
          PREDICT_TYPE: "预增"
        }
      ]
    }
  });
  assert.equal(guidance.parentProfit.growthLow, 52.22);
  assert.equal(guidance.deductedProfit.growthHigh, 83.09);

  const analyst = parseAnalystForecast({
    result: {
      data: [
        {
          RATING_ORG_NUM: 5,
          YEAR1: 2025,
          YEAR_MARK1: "A",
          EPS1: 1.14,
          YEAR2: 2026,
          YEAR_MARK2: "E",
          EPS2: 1.39,
          YEAR3: 2027,
          YEAR_MARK3: "E",
          EPS3: 1.652,
          DEC_AIMPRICEMIN: 46.91,
          DEC_AIMPRICEMAX: 68,
          INDUSTRY_BOARD: "软件开发"
        }
      ]
    }
  });
  assert.equal(analyst.estimates[1].eps, 1.39);
  assert.equal(analyst.institutionCount, 5);
});

test("builds industry distribution and explainable valuation scenarios", () => {
  const industry = parseIndustryMembers(
    [
      {
        data: {
          diff: [
            { f3: 2, f9: 20, f62: 100, f267: 300 },
            { f3: 1, f9: 30, f62: 200, f267: 400 },
            { f3: -1, f9: 40, f62: -50, f267: 100 },
            { f3: 0.5, f9: 50, f62: 20, f267: -20 }
          ]
        }
      }
    ],
    "软件开发"
  );
  assert.equal(industry.peMedian, 35);
  assert.equal(industry.upCount, 3);
  assert.equal(industry.downCount, 1);
  assert.equal(industry.netFlow3Day, 780);

  const model = buildValuationModel({
    snapshot: {
      code: "603039",
      name: "泛微网络",
      price: 32.27,
      peDynamic: 39.95,
      peStatic: 34.39,
      peTtm: 30.57,
      pb: 3.78
    },
    reports: [
      {
        reportDate: "2026-03-31",
        reportType: "2026年 一季报",
        qdate: "2026Q1",
        eps: 0.24,
        revenueGrowth: 1.29,
        profitGrowth: 137.91,
        roe: 2.42
      },
      {
        reportDate: "2025-12-31",
        reportType: "2025年 年报",
        qdate: "2025Q4",
        eps: 1.14,
        revenueGrowth: -3.17,
        profitGrowth: 42.25,
        roe: 12.55,
        cashFlowPerShare: 1.09
      }
    ],
    companyForecast: {
      parentProfit: { growthLow: 52.22, growthHigh: 82.66 },
      deductedProfit: { growthLow: 48.54, growthHigh: 83.09 }
    },
    analystForecast: {
      institutionCount: 5,
      estimates: [
        { year: 2025, eps: 1.14, estimated: false },
        { year: 2026, eps: 1.39, estimated: true },
        { year: 2027, eps: 1.652, estimated: true }
      ],
      targetPriceLow: 46.91,
      targetPriceHigh: 68,
      industryName: "软件开发"
    },
    industry
  });

  assert.equal(model.applicable, true);
  assert.equal(model.earnings.expectedEps, 1.39);
  assert.ok(model.current.forwardPe > 23 && model.current.forwardPe < 24);
  assert.equal(model.scenarios.length, 3);
  assert.ok(model.fairRange.low < model.fairRange.base);
  assert.ok(model.fairRange.base < model.fairRange.high);
  assert.equal(model.confidence.label, "较高");
});

test("refuses PE fair-value scenarios for loss-making companies", () => {
  const model = buildValuationModel({
    snapshot: {
      code: "000001",
      name: "亏损样例",
      price: 10,
      peTtm: -12,
      peStatic: -10,
      peDynamic: -8,
      pb: 2
    }
  });
  assert.equal(model.applicable, false);
  assert.match(model.reason, /不适合直接使用PE/);
});

test("warns strongly cyclical industries instead of forcing a PE target", () => {
  const model = buildValuationModel({
    snapshot: {
      code: "601212",
      name: "周期样例",
      price: 10,
      peTtm: 12,
      peStatic: 14,
      peDynamic: 11,
      pb: 2
    },
    reports: [
      {
        reportDate: "2025-12-31",
        reportType: "2025年 年报",
        qdate: "2025Q4",
        eps: 0.8,
        industryName: "工业金属"
      }
    ],
    analystForecast: {
      institutionCount: 3,
      estimates: [{ year: 2026, eps: 0.9, estimated: true }],
      industryName: "有色金属"
    },
    industry: {
      name: "有色金属",
      profitableSampleSize: 20,
      temperatureScore: 50
    }
  });
  assert.equal(model.applicable, false);
  assert.match(model.reason, /强周期行业/);
  assert.match(model.reason, /PB/);
});
