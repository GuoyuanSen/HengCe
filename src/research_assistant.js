(function exposeResearchAssistant(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HengCeResearchAssistant = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createResearchAssistant() {
  const CONTEXT_ANSWER_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "perspectives", "risks", "nextChecks", "sourceLabels", "limitations"],
    properties: {
      summary: { type: "string" },
      perspectives: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role", "conclusion", "evidence"],
          properties: {
            role: { type: "string" },
            conclusion: { type: "string" },
            evidence: { type: "array", items: { type: "string" } }
          }
        }
      },
      risks: { type: "array", items: { type: "string" } },
      nextChecks: { type: "array", items: { type: "string" } },
      sourceLabels: { type: "array", items: { type: "string" } },
      limitations: { type: "array", items: { type: "string" } }
    }
  };

  function text(value, maximum = 500) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
  }

  function strings(values, maximumItems = 8, maximumLength = 180) {
    return (Array.isArray(values) ? values : [])
      .map((value) => text(value, maximumLength))
      .filter(Boolean)
      .slice(0, maximumItems);
  }

  function decimal(value, digits = 2) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : "--";
  }

  function normalizeContextAnswer(value = {}) {
    return {
      summary: text(value.summary, 800) || "当前事实不足，暂不形成方向判断。",
      perspectives: (Array.isArray(value.perspectives) ? value.perspectives : [])
        .map((item) => ({
          role: text(item?.role, 40) || "综合",
          conclusion: text(item?.conclusion, 500) || "等待更多数据",
          evidence: strings(item?.evidence, 6, 220)
        }))
        .slice(0, 6),
      risks: strings(value.risks, 8, 220),
      nextChecks: strings(value.nextChecks, 8, 220),
      sourceLabels: strings(value.sourceLabels, 12, 100),
      limitations: strings(value.limitations, 8, 220)
    };
  }

  function localContextAnswer(question, context = {}) {
    const facts = context.stockFacts || {};
    const report = context.stockReport || {};
    const portfolio = context.portfolioRisk || {};
    const intelligence = context.intelligence || {};
    const query = text(question, 500);
    const perspectives = [];
    if (facts.code) {
      perspectives.push({
        role: "技术与价格",
        conclusion: `${facts.name || facts.code} 当前量化评分 ${decimal(facts.technical?.score, 0)}，${facts.technical?.trend || "趋势待确认"}。`,
        evidence: [
          facts.quote?.price != null ? `最新价 ${decimal(facts.quote.price)}，涨跌幅 ${decimal(facts.quote.percentChange)}%` : "最新报价暂缺",
          facts.observationPlan?.invalidation != null ? `策略失效位 ${decimal(facts.observationPlan.invalidation)}` : "失效位尚未形成"
        ]
      });
      perspectives.push({
        role: "基本面与估值",
        conclusion: facts.valuation?.applicable
          ? `当前使用${facts.valuation.method || "模型估值"}，估值仅作情景约束。`
          : `当前估值模型不适用或数据不足：${facts.valuation?.reason || "等待财务数据"}。`,
        evidence: [facts.industry ? `所属行业：${facts.industry}` : "行业资料暂缺"]
      });
    }
    if (portfolio.positionCount) {
      perspectives.push({
        role: "组合风控",
        conclusion: `组合风险为${portfolio.riskLevel || "等待数据"}，最大单股权重 ${Math.round((portfolio.maxWeight || 0) * 100)}%。`,
        evidence: [
          `持仓 ${portfolio.positionCount} 只`,
          portfolio.maxDrawdown != null ? `近120日代理最大回撤 ${(portfolio.maxDrawdown * 100).toFixed(1)}%` : "回撤样本不足"
        ]
      });
    }
    if (intelligence.themes?.length) {
      const theme = intelligence.themes[0];
      perspectives.push({
        role: "事件与市场",
        conclusion: `当前活跃主题为${theme.label || "市场综合"}，阶段${theme.phase?.label || "观察"}。`,
        evidence: [`事件 ${theme.newsCount || 0} 条`, `活跃度 ${theme.activityScore || 0}`]
      });
    }
    const asksTrade = /买|卖|加仓|减仓|止损|仓位/.test(query);
    const risks = strings([
      ...(report.risks || []),
      ...(portfolio.riskAlerts || []),
      asksTrade ? "本地规则不能替代成交能力、流动性和个人风险承受判断" : null
    ], 8, 220);
    return normalizeContextAnswer({
      summary: perspectives.length
        ? `围绕“${query}”，本地规则已从价格、估值、组合和事件事实中整理可验证线索；未配置 AI Key 时不做超出规则的语义推断。`
        : "当前上下文数据不足，请先刷新标的、持仓或市场情报。",
      perspectives,
      risks,
      nextChecks: strings([
        ...(report.nextChecks || []),
        facts.observationPlan?.invalidation != null ? `确认价格是否守住失效位 ${decimal(facts.observationPlan.invalidation)}` : null,
        "核对最新行情时间与原始公告/新闻来源"
      ]),
      sourceLabels: strings(facts.sources || ["本地量化规则"]),
      limitations: ["这是基于当前已加载数据的研究辅助，不构成买卖指令", "未配置 AI Key 时仅进行关键词与规则归纳"]
    });
  }

  function contextAssistantInstructions() {
    return [
      "你是衡策中的审慎型A股研究助手。只能使用用户问题和输入事实包，不得调用或假装拥有外部信息。",
      "把结论拆成技术与价格、基本面与估值、事件与市场、组合风控等不同视角；没有证据的视角可以省略。",
      "区分事实、推断和待验证项。不得编造价格、财务数字、公告正文、新闻正文或来源。",
      "不得给出保证性收益、确定买卖指令或替用户决定仓位。涉及交易时必须给出风险与失效条件。",
      "sourceLabels 只能复用事实包中已有来源名称。输出必须严格匹配JSON Schema。"
    ].join("\n");
  }

  function contextAssistantInput(question, context) {
    return JSON.stringify({
      task: "回答用户关于当前股票、持仓、热点或市场环境的问题",
      question: text(question, 600),
      facts: context
    });
  }

  return {
    CONTEXT_ANSWER_SCHEMA,
    contextAssistantInput,
    contextAssistantInstructions,
    localContextAnswer,
    normalizeContextAnswer
  };
});
