const VIDEO_PLAYBACK_POLICY = {
  premium: {
    dailySeconds: 6 * 60 * 60,
    weeklySeconds: 25 * 60 * 60,
    monthlySeconds: 70 * 60 * 60
  },
  free: {
    dailySeconds: 90 * 60,
    weeklySeconds: 6 * 60 * 60,
    monthlySeconds: 18 * 60 * 60
  },
  maxActiveSessions: 3,
  activeSessionTtlMs: 2 * 60 * 1000,
  heartbeatSeconds: 30,
  maxCreditSeconds: 45,
  blockMs: 24 * 60 * 60 * 1000
};

function safeVideoPlaybackId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "video";
}

function dateKeyFromMs(ms, offsetDays = 0) {
  const date = new Date(Number(ms || Date.now()) - offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function monthKeyFromMs(ms) {
  return new Date(Number(ms || Date.now())).toISOString().slice(0, 7);
}

function numberMap(value = {}) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, seconds]) => [safeVideoPlaybackId(key), Math.max(0, Number(seconds || 0))])
    .filter(([, seconds]) => Number.isFinite(seconds)));
}

function pruneDailySeconds(dailySeconds = {}, nowMs = Date.now()) {
  const allowed = new Set(Array.from({ length: 35 }, (_, index) => dateKeyFromMs(nowMs, index)));
  return Object.fromEntries(Object.entries(numberMap(dailySeconds)).filter(([key]) => allowed.has(key)));
}

function pruneSessions(sessions = {}, nowMs = Date.now()) {
  if (!sessions || typeof sessions !== "object") return {};
  return Object.fromEntries(Object.entries(sessions).filter(([, session]) => {
    const lastSeenMs = Number(session?.lastSeenMs || 0);
    return Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= VIDEO_PLAYBACK_POLICY.activeSessionTtlMs;
  }));
}

function rollingDailySeconds(dailySeconds = {}, nowMs = Date.now(), days = 7) {
  const data = numberMap(dailySeconds);
  return Array.from({ length: days }, (_, index) => data[dateKeyFromMs(nowMs, index)] || 0)
    .reduce((sum, seconds) => sum + seconds, 0);
}

function updateVideoPlaybackState({
  usage = {},
  isPremium = false,
  event = "heartbeat",
  sessionKey = "",
  videoId = "",
  resourceId = "",
  nowMs = Date.now(),
  reportedSeconds = 0
} = {}) {
  const normalizedEvent = ["start", "heartbeat", "stop"].includes(event) ? event : "heartbeat";
  const policy = isPremium ? VIDEO_PLAYBACK_POLICY.premium : VIDEO_PLAYBACK_POLICY.free;
  const safeSessionKey = safeVideoPlaybackId(sessionKey);
  const safeVideoId = safeVideoPlaybackId(videoId);
  const safeResourceId = safeVideoPlaybackId(resourceId || safeVideoId);
  const existingBlockedUntilMs = Math.max(0, Number(usage.blockedUntilMs || 0));
  let dailySeconds = pruneDailySeconds(usage.dailySeconds, nowMs);
  const monthlySeconds = numberMap(usage.monthlySeconds);
  let sessions = pruneSessions(usage.sessions, nowMs);

  if (existingBlockedUntilMs > nowMs) {
    return {
      allowed: false,
      reason: "temporary-block",
      retryAfterSeconds: Math.ceil((existingBlockedUntilMs - nowMs) / 1000),
      blockedUntilMs: existingBlockedUntilMs,
      dailySeconds,
      monthlySeconds,
      sessions
    };
  }

  const activeOtherSessions = Object.keys(sessions).filter(key => key !== safeSessionKey).length;
  if (normalizedEvent === "start" && activeOtherSessions >= VIDEO_PLAYBACK_POLICY.maxActiveSessions) {
    const blockedUntilMs = nowMs + VIDEO_PLAYBACK_POLICY.blockMs;
    return {
      allowed: false,
      reason: "too-many-sessions",
      retryAfterSeconds: Math.ceil(VIDEO_PLAYBACK_POLICY.blockMs / 1000),
      blockedUntilMs,
      dailySeconds,
      monthlySeconds,
      sessions,
      shouldBlock: true
    };
  }

  const previousSession = sessions[safeSessionKey] || {};
  const elapsedSeconds = previousSession.lastSeenMs
    ? Math.max(0, (nowMs - Number(previousSession.lastSeenMs)) / 1000)
    : VIDEO_PLAYBACK_POLICY.heartbeatSeconds;
  const requestedSeconds = Math.max(0, Number(reportedSeconds || 0));
  const shouldCredit = normalizedEvent === "heartbeat" || normalizedEvent === "stop";
  const creditSeconds = shouldCredit
    ? Math.round(Math.min(
      requestedSeconds || VIDEO_PLAYBACK_POLICY.heartbeatSeconds,
      elapsedSeconds + 5,
      VIDEO_PLAYBACK_POLICY.maxCreditSeconds
    ))
    : 0;

  const todayKey = dateKeyFromMs(nowMs);
  const monthKey = monthKeyFromMs(nowMs);
  if (creditSeconds > 0) {
    dailySeconds[todayKey] = Math.round((dailySeconds[todayKey] || 0) + creditSeconds);
    monthlySeconds[monthKey] = Math.round((monthlySeconds[monthKey] || 0) + creditSeconds);
  }

  if (normalizedEvent === "stop") {
    delete sessions[safeSessionKey];
  } else {
    sessions[safeSessionKey] = {
      videoId: safeVideoId,
      resourceId: safeResourceId,
      lastSeenMs: nowMs
    };
  }

  const totalToday = dailySeconds[todayKey] || 0;
  const totalWeek = rollingDailySeconds(dailySeconds, nowMs, 7);
  const totalMonth = monthlySeconds[monthKey] || 0;
  const exceeded = totalToday > policy.dailySeconds || totalWeek > policy.weeklySeconds || totalMonth > policy.monthlySeconds;
  const blockedUntilMs = exceeded ? nowMs + VIDEO_PLAYBACK_POLICY.blockMs : 0;
  return {
    allowed: !exceeded,
    reason: exceeded ? "excessive-watch-time" : "allowed",
    retryAfterSeconds: exceeded ? Math.ceil(VIDEO_PLAYBACK_POLICY.blockMs / 1000) : 0,
    blockedUntilMs,
    shouldBlock: exceeded,
    creditedSeconds: creditSeconds,
    totals: { today: totalToday, week: totalWeek, month: totalMonth },
    limits: policy,
    dailySeconds,
    monthlySeconds,
    sessions
  };
}

module.exports = {
  VIDEO_PLAYBACK_POLICY,
  safeVideoPlaybackId,
  updateVideoPlaybackState
};