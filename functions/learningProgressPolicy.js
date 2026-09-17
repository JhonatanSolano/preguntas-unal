function normalizeRoutePart(value = "") {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function learningProgressIdForBranch(source = {}) {
  const branchId = normalizeRoutePart(source.branchId);
  if (!branchId) return "";
  return `${branchId}__branch-complete`;
}

module.exports = {
  learningProgressIdForBranch
};
