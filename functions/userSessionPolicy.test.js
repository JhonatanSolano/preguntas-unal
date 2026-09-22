const test = require("node:test");
const assert = require("node:assert/strict");
const {
  USER_SESSION_POLICY,
  activeUserSessions,
  evaluateUserSessionLimit,
  safeUserSessionId
} = require("./userSessionPolicy");

test("allows the first two active app sessions", () => {
  const nowMs = Date.parse("2026-09-21T12:00:00Z");
  const decision = evaluateUserSessionLimit({
    nowMs,
    sessionId: "pc-2",
    sessions: [
      { sessionId: "phone-1", lastSeenMs: nowMs - 30_000 }
    ]
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.activeCount, 2);
});

test("revokes all sessions when a third active device appears", () => {
  const nowMs = Date.parse("2026-09-21T12:00:00Z");
  const decision = evaluateUserSessionLimit({
    nowMs,
    sessionId: "tablet-3",
    sessions: [
      { sessionId: "phone-1", lastSeenMs: nowMs - 30_000 },
      { sessionId: "pc-2", lastSeenMs: nowMs - 45_000 }
    ]
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "too-many-devices");
  assert.equal(decision.shouldRevokeAll, true);
  assert.deepEqual(decision.activeSessionIds.sort(), ["pc-2", "phone-1", "tablet-3"].sort());
});

test("ignores sessions older than the inactivity window", () => {
  const nowMs = Date.parse("2026-09-21T12:00:00Z");
  const expiredMs = nowMs - USER_SESSION_POLICY.activeSessionTtlMs - 1;
  const decision = evaluateUserSessionLimit({
    nowMs,
    sessionId: "new-device",
    sessions: [
      { sessionId: "old-phone", lastSeenMs: expiredMs },
      { sessionId: "active-pc", lastSeenMs: nowMs - 10_000 }
    ]
  });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.activeSessionIds.sort(), ["active-pc", "new-device"].sort());
});

test("sanitizes session ids before storing or comparing", () => {
  assert.equal(safeUserSessionId(" phone / 1 "), "phone_1");
  const active = activeUserSessions([
    { sessionId: " phone / 1 ", lastSeenMs: Date.parse("2026-09-21T12:00:00Z") }
  ], Date.parse("2026-09-21T12:00:30Z"));
  assert.equal(active[0].sessionId, "phone_1");
});
