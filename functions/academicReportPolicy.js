function normalizeAcademicReportLevel(level = "") {
  const value = String(level || "").trim();
  if (value === "facil") return "diagnostico";
  if (value === "medio") return "nivel1";
  if (value === "dificil" || value === "avanzado") return "examen";
  return ["diagnostico", "nivel1", "examen"].includes(value) ? value : "";
}

function normalizeReportRoutePart(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeReportLabel(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeAcademicReportFilter(body = {}) {
  const classId = String(body.classId || "").trim();
  const level = normalizeAcademicReportLevel(body.level);
  const branchId = normalizeReportRoutePart(body.branchId);
  const topicId = normalizeReportRoutePart(body.topicId);
  const subtopicId = normalizeReportRoutePart(body.subtopicId);
  return {
    classId,
    level,
    branchId,
    topicId,
    subtopicId,
    topicName: normalizeReportLabel(body.topicName),
    subtopicName: normalizeReportLabel(body.subtopicName),
    valid: Boolean(classId && level && branchId && topicId && subtopicId)
  };
}

module.exports = {
  normalizeAcademicReportFilter,
  normalizeAcademicReportLevel,
  normalizeReportRoutePart
};
