const EXAM_DURATIONS_BY_LEVEL = {
  diagnostico: 15 * 60,
  nivel1: 25 * 60,
  examen: 35 * 60
};

function baseResultKey(key = "") {
  const parts = String(key || "").split("::");
  return parts.find(part => ["diagnostico", "nivel1", "examen"].includes(part)) || String(key || "");
}

function examDurationSeconds(key = "") {
  return EXAM_DURATIONS_BY_LEVEL[baseResultKey(key)] || EXAM_DURATIONS_BY_LEVEL.diagnostico;
}

function calcNotaFromPercent(pct = 0) {
  return Math.round((Math.max(0, Math.min(100, Number(pct) || 0)) / 100 * 5) * 10) / 10;
}

function shouldUseResultKey(resultados = {}, key = "") {
  const base = baseResultKey(key);
  if (base !== key) return true;
  return !resultados[`principal::${base}`];
}

function metricasIntentoEstado(key = "", intento = {}) {
  const serverMetrics = intento.serverMetrics || {};
  const total = Math.max(0, Number(intento.total || intento.totalQuestions || intento.answerKey?.length || intento.questionSnapshot?.length || 0));
  const serverCorrectas = Number(serverMetrics.correctas);
  const serverIncorrectas = Number(serverMetrics.incorrectas);
  const answerKey = Array.isArray(intento.answerKey) ? intento.answerKey : [];
  const respuestas = Array.isArray(intento.respuestas) ? intento.respuestas : [];
  const correctas = Number.isFinite(serverCorrectas)
    ? serverCorrectas
    : answerKey.reduce((acc, correcta, index) => acc + (respuestas[index] === correcta ? 1 : 0), 0);
  const incorrectas = Number.isFinite(serverIncorrectas)
    ? serverIncorrectas
    : Math.max(0, total - correctas);
  const tiempoServidor = Number(serverMetrics.tiempoTotalSegundos || intento.tiempoTotalSegundos);
  const tiempoEmpleado = Number.isFinite(tiempoServidor) && tiempoServidor >= 0
    ? tiempoServidor
    : Math.max(0, examDurationSeconds(key) - Math.max(0, Number(intento.restante || 0)));
  const notaServidor = Number(serverMetrics.nota || intento.nota);
  const pct = total ? Math.round((correctas / total) * 100) : 0;
  return {
    correctas,
    incorrectas,
    nota: Number.isFinite(notaServidor) ? notaServidor : calcNotaFromPercent(pct),
    tiempoEmpleado
  };
}

function buildTeacherClassMetrics({ classes = [], states = [] } = {}) {
  const buckets = new Map(classes.map(aula => [
    aula.id,
    {
      id: aula.id,
      name: aula.name || aula.className || "Aula",
      studentsSet: new Set(),
      students: 0,
      intentos: 0,
      correctas: 0,
      incorrectas: 0,
      nota: 0,
      tiempo: 0
    }
  ]));

  states.forEach(state => {
    const classId = state.aulaId || state.claseId || state.grupo || state.classId || "";
    const bucket = buckets.get(classId);
    if (!bucket) return;
    bucket.studentsSet.add(state.uid || state.id || state.userUid || state.email || "estudiante");
    const resultados = state.resultados || {};
    Object.entries(resultados).forEach(([key, value]) => {
      if (!shouldUseResultKey(resultados, key)) return;
      (value?.intentos || []).forEach(intento => {
        const metrics = metricasIntentoEstado(key, intento);
        bucket.intentos++;
        bucket.correctas += metrics.correctas;
        bucket.incorrectas += metrics.incorrectas;
        bucket.nota += metrics.nota;
        bucket.tiempo += metrics.tiempoEmpleado;
      });
    });
  });

  const classesWithMetrics = [...buckets.values()].map(bucket => {
    const n = bucket.intentos || 1;
    return {
      id: bucket.id,
      name: bucket.name,
      students: bucket.studentsSet.size,
      intentos: bucket.intentos,
      correctas: bucket.correctas,
      incorrectas: bucket.incorrectas,
      nota: bucket.nota,
      tiempo: bucket.tiempo,
      promedioNota: bucket.nota / n,
      promedioCorrectas: bucket.correctas / n,
      promedioIncorrectas: bucket.incorrectas / n,
      promedioTiempo: bucket.tiempo / n
    };
  });

  classesWithMetrics.sort((a, b) =>
    b.promedioNota - a.promedioNota ||
    b.promedioCorrectas - a.promedioCorrectas ||
    a.promedioTiempo - b.promedioTiempo
  );

  return { classes: classesWithMetrics };
}

module.exports = {
  buildTeacherClassMetrics,
  metricasIntentoEstado,
  shouldUseResultKey
};
