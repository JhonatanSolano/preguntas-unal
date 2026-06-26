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
  const prefijo = tipo === "examen" ? "examen" : "diag";
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
  detenerTimerExamen();
  diagnosticoCompletado = false;
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
    document.getElementById("sectionDiagnostico").classList.toggle("hidden", sec !== "diagnostico");
    document.getElementById("sectionExamen").classList.toggle("hidden",      sec !== "examen");

    if (sec === "diagnostico") {
      actualizarProgreso();
    }

    // Al entrar al examen final, mostrar estado correcto
    if (sec === "examen") {
      if (diagnosticoCompletado) {
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

// Botón "Ir al Diagnóstico" desde pantalla bloqueada
document.getElementById("btnIrDiagnostico").addEventListener("click", () => {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector("[data-section='diagnostico']").classList.add("active");
  document.getElementById("sectionDiagnostico").classList.remove("hidden");
  document.getElementById("sectionExamen").classList.add("hidden");
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

/* ────────────────────────────────────────────────────
   12. MOTOR DEL EXAMEN FINAL
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
