const MODE_INSTRUCTIONS = {
  solve: "Especialidad: resolver preguntas paso a paso. Identifica datos, estrategia, procedimiento, respuesta y verificacion.",
  generate: "Especialidad: crear ejercicios tipo examen. Entrega enunciados claros, opciones si aplica, respuesta correcta y explicacion.",
  practice: "Especialidad: practica guiada por tema. Propone ejercicios graduales y corrige sin revelar todo de inmediato.",
  review: "Especialidad: revision de errores. Detecta el error conceptual o de procedimiento y muestra como corregirlo.",
  guide: "Especialidad: planificacion academica. Organiza rutas de estudio, clases, actividades o retroalimentaciones con objetivos claros.",
  latex: "Especialidad: lectura, correccion y escritura de LaTeX matematico. Explica la expresion, valida sintaxis y entrega una version compilable."
};

function cleanLabel(value = "") {
  return String(value || "").replace(/[<>]/g, "").slice(0, 120).trim();
}

function cleanLongText(value = "", max = 220) {
  return String(value || "").replace(/[<>]/g, "").slice(0, max).trim();
}

function cleanRelativeUrl(value = "") {
  const text = String(value || "").trim().replace(/[<>]/g, "");
  if (!text || text.length > 220) return "";
  if (/^(https?:|javascript:|data:|vbscript:)/i.test(text)) return "";
  return text.replace(/^\/+/, "");
}

function normalizeAppMap(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const appSections = Array.isArray(source.appSections)
    ? source.appSections.slice(0, 16).map(item => ({
      id: cleanLabel(item?.id).toLowerCase(),
      title: cleanLabel(item?.title),
      purpose: cleanLongText(item?.purpose)
    })).filter(item => item.id && item.title)
    : [];

  const learningCatalog = Array.isArray(source.learningCatalog)
    ? source.learningCatalog.slice(0, 24).map(branch => ({
      branch: cleanLabel(branch?.branch),
      topics: Array.isArray(branch?.topics)
        ? branch.topics.slice(0, 18).map(topic => ({
          title: cleanLabel(topic?.title),
          subtopics: Array.isArray(topic?.subtopics)
            ? topic.subtopics.slice(0, 24).map(cleanLabel).filter(Boolean)
            : []
        })).filter(topic => topic.title)
        : []
    })).filter(branch => branch.branch)
    : [];

  const learningResources = Array.isArray(source.learningResources)
    ? source.learningResources.slice(0, 80).map(resource => ({
      branch: cleanLabel(resource?.branch),
      topic: cleanLabel(resource?.topic),
      subtopic: cleanLabel(resource?.subtopic),
      type: cleanLabel(resource?.type || "Recurso"),
      title: cleanLabel(resource?.title),
      url: cleanRelativeUrl(resource?.url)
    })).filter(resource => resource.branch && resource.topic && resource.subtopic && resource.title)
    : [];

  const currentLearningPath = source.currentLearningPath && typeof source.currentLearningPath === "object"
    ? {
      branch: cleanLabel(source.currentLearningPath.branch),
      topic: cleanLabel(source.currentLearningPath.topic),
      subtopic: cleanLabel(source.currentLearningPath.subtopic),
      examDefaultLevel: cleanLabel(source.currentLearningPath.examDefaultLevel)
    }
    : {};

  const accessNotes = Array.isArray(source.accessNotes)
    ? source.accessNotes.slice(0, 8).map(item => cleanLongText(item, 180)).filter(Boolean)
    : [];

  return { appSections, learningCatalog, learningResources, currentLearningPath, accessNotes };
}

function normalizeAiSessionData(currentData = {}) {
  return {
    app: cleanLabel(currentData.app),
    role: cleanLabel(currentData.role).toLowerCase() === "teacher" ? "teacher" : "student",
    className: cleanLabel(currentData.className),
    bank: cleanLabel(currentData.bank),
    mode: cleanLabel(currentData.mode).toLowerCase(),
    modeLabel: cleanLabel(currentData.modeLabel),
    appMap: normalizeAppMap(currentData.appMap)
  };
}

function buildAppMapInstruction(appMap = {}) {
  const sections = Array.isArray(appMap.appSections) ? appMap.appSections : [];
  const catalog = Array.isArray(appMap.learningCatalog) ? appMap.learningCatalog : [];
  const resources = Array.isArray(appMap.learningResources) ? appMap.learningResources : [];
  if (!sections.length && !catalog.length && !resources.length) return "";

  const sectionLines = sections.map(section =>
    `- ${section.title} (${section.id}): ${section.purpose || "Seccion de la app."}`
  );
  const catalogLines = [];
  catalog.forEach(branch => {
    (branch.topics || []).forEach(topic => {
      const subtopics = (topic.subtopics || []).join(", ");
      catalogLines.push(`- ${branch.branch} > ${topic.title}${subtopics ? ` > ${subtopics}` : ""}`);
    });
  });
  const resourceLines = resources.map(resource =>
    `- ${resource.type}: ${resource.title} en ${resource.branch} > ${resource.topic} > ${resource.subtopic}${resource.url ? ` (${resource.url})` : ""}`
  );
  const current = appMap.currentLearningPath || {};
  const currentLine = current.branch || current.topic || current.subtopic
    ? `Ruta actual de Aprendizaje: ${[current.branch, current.topic, current.subtopic].filter(Boolean).join(" > ")}${current.examDefaultLevel ? `. Al ir a examenes desde Aprendizaje se sugiere iniciar en ${current.examDefaultLevel}.` : ""}`
    : "";
  const noteLines = Array.isArray(appMap.accessNotes) ? appMap.accessNotes.map(note => `- ${note}`) : [];

  return [
    "Mapa interno de la app para orientar al usuario. Usa solo este mapa como referencia de secciones, rutas academicas y recursos internos disponibles.",
    "Cuando el usuario pregunte donde estudiar algo, recomienda una ruta concreta en formato: Aprendizaje > Rama > Tema > Subtema. Si existe PDF o video interno relacionado, mencionalo como recurso de la app.",
    "Para dudas tecnicas de la app, orienta hacia la seccion adecuada: Inicio, Perfil, Aprendizaje, Examenes, Estadisticas, Mensajes, Asesor IA, Suscripcion, Facturacion, Configuracion o Soporte, segun corresponda.",
    "No recomiendes recursos externos, videos externos, pagos externos ni enlaces fuera de la app a menos que el usuario lo pida explicitamente.",
    currentLine,
    noteLines.length ? `Reglas y notas internas:\n${noteLines.join("\n")}` : "",
    sectionLines.length ? `Secciones internas:\n${sectionLines.join("\n")}` : "",
    catalogLines.length ? `Catalogo de aprendizaje:\n${catalogLines.join("\n")}` : "",
    resourceLines.length ? `Recursos internos disponibles:\n${resourceLines.join("\n")}` : ""
  ].filter(Boolean).join("\n");
}

function buildAiSessionInstruction(currentData = {}) {
  const safeData = normalizeAiSessionData(currentData);
  const modeInstruction = MODE_INSTRUCTIONS[safeData.mode] || "Especialidad: tutoria matematica general con explicaciones claras, breves y verificables, incluyendo lectura de LaTeX cuando el usuario lo solicite.";
  const academicNotebookInstruction = "Actua como cuaderno academico inteligente: conecta conceptos, organiza fuentes dadas por el usuario, no inventes material no aportado y separa claramente datos, procedimiento, respuesta y verificacion.";
  const appMapInstruction = buildAppMapInstruction(safeData.appMap);

  if (safeData.role === "teacher") {
    return [
      "Sesion de profesor: responde como asesor docente especializado en matematicas, evaluacion y gestion academica.",
      "Puede ayudar a planear clases, crear examenes, mejorar preguntas, redactar retroalimentaciones, disenar actividades, preparar rubricas y analizar resultados.",
      academicNotebookInstruction,
      appMapInstruction,
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
    academicNotebookInstruction,
    appMapInstruction,
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
