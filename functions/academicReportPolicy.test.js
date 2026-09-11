const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeAcademicReportFilter,
  normalizeAcademicReportLevel
} = require("./academicReportPolicy");

test("normalizeAcademicReportLevel keeps the three official exam levels", () => {
  assert.equal(normalizeAcademicReportLevel("facil"), "diagnostico");
  assert.equal(normalizeAcademicReportLevel("medio"), "nivel1");
  assert.equal(normalizeAcademicReportLevel("dificil"), "examen");
  assert.equal(normalizeAcademicReportLevel("examen"), "examen");
});

test("normalizeAcademicReportFilter requires aula, tema, subtema y nivel", () => {
  const filter = normalizeAcademicReportFilter({
    classId: "class-1",
    level: "nivel1",
    branchId: "algebra",
    topicId: "ecuaciones",
    subtopicId: "ecuaciones-lineales",
    topicName: "  Ecuaciones   y despejes  ",
    subtopicName: "Ecuaciones lineales"
  });

  assert.equal(filter.valid, true);
  assert.equal(filter.level, "nivel1");
  assert.equal(filter.topicName, "Ecuaciones y despejes");
  assert.equal(filter.subtopicName, "Ecuaciones lineales");

  const missingSubtopic = normalizeAcademicReportFilter({
    classId: "class-1",
    level: "nivel1",
    branchId: "algebra",
    topicId: "ecuaciones"
  });
  assert.equal(missingSubtopic.valid, false);
});
