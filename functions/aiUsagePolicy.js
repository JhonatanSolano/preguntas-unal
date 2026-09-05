const AI_USAGE_POLICY = {
  perMinute: 4,
  perDay: 45,
  perMonth: 900,
  dailyInputTokens: 180000,
  monthlyInputTokens: 2500000,
  dailyOutputTokens: 90000,
  monthlyOutputTokens: 1200000,
  maxInputChars: 2500,
  maxHistoryItems: 6,
  maxOutputTokens: 900
};

function aiDayKey(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function aiMonthKey(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 7);
}

function estimateTokensFromText(value = "") {
  const text = String(value || "");
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 4);
}

function historyText(item = {}) {
  const parts = Array.isArray(item.parts) ? item.parts : [];
  return parts.map(part => part?.text || "").join("\n");
}

function estimateAiInputTokens({ input = "", history = [], currentData = {} } = {}) {
  const boundedHistory = Array.isArray(history) ? history.slice(-AI_USAGE_POLICY.maxHistoryItems) : [];
  const contextText = typeof currentData === "string" ? currentData : JSON.stringify(currentData || {});
  const totalText = [
    input,
    contextText,
    ...boundedHistory.map(historyText)
  ].join("\n\n");
  return estimateTokensFromText(totalText) + 300;
}

function updateAiUsageState({
  usage = {},
  nowMs = Date.now(),
  estimatedInputTokens = 0,
  estimatedOutputTokens = AI_USAGE_POLICY.maxOutputTokens
} = {}) {
  const minuteKey = Math.floor(nowMs / 60000);
  const dayKey = aiDayKey(nowMs);
  const monthKey = aiMonthKey(nowMs);
  const minuteCount = usage.minuteKey === minuteKey ? Number(usage.minuteCount || 0) : 0;
  const dayCount = usage.dayKey === dayKey ? Number(usage.dayCount || 0) : 0;
  const monthCount = usage.monthKey === monthKey ? Number(usage.monthCount || 0) : 0;
  const dayInputTokens = usage.dayKey === dayKey ? Number(usage.dayInputTokens || 0) : 0;
  const monthInputTokens = usage.monthKey === monthKey ? Number(usage.monthInputTokens || 0) : 0;
  const dayOutputTokens = usage.dayKey === dayKey ? Number(usage.dayOutputTokens || 0) : 0;
  const monthOutputTokens = usage.monthKey === monthKey ? Number(usage.monthOutputTokens || 0) : 0;

  if (minuteCount >= AI_USAGE_POLICY.perMinute) {
    return { allowed: false, reason: "minute", retryAfterSeconds: 60 };
  }
  if (dayCount >= AI_USAGE_POLICY.perDay) {
    return { allowed: false, reason: "daily", retryAfterSeconds: 3600 };
  }
  if (monthCount >= AI_USAGE_POLICY.perMonth) {
    return { allowed: false, reason: "monthly", retryAfterSeconds: 86400 };
  }
  if (dayInputTokens + estimatedInputTokens > AI_USAGE_POLICY.dailyInputTokens ||
      dayOutputTokens + estimatedOutputTokens > AI_USAGE_POLICY.dailyOutputTokens) {
    return { allowed: false, reason: "daily-tokens", retryAfterSeconds: 3600 };
  }
  if (monthInputTokens + estimatedInputTokens > AI_USAGE_POLICY.monthlyInputTokens ||
      monthOutputTokens + estimatedOutputTokens > AI_USAGE_POLICY.monthlyOutputTokens) {
    return { allowed: false, reason: "monthly-tokens", retryAfterSeconds: 86400 };
  }

  return {
    allowed: true,
    minuteKey,
    minuteCount: minuteCount + 1,
    dayKey,
    dayCount: dayCount + 1,
    monthKey,
    monthCount: monthCount + 1,
    dayInputTokens: dayInputTokens + estimatedInputTokens,
    monthInputTokens: monthInputTokens + estimatedInputTokens,
    dayOutputTokens: dayOutputTokens + estimatedOutputTokens,
    monthOutputTokens: monthOutputTokens + estimatedOutputTokens
  };
}

function aiLimitMessage(reason) {
  if (reason === "minute") {
    return "El Asesor IA recibió muchas solicitudes seguidas. Espera un minuto e intenta de nuevo.";
  }
  if (reason === "daily" || reason === "daily-tokens") {
    return "Por hoy alcanzaste el uso razonable del Asesor IA. Podrás volver a usarlo más tarde.";
  }
  return "Este mes alcanzaste el uso razonable del Asesor IA. Si crees que es un error, comunícate con soporte.";
}

module.exports = {
  AI_USAGE_POLICY,
  estimateTokensFromText,
  estimateAiInputTokens,
  updateAiUsageState,
  aiLimitMessage
};
