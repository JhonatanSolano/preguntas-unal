/* ════════════════════════════════════════════════════════
   UNAL – Diagnóstico Matemático · script.js
   Separación clara: DATOS → LÓGICA → PRESENTACIÓN
════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────
   1. DATOS – Banco de preguntas en JSON
   Para agregar/modificar preguntas editar solo este arreglo.
   Estructura de cada objeto:
     id       : número de la pregunta
     pregunta : texto antes de la fórmula (puede ser vacío)
     formula  : expresión LaTeX a renderizar (puede ser vacío)
     opciones : array de 4 strings en orden A–D
     correcta : índice 0-based de la opción correcta
     explicacion: string con el procedimiento
──────────────────────────────────────────────────── */
const PREGUNTAS = [
  {
    id: 1,
    pregunta: "Si \\(x = -2\\), ¿cuánto vale",
    formula: "\\[ 3x^2 - 5x + 1 \\]",
    opciones: ["11", "23", "15", "7"],
    correcta: 1,
    explicacion: "Sustituimos \\(x = -2\\):<br>\\(3(-2)^2 - 5(-2) + 1 = 3(4) + 10 + 1 = 12 + 10 + 1 = 23\\)."
  },
  {
    id: 2,
    pregunta: "Simplifica",
    formula: "\\[ (4x^3 - 2x) + (x^3 + 7x) \\]",
    opciones: ["\\(5x^3 + 9x\\)", "\\(5x^3 + 5x\\)", "\\(4x^3 + 5x\\)", "\\(5x^2 + 5x\\)"],
    correcta: 1,
    explicacion: "Se suman los términos semejantes: \\((4+1)x^3 + (-2+7)x = 5x^3 + 5x\\)."
  },
  {
    id: 3,
    pregunta: "Desarrolla el producto notable",
    formula: "\\[ (x + 4)(x - 4) \\]",
    opciones: ["\\(x^2 - 8x + 16\\)", "\\(x^2 + 16\\)", "\\(x^2 - 16\\)", "\\(x^2 + 8x - 16\\)"],
    correcta: 2,
    explicacion: "Es una diferencia de cuadrados: \\((a+b)(a-b) = a^2 - b^2\\).<br>Con \\(a=x,\\, b=4\\): \\(x^2 - 16\\)."
  },
  {
    id: 4,
    pregunta: "Factoriza completamente",
    formula: "\\[ 6x^2 - 15x \\]",
    opciones: ["\\(3x(2x - 5)\\)", "\\(6(x^2 - 15x)\\)", "\\(x(6x - 15)\\)", "\\(2x(3x - 5)\\)"],
    correcta: 0,
    explicacion: "Se extrae el máximo factor común \\(3x\\):<br>\\(6x^2 - 15x = 3x \\cdot 2x - 3x \\cdot 5 = 3x(2x - 5)\\)."
  },
  {
    id: 5,
    pregunta: "Resuelve la ecuación",
    formula: "\\[ 3x - 7 = 11 \\]",
    opciones: ["4", "5", "6", "7"],
    correcta: 2,
    explicacion: "\\(3x = 11 + 7 = 18 \\Rightarrow x = \\dfrac{18}{3} = 6\\)."
  },
  {
    id: 6,
    pregunta: "Desarrolla el cuadrado del binomio",
    formula: "\\[ (2x - 3)^2 \\]",
    opciones: [
      "\\(4x^2 - 6x + 9\\)",
      "\\(4x^2 - 12x + 9\\)",
      "\\(2x^2 - 12x + 9\\)",
      "\\(4x^2 + 12x + 9\\)"
    ],
    correcta: 1,
    explicacion: "\\((a - b)^2 = a^2 - 2ab + b^2\\).<br>Con \\(a = 2x,\\, b = 3\\):<br>\\((2x)^2 - 2(2x)(3) + 3^2 = 4x^2 - 12x + 9\\)."
  },
  {
    id: 7,
    pregunta: "Factoriza",
    formula: "\\[ x^2 - 9 \\]",
    opciones: [
      "\\((x - 9)(x + 1)\\)",
      "\\((x - 3)^2\\)",
      "\\((x - 3)(x + 3)\\)",
      "\\((x + 9)(x - 1)\\)"
    ],
    correcta: 2,
    explicacion: "Diferencia de cuadrados: \\(x^2 - 9 = x^2 - 3^2 = (x-3)(x+3)\\)."
  },
  {
    id: 8,
    pregunta: "Resuelve la ecuación cuadrática",
    formula: "\\[ x^2 - 5x + 6 = 0 \\]",
    opciones: ["1 y 6", "2 y 3", "−2 y −3", "5 y 6"],
    correcta: 1,
    explicacion: "Se buscan dos números que sumen 5 y multipliquen 6: son 2 y 3.<br>\\((x-2)(x-3) = 0 \\Rightarrow x = 2\\) o \\(x = 3\\)."
  },
  {
    id: 9,
    pregunta: "Simplifica la expresión racional",
    formula: "\\[ \\frac{x^2 - 4}{x - 2} \\]",
    opciones: [
      "\\(x - 2\\)",
      "\\(x + 2\\)",
      "\\(x + 2,\\; x \\neq 2\\)",
      "\\(x,\\; x \\neq 2\\)"
    ],
    correcta: 2,
    explicacion: "\\(x^2 - 4 = (x-2)(x+2)\\), entonces \\(\\dfrac{(x-2)(x+2)}{x-2} = x+2\\), con la restricción \\(x \\neq 2\\)."
  },
  {
    id: 10,
    pregunta: "Resuelve la ecuación con valor absoluto",
    formula: "\\[ |x - 3| = 5 \\]",
    opciones: ["8", "−2", "8 y −2", "5 y −5"],
    correcta: 2,
    explicacion: "\\(|x-3| = 5\\) da dos casos:<br>• \\(x - 3 = 5 \\Rightarrow x = 8\\)<br>• \\(x - 3 = -5 \\Rightarrow x = -2\\)"
  },
  {
    id: 11,
    pregunta: "¿Para qué valores de \\(x\\) está definida la expresión",
    formula: "\\[ \\frac{x + 1}{x^2 - 4} \\]",
    opciones: [
      "Todo número real",
      "\\(x \\neq 2\\)",
      "\\(x \\neq -2\\)",
      "\\(x \\neq 2\\) y \\(x \\neq -2\\)"
    ],
    correcta: 3,
    explicacion: "El denominador \\(x^2 - 4 = (x-2)(x+2) = 0\\) cuando \\(x = 2\\) o \\(x = -2\\).<br>La expresión no está definida en esos valores."
  },
  {
    id: 12,
    pregunta: "Resuelve la desigualdad",
    formula: "\\[ 2x + 5 > 3x - 1 \\]",
    opciones: ["\\(x > 6\\)", "\\(x < 6\\)", "\\(x = 6\\)", "\\(x \\geq 6\\)"],
    correcta: 1,
    explicacion: "\\(2x + 5 > 3x - 1 \\Rightarrow 5 + 1 > 3x - 2x \\Rightarrow 6 > x\\), es decir \\(x < 6\\)."
  },
  {
    id: 13,
    pregunta: "Factoriza el trinomio",
    formula: "\\[ x^2 + 7x + 10 \\]",
    opciones: [
      "\\((x + 1)(x + 10)\\)",
      "\\((x + 2)(x + 5)\\)",
      "\\((x + 7)(x + 10)\\)",
      "\\((x + 3)(x + 4)\\)"
    ],
    correcta: 1,
    explicacion: "Se buscan dos números que sumen 7 y multipliquen 10: 2 y 5.<br>\\(x^2 + 7x + 10 = (x+2)(x+5)\\)."
  },
  {
    id: 14,
    pregunta: "Si \\(\\displaystyle x + \\frac{1}{x} = 3\\), halla el valor de",
    formula: "\\[ x^2 + \\frac{1}{x^2} \\]",
    opciones: ["5", "6", "7", "9"],
    correcta: 2,
    explicacion: "Se eleva al cuadrado la identidad dada:<br>\\(\\left(x + \\dfrac{1}{x}\\right)^2 = x^2 + 2 + \\dfrac{1}{x^2} = 9\\)<br>Por tanto \\(x^2 + \\dfrac{1}{x^2} = 9 - 2 = 7\\)."
  },
  {
    id: 15,
    pregunta: "Resuelve la ecuación",
    formula: "\\[ x^2 - 4x + 4 = 0 \\]",
    opciones: ["\\(x = 4\\)", "\\(x = 2\\)", "\\(x = -2\\)", "\\(x = 2\\) (raíz doble)"],
    correcta: 3,
    explicacion: "\\(x^2 - 4x + 4 = (x-2)^2 = 0 \\Rightarrow x = 2\\) con multiplicidad 2 (raíz doble)."
  }
];

/* ────────────────────────────────────────────────────
   2. TEMPORIZADOR
   - DURACION_SEG: duración total en segundos
   - timerInterval: referencia al setInterval activo
   - timerActivo: bandera para evitar doble inicio
──────────────────────────────────────────────────── */
const DURACION_SEG = 15 * 60; // 15 minutos
let segundosRestantes = DURACION_SEG;
let timerInterval     = null;
let timerActivo       = false;

/** Formatea segundos → "MM:SS" */
function formatTiempo(seg) {
  const m = Math.floor(seg / 60).toString().padStart(2, "0");
  const s = (seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Inicia el countdown */
function iniciarTimer() {
  if (timerActivo) return;
  timerActivo = true;
  segundosRestantes = DURACION_SEG;

  const displayEl = document.getElementById("timerDisplay");
  const timerBox  = document.getElementById("timerBox");
  displayEl.textContent = formatTiempo(segundosRestantes);

  timerInterval = setInterval(() => {
    segundosRestantes--;
    displayEl.textContent = formatTiempo(segundosRestantes);

    // Aviso visual: quedan 5 minutos
    if (segundosRestantes <= 300 && segundosRestantes > 120) {
      timerBox.classList.add("warn");
      timerBox.classList.remove("danger");
    }
    // Alerta roja: quedan 2 minutos
    if (segundosRestantes <= 120) {
      timerBox.classList.remove("warn");
      timerBox.classList.add("danger");
    }

    // Tiempo agotado
    if (segundosRestantes <= 0) {
      detenerTimer();
      mostrarOverlayTiempoAgotado();
    }
  }, 1000);
}

/** Detiene y limpia el countdown */
function detenerTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerActivo   = false;
  const timerBox = document.getElementById("timerBox");
  timerBox.classList.remove("warn", "danger");
}

/** Reinicia el timer visualmente para un nuevo intento */
function resetTimer() {
  detenerTimer();
  segundosRestantes = DURACION_SEG;
  document.getElementById("timerDisplay").textContent = formatTiempo(DURACION_SEG);
}

/** Muestra el overlay de tiempo agotado */
function mostrarOverlayTiempoAgotado() {
  document.getElementById("timeoutOverlay").classList.remove("hidden");
}

/** Oculta el overlay y muestra los resultados con sin-responder = incorrectas */
function procesarTiempoAgotado() {
  document.getElementById("timeoutOverlay").classList.add("hidden");

  // Las preguntas sin responder se toman como -1 (ninguna opción → incorrecta)
  const respuestas = PREGUNTAS.map(q => {
    const checked = document.querySelector(`input[name="diag-q${q.id}"]:checked`);
    return checked ? parseInt(checked.value, 10) : -1;
  });

  evaluarYMostrar(respuestas);
}

/* Botón del overlay */
document.getElementById("btnVerResultado").addEventListener("click", procesarTiempoAgotado);

/* ────────────────────────────────────────────────────
   3. LÓGICA AUXILIAR
──────────────────────────────────────────────────── */

/** Calcula nota sobre 5.0 a partir del porcentaje */
function calcNota(pct) {
  return ((pct / 100) * 5).toFixed(1);
}

/** Retorna la etiqueta de desempeño */
function calcBadge(pct) {
  if (pct >= 90) return "🏆 Excelente";
  if (pct >= 70) return "👍 Muy bueno";
  if (pct >= 50) return "🔶 Aceptable";
  return "📚 Necesita reforzar";
}

/** Resume precisión y tiempo promedio usado por pregunta */
function calcBalance(correctas, total, tiempoSeg) {
  const promedio = tiempoSeg / total;
  return `${promedio.toFixed(1)} segundos por pregunta`;
}

/** Letras de las opciones */
const LETRAS = ["A", "B", "C", "D"];

/* ────────────────────────────────────────────────────
   4. PRESENTACIÓN – Generación del formulario
──────────────────────────────────────────────────── */

const container   = document.getElementById("questionsContainer");
const progressBar = document.getElementById("progressBar");
const progressLbl = document.getElementById("progressLabel");
const answeredEl  = document.getElementById("answeredCount");

/**
 * Genera una tarjeta de pregunta en el DOM.
 * @param {Object} q - Objeto del banco de preguntas
 * @returns {HTMLElement}
 */
function crearTarjetaPregunta(q, tipo = "diag") {
  const prefijo = tipo;
  const card = document.createElement("div");
  card.className = "question-card";
  card.id = `${prefijo}-card-${q.id}`;

  /* Encabezado con número y texto */
  card.innerHTML = `
    <div class="q-header">
      <span class="q-num">${q.id}</span>
      <p class="q-text">${q.pregunta}</p>
    </div>
    ${q.formula ? `<div class="q-formula">${q.formula}</div>` : ""}
    <div class="options-list" id="${prefijo}-opts-${q.id}"></div>
  `;

  /* Opciones */
  const optsList = card.querySelector(`#${prefijo}-opts-${q.id}`);
  q.opciones.forEach((texto, idx) => {
    const label = document.createElement("label");
    label.className = "option-label";
    label.htmlFor = `${prefijo}-q${q.id}-opt${idx}`;
    label.innerHTML = `
      <input type="radio" name="${prefijo}-q${q.id}" id="${prefijo}-q${q.id}-opt${idx}" value="${idx}" />
      <span class="opt-letter">${LETRAS[idx]}</span>
      <span class="opt-text">${texto}</span>
    `;

    /* Marcar seleccionada visualmente */
    label.querySelector("input").addEventListener("change", () => {
      optsList.querySelectorAll(".option-label").forEach(l => l.classList.remove("selected"));
      label.classList.add("selected");
      card.classList.add("answered");
      if (tipo === "examen") actualizarProgresoExamen();
      else if (tipo === "nivel") actualizarProgresoNivel();
      else actualizarProgreso();
    });

    optsList.appendChild(label);
  });

  return card;
}

/** Renderiza todas las tarjetas */
function renderizarPreguntas() {
  container.innerHTML = "";
  PREGUNTAS.forEach(q => container.appendChild(crearTarjetaPregunta(q)));
  // Re-render KaTeX si está disponible
  if (typeof renderMathInElement === "function") {
    renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ]
    });
  }
}

/** Actualiza barra de progreso y contadores */
function actualizarProgreso() {
  let respondidas = 0;
  PREGUNTAS.forEach(q => {
    const el = document.querySelector(`input[name="diag-q${q.id}"]:checked`);
    if (el) respondidas++;
  });
  mostrarProgreso(respondidas, PREGUNTAS.length);
}

/** Actualiza el progreso del examen final */
function actualizarProgresoExamen() {
  let respondidas = 0;
  PREGUNTAS_EXAMEN.forEach(q => {
    const el = document.querySelector(`input[name="examen-q${q.id}"]:checked`);
    if (el) respondidas++;
  });
  mostrarProgreso(respondidas, PREGUNTAS_EXAMEN.length);
}

/** Presenta en el encabezado el progreso de la sección activa */
function mostrarProgreso(respondidas, total) {
  const pct = Math.round((respondidas / total) * 100);
  progressBar.style.width = pct + "%";
  progressLbl.textContent = pct + "% completado";
  answeredEl.textContent  = respondidas;
  document.getElementById("totalCount").textContent = total;
}

/* ────────────────────────────────────────────────────
   5. ENVÍO Y EVALUACIÓN
──────────────────────────────────────────────────── */

const form           = document.getElementById("diagForm");
const warnMsg        = document.getElementById("warnMsg");
const resultsSection = document.getElementById("resultsSection");

// Bandera global: el estudiante completó el diagnóstico
let diagnosticoCompletado = false;
let examenIniciado = false;
let examenCompletado = false;
const nivelesCompletados = { nivel1: false, nivel2: false, nivel3: false, nivel4: false, nivel5: false };

form.addEventListener("submit", (e) => {
  e.preventDefault();

  /* Validar que todas estén respondidas */
  const sinResponder = PREGUNTAS.some(
    q => !document.querySelector(`input[name="diag-q${q.id}"]:checked`)
  );
  if (sinResponder) {
    warnMsg.hidden = false;
    for (const q of PREGUNTAS) {
      if (!document.querySelector(`input[name="diag-q${q.id}"]:checked`)) {
        document.getElementById(`diag-card-${q.id}`).scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
    return;
  }
  warnMsg.hidden = true;
  detenerTimer();

  /* Recopilar respuestas */
  const respuestas = PREGUNTAS.map(q => {
    const checked = document.querySelector(`input[name="diag-q${q.id}"]:checked`);
    return parseInt(checked.value, 10);
  });

  evaluarYMostrar(respuestas);
  resultsSection.scrollIntoView({ behavior: "smooth" });
});

/**
 * Función central compartida por envío manual y tiempo agotado.
 * Recibe array de respuestas (índice 0-3 o -1 = sin responder).
 */
function evaluarYMostrar(respuestas) {
  /* Ocultar formulario de envío */
  document.getElementById("submitBtn").style.display = "none";
  // Marcar diagnóstico como completado
  diagnosticoCompletado = true;

  /* Calcular resultados */
  let correctas = 0;
  PREGUNTAS.forEach((q, i) => { if (respuestas[i] === q.correcta) correctas++; });
  const incorrectas = PREGUNTAS.length - correctas;
  const porcentaje  = Math.round((correctas / PREGUNTAS.length) * 100);
  const nota        = calcNota(porcentaje);
  const badge       = calcBadge(porcentaje);

  mostrarResultados(respuestas, correctas, incorrectas, porcentaje, nota, badge);
  resetTimer();
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

/* ────────────────────────────────────────────────────
   6. PRESENTACIÓN – Resultados
──────────────────────────────────────────────────── */

function mostrarResultados(respuestas, correctas, incorrectas, pct, nota, badge) {
  resultsSection.hidden = false;
  const tiempoEmpleado = DURACION_SEG - segundosRestantes;

  /* ── Score ring ── */
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (pct / 100) * circumference;
  document.getElementById("ringFill").style.strokeDashoffset = offset;
  document.getElementById("scorePct").textContent   = pct + "%";
  document.getElementById("scoreNota").textContent  = "Nota: " + nota + " / 5.0";
  document.getElementById("scoreBadge").textContent = badge;
  document.getElementById("pillCorrect").textContent = correctas + " correctas";
  document.getElementById("pillWrong").textContent   = incorrectas + " incorrectas";
  document.getElementById("tiempoEmpleado").textContent = formatTiempo(tiempoEmpleado);
  document.getElementById("tiempoRestante").textContent = formatTiempo(segundosRestantes);
  document.getElementById("balanceResultado").textContent =
    calcBalance(correctas, PREGUNTAS.length, tiempoEmpleado);

  const ring = document.getElementById("ringFill");
  if (pct >= 70) ring.style.stroke = "#1a7f5a";
  else if (pct >= 50) ring.style.stroke = "#c8972b";
  else ring.style.stroke = "#c0392b";

  /* ── Gráfico de barras ── */
  const MAX_PX = 120; // altura máxima de la barra en px
  const barC   = document.getElementById("barCorrect");
  const barW   = document.getElementById("barWrong");
  barC.setAttribute("data-val", correctas);
  barW.setAttribute("data-val", incorrectas);
  setTimeout(() => {
    barC.style.height = Math.round((correctas  / PREGUNTAS.length) * MAX_PX) + "px";
    barW.style.height = Math.round((incorrectas / PREGUNTAS.length) * MAX_PX) + "px";
  }, 150);

  /* ── Tabla resumen (con LaTeX) ── */
  const tbody = document.getElementById("summaryBody");
  tbody.innerHTML = "";
  PREGUNTAS.forEach((q, i) => {
    const sinResp = respuestas[i] === -1;
    const ok = !sinResp && respuestas[i] === q.correcta;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${q.id}</td>
      <td class="${ok ? "tag-ok" : "tag-bad"}">${ok ? "✔ Correcta" : sinResp ? "✘ Sin responder" : "✘ Incorrecta"}</td>
      <td>${sinResp ? "—" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</td>
      <td>${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</td>
    `;
    tbody.appendChild(tr);
  });

  /* ── Retroalimentación detallada ── */
  const feedbackEl = document.getElementById("feedbackItems");
  feedbackEl.innerHTML = "";
  PREGUNTAS.forEach((q, i) => {
    const sinResp = respuestas[i] === -1;
    const ok = !sinResp && respuestas[i] === q.correcta;
    const item = document.createElement("div");
    item.className = `feedback-item ${ok ? "fb-correct" : "fb-wrong"}`;
    item.id = `fb-${q.id}`;
    item.innerHTML = `
      <div class="fb-header">
        <span class="fb-icon">${ok ? "✔" : "✘"}</span>
        Pregunta ${q.id}${sinResp ? " <em style='font-weight:400;font-size:.85rem'>(sin responder)</em>" : ""}
      </div>
      <p class="fb-resp"><strong>Tu respuesta:</strong> ${sinResp ? "No respondida" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</p>
      ${!ok ? `<p class="fb-resp"><strong>Respuesta correcta:</strong> ${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</p>` : ""}
      <div class="fb-expl"><strong>Explicación:</strong><br>${q.explicacion}</div>
    `;
    feedbackEl.appendChild(item);
  });

  /* Re-render KaTeX */
  if (typeof renderMathInElement === "function") {
    renderMathInElement(resultsSection, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ]
    });
  }

  /* Marcar tarjetas visualmente */
  PREGUNTAS.forEach((q, i) => {
    const card = document.getElementById(`diag-card-${q.id}`);
    if (!card) return;
    const sinResp = respuestas[i] === -1;
    const ok = !sinResp && respuestas[i] === q.correcta;
    card.classList.add(ok ? "result-correct" : "result-wrong");
    card.querySelectorAll("input[type='radio']").forEach(inp => { inp.disabled = true; });
    card.querySelectorAll(".option-label").forEach((lbl, idx) => {
      if (idx === q.correcta) lbl.classList.add("opt-correct");
      if (!sinResp && !ok && idx === respuestas[i]) lbl.classList.add("opt-wrong");
    });
  });
}

/* Quita tags LaTeX simples para mostrar texto sin formato en la tabla */
function textoPlano(str) {
  return str.replace(/\\[()[\]]/g, "").replace(/\\\(|\\\)/g, "").replace(/\$/g, "");
}

/* ────────────────────────────────────────────────────
   7. BOTONES DE ACCIÓN POST-RESULTADO
──────────────────────────────────────────────────── */

/* Reiniciar diagnóstico */
document.getElementById("btnRestart").addEventListener("click", () => {
  // El diagnóstico es el requisito del examen final: reiniciarlo invalida ambos intentos.
  detenerTimer();
  detenerTimerNivel();
  detenerTimerExamen();
  diagnosticoCompletado = false;
  reiniciarEstadoNiveles();
  reiniciarEstadoExamenFinal(false);

  resultsSection.hidden = true;
  document.getElementById("submitBtn").style.display = "";
  document.getElementById("warnMsg").hidden = true;
  // Ocultar preguntas y resultados, volver a pantalla de inicio
  document.getElementById("diagFormWrap").hidden = true;
  document.getElementById("startScreen").hidden  = false;
  // Limpiar preguntas del DOM (se regeneran al iniciar)
  document.getElementById("questionsContainer").innerHTML = "";

  // Restablecer el encabezado al estado inicial del diagnóstico.
  resetTimer();
  mostrarProgreso(0, PREGUNTAS.length);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* Ver solo incorrectas */
document.getElementById("btnWrong").addEventListener("click", () => {
  const items = document.querySelectorAll(".feedback-item");
  items.forEach(item => {
    if (item.classList.contains("fb-correct")) {
      item.classList.add("hidden-item");
    } else {
      item.classList.remove("hidden-item");
    }
  });
  document.getElementById("feedbackList").scrollIntoView({ behavior: "smooth" });
});

/* Ver todas las respuestas */
document.getElementById("btnAll").addEventListener("click", () => {
  document.querySelectorAll(".feedback-item").forEach(item => item.classList.remove("hidden-item"));
  document.getElementById("feedbackList").scrollIntoView({ behavior: "smooth" });
});

/* ────────────────────────────────────────────────────
   8. NAVEGACIÓN DE SECCIONES
──────────────────────────────────────────────────── */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const sec = btn.dataset.section;
    mostrarSeccion(sec);

    if (sec === "diagnostico") {
      actualizarProgreso();
    }

    if (sec.startsWith("nivel")) {
      abrirNivel(sec);
    }

    // Al entrar al examen final, mostrar estado correcto
    if (sec === "examen") {
      if (puedeAbrirExamenFinal()) {
        document.getElementById("examenBloqueado").hidden   = true;
        document.getElementById("startScreenExamen").hidden = examenIniciado || examenCompletado;
        document.getElementById("examenFormWrap").hidden = !examenIniciado;
        document.getElementById("resultsSectionExamen").hidden = !examenCompletado;
        if (!examenIniciado && !examenCompletado) {
          resetTimerExamen();
        }
      } else {
        document.getElementById("examenBloqueado").hidden   = false;
        document.getElementById("startScreenExamen").hidden = true;
        // Asegurarse que el formulario no sea visible
        document.getElementById("examenFormWrap").hidden       = true;
        document.getElementById("resultsSectionExamen").hidden = true;
      }
      actualizarProgresoExamen();
    }
  });
});

function mostrarSeccion(sec) {
  document.getElementById("sectionDiagnostico").classList.toggle("hidden", sec !== "diagnostico");
  document.getElementById("sectionNivel").classList.toggle("hidden", !sec.startsWith("nivel"));
  document.getElementById("sectionExamen").classList.toggle("hidden", sec !== "examen");
  document.getElementById("sectionAdmin").classList.toggle("hidden", sec !== "admin");
}

function activarNav(sec) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === sec));
  mostrarSeccion(sec);
}

// Botón "Ir al Diagnóstico" desde pantalla bloqueada
document.getElementById("btnIrDiagnostico").addEventListener("click", () => {
  activarNav("nivel5");
  abrirNivel("nivel5");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ────────────────────────────────────────────────────
   9. INICIALIZACIÓN
──────────────────────────────────────────────────── */
// Solo inicializa contadores — las preguntas se generan al presionar Iniciar
actualizarProgreso();

/* ────────────────────────────────────────────────────
   10. BOTÓN INICIAR DIAGNÓSTICO
──────────────────────────────────────────────────── */
document.getElementById("btnIniciarDiag").addEventListener("click", () => {
  // Generar preguntas en el momento de iniciar
  renderizarPreguntas();
  actualizarProgreso();
  // Mostrar formulario, ocultar pantalla de inicio
  document.getElementById("startScreen").hidden  = true;
  document.getElementById("diagFormWrap").hidden = false;
  // Arrancar timer
  iniciarTimer();
  // Scroll a las preguntas
  document.getElementById("diagFormWrap").scrollIntoView({ behavior: "smooth" });
});

/* ════════════════════════════════════════════════════════
   11. EXAMEN FINAL – DATOS (10 preguntas alta dificultad)
════════════════════════════════════════════════════════ */
const PREGUNTAS_EXAMEN = [
  {
    id: 1,
    pregunta: "Si \\(\\log_2 x + \\log_2(x-2) = 3\\), el valor de \\(x\\) es:",
    formula: "",
    opciones: ["\\(x = 4\\)", "\\(x = -2\\)", "\\(x = 2\\)", "\\(x = 8\\)"],
    correcta: 0,
    explicacion: "\\(\\log_2[x(x-2)]=3 \\Rightarrow x(x-2)=8 \\Rightarrow x^2-2x-8=0 \\Rightarrow (x-4)(x+2)=0\\).<br>Como \\(x>2\\) (dominio), la solución es \\(x=4\\)."
  },
  {
    id: 2,
    pregunta: "Si \\(m^{m^2} = 2\\), entonces ¿cuánto vale \\((m+3)(m-3)\\)?",
    formula: "",
    opciones: ["\\(1\\)", "\\(-7\\)", "\\(4\\)", "\\(-5\\)"],
    correcta: 1,
    explicacion: "Como \\(\\sqrt{2}^{(\\sqrt{2})^2} = \\sqrt{2}^{2} = 2\\), se puede tomar \\(m = \\sqrt{2}\\).<br>Entonces \\((m+3)(m-3) = m^2 - 9 = (\\sqrt{2})^2 - 9 = 2 - 9 = -7\\)."
  },
  {
    id: 3,
    pregunta: "¿Cuál es el conjunto solución de la inecuación?",
    formula: "\\[ \\frac{x^2 - 5x + 6}{x - 1} < 0 \\]",
    opciones: ["\\((-\\infty,1)\\cup(2,3)\\)", "\\((1,2)\\cup(3,\\infty)\\)", "\\((-\\infty,1)\\cup(3,\\infty)\\)", "\\((1,2)\\)"],
    correcta: 0,
    explicacion: "Factorizamos el numerador:<br>\\(\\dfrac{x^2-5x+6}{x-1}=\\dfrac{(x-2)(x-3)}{x-1}\\).<br>Los puntos críticos son \\(1\\), \\(2\\) y \\(3\\). Con el método del cementerio se analizan los signos en los intervalos \\((-\\infty,1)\\), \\((1,2)\\), \\((2,3)\\) y \\((3,\\infty)\\).<br>La expresión resulta negativa en \\((-\\infty,1)\\) y en \\((2,3)\\). Como la desigualdad es estricta y \\(x=1\\) no pertenece al dominio, el conjunto solución es \\((-\\infty,1)\\cup(2,3)\\)."
  },
  {
    id: 4,
    pregunta: "Si \\(f(x) = x^2 - 1\\) y \\(g(x) = \\sqrt{x+1}\\), entonces \\((g \\circ f)(3)\\) vale:",
    formula: "",
    opciones: ["\\(2\\sqrt{2}\\)", "\\(3\\)", "\\(\\sqrt{10}\\)", "\\(2\\)"],
    correcta: 1,  
    explicacion: "\\(f(3) = 9 - 1 = 8\\).<br>\\(g(f(3)) = g(8) = \\sqrt{8+1} = \\sqrt{9} = 3\\)."
  },
  {
    id: 5,
    pregunta: "El valor de",
    formula: "\\[ \\lim_{x \\to 0} \\frac{\\sin(3x)}{\\tan(5x)} \\]",
    opciones: ["\\(\\dfrac{5}{3}\\)", "\\(0\\)", "\\(\\dfrac{3}{5}\\)", "\\(1\\)"],
    correcta: 2,
    explicacion: "Usando \\(\\lim_{u\\to 0}\\frac{\\sin u}{u}=1\\) y \\(\\lim_{u\\to 0}\\frac{\\tan u}{u}=1\\):<br>\\(\\lim_{x\\to 0}\\frac{\\sin 3x}{\\tan 5x} = \\lim_{x\\to 0}\\frac{\\sin 3x}{3x}\\cdot\\frac{5x}{\\tan 5x}\\cdot\\frac{3}{5} = 1\\cdot1\\cdot\\frac{3}{5} = \\dfrac{3}{5}\\)."
  },
  {
    id: 6,
    pregunta: "Si \\(3^w + 9^w = 90\\), entonces \\(w\\) vale:",
    formula: "",
    opciones: ["\\(2\\)", "\\(7\\)", "\\(1\\)", "\\(0\\)"],
    correcta: 0,
    explicacion: "Sea \\(p=3^w\\). Entonces \\(9^w=(3^2)^w=3^{2w}=(3^w)^2=p^2\\).<br>La ecuación queda \\(p+p^2=90\\), es decir, \\(p^2+p-90=0\\).<br>Factorizando: \\((p+10)(p-9)=0\\). Como \\(p=3^w>0\\), se toma \\(p=9\\).<br>Así, \\(3^w=9=3^2\\), por tanto \\(w=2\\)."
  },
  {
    id: 7,
    pregunta: "La ecuación \\(2\\sin^2\\theta - \\sin\\theta - 1 = 0\\) en \\([0°, 360°)\\) tiene soluciones:",
    formula: "",
    opciones: [
      "\\(90°\\) y \\(210°\\)",
      "\\(90°, 210°\\) y \\(330°\\)",
      "\\(270°, 210°\\) y \\(330°\\)",
      "\\(270°\\) y \\(30°\\)"
    ],
    correcta: 1,
    explicacion: "Factorizando: \\((2\\sin\\theta+1)(\\sin\\theta-1)=0\\).<br>• \\(\\sin\\theta=1 \\Rightarrow \\theta=90°\\)<br>• \\(\\sin\\theta=-\\frac{1}{2} \\Rightarrow \\theta=210°\\) o \\(330°\\).<br>Soluciones: \\(90°, 210°, 330°\\)."
  },
  {
    id: 8,
    pregunta: "Si las raíces de \\(x^2 + px + q = 0\\) son \\(r\\) y \\(s\\), entonces \\(r^2 + s^2\\) equivale a:",
    formula: "",
    opciones: [
      "\\(p^2 - 2q\\)",
      "\\(p^2 + 2q\\)",
      "\\(p^2 - q\\)",
      "\\((p-q)^2\\)"
    ],
    correcta: 0,
    explicacion: "Por Vieta: \\(r+s = -p\\) y \\(rs = q\\).<br>\\(r^2+s^2 = (r+s)^2 - 2rs = (-p)^2 - 2q = p^2 - 2q\\)."
  },
  {
    id: 9,
    pregunta: "Calcular \\(E=\\log(1000!)-\\log(999!)\\):",
    formula: "",
    opciones: [
      "\\(1\\)",
      "\\(2\\)",
      "\\(0\\)",
      "\\(3\\)"
    ],
    correcta: 3,
    explicacion: "Usando la propiedad \\(\\log a-\\log b=\\log\\left(\\dfrac{a}{b}\\right)\\), tenemos:<br>\\(E=\\log\\left(\\dfrac{1000!}{999!}\\right)\\).<br>Como \\(1000! = 1000\\cdot 999!\\), entonces \\(\\dfrac{1000!}{999!}=1000\\).<br>Por tanto, \\(E=\\log(1000)=3\\), porque \\(10^3=1000\\)."
  },
  {
    id: 10,
    pregunta: "En un triángulo con lados \\(a=7\\), \\(b=8\\) y \\(c=9\\), el coseno del ángulo \\(C\\) (opuesto al lado \\(c\\)) es:",
    formula: "",
    opciones: [
      "\\(\\dfrac{1}{7}\\)",
      "\\(\\dfrac{11}{56}\\)",
      "\\(\\dfrac{2}{7}\\)",
      "\\(-\\dfrac{1}{14}\\)"
    ],
    correcta: 2,
    explicacion: "Ley de cosenos: \\(c^2 = a^2+b^2-2ab\\cos C\\).<br>\\(81 = 49+64-112\\cos C \\Rightarrow 112\\cos C = 32 \\Rightarrow \\cos C = \\dfrac{32}{112} = \\dfrac{2}{7}\\)."
  }
];

/* ════════════════════════════════════════════════════════
   12. NIVELES – DATOS (5 niveles, 10 preguntas cada uno)
════════════════════════════════════════════════════════ */
const NIVELES_META = {
  nivel1: { titulo: "Nivel 1", descripcion: "Fundamentos de aritmética, álgebra básica y ecuaciones lineales.", requisito: "diagnostico", requisitoTexto: "Completa primero el diagnóstico." },
  nivel2: { titulo: "Nivel 2", descripcion: "Álgebra intermedia, factorización, funciones y proporciones.", requisito: "nivel1", requisitoTexto: "Completa primero el Nivel 1." },
  nivel3: { titulo: "Nivel 3", descripcion: "Desigualdades, logaritmos, funciones y trigonometría básica.", requisito: "nivel2", requisitoTexto: "Completa primero el Nivel 2." },
  nivel4: { titulo: "Nivel 4", descripcion: "Precálculo, sucesiones, composición de funciones y conteo.", requisito: "nivel3", requisitoTexto: "Completa primero el Nivel 3." },
  nivel5: { titulo: "Nivel 5", descripcion: "Reto avanzado antes del examen final.", requisito: "nivel4", requisitoTexto: "Completa primero el Nivel 4." }
};

const PREGUNTAS_NIVELES = {
  nivel1: [
    { id: 1, pregunta: "Calcula", formula: "\\[ 7-3(2-5) \\]", opciones: ["\\(16\\)", "\\(-2\\)", "\\(4\\)", "\\(13\\)"], correcta: 0, explicacion: "Primero el paréntesis: \\(2-5=-3\\). Luego \\(7-3(-3)=7+9=16\\)." },
    { id: 2, pregunta: "Si \\(2x+5=17\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(5\\)", "\\(6\\)", "\\(7\\)", "\\(11\\)"], correcta: 1, explicacion: "\\(2x=17-5=12\\). Por tanto, \\(x=6\\)." },
    { id: 3, pregunta: "Simplifica", formula: "\\[ 4a-2b+7a+5b \\]", opciones: ["\\(11a+3b\\)", "\\(3a+11b\\)", "\\(11a-7b\\)", "\\(a+3b\\)"], correcta: 0, explicacion: "Se agrupan términos semejantes: \\((4+7)a+(-2+5)b=11a+3b\\)." },
    { id: 4, pregunta: "El \\(25\\%\\) de 80 es:", formula: "", opciones: ["\\(15\\)", "\\(20\\)", "\\(25\\)", "\\(40\\)"], correcta: 1, explicacion: "\\(25\\%=\\frac14\\). Entonces \\(\\frac14\\cdot80=20\\)." },
    { id: 5, pregunta: "Factoriza", formula: "\\[ x^2+5x \\]", opciones: ["\\(x(x+5)\\)", "\\(5(x+1)\\)", "\\(x(x-5)\\)", "\\((x+5)^2\\)"], correcta: 0, explicacion: "El factor común es \\(x\\): \\(x^2+5x=x(x+5)\\)." },
    { id: 6, pregunta: "Resuelve", formula: "\\[ \\frac{x}{3}+2=7 \\]", opciones: ["\\(9\\)", "\\(12\\)", "\\(15\\)", "\\(21\\)"], correcta: 2, explicacion: "\\(\\frac{x}{3}=5\\). Multiplicando por 3: \\(x=15\\)." },
    { id: 7, pregunta: "Si \\(f(x)=2x-1\\), entonces \\(f(4)\\) es:", formula: "", opciones: ["\\(6\\)", "\\(7\\)", "\\(8\\)", "\\(9\\)"], correcta: 1, explicacion: "\\(f(4)=2(4)-1=8-1=7\\)." },
    { id: 8, pregunta: "El producto notable", formula: "\\[ (x+3)^2 \\]", opciones: ["\\(x^2+9\\)", "\\(x^2+6x+9\\)", "\\(x^2+3x+9\\)", "\\(x^2-6x+9\\)"], correcta: 1, explicacion: "\\((a+b)^2=a^2+2ab+b^2\\). Entonces \\((x+3)^2=x^2+6x+9\\)." },
    { id: 9, pregunta: "Ordena de menor a mayor:", formula: "\\[ -2,\\; \\frac12,\\; 0,\\; -\\frac32 \\]", opciones: ["\\(-2,-\\frac32,0,\\frac12\\)", "\\(-\\frac32,-2,0,\\frac12\\)", "\\(0,\\frac12,-\\frac32,-2\\)", "\\(-2,0,-\\frac32,\\frac12\\)"], correcta: 0, explicacion: "En la recta numérica: \\(-2<-\\frac32<0<\\frac12\\)." },
    { id: 10, pregunta: "Si \\(3x-4=2x+9\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(5\\)", "\\(9\\)", "\\(13\\)", "\\(-13\\)"], correcta: 2, explicacion: "Restando \\(2x\\): \\(x-4=9\\). Sumando 4: \\(x=13\\)." }
  ],
  nivel2: [
    { id: 1, pregunta: "Factoriza", formula: "\\[ x^2-25 \\]", opciones: ["\\((x-5)^2\\)", "\\((x-5)(x+5)\\)", "\\((x+25)(x-1)\\)", "\\(x(x-25)\\)"], correcta: 1, explicacion: "Es diferencia de cuadrados: \\(x^2-25=x^2-5^2=(x-5)(x+5)\\)." },
    { id: 2, pregunta: "Resuelve", formula: "\\[ 2(x-3)=x+4 \\]", opciones: ["\\(6\\)", "\\(8\\)", "\\(10\\)", "\\(12\\)"], correcta: 2, explicacion: "\\(2x-6=x+4\\). Entonces \\(x=10\\)." },
    { id: 3, pregunta: "Simplifica", formula: "\\[ \\frac{12x^3}{3x} \\]", opciones: ["\\(4x^2\\)", "\\(4x^3\\)", "\\(9x^2\\)", "\\(15x^2\\)"], correcta: 0, explicacion: "\\(12/3=4\\) y \\(x^3/x=x^2\\). Resultado: \\(4x^2\\)." },
    { id: 4, pregunta: "La pendiente de la recta que pasa por \\((1,2)\\) y \\((3,8)\\) es:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(6\\)"], correcta: 1, explicacion: "\\(m=\\frac{8-2}{3-1}=\\frac{6}{2}=3\\)." },
    { id: 5, pregunta: "Si \\(f(x)=x^2-2x\\), entonces \\(f(-1)\\) vale:", formula: "", opciones: ["\\(-3\\)", "\\(1\\)", "\\(3\\)", "\\(5\\)"], correcta: 2, explicacion: "\\(f(-1)=(-1)^2-2(-1)=1+2=3\\)." },
    { id: 6, pregunta: "Resuelve", formula: "\\[ x^2-9x+20=0 \\]", opciones: ["\\(4\\) y \\(5\\)", "\\(2\\) y \\(10\\)", "\\(-4\\) y \\(-5\\)", "\\(1\\) y \\(20\\)"], correcta: 0, explicacion: "Buscamos dos números que sumen 9 y multipliquen 20: 4 y 5. Entonces \\((x-4)(x-5)=0\\)." },
    { id: 7, pregunta: "Si \\(\\frac{a}{3}=\\frac{10}{6}\\), entonces \\(a\\) vale:", formula: "", opciones: ["\\(4\\)", "\\(5\\)", "\\(6\\)", "\\(8\\)"], correcta: 1, explicacion: "Por producto cruzado: \\(6a=30\\). Entonces \\(a=5\\)." },
    { id: 8, pregunta: "El dominio de", formula: "\\[ \\frac{1}{x-4} \\]", opciones: ["\\(x\\neq 0\\)", "\\(x\\neq 4\\)", "\\(x>4\\)", "\\(x<4\\)"], correcta: 1, explicacion: "El denominador no puede ser cero. \\(x-4\\neq0\\), por tanto \\(x\\neq4\\)." },
    { id: 9, pregunta: "Calcula", formula: "\\[ 2^3\\cdot2^4 \\]", opciones: ["\\(2^7\\)", "\\(2^{12}\\)", "\\(4^7\\)", "\\(16\\)"], correcta: 0, explicacion: "Con la misma base se suman exponentes: \\(2^3\\cdot2^4=2^{3+4}=2^7\\)." },
    { id: 10, pregunta: "Si \\(y\\) es directamente proporcional a \\(x\\) y \\(y=12\\) cuando \\(x=3\\), entonces cuando \\(x=5\\), \\(y\\) vale:", formula: "", opciones: ["\\(15\\)", "\\(18\\)", "\\(20\\)", "\\(24\\)"], correcta: 2, explicacion: "La constante es \\(k=12/3=4\\). Entonces \\(y=4x\\). Para \\(x=5\\), \\(y=20\\)." }
  ],
  nivel3: [
    { id: 1, pregunta: "Resuelve la desigualdad", formula: "\\[ 3x-7<11 \\]", opciones: ["\\(x<6\\)", "\\(x>6\\)", "\\(x<\\frac43\\)", "\\(x>\\frac43\\)"], correcta: 0, explicacion: "\\(3x<18\\). Dividiendo entre 3: \\(x<6\\)." },
    { id: 2, pregunta: "Calcula", formula: "\\[ \\log_{2}(32) \\]", opciones: ["\\(4\\)", "\\(5\\)", "\\(16\\)", "\\(64\\)"], correcta: 1, explicacion: "\\(2^5=32\\), por tanto \\(\\log_2(32)=5\\)." },
    { id: 3, pregunta: "Si \\(g(x)=\\sqrt{x-1}\\), su dominio es:", formula: "", opciones: ["\\(x>1\\)", "\\(x\\geq1\\)", "\\(x\\leq1\\)", "Todo real"], correcta: 1, explicacion: "Para una raíz cuadrada se exige \\(x-1\\geq0\\). Entonces \\(x\\geq1\\)." },
    { id: 4, pregunta: "Resuelve", formula: "\\[ |x-2|=5 \\]", opciones: ["\\(7\\)", "\\(-3\\)", "\\(7\\) y \\(-3\\)", "\\(5\\) y \\(-5\\)"], correcta: 2, explicacion: "Dos casos: \\(x-2=5\\Rightarrow x=7\\) y \\(x-2=-5\\Rightarrow x=-3\\)." },
    { id: 5, pregunta: "Simplifica", formula: "\\[ \\frac{x^2-1}{x-1} \\]", opciones: ["\\(x-1\\)", "\\(x+1\\)", "\\(x^2+1\\)", "\\(1\\)"], correcta: 1, explicacion: "\\(x^2-1=(x-1)(x+1)\\). Al simplificar queda \\(x+1\\), con \\(x\\neq1\\)." },
    { id: 6, pregunta: "El valor de \\(\\sin 30^\\circ\\) es:", formula: "", opciones: ["\\(\\frac12\\)", "\\(\\frac{\\sqrt2}{2}\\)", "\\(\\frac{\\sqrt3}{2}\\)", "\\(1\\)"], correcta: 0, explicacion: "En los ángulos notables, \\(\\sin 30^\\circ=\\frac12\\)." },
    { id: 7, pregunta: "Si \\(2^{x+1}=16\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(5\\)"], correcta: 1, explicacion: "\\(16=2^4\\). Entonces \\(x+1=4\\), por tanto \\(x=3\\)." },
    { id: 8, pregunta: "El vértice de \\(y=(x-2)^2+3\\) es:", formula: "", opciones: ["\\((2,3)\\)", "\\((-2,3)\\)", "\\((3,2)\\)", "\\((2,-3)\\)"], correcta: 0, explicacion: "La forma \\(y=(x-h)^2+k\\) tiene vértice \\((h,k)\\). Aquí es \\((2,3)\\)." },
    { id: 9, pregunta: "Si \\(a+b=10\\) y \\(ab=21\\), entonces \\(a^2+b^2\\) es:", formula: "", opciones: ["\\(42\\)", "\\(58\\)", "\\(79\\)", "\\(100\\)"], correcta: 1, explicacion: "\\(a^2+b^2=(a+b)^2-2ab=10^2-2(21)=100-42=58\\)." },
    { id: 10, pregunta: "La solución de", formula: "\\[ \\frac{x-1}{2}=\\frac{x+3}{4} \\]", opciones: ["\\(1\\)", "\\(3\\)", "\\(5\\)", "\\(7\\)"], correcta: 2, explicacion: "Multiplicando por 4: \\(2(x-1)=x+3\\). Entonces \\(2x-2=x+3\\), así \\(x=5\\)." }
  ],
  nivel4: [
    { id: 1, pregunta: "Calcula", formula: "\\[ \\lim_{x\\to 2}\\frac{x^2-4}{x-2} \\]", opciones: ["\\(0\\)", "\\(2\\)", "\\(4\\)", "No existe"], correcta: 2, explicacion: "Factorizamos \\(x^2-4=(x-2)(x+2)\\). Al simplificar queda \\(x+2\\). Evaluando en 2: \\(4\\)." },
    { id: 2, pregunta: "La suma de los primeros 20 enteros positivos es:", formula: "", opciones: ["\\(190\\)", "\\(200\\)", "\\(210\\)", "\\(220\\)"], correcta: 2, explicacion: "\\(1+2+\\cdots+n=\\frac{n(n+1)}2\\). Para \\(n=20\\): \\(\\frac{20\\cdot21}{2}=210\\)." },
    { id: 3, pregunta: "Si \\(f(x)=2x+1\\) y \\(g(x)=x^2\\), entonces \\((f\\circ g)(3)\\) vale:", formula: "", opciones: ["\\(10\\)", "\\(17\\)", "\\(19\\)", "\\(36\\)"], correcta: 2, explicacion: "\\(g(3)=9\\). Luego \\(f(g(3))=f(9)=2(9)+1=19\\)." },
    { id: 4, pregunta: "Resuelve", formula: "\\[ \\log(x)+\\log(10)=3 \\]", opciones: ["\\(10\\)", "\\(100\\)", "\\(1000\\)", "\\(1\\)"], correcta: 1, explicacion: "\\(\\log(x)+\\log(10)=\\log(10x)=3\\). Entonces \\(10x=10^3=1000\\), así \\(x=100\\)." },
    { id: 5, pregunta: "El número de formas de ordenar 4 objetos distintos es:", formula: "", opciones: ["\\(8\\)", "\\(12\\)", "\\(16\\)", "\\(24\\)"], correcta: 3, explicacion: "Las permutaciones de 4 objetos son \\(4!=4\\cdot3\\cdot2\\cdot1=24\\)." },
    { id: 6, pregunta: "Si \\(\\cos\\theta=\\frac35\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\sin\\theta\\) es:", formula: "", opciones: ["\\(\\frac45\\)", "\\(\\frac35\\)", "\\(\\frac{16}{25}\\)", "\\(\\frac12\\)"], correcta: 0, explicacion: "\\(\\sin^2\\theta=1-\\cos^2\\theta=1-\\frac{9}{25}=\\frac{16}{25}\\). En el primer cuadrante, \\(\\sin\\theta=\\frac45\\)." },
    { id: 7, pregunta: "Resuelve", formula: "\\[ x^2-4x-5>0 \\]", opciones: ["\\((-1,5)\\)", "\\((-\\infty,-1)\\cup(5,\\infty)\\)", "\\((-\\infty,5)\\)", "\\((-1,\\infty)\\)"], correcta: 1, explicacion: "Factorizamos \\((x-5)(x+1)>0\\). El producto es positivo fuera de las raíces: \\((-\\infty,-1)\\cup(5,\\infty)\\)." },
    { id: 8, pregunta: "La distancia entre \\((1,2)\\) y \\((4,6)\\) es:", formula: "", opciones: ["\\(3\\)", "\\(4\\)", "\\(5\\)", "\\(7\\)"], correcta: 2, explicacion: "\\(d=\\sqrt{(4-1)^2+(6-2)^2}=\\sqrt{9+16}=5\\)." },
    { id: 9, pregunta: "Si \\(r\\) es raíz doble de \\(x^2-6x+9=0\\), entonces \\(r\\) es:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(6\\)", "\\(9\\)"], correcta: 1, explicacion: "\\(x^2-6x+9=(x-3)^2\\). La raíz doble es \\(x=3\\)." },
    { id: 10, pregunta: "La asíntota vertical de", formula: "\\[ y=\\frac{2}{x+1} \\]", opciones: ["\\(x=1\\)", "\\(x=-1\\)", "\\(y=0\\)", "\\(y=2\\)"], correcta: 1, explicacion: "La asíntota vertical ocurre cuando el denominador es cero: \\(x+1=0\\), entonces \\(x=-1\\)." }
  ],
  nivel5: [
    { id: 1, pregunta: "Calcula", formula: "\\[ \\lim_{x\\to 0}\\frac{1-\\cos x}{x^2} \\]", opciones: ["\\(0\\)", "\\(\\frac12\\)", "\\(1\\)", "\\(2\\)"], correcta: 1, explicacion: "Usando el límite notable \\(1-\\cos x\\sim \\frac{x^2}{2}\\), el valor es \\(\\frac12\\)." },
    { id: 2, pregunta: "Si \\(x+\\frac1x=4\\), entonces \\(x^2+\\frac1{x^2}\\) vale:", formula: "", opciones: ["\\(12\\)", "\\(14\\)", "\\(16\\)", "\\(18\\)"], correcta: 1, explicacion: "Elevando al cuadrado: \\((x+\\frac1x)^2=x^2+2+\\frac1{x^2}=16\\). Entonces \\(x^2+\\frac1{x^2}=14\\)." },
    { id: 3, pregunta: "La suma infinita", formula: "\\[ 6+3+\\frac32+\\cdots \\]", opciones: ["\\(9\\)", "\\(10\\)", "\\(12\\)", "\\(18\\)"], correcta: 2, explicacion: "Es geométrica con \\(a=6\\) y \\(r=\\frac12\\). Entonces \\(S=\\frac{a}{1-r}=\\frac6{1/2}=12\\)." },
    { id: 4, pregunta: "Resuelve", formula: "\\[ \\sqrt{x+5}=x-1 \\]", opciones: ["\\(4\\)", "\\(5\\)", "\\(6\\)", "\\(7\\)"], correcta: 0, explicacion: "Debe cumplirse \\(x\\geq1\\). Al cuadrar: \\(x+5=(x-1)^2=x^2-2x+1\\). Entonces \\(x^2-3x-4=0\\), de donde \\(x=4\\) o \\(x=-1\\). Por dominio, \\(x=4\\)." },
    { id: 5, pregunta: "Si \\(\\log_3(x-1)+\\log_3(x+1)=2\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(2\\)", "\\(\\sqrt{10}\\)", "\\(3\\)", "\\(4\\)"], correcta: 1, explicacion: "\\(\\log_3[(x-1)(x+1)]=2\\). Entonces \\(x^2-1=9\\), así \\(x^2=10\\). Por dominio \\(x>1\\), luego \\(x=\\sqrt{10}\\)." },
    { id: 6, pregunta: "El coeficiente de \\(x^2\\) en \\((x+2)^4\\) es:", formula: "", opciones: ["\\(12\\)", "\\(18\\)", "\\(24\\)", "\\(32\\)"], correcta: 2, explicacion: "Término general: \\(\\binom{4}{2}x^2(2)^2=6\\cdot4x^2=24x^2\\). El coeficiente es 24." },
    { id: 7, pregunta: "Si \\(\\tan\\theta=\\frac34\\) en el primer cuadrante, entonces \\(\\sin\\theta\\) es:", formula: "", opciones: ["\\(\\frac35\\)", "\\(\\frac45\\)", "\\(\\frac34\\)", "\\(\\frac43\\)"], correcta: 0, explicacion: "Con catetos 3 y 4, la hipotenusa es 5. Entonces \\(\\sin\\theta=\\frac{opuesto}{hipotenusa}=\\frac35\\)." },
    { id: 8, pregunta: "El mínimo de \\(f(x)=x^2-8x+10\\) es:", formula: "", opciones: ["\\(-10\\)", "\\(-6\\)", "\\(4\\)", "\\(10\\)"], correcta: 1, explicacion: "El vértice está en \\(x=\\frac{-b}{2a}=4\\). \\(f(4)=16-32+10=-6\\)." },
    { id: 9, pregunta: "Si \\(a_n=3n-2\\), la suma de los primeros 15 términos es:", formula: "", opciones: ["\\(315\\)", "\\(330\\)", "\\(345\\)", "\\(360\\)"], correcta: 1, explicacion: "Es aritmética: \\(a_1=1\\), \\(a_{15}=43\\). Entonces \\(S_{15}=\\frac{15(1+43)}2=330\\)." },
    { id: 10, pregunta: "La ecuación \\(2^x+2^{x+1}=24\\) tiene solución:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(5\\)"], correcta: 1, explicacion: "\\(2^{x+1}=2\\cdot2^x\\). Entonces \\(2^x+2\\cdot2^x=3\\cdot2^x=24\\). Así \\(2^x=8=2^3\\), por tanto \\(x=3\\)." }
  ]
};

const ADMIN_CLAVE = "Barcelona2026";
const STORAGE_HABILITADOS = "preguntasUnalHabilitados";
const DEFAULT_HABILITADOS = { nivel1: false, nivel2: false, nivel3: false, nivel4: false, nivel5: false, examen: false };
let habilitados = cargarHabilitados();
let nivelActual = "nivel1";
let nivelIniciado = false;
let nivelCompletadoVisible = false;
let timerNivelInterval = null;
let timerNivelActivo = false;
let segsNivel = DURACION_SEG;

function cargarHabilitados() {
  try {
    return { ...DEFAULT_HABILITADOS, ...JSON.parse(localStorage.getItem(STORAGE_HABILITADOS) || "{}") };
  } catch {
    return { ...DEFAULT_HABILITADOS };
  }
}

function guardarHabilitados() {
  localStorage.setItem(STORAGE_HABILITADOS, JSON.stringify(habilitados));
}

function requisitoCumplido(clave) {
  const req = NIVELES_META[clave].requisito;
  if (req === "diagnostico") return diagnosticoCompletado;
  return !!nivelesCompletados[req];
}

function puedeAbrirNivel(clave) {
  return !!habilitados[clave] && requisitoCumplido(clave);
}

function puedeAbrirExamenFinal() {
  return !!habilitados.examen && nivelesCompletados.nivel5;
}

function actualizarProgresoNivel() {
  const preguntas = PREGUNTAS_NIVELES[nivelActual] || [];
  let respondidas = 0;
  preguntas.forEach(q => {
    const el = document.querySelector(`input[name="nivel-q${q.id}"]:checked`);
    if (el) respondidas++;
  });
  mostrarProgreso(respondidas, preguntas.length || 10);
}

function iniciarTimerNivel() {
  if (timerNivelActivo) return;
  timerNivelActivo = true;
  segsNivel = DURACION_SEG;
  const display = document.getElementById("timerDisplay");
  const timerBox = document.getElementById("timerBox");
  display.textContent = formatTiempo(segsNivel);

  timerNivelInterval = setInterval(() => {
    segsNivel--;
    display.textContent = formatTiempo(segsNivel);
    if (segsNivel <= 300 && segsNivel > 120) {
      timerBox.classList.add("warn");
      timerBox.classList.remove("danger");
    }
    if (segsNivel <= 120) {
      timerBox.classList.remove("warn");
      timerBox.classList.add("danger");
    }
    if (segsNivel <= 0) {
      detenerTimerNivel();
      document.getElementById("timeoutOverlayNivel").classList.remove("hidden");
    }
  }, 1000);
}

function detenerTimerNivel() {
  clearInterval(timerNivelInterval);
  timerNivelInterval = null;
  timerNivelActivo = false;
  document.getElementById("timerBox").classList.remove("warn", "danger");
}

function resetTimerNivel() {
  detenerTimerNivel();
  segsNivel = DURACION_SEG;
  document.getElementById("timerDisplay").textContent = formatTiempo(DURACION_SEG);
}

function abrirNivel(clave) {
  const cambioDeNivel = nivelActual !== clave;
  nivelActual = clave;
  if (cambioDeNivel) {
    nivelIniciado = false;
    nivelCompletadoVisible = false;
    document.getElementById("nivelContainer").innerHTML = "";
    document.getElementById("summaryBodyNivel").innerHTML = "";
    document.getElementById("feedbackItemsNivel").innerHTML = "";
    document.getElementById("resultsSectionNivel").hidden = true;
    document.getElementById("nivelFormWrap").hidden = true;
    document.getElementById("submitBtnNivel").style.display = "";
    resetTimerNivel();
  }
  const meta = NIVELES_META[clave];
  document.getElementById("nivelTitulo").textContent = meta.titulo;
  document.getElementById("nivelDescripcion").textContent = meta.descripcion;
  document.getElementById("btnIniciarNivel").textContent = `▶ Iniciar ${meta.titulo.toLowerCase()}`;
  document.getElementById("submitBtnNivel").textContent = `Enviar ${meta.titulo.toLowerCase()}`;
  document.getElementById("nivelBloqueadoTitulo").textContent = `${meta.titulo} bloqueado`;
  document.getElementById("nivelBloqueadoTexto").textContent = !habilitados[clave]
    ? "Este nivel todavía no ha sido habilitado por el administrador."
    : meta.requisitoTexto;
  document.getElementById("nivelBloqueadoRegla").textContent = !habilitados[clave]
    ? "Espera a que el administrador habilite este nivel"
    : meta.requisitoTexto;

  if (puedeAbrirNivel(clave)) {
    document.getElementById("nivelBloqueado").hidden = true;
    document.getElementById("startScreenNivel").hidden = nivelIniciado || nivelCompletadoVisible;
    document.getElementById("nivelFormWrap").hidden = !nivelIniciado;
    document.getElementById("resultsSectionNivel").hidden = !nivelCompletadoVisible;
    if (!nivelIniciado && !nivelCompletadoVisible) resetTimerNivel();
  } else {
    document.getElementById("nivelBloqueado").hidden = false;
    document.getElementById("startScreenNivel").hidden = true;
    document.getElementById("nivelFormWrap").hidden = true;
    document.getElementById("resultsSectionNivel").hidden = true;
  }
  actualizarProgresoNivel();
}

function renderizarNivel() {
  const cont = document.getElementById("nivelContainer");
  cont.innerHTML = "";
  PREGUNTAS_NIVELES[nivelActual].forEach(q => cont.appendChild(crearTarjetaPregunta(q, "nivel")));
  reRenderKatex(cont);
}

function reiniciarEstadoNivelVisual() {
  nivelIniciado = false;
  nivelCompletadoVisible = false;
  resetTimerNivel();
  document.getElementById("timeoutOverlayNivel").classList.add("hidden");
  document.getElementById("resultsSectionNivel").hidden = true;
  document.getElementById("nivelFormWrap").hidden = true;
  document.getElementById("startScreenNivel").hidden = !puedeAbrirNivel(nivelActual);
  document.getElementById("nivelBloqueado").hidden = puedeAbrirNivel(nivelActual);
  document.getElementById("nivelContainer").innerHTML = "";
  document.getElementById("summaryBodyNivel").innerHTML = "";
  document.getElementById("feedbackItemsNivel").innerHTML = "";
  document.getElementById("warnMsgNivel").hidden = true;
  document.getElementById("submitBtnNivel").style.display = "";
  document.getElementById("ringFillNivel").style.strokeDashoffset = "314";
  document.getElementById("scorePctNivel").textContent = "0%";
  document.getElementById("scoreNotaNivel").textContent = "0.0";
  document.getElementById("scoreBadgeNivel").textContent = "—";
  document.getElementById("tiempoEmpleadoNivel").textContent = "00:00";
  document.getElementById("tiempoRestanteNivel").textContent = "15:00";
  document.getElementById("balanceResultadoNivel").textContent = "0.0 segundos por pregunta";
  ["barCorrectNivel", "barWrongNivel"].forEach(id => {
    const barra = document.getElementById(id);
    barra.style.height = "0px";
    barra.removeAttribute("data-val");
  });
}

function reiniciarEstadoNiveles() {
  Object.keys(nivelesCompletados).forEach(k => nivelesCompletados[k] = false);
  nivelActual = "nivel1";
  reiniciarEstadoNivelVisual();
}

function bloquearPosteriores(clave) {
  const orden = Object.keys(NIVELES_META);
  const idx = orden.indexOf(clave);
  orden.slice(idx + 1).forEach(k => nivelesCompletados[k] = false);
  reiniciarEstadoExamenFinal(false);
}

function evaluarYMostrarNivel(respuestas) {
  nivelIniciado = false;
  nivelCompletadoVisible = true;
  nivelesCompletados[nivelActual] = true;
  bloquearPosteriores(nivelActual);
  document.getElementById("submitBtnNivel").style.display = "none";

  const preguntas = PREGUNTAS_NIVELES[nivelActual];
  const tiempoEmpleado = DURACION_SEG - segsNivel;
  let correctas = 0;
  preguntas.forEach((q, i) => { if (respuestas[i] === q.correcta) correctas++; });
  const incorrectas = preguntas.length - correctas;
  const pct = Math.round((correctas / preguntas.length) * 100);
  const nota = calcNota(pct);
  const badge = calcBadge(pct);
  const sec = document.getElementById("resultsSectionNivel");
  sec.hidden = false;

  const circ = 2 * Math.PI * 50;
  document.getElementById("ringFillNivel").style.strokeDashoffset = circ - (pct / 100) * circ;
  document.getElementById("scorePctNivel").textContent = pct + "%";
  document.getElementById("scoreNotaNivel").textContent = "Nota: " + nota + " / 5.0";
  document.getElementById("scoreBadgeNivel").textContent = badge;
  document.getElementById("pillCorrectNivel").textContent = correctas + " correctas";
  document.getElementById("pillWrongNivel").textContent = incorrectas + " incorrectas";
  document.getElementById("tiempoEmpleadoNivel").textContent = formatTiempo(tiempoEmpleado);
  document.getElementById("tiempoRestanteNivel").textContent = formatTiempo(segsNivel);
  document.getElementById("balanceResultadoNivel").textContent = calcBalance(correctas, preguntas.length, tiempoEmpleado);

  const ring = document.getElementById("ringFillNivel");
  if (pct >= 70) ring.style.stroke = "#1a7f5a";
  else if (pct >= 50) ring.style.stroke = "#c8972b";
  else ring.style.stroke = "#c0392b";

  const bC = document.getElementById("barCorrectNivel");
  const bW = document.getElementById("barWrongNivel");
  bC.setAttribute("data-val", correctas);
  bW.setAttribute("data-val", incorrectas);
  setTimeout(() => {
    bC.style.height = Math.round((correctas / preguntas.length) * 120) + "px";
    bW.style.height = Math.round((incorrectas / preguntas.length) * 120) + "px";
  }, 150);

  const tbody = document.getElementById("summaryBodyNivel");
  tbody.innerHTML = "";
  preguntas.forEach((q, i) => {
    const sinR = respuestas[i] === -1;
    const ok = !sinR && respuestas[i] === q.correcta;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${q.id}</td>
      <td class="${ok ? "tag-ok" : "tag-bad"}">${ok ? "✔ Correcta" : sinR ? "✘ Sin responder" : "✘ Incorrecta"}</td>
      <td>${sinR ? "—" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</td>
      <td>${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</td>
    `;
    tbody.appendChild(tr);
  });

  const fbEl = document.getElementById("feedbackItemsNivel");
  fbEl.innerHTML = "";
  preguntas.forEach((q, i) => {
    const sinR = respuestas[i] === -1;
    const ok = !sinR && respuestas[i] === q.correcta;
    const item = document.createElement("div");
    item.className = `feedback-item ${ok ? "fb-correct" : "fb-wrong"}`;
    item.innerHTML = `
      <div class="fb-header"><span class="fb-icon">${ok ? "✔" : "✘"}</span> Pregunta ${q.id}${sinR ? " <em style='font-weight:400;font-size:.85rem'>(sin responder)</em>" : ""}</div>
      <p class="fb-resp"><strong>Tu respuesta:</strong> ${sinR ? "No respondida" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</p>
      ${!ok ? `<p class="fb-resp"><strong>Respuesta correcta:</strong> ${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</p>` : ""}
      <div class="fb-expl"><strong>Explicación:</strong><br>${q.explicacion}</div>
    `;
    fbEl.appendChild(item);
  });

  reRenderKatex(sec);
  resetTimerNivel();
  sec.scrollIntoView({ behavior: "smooth" });

  preguntas.forEach((q, i) => {
    const card = document.getElementById(`nivel-card-${q.id}`);
    if (!card) return;
    const sinR = respuestas[i] === -1;
    const ok = !sinR && respuestas[i] === q.correcta;
    card.classList.add(ok ? "result-correct" : "result-wrong");
    card.querySelectorAll("input[type='radio']").forEach(inp => inp.disabled = true);
    card.querySelectorAll(".option-label").forEach((lbl, idx) => {
      if (idx === q.correcta) lbl.classList.add("opt-correct");
      if (!sinR && !ok && idx === respuestas[i]) lbl.classList.add("opt-wrong");
    });
  });
}

document.getElementById("btnNivelAnterior").addEventListener("click", () => {
  const req = NIVELES_META[nivelActual].requisito;
  const destino = req === "diagnostico" ? "diagnostico" : req;
  activarNav(destino);
  if (destino.startsWith("nivel")) abrirNivel(destino);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("btnIniciarNivel").addEventListener("click", () => {
  nivelIniciado = true;
  nivelCompletadoVisible = false;
  document.getElementById("startScreenNivel").hidden = true;
  document.getElementById("nivelFormWrap").hidden = false;
  renderizarNivel();
  actualizarProgresoNivel();
  resetTimerNivel();
  iniciarTimerNivel();
  document.getElementById("nivelFormWrap").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnVerResultadoNivel").addEventListener("click", () => {
  document.getElementById("timeoutOverlayNivel").classList.add("hidden");
  const respuestas = PREGUNTAS_NIVELES[nivelActual].map(q => {
    const ch = document.querySelector(`input[name="nivel-q${q.id}"]:checked`);
    return ch ? parseInt(ch.value, 10) : -1;
  });
  evaluarYMostrarNivel(respuestas);
});

document.getElementById("nivelForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const preguntas = PREGUNTAS_NIVELES[nivelActual];
  const sinResp = preguntas.some(q => !document.querySelector(`input[name="nivel-q${q.id}"]:checked`));
  if (sinResp) {
    document.getElementById("warnMsgNivel").hidden = false;
    for (const q of preguntas) {
      if (!document.querySelector(`input[name="nivel-q${q.id}"]:checked`)) {
        document.getElementById(`nivel-card-${q.id}`).scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
    return;
  }
  document.getElementById("warnMsgNivel").hidden = true;
  detenerTimerNivel();
  const respuestas = preguntas.map(q => {
    const ch = document.querySelector(`input[name="nivel-q${q.id}"]:checked`);
    return parseInt(ch.value, 10);
  });
  evaluarYMostrarNivel(respuestas);
});

document.getElementById("btnRestartNivel").addEventListener("click", () => {
  nivelesCompletados[nivelActual] = false;
  bloquearPosteriores(nivelActual);
  reiniciarEstadoNivelVisual();
  actualizarProgresoNivel();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("btnWrongNivel").addEventListener("click", () => {
  document.querySelectorAll("#feedbackItemsNivel .feedback-item").forEach(item => {
    item.classList.toggle("hidden-item", item.classList.contains("fb-correct"));
  });
  document.getElementById("feedbackListNivel").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnAllNivel").addEventListener("click", () => {
  document.querySelectorAll("#feedbackItemsNivel .feedback-item").forEach(item => item.classList.remove("hidden-item"));
  document.getElementById("feedbackListNivel").scrollIntoView({ behavior: "smooth" });
});

function renderAdminList() {
  const items = [
    ["nivel1", "Nivel 1", "Requiere diagnóstico completado"],
    ["nivel2", "Nivel 2", "Requiere Nivel 1 completado"],
    ["nivel3", "Nivel 3", "Requiere Nivel 2 completado"],
    ["nivel4", "Nivel 4", "Requiere Nivel 3 completado"],
    ["nivel5", "Nivel 5", "Requiere Nivel 4 completado"],
    ["examen", "Examen Final", "Requiere Nivel 5 completado"]
  ];
  const list = document.getElementById("adminList");
  list.innerHTML = "";
  items.forEach(([clave, titulo, detalle]) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div><strong>${titulo}</strong><span>${detalle}</span></div>
      <label class="switch">
        <input type="checkbox" data-admin-toggle="${clave}" ${habilitados[clave] ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-admin-toggle]").forEach(input => {
    input.addEventListener("change", () => {
      habilitados[input.dataset.adminToggle] = input.checked;
      guardarHabilitados();
      if (nivelActual) abrirNivel(nivelActual);
    });
  });
}

document.getElementById("btnAdminEntrar").addEventListener("click", () => {
  const clave = document.getElementById("adminClave").value;
  if (clave !== ADMIN_CLAVE) {
    document.getElementById("adminWarn").hidden = false;
    return;
  }
  document.getElementById("adminWarn").hidden = true;
  document.getElementById("adminLogin").hidden = true;
  document.getElementById("adminControls").hidden = false;
  renderAdminList();
});

document.getElementById("btnAdminSalir").addEventListener("click", () => {
  document.getElementById("adminClave").value = "";
  document.getElementById("adminLogin").hidden = false;
  document.getElementById("adminControls").hidden = true;
});

/* ────────────────────────────────────────────────────
   13. MOTOR DEL EXAMEN FINAL
──────────────────────────────────────────────────── */
let timerExamenInterval = null;
let timerExamenActivo   = false;
let segsExamen          = 15 * 60;

function iniciarTimerExamen() {
  if (timerExamenActivo) return;
  timerExamenActivo = true;
  segsExamen = 15 * 60;
  const display  = document.getElementById("timerDisplay");
  const timerBox = document.getElementById("timerBox");
  display.textContent = formatTiempo(segsExamen);

  timerExamenInterval = setInterval(() => {
    segsExamen--;
    display.textContent = formatTiempo(segsExamen);
    if (segsExamen <= 300 && segsExamen > 120) {
      timerBox.classList.add("warn"); timerBox.classList.remove("danger");
    }
    if (segsExamen <= 120) {
      timerBox.classList.remove("warn"); timerBox.classList.add("danger");
    }
    if (segsExamen <= 0) {
      detenerTimerExamen();
      document.getElementById("timeoutOverlayExamen").classList.remove("hidden");
    }
  }, 1000);
}

function detenerTimerExamen() {
  clearInterval(timerExamenInterval);
  timerExamenInterval = null;
  timerExamenActivo   = false;
  const timerBox = document.getElementById("timerBox");
  timerBox.classList.remove("warn", "danger");
}

function resetTimerExamen() {
  detenerTimerExamen();
  segsExamen = 15 * 60;
  document.getElementById("timerDisplay").textContent = formatTiempo(segsExamen);
}

/** Borra por completo el intento y los resultados del examen final */
function reiniciarEstadoExamenFinal(desbloqueado) {
  examenIniciado = false;
  examenCompletado = false;
  resetTimerExamen();

  document.getElementById("timeoutOverlayExamen").classList.add("hidden");
  document.getElementById("resultsSectionExamen").hidden = true;
  document.getElementById("examenFormWrap").hidden = true;
  document.getElementById("startScreenExamen").hidden = !desbloqueado;
  document.getElementById("examenBloqueado").hidden = desbloqueado;
  document.getElementById("examenContainer").innerHTML = "";
  document.getElementById("summaryBodyExamen").innerHTML = "";
  document.getElementById("feedbackItemsExamen").innerHTML = "";
  document.getElementById("warnMsgExamen").hidden = true;
  document.getElementById("submitBtnExamen").style.display = "";

  document.getElementById("ringFillExamen").style.strokeDashoffset = "314";
  document.getElementById("scorePctExamen").textContent = "0%";
  document.getElementById("scoreNotaExamen").textContent = "0.0";
  document.getElementById("scoreBadgeExamen").textContent = "—";
  document.getElementById("pillCorrectExamen").textContent = "0 correctas";
  document.getElementById("pillWrongExamen").textContent = "0 incorrectas";
  document.getElementById("tiempoEmpleadoExamen").textContent = "00:00";
  document.getElementById("tiempoRestanteExamen").textContent = "15:00";
  document.getElementById("balanceResultadoExamen").textContent = "0.0 segundos por pregunta";

  ["barCorrectExamen", "barWrongExamen"].forEach(id => {
    const barra = document.getElementById(id);
    barra.style.height = "0px";
    barra.removeAttribute("data-val");
  });
}

/** Genera las tarjetas del examen final */
function renderizarExamen() {
  const cont = document.getElementById("examenContainer");
  cont.innerHTML = "";
  PREGUNTAS_EXAMEN.forEach(q => cont.appendChild(crearTarjetaPregunta(q, "examen")));
  reRenderKatex(cont);
}

function reRenderKatex(el) {
  if (typeof renderMathInElement === "function") {
    renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$",  right: "$",  display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ]
    });
  }
}

/** Botón iniciar examen final */
document.getElementById("btnIniciarExamen").addEventListener("click", () => {
  examenIniciado = true;
  examenCompletado = false;
  document.getElementById("startScreenExamen").hidden = true;
  document.getElementById("examenFormWrap").hidden    = false;
  renderizarExamen();
  actualizarProgresoExamen();
  resetTimerExamen();
  iniciarTimerExamen();
  document.getElementById("examenFormWrap").scrollIntoView({ behavior: "smooth" });
});

/** Tiempo agotado examen */
document.getElementById("btnVerResultadoExamen").addEventListener("click", () => {
  document.getElementById("timeoutOverlayExamen").classList.add("hidden");
  const resp = PREGUNTAS_EXAMEN.map(q => {
    const ch = document.querySelector(`input[name="examen-q${q.id}"]:checked`);
    return ch ? parseInt(ch.value, 10) : -1;
  });
  evaluarYMostrarExamen(resp);
});
document.getElementById("examenForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const sinResp = PREGUNTAS_EXAMEN.some(q => !document.querySelector(`input[name="examen-q${q.id}"]:checked`));
  if (sinResp) {
    document.getElementById("warnMsgExamen").hidden = false;
    for (const q of PREGUNTAS_EXAMEN) {
      if (!document.querySelector(`input[name="examen-q${q.id}"]:checked`)) {
        document.getElementById(`examen-card-${q.id}`).scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
    return;
  }
  document.getElementById("warnMsgExamen").hidden = true;
  detenerTimerExamen();
  const resp = PREGUNTAS_EXAMEN.map(q => {
    const ch = document.querySelector(`input[name="examen-q${q.id}"]:checked`);
    return parseInt(ch.value, 10);
  });
  evaluarYMostrarExamen(resp);
});

/** Submit manual examen */
function evaluarYMostrarExamen(respuestas) {
  examenIniciado = false;
  examenCompletado = true;
  document.getElementById("submitBtnExamen").style.display = "none";
  const tiempoEmpleado = (15 * 60) - segsExamen;
  let correctas = 0;
  PREGUNTAS_EXAMEN.forEach((q, i) => { if (respuestas[i] === q.correcta) correctas++; });
  const incorrectas = PREGUNTAS_EXAMEN.length - correctas;
  const pct  = Math.round((correctas / PREGUNTAS_EXAMEN.length) * 100);
  const nota = calcNota(pct);
  const badge = calcBadge(pct);

  const sec = document.getElementById("resultsSectionExamen");
  sec.hidden = false;

  // Score ring
  const circ = 2 * Math.PI * 50;
  document.getElementById("ringFillExamen").style.strokeDashoffset = circ - (pct / 100) * circ;
  document.getElementById("scorePctExamen").textContent   = pct + "%";
  document.getElementById("scoreNotaExamen").textContent  = "Nota: " + nota + " / 5.0";
  document.getElementById("scoreBadgeExamen").textContent = badge;
  document.getElementById("pillCorrectExamen").textContent = correctas + " correctas";
  document.getElementById("pillWrongExamen").textContent   = incorrectas + " incorrectas";
  document.getElementById("tiempoEmpleadoExamen").textContent = formatTiempo(tiempoEmpleado);
  document.getElementById("tiempoRestanteExamen").textContent = formatTiempo(segsExamen);
  document.getElementById("balanceResultadoExamen").textContent =
    calcBalance(correctas, PREGUNTAS_EXAMEN.length, tiempoEmpleado);
  const ringE = document.getElementById("ringFillExamen");
  if (pct >= 70) ringE.style.stroke = "#1a7f5a";
  else if (pct >= 50) ringE.style.stroke = "#c8972b";
  else ringE.style.stroke = "#c0392b";

  // Barras
  const MAX_PX = 120;
  const bC = document.getElementById("barCorrectExamen");
  const bW = document.getElementById("barWrongExamen");
  bC.setAttribute("data-val", correctas);
  bW.setAttribute("data-val", incorrectas);
  setTimeout(() => {
    bC.style.height = Math.round((correctas  / PREGUNTAS_EXAMEN.length) * MAX_PX) + "px";
    bW.style.height = Math.round((incorrectas / PREGUNTAS_EXAMEN.length) * MAX_PX) + "px";
  }, 150);

  // Tabla (con LaTeX completo)
  const tbody = document.getElementById("summaryBodyExamen");
  tbody.innerHTML = "";
  PREGUNTAS_EXAMEN.forEach((q, i) => {
    const sinR = respuestas[i] === -1;
    const ok   = !sinR && respuestas[i] === q.correcta;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${q.id}</td>
      <td class="${ok ? "tag-ok" : "tag-bad"}">${ok ? "✔ Correcta" : sinR ? "✘ Sin responder" : "✘ Incorrecta"}</td>
      <td>${sinR ? "—" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</td>
      <td>${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</td>
    `;
    tbody.appendChild(tr);
  });

  // Retroalimentación
  const fbEl = document.getElementById("feedbackItemsExamen");
  fbEl.innerHTML = "";
  PREGUNTAS_EXAMEN.forEach((q, i) => {
    const sinR = respuestas[i] === -1;
    const ok   = !sinR && respuestas[i] === q.correcta;
    const item = document.createElement("div");
    item.className = `feedback-item ${ok ? "fb-correct" : "fb-wrong"}`;
    item.innerHTML = `
      <div class="fb-header"><span class="fb-icon">${ok ? "✔" : "✘"}</span> Pregunta ${q.id}${sinR ? " <em style='font-weight:400;font-size:.85rem'>(sin responder)</em>" : ""}</div>
      <p class="fb-resp"><strong>Tu respuesta:</strong> ${sinR ? "No respondida" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</p>
      ${!ok ? `<p class="fb-resp"><strong>Respuesta correcta:</strong> ${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</p>` : ""}
      <div class="fb-expl"><strong>Explicación:</strong><br>${q.explicacion}</div>
    `;
    fbEl.appendChild(item);
  });

  reRenderKatex(sec);
  resetTimerExamen();
  sec.scrollIntoView({ behavior: "smooth" });

  // Marcar tarjetas
  PREGUNTAS_EXAMEN.forEach((q, i) => {
    const card = document.getElementById(`examen-card-${q.id}`);
    if (!card) return;
    const sinR = respuestas[i] === -1;
    const ok   = !sinR && respuestas[i] === q.correcta;
    card.classList.add(ok ? "result-correct" : "result-wrong");
    card.querySelectorAll("input[type='radio']").forEach(inp => inp.disabled = true);
    card.querySelectorAll(".option-label").forEach((lbl, idx) => {
      if (idx === q.correcta) lbl.classList.add("opt-correct");
      if (!sinR && !ok && idx === respuestas[i]) lbl.classList.add("opt-wrong");
    });
  });
}

/* Botones examen final */
document.getElementById("btnRestartExamen").addEventListener("click", () => {
  reiniciarEstadoExamenFinal(true);
  actualizarProgresoExamen();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
document.getElementById("btnWrongExamen").addEventListener("click", () => {
  document.querySelectorAll("#feedbackItemsExamen .feedback-item").forEach(item => {
    item.classList.toggle("hidden-item", item.classList.contains("fb-correct"));
  });
  document.getElementById("feedbackListExamen").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("btnAllExamen").addEventListener("click", () => {
  document.querySelectorAll("#feedbackItemsExamen .feedback-item").forEach(item => item.classList.remove("hidden-item"));
  document.getElementById("feedbackListExamen").scrollIntoView({ behavior: "smooth" });
});
