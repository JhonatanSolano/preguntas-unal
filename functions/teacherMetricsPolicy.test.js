const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTeacherClassMetrics } = require("./teacherMetricsPolicy");

test("buildTeacherClassMetrics aggregates only states that belong to teacher classes", () => {
  const metrics = buildTeacherClassMetrics({
    classes: [
      { id: "aula-1", name: "Álgebra" },
      { id: "aula-2", name: "Geometría" }
    ],
    states: [
      {
        id: "student-1",
        aulaId: "aula-1",
        resultados: {
          "principal::diagnostico::algebra::ecuaciones::lineales": {
            intentos: [{
              total: 2,
              answerKey: [0, 1],
              respuestas: [0, 2],
              restante: 600
            }]
          }
        }
      },
      {
        id: "student-2",
        claseId: "aula-2",
        resultados: {
          "principal::nivel1": {
            intentos: [{
              serverMetrics: {
                correctas: 8,
                incorrectas: 2,
                nota: 4,
                tiempoTotalSegundos: 900
              }
            }]
          }
        }
      },
      {
        id: "other",
        aulaId: "otra-aula",
        resultados: {
          "principal::diagnostico": {
            intentos: [{ total: 1, answerKey: [0], respuestas: [0], restante: 0 }]
          }
        }
      }
    ]
  });

  assert.equal(metrics.classes.length, 2);
  assert.equal(metrics.classes[0].id, "aula-2");
  assert.equal(metrics.classes[0].students, 1);
  assert.equal(metrics.classes[0].intentos, 1);
  assert.equal(metrics.classes[0].promedioNota, 4);
  assert.equal(metrics.classes[1].id, "aula-1");
  assert.equal(metrics.classes[1].students, 1);
  assert.equal(metrics.classes[1].intentos, 1);
  assert.equal(metrics.classes[1].correctas, 1);
  assert.equal(metrics.classes[1].incorrectas, 1);
});

test("buildTeacherClassMetrics ignores legacy base keys when routed keys exist", () => {
  const metrics = buildTeacherClassMetrics({
    classes: [{ id: "aula-1", name: "Álgebra" }],
    states: [{
      id: "student-1",
      aulaId: "aula-1",
      resultados: {
        diagnostico: {
          intentos: [{ total: 1, answerKey: [0], respuestas: [0], restante: 0 }]
        },
        "principal::diagnostico": {
          intentos: [{ total: 1, answerKey: [0], respuestas: [0], restante: 0 }]
        }
      }
    }]
  });

  assert.equal(metrics.classes[0].intentos, 1);
});
