const test = require("node:test");
const assert = require("node:assert/strict");
const { updateVideoPlaybackState, VIDEO_PLAYBACK_POLICY } = require("./videoPlaybackPolicy");

test("premium users are allowed under normal daily usage", () => {
  const result = updateVideoPlaybackState({
    usage: { dailySeconds: { "2026-09-05": 60 * 60 }, monthlySeconds: { "2026-09": 5 * 60 * 60 } },
    isPremium: true,
    event: "heartbeat",
    sessionKey: "device-a",
    videoId: "video-a",
    nowMs: Date.parse("2026-09-05T12:00:00Z"),
    reportedSeconds: 30
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "allowed");
});

test("free users are blocked after excessive daily video time", () => {
  const result = updateVideoPlaybackState({
    usage: { dailySeconds: { "2026-09-05": VIDEO_PLAYBACK_POLICY.free.dailySeconds + 1 } },
    isPremium: false,
    event: "heartbeat",
    sessionKey: "device-a",
    videoId: "video-a",
    nowMs: Date.parse("2026-09-05T12:00:00Z"),
    reportedSeconds: 30
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "excessive-watch-time");
  assert.ok(result.blockedUntilMs > Date.parse("2026-09-05T12:00:00Z"));
});

test("too many simultaneous sessions triggers a temporary block", () => {
  const nowMs = Date.parse("2026-09-05T12:00:00Z");
  const result = updateVideoPlaybackState({
    usage: {
      sessions: {
        a: { lastSeenMs: nowMs - 1000 },
        b: { lastSeenMs: nowMs - 2000 },
        c: { lastSeenMs: nowMs - 3000 }
      }
    },
    isPremium: true,
    event: "start",
    sessionKey: "device-d",
    videoId: "video-a",
    nowMs
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "too-many-sessions");
});

test("existing temporary block remains enforced", () => {
  const nowMs = Date.parse("2026-09-05T12:00:00Z");
  const result = updateVideoPlaybackState({
    usage: { blockedUntilMs: nowMs + 60000 },
    isPremium: true,
    event: "start",
    sessionKey: "device-a",
    videoId: "video-a",
    nowMs
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "temporary-block");
  assert.ok(result.retryAfterSeconds > 0);
});