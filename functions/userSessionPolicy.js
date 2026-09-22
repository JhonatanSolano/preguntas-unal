const USER_SESSION_POLICY = {
  maxActiveSessions: 2,
  activeSessionTtlMs: 30 * 60 * 1000,
  heartbeatMs: 60 * 1000
};

function safeUserSessionId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeUserSessions(sessions = [], nowMs = Date.now()) {
  return (Array.isArray(sessions) ? sessions : [])
    .map(session => ({
      ...session,
      sessionId: safeUserSessionId(session?.sessionId || session?.id || ""),
      lastSeenMs: Number(session?.lastSeenMs || timestampMillis(session?.lastSeenAt))
    }))
    .filter(session =>
      session.sessionId &&
      Number.isFinite(session.lastSeenMs) &&
      nowMs - session.lastSeenMs <= USER_SESSION_POLICY.activeSessionTtlMs
    );
}

function evaluateUserSessionLimit({ sessions = [], sessionId = "", nowMs = Date.now() } = {}) {
  const safeSessionId = safeUserSessionId(sessionId);
  if (!safeSessionId) {
    return {
      allowed: false,
      reason: "invalid-session",
      activeCount: 0,
      activeSessionIds: []
    };
  }
  const active = activeUserSessions(sessions, nowMs);
  const activeIds = new Set(active.map(session => session.sessionId));
  activeIds.add(safeSessionId);
  const activeSessionIds = Array.from(activeIds);
  const activeCount = activeSessionIds.length;
  const allowed = activeCount <= USER_SESSION_POLICY.maxActiveSessions;
  return {
    allowed,
    reason: allowed ? "allowed" : "too-many-devices",
    activeCount,
    activeSessionIds,
    shouldRevokeAll: !allowed
  };
}

module.exports = {
  USER_SESSION_POLICY,
  activeUserSessions,
  evaluateUserSessionLimit,
  safeUserSessionId,
  timestampMillis
};
