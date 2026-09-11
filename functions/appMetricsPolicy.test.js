const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAppMetricsFromUsers,
  metricCategory,
  metricDelta
} = require("./appMetricsPolicy");

test("builds app metrics without counting the platform owner", () => {
  const metrics = buildAppMetricsFromUsers([
    { email: "solanojhonatan2000@gmail.com", role: "teacher", subscriptionStatus: "active" },
    { email: "inst@gmail.com", role: "institution", subscriptionStatus: "active" },
    { email: "teacher@gmail.com", role: "teacher" },
    { email: "student@gmail.com", role: "student", subscriptionStatus: "active" },
    { email: "class@gmail.com", role: "student", institutionDane: "123", subscriptionInherited: true, institutionSubscriptionStatus: "active" }
  ]);

  assert.equal(metrics.total.registered, 4);
  assert.equal(metrics.total.subscribed, 3);
  assert.equal(metrics.institutions.subscribed, 1);
  assert.equal(metrics.teachers.registered, 1);
  assert.equal(metrics.independentStudents.subscribed, 1);
  assert.equal(metrics.institutionStudents.subscribed, 1);
});

test("classifies institutional students by account mode, institution or inherited access", () => {
  assert.equal(metricCategory({ role: "student", accountMode: "institutional" }), "institutionStudents");
  assert.equal(metricCategory({ role: "student", institutionDane: "05001" }), "institutionStudents");
  assert.equal(metricCategory({ role: "student", subscriptionInherited: true }), "institutionStudents");
  assert.equal(metricCategory({ role: "student" }), "independentStudents");
});

test("computes only changed aggregate paths for app metrics", () => {
  const changes = metricDelta(
    { email: "a@gmail.com", role: "student" },
    { email: "a@gmail.com", role: "student", subscriptionStatus: "active" }
  );

  assert.deepEqual(changes, {
    "total.subscribed": 1,
    "independentStudents.subscribed": 1
  });
});
