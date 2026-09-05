const MODE_INSTRUCTIONS = {
  solve: "Especialidad: resolver preguntas paso a paso. Identifica datos, estrategia, procedimiento, respuesta y verificacion.",
  generate: "Especialidad: crear ejercicios tipo examen. Entrega enunciados claros, opciones si aplica, respuesta correcta y explicacion.",
  practice: "Especialidad: practica guiada por tema. Propone ejercicios graduales y corrige sin revelar todo de inmediato.",
  review: "Especialidad: revision de errores. Detecta el error conceptual o de procedimiento y muestra como corregirlo.",
  guide: "Especialidad: planificacion academica. Organiza rutas de estudio, clases, actividades o retroalimentaciones con objetivos claros."
};

function cleanLabel(value = "") {
  return String(value || "").replace(/[<>]/g, "").slice(0, 120).trim();
}

function normalizeAiSessionData(currentData = {}) {
  return {
    app: cleanLabel(currentData.app),
    role: cleanLabel(currentData.role).toLowerCase() === "teacher" ? "teacher" : "student",
    className: cleanLabel(currentData.className),
    bank: cleanLabel(currentData.bank),
    mode: cleanLabel(currentData.mode).toLowerCase(),
    modeLabel: cleanLabel(currentData.modeLabel)
  };
}

function buildAiSessionInstruction(currentData = {}) {
  const safeData = normalizeAiSessionData(currentData);
  const modeInstruction = MODE_INSTRUCTIONS[safeData.mode] || "Especialidad: tutoria matematica general con explicaciones claras, breves y verificables.";

  if (safeData.role === "teacher") {
    return [
      "Sesion de profesor: responde como asesor docente especializado en matematicas, evaluacion y gestion academica.",
      "Puede ayudar a planear clases, crear examenes, mejorar preguntas, redactar retroalimentaciones, disenar actividades, preparar rubricas y analizar resultados.",
      "No inventes datos de estudiantes, notas, permisos, pagos ni configuraciones. Si falta informacion, pide un dato concreto.",
      modeInstruction,
      safeData.bank ? `Banco activo: ${safeData.bank}.` : "",
      safeData.className ? `Aula activa: ${safeData.className}.` : "",
      safeData.modeLabel ? `Modo visible: ${safeData.modeLabel}.` : ""
    ].filter(Boolean).join("\n");
  }

  return [
    "Sesion de estudiante: responde como tutor experto en matematicas para aprendizaje, practica, ICFES Saber 11, admision UNAL y primeros cursos de educacion superior.",
    "Ayuda a entender conceptos, resolver dudas, practicar por tema, revisar errores y construir planes de estudio. No hagas tareas completas sin explicar el razonamiento.",
    "Adapta la dificultad al mensaje del estudiante y prioriza pasos verificables, lenguaje claro y ejemplos cortos.",
    modeInstruction,
    safeData.bank ? `Banco activo: ${safeData.bank}.` : "",
    safeData.modeLabel ? `Modo visible: ${safeData.modeLabel}.` : ""
  ].filter(Boolean).join("\n");
}

module.exports = {
  normalizeAiSessionData,
  buildAiSessionInstruction
};