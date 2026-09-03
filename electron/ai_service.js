const DEFAULT_AI_SETTINGS = Object.freeze({
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5.6-luna",
  sendHoldings: false
});

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_AI_SETTINGS.baseUrl).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("AI 接口地址格式不正确");
  }
  if (parsed.protocol !== "https:") throw new Error("AI 接口地址必须使用 HTTPS");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("AI 接口地址不能包含账号、查询参数或片段");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeAiSettings(value = {}) {
  const model = String(value.model || DEFAULT_AI_SETTINGS.model).trim();
  if (!model || model.length > 80 || /[\s<>]/.test(model)) {
    throw new Error("模型名称格式不正确");
  }
  return {
    baseUrl: normalizeBaseUrl(value.baseUrl),
    model,
    sendHoldings: value.sendHoldings === true
  };
}

function responsesUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

function responseText(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
    }
  }
  throw new Error("AI 服务未返回可解析的文本结果");
}

function parseJsonResponse(payload) {
  const raw = responseText(payload);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("AI 服务返回的结构不符合要求");
  }
}

function publicAiSettings(settings, { hasApiKey = false, secureStorage = false } = {}) {
  return {
    ...normalizeAiSettings(settings),
    hasApiKey: Boolean(hasApiKey),
    secureStorage: Boolean(secureStorage)
  };
}

function safeApiError(status, payload) {
  const message = String(payload?.error?.message || payload?.message || "").trim();
  const code = String(payload?.error?.code || "").trim();
  if (status === 401) return "API Key 无效、已失效或不属于当前接口地址";
  if (status === 403) return "API Key 已被识别，但当前 API 项目没有该模型的访问权限";
  if (status === 404 && code === "model_not_found") {
    return "模型名称不存在，或当前 API 项目没有该模型权限；请更换模型后重试";
  }
  if (status === 429) return "AI 服务请求过于频繁或额度不足，请稍后重试";
  if (status >= 500) return "AI 服务暂时不可用，请稍后重试";
  return message ? `AI 服务返回 ${status}：${message.slice(0, 180)}` : `AI 服务返回 ${status}`;
}

module.exports = {
  DEFAULT_AI_SETTINGS,
  normalizeAiSettings,
  normalizeBaseUrl,
  parseJsonResponse,
  publicAiSettings,
  responsesUrl,
  safeApiError
};
