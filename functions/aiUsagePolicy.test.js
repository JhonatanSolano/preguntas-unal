const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AI_USAGE_POLICY,
  estimateAiInputTokens,
  updateAiUsageState,
  aiLimitMessage
} = require("./aiUsagePolicy");

test("allows normal advisor usage and increments all windows", () => {
  const decision = updateAiUsageState({
    usage: {},
    nowMs: Date.UTC(2026, 8, 5, 12, 0, 0),
    estimatedInputTokens: 500,
    estimatedOutputTokens: 300
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.minuteCount, 1);
  assert.equal(decision.dayCount, 1);
  assert.equal(decision.monthCount, 1);
  assert.equal(decision.dayInputTokens, 500);
  assert.equal(decision.monthOutputTokens, 300);
});

test("blocks advisor usage after the per-minute allowance", () => {
  const nowMs = Date.UTC(2026, 8, 5, 12, 0, 0);
  const decision = updateAiUsageState({
    usage: {
      minuteKey: Math.floor(nowMs / 60000),
      minuteCount: AI_USAGE_POLICY.perMinute
    },
    nowMs
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "minute");
  assert.match(aiLimitMessage(decision.reason), /muchas solicitudes/i);
});

test("blocks advisor usage after the daily allowance", () => {
  const nowMs = Date.UTC(2026, 8, 5, 12, 0, 0);
  const decision = updateAiUsageState({
    usage: {
      dayKey: "2026-09-05",
      dayCount: AI_USAGE_POLICY.perDay
    },
    nowMs
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "daily");
});

test("blocks advisor usage before exceeding the monthly output budget", () => {
  const nowMs = Date.UTC(2026, 8, 5, 12, 0, 0);
  const decision = updateAiUsageState({
    usage: {
      monthKey: "2026-09",
      monthOutputTokens: AI_USAGE_POLICY.monthlyOutputTokens - 100
    },
    nowMs,
    estimatedInputTokens: 10,
    estimatedOutputTokens: 300
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "monthly-tokens");
});

test("estimates advisor input from current message, context and bounded history", () => {
  const history = Array.from({ length: AI_USAGE_POLICY.maxHistoryItems + 3 }, (_, index) => ({
    role: index % 2 ? "model" : "user",
    parts: [{ text: "x".repeat(80) }]
  }));
  const estimate = estimateAiInputTokens({
    input: "Necesito practicar aritmetica.",
    history,
    currentData: { role: "student", topic: "Aritmetica" }
  });

  assert.ok(estimate > 300);
  assert.ok(estimate < 500);
});
