const OWNER_EMAIL = "solanojhonatan2000@gmail.com";

function emptyAppMetrics() {
  return {
    total: { registered: 0, subscribed: 0 },
    institutions: { label: "Instituciones", registered: 0, subscribed: 0 },
    teachers: { label: "Docentes", registered: 0, subscribed: 0 },
    independentStudents: { label: "Estudiantes independientes", registered: 0, subscribed: 0 },
    institutionStudents: { label: "Estudiantes institucionales", registered: 0, subscribed: 0 },
    other: { label: "Otros usuarios", registered: 0, subscribed: 0 }
  };
}

function hasInstitutionalAccess(data = {}) {
  return !!(
    data.subscriptionInherited === true &&
    data.institutionSubscriptionStatus === "active" &&
    data.institutionAccessRevoked !== true &&
    data.institutionAccessBlocked !== true &&
    data.institutionPremiumBlocked !== true &&
    data.subscriptionPremiumBlocked !== true &&
    data.institutionMemberStatus !== "removed" &&
    data.institutionMemberStatus !== "blocked"
  );
}

function hasMetricSubscription(data = {}) {
  return data.subscriptionStatus === "active" || hasInstitutionalAccess(data);
}

function metricCategory(data = {}) {
  const role = data.role || data.tipoCuenta || "";
  const email = String(data.email || data.correo || "").toLowerCase();
  if (email === OWNER_EMAIL) return "owner";
  if (role === "institution") return "institutions";
  if (role === "teacher") return "teachers";
  if (role === "student") {
    const institutional = data.accountMode === "institutional" || !!data.institutionDane || data.subscriptionInherited === true;
    return institutional ? "institutionStudents" : "independentStudents";
  }
  return "other";
}

function metricEntry(data = null) {
  if (!data) return null;
  const category = metricCategory(data);
  if (category === "owner") return null;
  return {
    category,
    registered: 1,
    subscribed: hasMetricSubscription(data) ? 1 : 0
  };
}

function addEntry(metrics, entry, direction = 1) {
  if (!entry) return metrics;
  const category = metrics[entry.category] || metrics.other;
  category.registered += direction * entry.registered;
  category.subscribed += direction * entry.subscribed;
  metrics.total.registered += direction * entry.registered;
  metrics.total.subscribed += direction * entry.subscribed;
  return metrics;
}

function buildAppMetricsFromUsers(users = []) {
  const metrics = emptyAppMetrics();
  users.forEach(user => addEntry(metrics, metricEntry(user), 1));
  return metrics;
}

function metricDelta(before = null, after = null) {
  const changes = {};
  const apply = (entry, direction) => {
    if (!entry) return;
    const paths = [
      ["total.registered", entry.registered],
      ["total.subscribed", entry.subscribed],
      [`${entry.category}.registered`, entry.registered],
      [`${entry.category}.subscribed`, entry.subscribed]
    ];
    paths.forEach(([path, amount]) => {
      changes[path] = (changes[path] || 0) + direction * amount;
    });
  };
  apply(metricEntry(before), -1);
  apply(metricEntry(after), 1);
  Object.keys(changes).forEach(path => {
    if (changes[path] === 0) delete changes[path];
  });
  return changes;
}

module.exports = {
  OWNER_EMAIL,
  buildAppMetricsFromUsers,
  emptyAppMetrics,
  hasMetricSubscription,
  metricCategory,
  metricDelta
};
