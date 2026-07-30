function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantile(values, ratio) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function parseValuationSnapshot(payload, fallbackCode) {
  const item = payload?.data;
  if (!item || !finiteNumber(item.f43)) {
    throw new Error("估值快照暂不可用");
  }
  return {
    code: String(item.f57 || fallbackCode),
    name: item.f58 || fallbackCode,
    price: finiteNumber(item.f43),
    marketCap: finiteNumber(item.f116),
    peDynamic: finiteNumber(item.f162),
    peStatic: finiteNumber(item.f163),
    peTtm: finiteNumber(item.f164),
    pb: finiteNumber(item.f167)
  };
}

function parseFinancialReports(payload) {
  const rows = Array.isArray(payload?.result?.data)
    ? payload.result.data
    : [];
  return rows
    .map((item) => ({
      reportDate: String(item.REPORTDATE || "").slice(0, 10),
      reportType: item.DATATYPE || item.DATEMMDD || "",
      qdate: item.QDATE || "",
      eps: finiteNumber(item.BASIC_EPS),
      revenue: finiteNumber(item.TOTAL_OPERATE_INCOME),
      netProfit: finiteNumber(item.PARENT_NETPROFIT),
      revenueGrowth: finiteNumber(item.YSTZ),
      profitGrowth: finiteNumber(item.SJLTZ),
      roe: finiteNumber(item.WEIGHTAVG_ROE),
      cashFlowPerShare: finiteNumber(item.MGJYXJJE),
      grossMargin: finiteNumber(item.XSMLL),
      industryName: item.BOARD_NAME || item.PUBLISHNAME || "",
      industryCode: item.BOARD_CODE || ""
    }))
    .filter((item) => item.reportDate)
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate));
}

function parseCompanyForecast(payload) {
  const rows = Array.isArray(payload?.result?.data)
    ? payload.result.data
    : [];
  const normalized = rows
    .map((item) => ({
      noticeDate: String(item.NOTICE_DATE || "").slice(0, 10),
      reportDate: String(item.REPORT_DATE || "").slice(0, 10),
      financeCode: String(item.PREDICT_FINANCE_CODE || ""),
      metric: item.PREDICT_FINANCE || "",
      amountLow: finiteNumber(item.PREDICT_AMT_LOWER),
      amountHigh: finiteNumber(item.PREDICT_AMT_UPPER),
      growthLow: finiteNumber(item.ADD_AMP_LOWER),
      growthHigh: finiteNumber(item.ADD_AMP_UPPER),
      type: item.PREDICT_TYPE || "",
      reason: item.CHANGE_REASON_EXPLAIN || ""
    }))
    .filter((item) => item.noticeDate)
    .sort((left, right) => right.noticeDate.localeCompare(left.noticeDate));

  const latestDate = normalized[0]?.noticeDate;
  const latest = normalized.filter((item) => item.noticeDate === latestDate);
  return {
    parentProfit:
      latest.find((item) => item.financeCode === "004") || latest[0] || null,
    deductedProfit:
      latest.find((item) => item.financeCode === "005") || null
  };
}

function parseAnalystForecast(payload) {
  const item = payload?.result?.data?.[0];
  if (!item) return null;
  const estimates = [];
  for (let index = 1; index <= 4; index += 1) {
    const year = finiteNumber(item[`YEAR${index}`]);
    const eps = finiteNumber(item[`EPS${index}`]);
    if (year && eps != null) {
      estimates.push({
        year,
        eps,
        estimated: item[`YEAR_MARK${index}`] === "E"
      });
    }
  }
  return {
    institutionCount: finiteNumber(item.RATING_ORG_NUM) || 0,
    estimates,
    targetPriceLow: finiteNumber(item.DEC_AIMPRICEMIN),
    targetPriceHigh: finiteNumber(item.DEC_AIMPRICEMAX),
    industryName: item.INDUSTRY_BOARD || ""
  };
}

function parseIndustryMembers(payloads, industryName = "") {
  const rows = payloads.flatMap((payload) =>
    Array.isArray(payload?.data?.diff) ? payload.data.diff : []
  );
  const peValues = rows
    .map((item) => finiteNumber(item.f9))
    .filter((value) => value != null && value >= 5 && value <= 150);
  const changes = rows
    .map((item) => finiteNumber(item.f3))
    .filter((value) => value != null);
  const upCount = changes.filter((value) => value > 0).length;
  const downCount = changes.filter((value) => value < 0).length;
  const breadth =
    changes.length > 0 ? (upCount - downCount) / changes.length : 0;
  const medianChange = quantile(changes, 0.5) || 0;
  const netFlowToday = rows.reduce(
    (sum, item) => sum + (finiteNumber(item.f62) || 0),
    0
  );
  const netFlow3Day = rows.reduce(
    (sum, item) => sum + (finiteNumber(item.f267) || 0),
    0
  );
  const flowSignal = netFlow3Day > 0 ? 1 : netFlow3Day < 0 ? -1 : 0;
  const temperatureScore = Math.round(
    clamp(50 + medianChange * 4 + breadth * 20 + flowSignal * 5, 0, 100)
  );
  const temperature =
    temperatureScore >= 65
      ? "偏热"
      : temperatureScore >= 55
        ? "偏暖"
        : temperatureScore <= 35
          ? "偏冷"
          : temperatureScore <= 45
            ? "转弱"
            : "中性";

  return {
    name: industryName,
    sampleSize: rows.length,
    profitableSampleSize: peValues.length,
    peQ25: quantile(peValues, 0.25),
    peMedian: quantile(peValues, 0.5),
    peQ75: quantile(peValues, 0.75),
    medianChange,
    upCount,
    downCount,
    netFlowToday,
    netFlow3Day,
    temperatureScore,
    temperature
  };
}

function annualReportFrom(reports) {
  return reports.find(
    (item) => item.qdate.endsWith("Q4") || item.reportType.includes("年报")
  );
}

function midpoint(low, high) {
  if (low == null && high == null) return null;
  if (low == null) return high;
  if (high == null) return low;
  return (low + high) / 2;
}

function isStronglyCyclical(industryName) {
  return /煤炭|有色|钢铁|贵金属|石油|油气|航运|养殖|化学原料|化学制品/.test(
    industryName || ""
  );
}

function buildValuationModel({
  snapshot,
  reports = [],
  companyForecast = { parentProfit: null, deductedProfit: null },
  analystForecast = null,
  industry = null,
  asOf = new Date().toISOString()
}) {
  const latestReport = reports[0] || null;
  const annualReport = annualReportFrom(reports);
  const estimates = analystForecast?.estimates || [];
  const currentEstimate = estimates.find((item) => item.estimated);
  const nextEstimate = estimates.find(
    (item) => item.estimated && item.year > (currentEstimate?.year || 0)
  );
  const guidance = companyForecast.parentProfit;
  const guidanceGrowth = guidance
    ? midpoint(guidance.growthLow, guidance.growthHigh)
    : null;
  const ttmEps =
    snapshot.peTtm > 0 ? snapshot.price / snapshot.peTtm : null;

  let expectedEps = currentEstimate?.eps || null;
  let expectationSource = currentEstimate
    ? `${analystForecast.institutionCount}家机构一致预期`
    : "";
  if (!(expectedEps > 0) && annualReport?.eps > 0) {
    const fallbackGrowth = clamp(
      (guidanceGrowth ?? latestReport?.profitGrowth ?? 0) / 100,
      -0.3,
      0.8
    );
    expectedEps = annualReport.eps * (1 + fallbackGrowth);
    expectationSource = guidance
      ? "年报EPS结合公司业绩预告推算"
      : "年报EPS结合最新利润增速推算";
  }
  if (!(expectedEps > 0) && ttmEps > 0) {
    expectedEps = ttmEps;
    expectationSource = "TTM每股收益";
  }

  const expectedGrowth =
    expectedEps > 0 && annualReport?.eps > 0
      ? expectedEps / annualReport.eps - 1
      : null;
  const nextYearGrowth =
    nextEstimate?.eps > 0 && expectedEps > 0
      ? nextEstimate.eps / expectedEps - 1
      : expectedGrowth;
  const forwardPe =
    expectedEps > 0 ? snapshot.price / expectedEps : null;
  const industryName =
    industry?.name || latestReport?.industryName || analystForecast?.industryName;

  let confidenceScore = 20;
  if (annualReport?.eps != null) confidenceScore += 15;
  if (latestReport) confidenceScore += 10;
  if (guidance) confidenceScore += 15;
  if (companyForecast.deductedProfit) confidenceScore += 5;
  if (currentEstimate && analystForecast.institutionCount >= 3) {
    confidenceScore += 20;
  }
  if (industry?.profitableSampleSize >= 10) confidenceScore += 15;
  confidenceScore = Math.min(100, confidenceScore);
  const confidence =
    confidenceScore >= 80 ? "较高" : confidenceScore >= 55 ? "中等" : "偏低";

  const peUnavailable = !(expectedEps > 0) || !(snapshot.peTtm > 0);
  const cyclical = isStronglyCyclical(industryName);
  if (peUnavailable || cyclical) {
    return {
      code: snapshot.code,
      name: snapshot.name,
      asOf,
      applicable: false,
      reason: cyclical
        ? `${industryName}属于强周期行业，单一PE容易在盈利高点给出虚假低估，应优先结合PB、商品价格和周期中枢判断。`
        : "当前盈利或每股收益数据不足，不适合直接使用PE估值。",
      current: {
        ...snapshot,
        ttmEps,
        forwardPe
      },
      earnings: {
        latestReport,
        annualReport,
        guidance,
        deductedGuidance: companyForecast.deductedProfit,
        expectedEps,
        expectedGrowth,
        nextEstimate,
        expectationSource,
        analystForecast
      },
      industry,
      confidence: { score: confidenceScore, label: confidence }
    };
  }

  const growthPercent = clamp((nextYearGrowth || 0) * 100, 0, 45);
  const growthPe = clamp(growthPercent * 1.4, 12, 45);
  const industryAnchor = clamp(
    industry?.peQ25 || snapshot.peTtm || growthPe,
    10,
    55
  );
  let qualityAdjustment = 0;
  if ((annualReport?.roe || 0) >= 15) qualityAdjustment += 0.04;
  else if ((annualReport?.roe || 0) < 8) qualityAdjustment -= 0.04;
  if ((annualReport?.revenueGrowth || 0) >= 10) qualityAdjustment += 0.03;
  else if ((annualReport?.revenueGrowth || 0) < 0) qualityAdjustment -= 0.03;
  if (
    annualReport?.cashFlowPerShare != null &&
    annualReport?.eps > 0 &&
    annualReport.cashFlowPerShare >= annualReport.eps * 0.8
  ) {
    qualityAdjustment += 0.03;
  }
  if (companyForecast.deductedProfit && guidanceGrowth > 20) {
    qualityAdjustment += 0.02;
  }
  qualityAdjustment = clamp(qualityAdjustment, -0.08, 0.08);
  const temperatureAdjustment = industry
    ? clamp((industry.temperatureScore - 50) / 500, -0.08, 0.08)
    : 0;
  const basePe = clamp(
    (growthPe * 0.6 + industryAnchor * 0.4) *
      (1 + qualityAdjustment + temperatureAdjustment),
    10,
    50
  );
  const conservativePe = clamp(basePe * 0.78, 8, basePe);
  const optimisticCeiling = Math.max(
    basePe,
    Math.min(industry?.peMedian || basePe * 1.35, 60)
  );
  const optimisticPe = clamp(
    basePe * 1.25,
    basePe,
    optimisticCeiling
  );
  const conservativeEps = expectedEps * 0.9;
  const optimisticEps = Math.max(
    expectedEps,
    Math.min(nextEstimate?.eps || expectedEps * 1.15, expectedEps * 1.2)
  );
  const scenarios = [
    {
      key: "conservative",
      label: "保守",
      eps: conservativeEps,
      targetPe: conservativePe,
      price: conservativeEps * conservativePe,
      note: "预期EPS下修10%，估值折价"
    },
    {
      key: "base",
      label: "基准",
      eps: expectedEps,
      targetPe: basePe,
      price: expectedEps * basePe,
      note: `${expectationSource}，结合行业估值`
    },
    {
      key: "optimistic",
      label: "乐观",
      eps: optimisticEps,
      targetPe: optimisticPe,
      price: optimisticEps * optimisticPe,
      note: "业绩兑现且行业温度维持"
    }
  ];

  return {
    code: snapshot.code,
    name: snapshot.name,
    asOf,
    applicable: true,
    method:
      "预期EPS × 目标PE；目标PE由增速、行业分位、盈利质量和行业温度共同约束",
    current: {
      ...snapshot,
      ttmEps,
      forwardPe
    },
    earnings: {
      latestReport,
      annualReport,
      guidance,
      deductedGuidance: companyForecast.deductedProfit,
      expectedEps,
      expectedGrowth,
      nextEstimate,
      nextYearGrowth,
      expectationSource,
      analystForecast
    },
    industry,
    adjustments: {
      quality: qualityAdjustment,
      temperature: temperatureAdjustment
    },
    scenarios,
    fairRange: {
      low: scenarios[0].price,
      base: scenarios[1].price,
      high: scenarios[2].price
    },
    confidence: { score: confidenceScore, label: confidence }
  };
}

module.exports = {
  buildValuationModel,
  parseAnalystForecast,
  parseCompanyForecast,
  parseFinancialReports,
  parseIndustryMembers,
  parseValuationSnapshot,
  quantile,
  isStronglyCyclical
};
