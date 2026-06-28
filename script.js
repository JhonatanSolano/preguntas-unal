import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  multiFactor,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCx2xCjNzfeH_KfQKMuKImuE13X6DnAk7I",
  authDomain: "preguntas-tipo-examen.firebaseapp.com",
  projectId: "preguntas-tipo-examen",
  storageBucket: "preguntas-tipo-examen.firebasestorage.app",
  messagingSenderId: "235600414785",
  appId: "1:235600414785:web:780282c2c2379fb39d9ec0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence);

const ADMIN_EMAIL = "solanojhonatan2000@gmail.com";
const SIMBOLOS_PERMITIDOS = "!@#$%^&*()_+-=[]{};:,.?";
let usuarioActual = null;
let perfilActual = null;
let unsubscribePermisos = null;
let mfaVerificationId = "";

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
    pregunta: "Si la recta \\(y=2x+b\\) pasa por el punto \\((3,11)\\), entonces \\(b\\) vale:",
    formula: "",
    opciones: ["\\(3\\)", "\\(4\\)", "\\(5\\)", "\\(6\\)"],
    correcta: 2,
    explicacion: "Sustituimos el punto en la ecuación: \\(11=2(3)+b\\). Entonces \\(11=6+b\\), de donde \\(b=5\\)."
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
function iniciarTimer(continuar = false) {
  if (timerActivo) return;
  timerActivo = true;
  if (!continuar) segundosRestantes = DURACION_SEG;

  const displayEl = document.getElementById("timerDisplay");
  const timerBox  = document.getElementById("timerBox");
  displayEl.textContent = formatTiempo(segundosRestantes);

  timerInterval = setInterval(() => {
    const desdeIntento = segundosRestantesIntento("diag", "diagnostico");
    segundosRestantes = desdeIntento === null ? segundosRestantes - 1 : desdeIntento;
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

function consejoPorNota(nota) {
  const n = Number(nota);
  if (n >= 4.3) return "Vas muy fuerte: trabaja velocidad y evita errores de lectura.";
  if (n >= 3.5) return "Buen nivel: repasa los temas donde perdiste puntos y controla el tiempo.";
  if (n >= 2.5) return "Nivel medio: refuerza procedimientos base antes de subir dificultad.";
  return "Necesitas reforzar fundamentos y repetir ejercicios guiados.";
}

/** Resume precisión y tiempo promedio usado por pregunta */
function calcBalance(correctas, total, tiempoSeg) {
  const promedio = tiempoSeg / total;
  return `${promedio.toFixed(1)} segundos por pregunta`;
}

function preguntasPorClave(clave) {
  if (clave === "diagnostico") return PREGUNTAS;
  if (clave === "examen") return PREGUNTAS_EXAMEN;
  return PREGUNTAS_NIVELES.nivel1;
}

function metricasIntento(clave, intento) {
  const preguntas = preguntasPorClave(clave);
  const total = preguntas.length;
  const correctas = preguntas.reduce((acc, q, i) => acc + (intento.respuestas?.[i] === q.correcta ? 1 : 0), 0);
  const incorrectas = total - correctas;
  const tiempoRestante = Math.max(0, intento.restante || 0);
  const tiempoEmpleado = DURACION_SEG - tiempoRestante;
  const pct = Math.round((correctas / total) * 100);
  const nota = calcNota(pct);
  return {
    total,
    correctas,
    incorrectas,
    tiempoRestante,
    tiempoEmpleado,
    segundosPorPregunta: tiempoEmpleado / total,
    pct,
    nota,
    consejo: consejoPorNota(nota)
  };
}

/** Letras de las opciones */
const LETRAS = ["A", "B", "C", "D"];

const ACTIVE_ATTEMPT_KEY = "preguntasUnalIntentoActivo";
const RESULTADOS_KEY = "preguntasUnalResultadosSesion";
const INACTIVIDAD_MS = 10 * 60 * 1000;
let intentoActivo = cargarIntentoActivo();
let resultadosSesion = cargarResultadosSesion();

function refEstadoUsuario(uid = usuarioActual?.uid) {
  return uid ? doc(db, "studentState", uid) : null;
}

function refPerfilUsuario(uid = usuarioActual?.uid) {
  return uid ? doc(db, "users", uid) : null;
}

function refPermisosGrupo(grupo) {
  return doc(db, "groupPermissions", grupo);
}

function normalizarResultados(raw = {}) {
  const normalizados = {};
  Object.entries(raw).forEach(([clave, valor]) => {
    normalizados[clave] = valor?.intentos ? valor : { intentos: [valor].filter(Boolean) };
  });
  return normalizados;
}

async function guardarEstadoRemoto() {
  if (!usuarioActual) return;
  const ref = refEstadoUsuario();
  if (!ref) return;
  await setDoc(ref, {
    uid: usuarioActual.uid,
    email: usuarioActual.email,
    grupo: grupoActivo || "",
    intentoActivo,
    resultados: resultadosSesion,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function cargarEstadoRemoto() {
  if (!usuarioActual) return;
  const ref = refEstadoUsuario();
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.grupo && GRUPOS[data.grupo]) grupoActivo = data.grupo;
  intentoActivo = data.intentoActivo || null;
  resultadosSesion = normalizarResultados(data.resultados || {});
  guardarIntentoActivo(false);
  guardarResultadosSesion(false);
}

function cargarIntentoActivo() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_ATTEMPT_KEY) || "null");
  } catch {
    return null;
  }
}

function guardarIntentoActivo(syncRemoto = true) {
  if (!intentoActivo) {
    localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
  } else {
    localStorage.setItem(ACTIVE_ATTEMPT_KEY, JSON.stringify(intentoActivo));
  }
  if (syncRemoto) guardarEstadoRemoto();
}

function limpiarIntentoActivo() {
  intentoActivo = null;
  guardarIntentoActivo();
}

function cargarResultadosSesion() {
  try {
    return JSON.parse(localStorage.getItem(RESULTADOS_KEY) || "{}");
  } catch {
    return {};
  }
}

function guardarResultadosSesion(syncRemoto = true) {
  localStorage.setItem(RESULTADOS_KEY, JSON.stringify(resultadosSesion));
  if (syncRemoto) guardarEstadoRemoto();
}

function guardarResultadoSesion(clave, respuestas, restante) {
  const intento = {
    respuestas,
    restante: Math.max(0, restante),
    guardado: Date.now()
  };
  const previos = resultadosSesion[clave]?.intentos || [];
  resultadosSesion[clave] = { intentos: [...previos, intento].slice(0, 2) };
  guardarResultadosSesion();
}

function borrarResultadoSesion(clave) {
  const previos = resultadosSesion[clave]?.intentos || [];
  resultadosSesion[clave] = { intentos: previos };
  guardarResultadosSesion();
}

function limpiarResultadosSesion() {
  resultadosSesion = {};
  localStorage.removeItem(RESULTADOS_KEY);
  guardarEstadoRemoto();
}

function resultadoActual(clave) {
  const intentos = resultadosSesion[clave]?.intentos || [];
  return intentos[intentos.length - 1] || null;
}

function intentosUsados(clave) {
  return (resultadosSesion[clave]?.intentos || []).length;
}

function puedeIniciarIntento(clave) {
  return intentosUsados(clave) < 2;
}

function iniciarIntentoActivo(tipo, clave, total) {
  intentoActivo = {
    tipo,
    clave,
    total,
    respuestas: {},
    inicio: Date.now(),
    vence: Date.now() + DURACION_SEG * 1000,
    ultimaActividad: Date.now()
  };
  guardarIntentoActivo();
}

function intentoCoincide(tipo, clave) {
  return intentoActivo && intentoActivo.tipo === tipo && intentoActivo.clave === clave;
}

function segundosRestantesIntento(tipo, clave) {
  if (!intentoCoincide(tipo, clave)) return null;
  return Math.max(0, Math.ceil((intentoActivo.vence - Date.now()) / 1000));
}

function guardarRespuestaActiva(tipo, clave, id, valor) {
  if (!intentoCoincide(tipo, clave)) return;
  intentoActivo.respuestas[id] = valor;
  intentoActivo.ultimaActividad = Date.now();
  guardarIntentoActivo();
}

function aplicarRespuestasGuardadas(tipo, clave, preguntas) {
  if (!intentoCoincide(tipo, clave)) return;
  preguntas.forEach(q => {
    const valor = intentoActivo.respuestas[q.id];
    if (valor === undefined) return;
    const input = document.querySelector(`input[name="${tipo}-q${q.id}"][value="${valor}"]`);
    if (!input) return;
    input.checked = true;
    input.closest(".option-label")?.classList.add("selected");
    document.getElementById(`${tipo}-card-${q.id}`)?.classList.add("answered");
  });
}

function respuestasDesdeIntento(preguntas, tipo) {
  return preguntas.map(q => {
    const checked = document.querySelector(`input[name="${tipo}-q${q.id}"]:checked`);
    return checked ? parseInt(checked.value, 10) : -1;
  });
}

function tocarActividad() {
  if (!intentoActivo) return;
  intentoActivo.ultimaActividad = Date.now();
  guardarIntentoActivo();
}

function pruebaActivaActual() {
  if (timerActivo) return "diagnostico";
  if (timerNivelActivo) return nivelActual;
  if (timerExamenActivo) return "examen";
  return null;
}

["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(evt => {
  window.addEventListener(evt, tocarActividad, { passive: true });
});

setInterval(() => {
  if (!intentoActivo) return;
  if (Date.now() - intentoActivo.ultimaActividad <= INACTIVIDAD_MS) return;
  detenerTimer();
  detenerTimerNivel();
  detenerTimerExamen();
  limpiarIntentoActivo();
  limpiarResultadosSesion();
  window.location.reload();
}, 30000);

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
      guardarRespuestaActiva(tipo, tipo === "nivel" ? nivelActual : tipo === "diag" ? "diagnostico" : "examen", q.id, idx);
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
const nivelesCompletados = { nivel1: false };

function sincronizarCompletadosGuardados() {
  diagnosticoCompletado = intentosUsados("diagnostico") > 0;
  Object.keys(nivelesCompletados).forEach(clave => {
    nivelesCompletados[clave] = intentosUsados(clave) > 0;
  });
  examenCompletado = intentosUsados("examen") > 0;
}

sincronizarCompletadosGuardados();

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
function evaluarYMostrar(respuestas, opciones = {}) {
  if (!opciones.restaurando) limpiarIntentoActivo();
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

  if (!opciones.restaurando) guardarResultadoSesion("diagnostico", respuestas, segundosRestantes);
  mostrarResultados(respuestas, correctas, incorrectas, porcentaje, nota, badge);
  mostrarProgreso(PREGUNTAS.length, PREGUNTAS.length);
  resetTimer();
  if (!opciones.restaurando) resultsSection.scrollIntoView({ behavior: "smooth" });
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
  if (!puedeIniciarIntento("diagnostico")) {
    alert("Ya usaste los 2 intentos permitidos para el diagnóstico.");
    return;
  }
  limpiarIntentoActivo();
  borrarResultadoSesion("diagnostico");
  detenerTimer();
  diagnosticoCompletado = false;

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
    const sec = btn.dataset.section;
    if (!sec) return;
    const activa = pruebaActivaActual();
    if (activa && sec !== activa && sec !== "soporte") {
      activarNav(activa);
      if (activa.startsWith("nivel")) abrirNivel(activa);
      return;
    }
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    mostrarSeccion(sec);

    if (sec === "diagnostico") {
      actualizarEstadoDiagnostico();
    }

    if (sec.startsWith("nivel")) {
      abrirNivel(sec);
    }

    // Al entrar al examen final, mostrar estado correcto
    if (sec === "examen") {
      const resultadoExamen = resultadoActual("examen");
      if (resultadoExamen && !examenIniciado) examenCompletado = true;
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
      if (resultadoExamen && !examenIniciado) {
        renderizarExamen();
        segsExamen = resultadoExamen.restante;
        evaluarYMostrarExamen(resultadoExamen.respuestas, { restaurando: true });
        document.getElementById("examenFormWrap").hidden = true;
        document.getElementById("startScreenExamen").hidden = true;
        document.getElementById("resultsSectionExamen").hidden = false;
      }
      actualizarProgresoExamen();
    }
  });
});

function actualizarEstadoDiagnostico() {
  const titulo = document.querySelector("#startScreen h2");
  const texto = document.querySelector("#startScreen p");
  const btn = document.getElementById("btnIniciarDiag");
  if (!examenHabilitado("diagnostico")) {
    document.getElementById("diagFormWrap").hidden = true;
    document.getElementById("resultsSection").hidden = true;
    document.getElementById("startScreen").hidden = false;
    titulo.textContent = "Diagnóstico bloqueado";
    texto.textContent = "Este diagnóstico todavía no está habilitado para tu grupo.";
    btn.hidden = true;
    mostrarProgreso(0, PREGUNTAS.length);
    return;
  }
  titulo.textContent = "Diagnóstico Matemático";
  texto.textContent = "Evalúa tu nivel actual antes de comenzar la preparación. Responde con honestidad, no hay penalización por error.";
  btn.hidden = false;
  const resultadoDiag = resultadoActual("diagnostico");
  if (resultadoDiag && !intentoCoincide("diag", "diagnostico")) {
    renderizarPreguntas();
    segundosRestantes = resultadoDiag.restante;
    evaluarYMostrar(resultadoDiag.respuestas, { restaurando: true });
    document.getElementById("startScreen").hidden = true;
    document.getElementById("diagFormWrap").hidden = true;
    resultsSection.hidden = false;
    return;
  }
  actualizarProgreso();
}

function mostrarSeccion(sec) {
  document.getElementById("sectionDiagnostico").classList.toggle("hidden", sec !== "diagnostico");
  document.getElementById("sectionNivel").classList.toggle("hidden", !sec.startsWith("nivel"));
  document.getElementById("sectionExamen").classList.toggle("hidden", sec !== "examen");
  document.getElementById("sectionEstadisticas").classList.toggle("hidden", sec !== "estadisticas");
  document.getElementById("sectionAdmin").classList.toggle("hidden", sec !== "admin");
  document.getElementById("sectionSoporte").classList.toggle("hidden", sec !== "soporte");
  if (sec === "diagnostico") actualizarEstadoDiagnostico();
  if (sec === "admin") renderAdminPanel();
  if (sec === "estadisticas") renderStudentStats();
}

function activarNav(sec) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === sec));
  mostrarSeccion(sec);
}

function aplicarModoUsuario() {
  document.body.classList.toggle("admin-mode", modoAdmin);
  actualizarGrupoActualPanel();
}

function actualizarGrupoActualPanel() {
  const panel = document.getElementById("grupoActualPanel");
  if (!panel) return;
  if (modoAdmin || !grupoActivo || !GRUPOS[grupoActivo]) {
    panel.hidden = true;
    panel.textContent = "";
    return;
  }
  panel.hidden = false;
  panel.textContent = `Estás en ${GRUPOS[grupoActivo].nombre}`;
}

function renderStudentStats() {
  const cont = document.getElementById("studentStats");
  if (!cont) return;
  const nombres = { diagnostico: "Diagnóstico", nivel1: "Nivel Medio", examen: "Examen Final" };
  cont.innerHTML = "";
  Object.entries(nombres).forEach(([clave, nombre]) => {
    const intentos = resultadosSesion[clave]?.intentos || [];
    const card = document.createElement("div");
    card.className = "stats-card";
    if (!intentos.length) {
      card.innerHTML = `<h3>${nombre}</h3><p>Sin intentos registrados.</p>`;
      cont.appendChild(card);
      return;
    }
    const detalle = intentos.map((intento, idx) => {
      const m = metricasIntento(clave, intento);
      return `
        <p><strong>Intento ${idx + 1}:</strong> Nota ${m.nota} · ${m.correctas} buenas · ${m.incorrectas} malas</p>
        <p>Tiempo usado: ${formatTiempo(m.tiempoEmpleado)} · Sobró: ${formatTiempo(m.tiempoRestante)} · ${m.segundosPorPregunta.toFixed(1)} seg/pregunta</p>
      `;
    }).join("");
    const notas = intentos.map(i => Number(metricasIntento(clave, i).nota));
    const promedio = (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1);
    card.innerHTML = `<h3>${nombre}</h3>${detalle}<p><strong>Promedio:</strong> ${promedio}</p><p>${consejoPorNota(promedio)}</p>`;
    cont.appendChild(card);
  });
}

// Botón "Ir al Diagnóstico" desde pantalla bloqueada
document.getElementById("btnIrDiagnostico").addEventListener("click", () => {
  activarNav("nivel1");
  abrirNivel("nivel1");
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
  if (!puedeIniciarIntento("diagnostico")) {
    alert("Ya usaste los 2 intentos permitidos para el diagnóstico.");
    return;
  }
  iniciarIntentoActivo("diag", "diagnostico", PREGUNTAS.length);
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
    pregunta: "Si \\(\\sin\\theta=\\frac{3}{5}\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\tan\\theta\\) vale:",
    formula: "",
    opciones: ["\\(\\dfrac{3}{4}\\)", "\\(\\dfrac{4}{3}\\)", "\\(\\dfrac{3}{5}\\)", "\\(\\dfrac{5}{4}\\)"],
    correcta: 0,
    explicacion: "Si \\(\\sin\\theta=\\frac35\\), en un triángulo rectángulo el cateto opuesto es 3 y la hipotenusa 5. Por Pitágoras, el cateto adyacente es 4. Entonces \\(\\tan\\theta=\\frac{3}{4}\\)."
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
  nivel1: { titulo: "Nivel Medio", descripcion: "Práctica intermedia con preguntas distintas para cada grupo.", requisito: "diagnostico", requisitoTexto: "Completa primero el diagnóstico." }
};

const PREGUNTAS_NIVELES = {
  nivel1: [
    { id: 1, pregunta: "Si \\(f(x)=3x-5\\), entonces el valor de \\(x\\) para el cual \\(f(x)=16\\) es:", formula: "", opciones: ["\\(5\\)", "\\(6\\)", "\\(7\\)", "\\(8\\)"], correcta: 2, explicacion: "Resolvemos \\(3x-5=16\\). Entonces \\(3x=21\\), por tanto \\(x=7\\)." },
    { id: 2, pregunta: "La suma de los primeros \\(n\\) números impares positivos es 361. Entonces \\(n\\) vale:", formula: "", opciones: ["\\(17\\)", "\\(18\\)", "\\(19\\)", "\\(20\\)"], correcta: 2, explicacion: "La suma de los primeros \\(n\\) impares es \\(n^2\\). Entonces \\(n^2=361\\), de donde \\(n=19\\)." },
    { id: 3, pregunta: "Si \\(x+\\frac1x=5\\), calcula", formula: "\\[x^2+\\frac1{x^2}\\]", opciones: ["\\(21\\)", "\\(23\\)", "\\(25\\)", "\\(27\\)"], correcta: 1, explicacion: "Elevando al cuadrado: \\((x+\\frac1x)^2=x^2+2+\\frac1{x^2}=25\\). Por tanto, \\(x^2+\\frac1{x^2}=23\\)." },
    { id: 4, pregunta: "En un triángulo rectángulo, los catetos miden 9 y 12. El radio de la circunferencia inscrita es:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(6\\)"], correcta: 1, explicacion: "La hipotenusa es \\(15\\). En un triángulo rectángulo, el inradio es \\(r=\\frac{a+b-c}{2}\\). Entonces \\(r=\\frac{9+12-15}{2}=3\\)." },
    { id: 5, pregunta: "Si \\(a\\) y \\(b\\) son positivos, \\(a+b=12\\) y \\(ab=27\\), entonces \\(a^2+b^2\\) es:", formula: "", opciones: ["\\(72\\)", "\\(84\\)", "\\(90\\)", "\\(108\\)"], correcta: 2, explicacion: "\\(a^2+b^2=(a+b)^2-2ab=144-54=90\\)." },
    { id: 6, pregunta: "Si \\(\\cos\\theta=\\frac{4}{5}\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\sin\\theta\\) vale:", formula: "", opciones: ["\\(\\frac15\\)", "\\(\\frac35\\)", "\\(\\frac45\\)", "\\(\\frac53\\)"], correcta: 1, explicacion: "En un triángulo rectángulo, el cateto adyacente es 4 y la hipotenusa 5. El cateto opuesto es \\(3\\) por Pitágoras. Así, \\(\\sin\\theta=\\frac35\\)." },
    { id: 7, pregunta: "Si \\(f(x)=x^2-3x+1\\), entonces \\(f(3-t)-f(t)\\) vale:", formula: "", opciones: ["\\(0\\)", "\\(3\\)", "\\(6t-9\\)", "\\(9-6t\\)"], correcta: 0, explicacion: "\\(f(3-t)=(3-t)^2-3(3-t)+1=t^2-3t+1=f(t)\\). La diferencia es 0." },
    { id: 8, pregunta: "El menor entero positivo \\(n\\) tal que \\(12n\\) es un cuadrado perfecto es:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(6\\)", "\\(12\\)"], correcta: 1, explicacion: "\\(12=2^2\\cdot3\\). Para que sea cuadrado, falta otro factor 3. Entonces \\(n=3\\)." },
    { id: 9, pregunta: "Si \\(2^a=8\\) y \\(3^b=81\\), entonces \\(a+b\\) es:", formula: "", opciones: ["\\(6\\)", "\\(7\\)", "\\(8\\)", "\\(9\\)"], correcta: 1, explicacion: "\\(2^a=2^3\\), entonces \\(a=3\\). \\(3^b=3^4\\), entonces \\(b=4\\). Por tanto, \\(a+b=7\\)." },
    { id: 10, pregunta: "Tres números enteros consecutivos tienen suma 84. El producto del menor y el mayor es:", formula: "", opciones: ["\\(783\\)", "\\(784\\)", "\\(785\\)", "\\(786\\)"], correcta: 0, explicacion: "Sean \\(n-1,n,n+1\\). Su suma es \\(3n=84\\), así \\(n=28\\). El producto pedido es \\(27\\cdot29=783\\)." }
  ],
  nivel2: [
    { id: 1, pregunta: "Resuelve", formula: "\\[x^2-6x+5<0\\]", opciones: ["\\((1,5)\\)", "\\((-\\infty,1)\\cup(5,\\infty)\\)", "\\([1,5]\\)", "\\((5,\\infty)\\)"], correcta: 0, explicacion: "Factorizamos \\((x-1)(x-5)<0\\). La parábola es negativa entre sus raíces: \\((1,5)\\)." },
    { id: 2, pregunta: "Si \\(\\frac{x-1}{x+1}=\\frac23\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(3\\)", "\\(4\\)", "\\(5\\)", "\\(6\\)"], correcta: 2, explicacion: "Producto cruzado: \\(3(x-1)=2(x+1)\\). Entonces \\(3x-3=2x+2\\), de donde \\(x=5\\)." },
    { id: 3, pregunta: "La parábola \\(y=x^2-6x+11\\) tiene vértice en:", formula: "", opciones: ["\\((3,2)\\)", "\\((3,-2)\\)", "\\((-3,2)\\)", "\\((6,11)\\)"], correcta: 0, explicacion: "Completamos cuadrado: \\(x^2-6x+11=(x-3)^2+2\\). Por tanto, el vértice es \\((3,2)\\)." },
    { id: 4, pregunta: "Si \\(x^2+y^2=34\\) y \\(xy=15\\), entonces \\((x+y)^2\\) es:", formula: "", opciones: ["\\(49\\)", "\\(54\\)", "\\(64\\)", "\\(68\\)"], correcta: 2, explicacion: "\\((x+y)^2=x^2+y^2+2xy=34+30=64\\)." },
    { id: 5, pregunta: "Si \\(g(x)=-2x+9\\), entonces el punto donde la gráfica corta al eje \\(x\\) es:", formula: "", opciones: ["\\((0,9)\\)", "\\((\\frac92,0)\\)", "\\((2,5)\\)", "\\((9,0)\\)"], correcta: 1, explicacion: "Para cortar el eje \\(x\\), se toma \\(y=0\\). Entonces \\(-2x+9=0\\), de donde \\(2x=9\\) y \\(x=\\frac92\\). El punto es \\((\\frac92,0)\\)." },
    { id: 6, pregunta: "Si \\(a\\neq0\\) y \\(a+\\frac1a=3\\), entonces \\(a^3+\\frac1{a^3}\\) vale:", formula: "", opciones: ["\\(9\\)", "\\(12\\)", "\\(18\\)", "\\(27\\)"], correcta: 2, explicacion: "Usamos \\(u^3+v^3=(u+v)^3-3uv(u+v)\\), con \\(u=a\\), \\(v=1/a\\). Resultado: \\(3^3-3(1)(3)=27-9=18\\)." },
    { id: 7, pregunta: "¿Cuántos divisores positivos tiene \\(360\\)?", formula: "", opciones: ["\\(18\\)", "\\(20\\)", "\\(24\\)", "\\(30\\)"], correcta: 2, explicacion: "\\(360=2^3\\cdot3^2\\cdot5\\). El número de divisores es \\((3+1)(2+1)(1+1)=24\\)." },
    { id: 8, pregunta: "Si \\(f(x)=\\frac{2x-1}{x+3}\\), entonces \\(f^{-1}(1)\\) vale:", formula: "", opciones: ["\\(-4\\)", "\\(-2\\)", "\\(2\\)", "\\(4\\)"], correcta: 3, explicacion: "Buscar \\(f^{-1}(1)\\) equivale a resolver \\(f(x)=1\\): \\(\\frac{2x-1}{x+3}=1\\Rightarrow 2x-1=x+3\\Rightarrow x=4\\)." },
    { id: 9, pregunta: "La suma de las raíces de \\(2x^2-7x+3=0\\) es:", formula: "", opciones: ["\\(\\frac32\\)", "\\(\\frac72\\)", "\\(\\frac73\\)", "\\(7\\)"], correcta: 1, explicacion: "Por Vieta, la suma de raíces es \\(-b/a=7/2\\)." },
    { id: 10, pregunta: "Si \\(x,y\\) son enteros positivos y \\(xy=36\\), ¿cuántos pares ordenados \\((x,y)\\) existen?", formula: "", opciones: ["\\(6\\)", "\\(8\\)", "\\(9\\)", "\\(12\\)"], correcta: 2, explicacion: "Cada divisor positivo de 36 determina un par \\((d,36/d)\\). Como \\(36=2^2\\cdot3^2\\), tiene \\((2+1)(2+1)=9\\) divisores." }
  ],
  nivel3: [
    { id: 1, pregunta: "El conjunto solución de", formula: "\\[\\frac{x-4}{x+2}\\geq 0\\]", opciones: ["\\((-\\infty,-2)\\cup[4,\\infty)\\)", "\\((-2,4]\\)", "\\((-\\infty,-2]\\cup[4,\\infty)\\)", "\\([4,\\infty)\\)"], correcta: 0, explicacion: "Puntos críticos: \\(-2\\) y \\(4\\). La expresión es positiva o cero en \\((-\\infty,-2)\\cup[4,\\infty)\\). Se excluye \\(-2\\) por anular el denominador." },
    { id: 2, pregunta: "Si \\(\\log_2 x+\\log_2(x-2)=3\\), entonces \\(x\\) es:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(6\\)"], correcta: 2, explicacion: "\\(\\log_2[x(x-2)]=3\\Rightarrow x(x-2)=8\\). Entonces \\(x^2-2x-8=0\\), y por dominio \\(x=4\\)." },
    { id: 3, pregunta: "Si \\(\\sin\\theta+\\cos\\theta=\\frac75\\), entonces \\(\\sin\\theta\\cos\\theta\\) vale:", formula: "", opciones: ["\\(\\frac{6}{25}\\)", "\\(\\frac{12}{25}\\)", "\\(\\frac{24}{25}\\)", "\\(\\frac15\\)"], correcta: 1, explicacion: "Al cuadrar: \\(1+2\\sin\\theta\\cos\\theta=\\frac{49}{25}\\). Entonces \\(2sc=\\frac{24}{25}\\), y \\(sc=\\frac{12}{25}\\)." },
    { id: 4, pregunta: "El valor de", formula: "\\[\\sqrt{20+8\\sqrt6}\\]", opciones: ["\\(2+2\\sqrt6\\)", "\\(2\\sqrt2+2\\sqrt3\\)", "\\(4+\\sqrt6\\)", "\\(\\sqrt2+3\\sqrt3\\)"], correcta: 1, explicacion: "Buscamos \\(\\sqrt a+\\sqrt b\\). Se requiere \\(a+b=20\\) y \\(2\\sqrt{ab}=8\\sqrt6\\), luego \\(ab=96\\). Sirven \\(a=8\\), \\(b=12\\), así queda \\(2\\sqrt2+2\\sqrt3\\)." },
    { id: 5, pregunta: "¿Cuántas formas hay de escoger 2 estudiantes de un grupo de 7?", formula: "", opciones: ["\\(14\\)", "\\(21\\)", "\\(28\\)", "\\(42\\)"], correcta: 1, explicacion: "Es combinación: \\(\\binom72=\\frac{7\\cdot6}{2}=21\\)." },
    { id: 6, pregunta: "Si \\(2^x+2^{x+1}+2^{x+2}=56\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(5\\)"], correcta: 1, explicacion: "Factorizamos \\(2^x(1+2+4)=7\\cdot2^x=56\\). Entonces \\(2^x=8\\), por tanto \\(x=3\\)." },
    { id: 7, pregunta: "La recta que pasa por \\((1,5)\\) y es perpendicular a \\(2x-3y=6\\) tiene pendiente:", formula: "", opciones: ["\\(-\\frac32\\)", "\\(-\\frac23\\)", "\\(\\frac23\\)", "\\(\\frac32\\)"], correcta: 0, explicacion: "La recta dada tiene pendiente \\(2/3\\). Una perpendicular tiene pendiente recíproca negativa: \\(-3/2\\)." },
    { id: 8, pregunta: "Si \\(x^2-4x+y^2+6y=12\\), el radio de la circunferencia es:", formula: "", opciones: ["\\(4\\)", "\\(5\\)", "\\(6\\)", "\\(7\\)"], correcta: 1, explicacion: "Completando cuadrados: \\((x-2)^2+(y+3)^2=25\\). El radio es 5." },
    { id: 9, pregunta: "La suma de los coeficientes de \\((2x-1)^5\\) es:", formula: "", opciones: ["\\(-1\\)", "\\(0\\)", "\\(1\\)", "\\(32\\)"], correcta: 2, explicacion: "La suma de coeficientes se obtiene evaluando en \\(x=1\\): \\((2(1)-1)^5=1\\)." },
    { id: 10, pregunta: "Si \\(a,b,c\\) son raíces de \\(x^3-6x^2+11x-6=0\\), entonces \\(ab+ac+bc\\) es:", formula: "", opciones: ["\\(6\\)", "\\(11\\)", "\\(17\\)", "\\(36\\)"], correcta: 1, explicacion: "Por Vieta, en \\(x^3-s_1x^2+s_2x-s_3\\), se tiene \\(ab+ac+bc=s_2=11\\)." }
  ],
  nivel4: [
    { id: 1, pregunta: "Si \\(x^4-1=0\\), ¿cuántas soluciones reales tiene la ecuación?", formula: "", opciones: ["\\(0\\)", "\\(1\\)", "\\(2\\)", "\\(4\\)"], correcta: 2, explicacion: "\\(x^4-1=(x^2-1)(x^2+1)=(x-1)(x+1)(x^2+1)\\). Las soluciones reales son \\(x=1\\) y \\(x=-1\\), porque \\(x^2+1=0\\) no tiene soluciones reales." },
    { id: 2, pregunta: "Si \\(f(x)=\\frac{x+1}{x-1}\\), entonces \\(f(f(2))\\) es:", formula: "", opciones: ["\\(-2\\)", "\\(-1\\)", "\\(0\\)", "\\(2\\)"], correcta: 3, explicacion: "\\(f(2)=3\\). Luego \\(f(3)=\\frac{4}{2}=2\\)." },
    { id: 3, pregunta: "El coeficiente de \\(x^3\\) en \\((x-2)^6\\) es:", formula: "", opciones: ["\\(-160\\)", "\\(-120\\)", "\\(120\\)", "\\(160\\)"], correcta: 0, explicacion: "El término con \\(x^3\\) toma 3 factores \\(x\\) y 3 factores \\(-2\\): \\(\\binom63(-2)^3=20(-8)=-160\\)." },
    { id: 4, pregunta: "La suma", formula: "\\[1\\cdot2+2\\cdot3+\\cdots+10\\cdot11\\]", opciones: ["\\(430\\)", "\\(440\\)", "\\(450\\)", "\\(460\\)"], correcta: 1, explicacion: "\\(k(k+1)=k^2+k\\). Entonces la suma es \\(\\sum k^2+\\sum k=385+55=440\\)." },
    { id: 5, pregunta: "Si \\(z\\) satisface \\(z^2+z+1=0\\), entonces \\(z^{2026}\\) es:", formula: "", opciones: ["\\(1\\)", "\\(z\\)", "\\(z^2\\)", "\\(-1\\)"], correcta: 1, explicacion: "De \\(z^2+z+1=0\\), se tiene \\(z^3=1\\) y \\(z\\neq1\\). Como \\(2026\\equiv1\\pmod3\\), \\(z^{2026}=z\\)." },
    { id: 6, pregunta: "¿Cuántos caminos mínimos hay de \\((0,0)\\) a \\((4,3)\\) moviéndose solo derecha o arriba?", formula: "", opciones: ["\\(21\\)", "\\(28\\)", "\\(35\\)", "\\(42\\)"], correcta: 2, explicacion: "Son 7 movimientos: 4 derechas y 3 arriba. Se eligen las posiciones de las 3 subidas: \\(\\binom73=35\\)." },
    { id: 7, pregunta: "Si \\(\\log_3(x+6)-\\log_3 x=1\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(6\\)"], correcta: 1, explicacion: "Usamos \\(\\log_3\\left(\\frac{x+6}{x}\\right)=1\\). Entonces \\(\\frac{x+6}{x}=3\\), de modo que \\(x+6=3x\\), y \\(x=3\\)." },
    { id: 8, pregunta: "Si \\(\\tan\\theta+\\cot\\theta=\\frac{13}{6}\\), entonces \\(\\tan^2\\theta+\\cot^2\\theta\\) vale:", formula: "", opciones: ["\\(\\frac{25}{36}\\)", "\\(\\frac{97}{36}\\)", "\\(\\frac{133}{36}\\)", "\\(\\frac{169}{36}\\)"], correcta: 1, explicacion: "\\((t+1/t)^2=t^2+2+1/t^2\\). Entonces \\(t^2+1/t^2=\\frac{169}{36}-2=\\frac{97}{36}\\)." },
    { id: 9, pregunta: "En un cuadrado de lado 10 se inscribe un círculo. El área de la región del cuadrado que queda fuera del círculo es:", formula: "", opciones: ["\\(100-25\\pi\\)", "\\(100-50\\pi\\)", "\\(25\\pi\\)", "\\(75\\pi\\)"], correcta: 0, explicacion: "El cuadrado tiene área \\(10^2=100\\). El círculo inscrito tiene radio 5, así que su área es \\(25\\pi\\). La región exterior al círculo dentro del cuadrado mide \\(100-25\\pi\\)." },
    { id: 10, pregunta: "Si \\(r+s=4\\) y \\(r^3+s^3=28\\), entonces \\(rs\\) vale:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(5\\)"], correcta: 1, explicacion: "\\(r^3+s^3=(r+s)^3-3rs(r+s)=64-12rs=28\\). Entonces \\(12rs=36\\), así \\(rs=3\\)." }
  ],
  nivel5: [
    { id: 1, pregunta: "Si \\(x,y>0\\) y \\(x+y=1\\), el mínimo de", formula: "\\[\\frac1x+\\frac1y\\]", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(5\\)"], correcta: 2, explicacion: "Por AM-HM o Cauchy, \\(\\frac1x+\\frac1y\\geq\\frac{(1+1)^2}{x+y}=4\\). Se alcanza en \\(x=y=1/2\\)." },
    { id: 2, pregunta: "Si \\(\\tan\\theta=\\frac{3}{4}\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\sin\\theta+\\cos\\theta\\) vale:", formula: "", opciones: ["\\(\\frac75\\)", "\\(\\frac65\\)", "\\(\\frac54\\)", "\\(\\frac43\\)"], correcta: 0, explicacion: "Con \\(\\tan\\theta=\\frac34\\), tomamos catetos 3 y 4, hipotenusa 5. Entonces \\(\\sin\\theta=\\frac35\\) y \\(\\cos\\theta=\\frac45\\). La suma es \\(\\frac75\\)." },
    { id: 3, pregunta: "Si \\(a,b,c\\) son positivos y \\(abc=1\\), entonces el mínimo de \\(a+b+c\\) es:", formula: "", opciones: ["\\(1\\)", "\\(2\\)", "\\(3\\)", "No tiene mínimo"], correcta: 2, explicacion: "Por AM-GM, \\(a+b+c\\geq3\\sqrt[3]{abc}=3\\). Se alcanza cuando \\(a=b=c=1\\)." },
    { id: 4, pregunta: "La suma de todos los enteros \\(n\\) tales que \\(n^2-10n+21<0\\) es:", formula: "", opciones: ["\\(12\\)", "\\(15\\)", "\\(18\\)", "\\(25\\)"], correcta: 1, explicacion: "Factorizamos \\((n-3)(n-7)<0\\). Los enteros estrictamente entre 3 y 7 son \\(4,5,6\\). Su suma es \\(15\\)." },
    { id: 5, pregunta: "Si \\(2^{x+1}+2^x=48\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(3\\)", "\\(4\\)", "\\(5\\)", "\\(6\\)"], correcta: 1, explicacion: "Factorizamos \\(2^x\\): \\(2^{x+1}+2^x=2\\cdot2^x+2^x=3\\cdot2^x=48\\). Entonces \\(2^x=16\\), por tanto \\(x=4\\)." },
    { id: 6, pregunta: "Si \\(\\sin\\theta=\\frac{5}{13}\\) y \\(\\theta\\) está en el segundo cuadrante, entonces \\(\\cos\\theta\\) vale:", formula: "", opciones: ["\\(\\frac{12}{13}\\)", "\\(-\\frac{12}{13}\\)", "\\(\\frac{5}{12}\\)", "\\(-\\frac{5}{12}\\)"], correcta: 1, explicacion: "Con hipotenusa 13 y cateto opuesto 5, el cateto adyacente mide 12. En el segundo cuadrante el coseno es negativo, así que \\(\\cos\\theta=-\\frac{12}{13}\\)." },
    { id: 7, pregunta: "¿Cuántos subconjuntos de \\(\\{1,2,3,4,5,6\\}\\) tienen suma par?", formula: "", opciones: ["\\(16\\)", "\\(24\\)", "\\(32\\)", "\\(36\\)"], correcta: 2, explicacion: "Hay igual cantidad de subconjuntos con suma par e impar porque existe al menos un elemento impar. Total \\(2^6=64\\), por tanto la mitad: 32." },
    { id: 8, pregunta: "Si \\(x^2-3x+1=0\\), entonces \\(x^4+\\frac1{x^4}\\) vale:", formula: "", opciones: ["\\(47\\)", "\\(49\\)", "\\(51\\)", "\\(53\\)"], correcta: 0, explicacion: "De la ecuación, \\(x+1/x=3\\). Entonces \\(x^2+1/x^2=7\\) y \\(x^4+1/x^4=7^2-2=47\\)." },
    { id: 9, pregunta: "Si \\(\\log_2(x-1)+\\log_2(x+1)=3\\), entonces \\(x\\) vale:", formula: "", opciones: ["\\(2\\)", "\\(3\\)", "\\(4\\)", "\\(5\\)"], correcta: 1, explicacion: "Se juntan los logaritmos: \\(\\log_2((x-1)(x+1))=3\\). Entonces \\(x^2-1=8\\), de donde \\(x^2=9\\). Por dominio, \\(x>1\\), así que \\(x=3\\)." },
    { id: 10, pregunta: "Si \\(\\alpha\\) y \\(\\beta\\) son raíces de \\(x^2-x-1=0\\), entonces \\(\\alpha^5+\\beta^5\\) vale:", formula: "", opciones: ["\\(5\\)", "\\(7\\)", "\\(11\\)", "\\(13\\)"], correcta: 2, explicacion: "Sea \\(S_n=\\alpha^n+\\beta^n\\). Como cada raíz cumple \\(x^2=x+1\\), \\(S_n=S_{n-1}+S_{n-2}\\). \\(S_0=2\\), \\(S_1=1\\), luego \\(S_2=3\\), \\(S_3=4\\), \\(S_4=7\\), \\(S_5=11\\)." }
  ]
};

const PREGUNTAS_MEDIO_GRUPOS = {
  grupo1: PREGUNTAS_NIVELES.nivel1,
  grupo2: PREGUNTAS_NIVELES.nivel2,
  grupo3: PREGUNTAS_NIVELES.nivel3,
  grupo4: PREGUNTAS_NIVELES.nivel4,
  grupo5: PREGUNTAS_NIVELES.nivel5
};

function aplicarBancoNivelMedio() {
  PREGUNTAS_NIVELES.nivel1 = PREGUNTAS_MEDIO_GRUPOS[grupoActivo] || PREGUNTAS_MEDIO_GRUPOS.grupo1;
}

const GRUPOS = {
  grupo1: { nombre: "Grupo 1", clave: "UNAL-G1-4826" },
  grupo2: { nombre: "Grupo 2", clave: "UNAL-G2-7391" },
  grupo3: { nombre: "Grupo 3", clave: "UNAL-G3-1548" },
  grupo4: { nombre: "Grupo 4", clave: "UNAL-G4-9263" },
  grupo5: { nombre: "Grupo 5", clave: "UNAL-G5-3174" }
};
const STORAGE_GRUPO = "preguntasUnalGrupoActivo";
const STORAGE_PERMISOS = "preguntasUnalPermisosPorGrupo";
const DEFAULT_HABILITADOS = { diagnostico: true, nivel1: false, examen: false };
let permisosGrupo = cargarPermisosGrupo();
let grupoActivo = localStorage.getItem(STORAGE_GRUPO) || "";
let modoAdmin = grupoActivo === "admin";
let adminGrupoActual = Object.keys(GRUPOS)[0];
let nivelActual = "nivel1";
let nivelIniciado = false;
let nivelCompletadoVisible = false;
let timerNivelInterval = null;
let timerNivelActivo = false;
let segsNivel = DURACION_SEG;

function cargarPermisosGrupo() {
  const permisos = {};
  Object.keys(GRUPOS).forEach(clave => {
    permisos[clave] = { ...DEFAULT_HABILITADOS };
  });
  try {
    const guardado = JSON.parse(localStorage.getItem(STORAGE_PERMISOS) || "{}");
    Object.keys(GRUPOS).forEach(clave => {
      permisos[clave] = { ...DEFAULT_HABILITADOS, ...(guardado[clave] || {}) };
    });
  } catch {
    localStorage.removeItem(STORAGE_PERMISOS);
  }
  return permisos;
}

function guardarPermisosGrupo() {
  localStorage.setItem(STORAGE_PERMISOS, JSON.stringify(permisosGrupo));
}

async function guardarPermisoGrupoRemoto(grupo, examen, valor) {
  permisosGrupo[grupo] = { ...DEFAULT_HABILITADOS, ...(permisosGrupo[grupo] || {}), [examen]: valor };
  guardarPermisosGrupo();
  await setDoc(refPermisosGrupo(grupo), {
    permisos: permisosGrupo[grupo],
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function cargarPermisosRemotos() {
  const permisos = {};
  await Promise.all(Object.keys(GRUPOS).map(async grupo => {
    const snap = await getDoc(refPermisosGrupo(grupo));
    permisos[grupo] = { ...DEFAULT_HABILITADOS, ...(snap.exists() ? snap.data().permisos || {} : {}) };
    if (!snap.exists()) {
      await setDoc(refPermisosGrupo(grupo), { permisos: permisos[grupo], updatedAt: serverTimestamp() }, { merge: true });
    }
  }));
  permisosGrupo = permisos;
  guardarPermisosGrupo();
}

function escucharPermisosGrupo(grupo) {
  if (unsubscribePermisos) unsubscribePermisos();
  unsubscribePermisos = onSnapshot(refPermisosGrupo(grupo), snap => {
    permisosGrupo[grupo] = { ...DEFAULT_HABILITADOS, ...(snap.exists() ? snap.data().permisos || {} : {}) };
    guardarPermisosGrupo();
    actualizarEstadoDiagnostico();
    if (nivelActual) abrirNivel(nivelActual);
  });
}

function refrescarPermisosGrupo() {
  permisosGrupo = cargarPermisosGrupo();
}

function permisoDirecto(clave) {
  refrescarPermisosGrupo();
  if (modoAdmin) return true;
  return !!grupoActivo && !!permisosGrupo[grupoActivo]?.[clave];
}

function requisitoCumplido(clave) {
  if (modoAdmin) return true;
  if (clave === "diagnostico") return false;
  const req = NIVELES_META[clave].requisito;
  if (req === "diagnostico") return diagnosticoCompletado;
  return !!nivelesCompletados[req];
}

function examenHabilitado(clave) {
  if (modoAdmin) return true;
  if (!grupoActivo || !GRUPOS[grupoActivo]) return false;
  if (clave === "diagnostico") return permisoDirecto("diagnostico");
  if (clave === "examen") return permisoDirecto("examen") || nivelesCompletados.nivel1;
  return permisoDirecto(clave) || requisitoCumplido(clave);
}

function puedeAbrirNivel(clave) {
  return examenHabilitado(clave);
}

function puedeAbrirExamenFinal() {
  return examenHabilitado("examen");
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

function iniciarTimerNivel(continuar = false) {
  if (timerNivelActivo) return;
  timerNivelActivo = true;
  if (!continuar) segsNivel = DURACION_SEG;
  const display = document.getElementById("timerDisplay");
  const timerBox = document.getElementById("timerBox");
  display.textContent = formatTiempo(segsNivel);

  timerNivelInterval = setInterval(() => {
    const desdeIntento = segundosRestantesIntento("nivel", nivelActual);
    segsNivel = desdeIntento === null ? segsNivel - 1 : desdeIntento;
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
  const resultadoNivel = resultadoActual(clave);
  if (cambioDeNivel) {
    nivelIniciado = false;
    nivelCompletadoVisible = !!resultadoNivel;
    document.getElementById("nivelContainer").innerHTML = "";
    document.getElementById("summaryBodyNivel").innerHTML = "";
    document.getElementById("feedbackItemsNivel").innerHTML = "";
    document.getElementById("resultsSectionNivel").hidden = true;
    document.getElementById("nivelFormWrap").hidden = true;
    document.getElementById("submitBtnNivel").style.display = "";
    resetTimerNivel();
  } else if (resultadoNivel && !nivelIniciado) {
    nivelCompletadoVisible = true;
  }
  const meta = NIVELES_META[clave];
  document.getElementById("nivelTitulo").textContent = meta.titulo;
  document.getElementById("nivelDescripcion").textContent = meta.descripcion;
  document.getElementById("btnIniciarNivel").textContent = `▶ Iniciar ${meta.titulo.toLowerCase()}`;
  document.getElementById("submitBtnNivel").textContent = `Enviar ${meta.titulo.toLowerCase()}`;
  document.getElementById("nivelBloqueadoTitulo").textContent = `${meta.titulo} bloqueado`;
  const mensajeBloqueo = meta.requisitoTexto;
  document.getElementById("nivelBloqueadoTexto").textContent = mensajeBloqueo;
  document.getElementById("nivelBloqueadoRegla").textContent = mensajeBloqueo;

  if (puedeAbrirNivel(clave)) {
    document.getElementById("nivelBloqueado").hidden = true;
    document.getElementById("startScreenNivel").hidden = nivelIniciado || nivelCompletadoVisible;
    document.getElementById("nivelFormWrap").hidden = !nivelIniciado;
    document.getElementById("resultsSectionNivel").hidden = !nivelCompletadoVisible;
    if (!nivelIniciado && !nivelCompletadoVisible) resetTimerNivel();
    if (resultadoNivel && !nivelIniciado) {
      renderizarNivel();
      segsNivel = resultadoNivel.restante;
      evaluarYMostrarNivel(resultadoNivel.respuestas, { restaurando: true });
      document.getElementById("nivelFormWrap").hidden = true;
      document.getElementById("startScreenNivel").hidden = true;
      document.getElementById("resultsSectionNivel").hidden = false;
    }
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

function evaluarYMostrarNivel(respuestas, opciones = {}) {
  if (!opciones.restaurando) limpiarIntentoActivo();
  nivelIniciado = false;
  nivelCompletadoVisible = true;
  nivelesCompletados[nivelActual] = true;
  document.getElementById("submitBtnNivel").style.display = "none";

  const preguntas = PREGUNTAS_NIVELES[nivelActual];
  const tiempoEmpleado = DURACION_SEG - segsNivel;
  if (!opciones.restaurando) guardarResultadoSesion(nivelActual, respuestas, segsNivel);
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
  mostrarProgreso(preguntas.length, preguntas.length);

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
  if (!opciones.restaurando) sec.scrollIntoView({ behavior: "smooth" });

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
  if (!puedeIniciarIntento(nivelActual)) {
    alert("Ya usaste los 2 intentos permitidos para este nivel.");
    return;
  }
  iniciarIntentoActivo("nivel", nivelActual, PREGUNTAS_NIVELES[nivelActual].length);
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
  if (!puedeIniciarIntento(nivelActual)) {
    alert("Ya usaste los 2 intentos permitidos para este nivel.");
    return;
  }
  limpiarIntentoActivo();
  borrarResultadoSesion(nivelActual);
  nivelesCompletados[nivelActual] = false;
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

function validarPassword(password) {
  const mayus = /[A-Z]/.test(password);
  const numeros = (password.match(/\d/g) || []).length >= 2;
  const simbolo = [...password].some(ch => SIMBOLOS_PERMITIDOS.includes(ch));
  return password.length >= 8 && mayus && numeros && simbolo;
}

function mostrarWarn(msg) {
  const warn = document.getElementById("grupoWarn");
  warn.textContent = msg;
  warn.hidden = false;
}

function limpiarWarn() {
  document.getElementById("grupoWarn").hidden = true;
}

async function guardarPerfilUsuario(extra = {}) {
  if (!usuarioActual) return;
  perfilActual = {
    uid: usuarioActual.uid,
    email: usuarioActual.email,
    displayName: usuarioActual.displayName || "",
    isAdmin: usuarioActual.email === ADMIN_EMAIL,
    grupo: grupoActivo || "",
    ...extra
  };
  await setDoc(refPerfilUsuario(), { ...perfilActual, updatedAt: serverTimestamp() }, { merge: true });
}

async function cargarPerfilUsuario() {
  if (!usuarioActual) return null;
  const snap = await getDoc(refPerfilUsuario());
  perfilActual = snap.exists() ? snap.data() : null;
  return perfilActual;
}

async function prepararSesionAutenticada() {
  await cargarPermisosRemotos();
  await cargarPerfilUsuario();
  await cargarEstadoRemoto();
  modoAdmin = usuarioActual?.email === ADMIN_EMAIL;
  if (modoAdmin) {
    grupoActivo = "admin";
    localStorage.setItem(STORAGE_GRUPO, grupoActivo);
    await guardarPerfilUsuario({ isAdmin: true, grupo: "admin" });
    document.body.classList.remove("group-locked");
    aplicarModoUsuario();
    activarNav("admin");
    return;
  }

  if (perfilActual?.grupo && GRUPOS[perfilActual.grupo]) {
    grupoActivo = perfilActual.grupo;
    localStorage.setItem(STORAGE_GRUPO, grupoActivo);
    aplicarBancoNivelMedio();
    escucharPermisosGrupo(grupoActivo);
    sincronizarCompletadosGuardados();
    document.body.classList.remove("group-locked");
    aplicarModoUsuario();
    activarNav("diagnostico");
    actualizarEstadoDiagnostico();
    restaurarIntentoActivo();
    return;
  }

  document.getElementById("groupEntry").classList.remove("hidden");
  document.getElementById("mfaPanel").classList.remove("hidden");
}

async function entrarGrupo() {
  if (!usuarioActual) {
    mostrarWarn("Primero inicia sesión o regístrate.");
    return;
  }
  const valor = document.getElementById("grupoClave").value.trim();
  const encontrado = Object.entries(GRUPOS).find(([, grupo]) => grupo.clave === valor);
  if (!encontrado) {
    mostrarWarn("Clave de grupo incorrecta.");
    return;
  }
  grupoActivo = encontrado[0];
  modoAdmin = false;
  localStorage.setItem(STORAGE_GRUPO, grupoActivo);
  await guardarPerfilUsuario({ grupo: grupoActivo, isAdmin: false });
  await guardarEstadoRemoto();
  aplicarBancoNivelMedio();
  escucharPermisosGrupo(grupoActivo);
  limpiarWarn();
  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  activarNav("diagnostico");
  actualizarEstadoDiagnostico();
}

async function loginEmail() {
  const email = document.getElementById("authEmail").value.trim().toLowerCase();
  const password = document.getElementById("authPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === "auth/multi-factor-auth-required") {
      iniciarResolucionMfa(err);
      return;
    }
    mostrarWarn("No se pudo ingresar. Revisa correo y contraseña.");
  }
}

async function registrarEmail() {
  const email = document.getElementById("authEmail").value.trim().toLowerCase();
  const password = document.getElementById("authPassword").value;
  if (!email.endsWith("@gmail.com")) {
    mostrarWarn("Solo se permiten correos @gmail.com.");
    return;
  }
  if (!validarPassword(password)) {
    mostrarWarn("La contraseña debe tener mínimo 8 caracteres, una mayúscula, dos números y un símbolo permitido.");
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch {
    mostrarWarn("No se pudo registrar ese correo.");
  }
}

async function loginGoogle() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    if (err.code === "auth/multi-factor-auth-required") iniciarResolucionMfa(err);
    else mostrarWarn("No se pudo ingresar con Google.");
  }
}

function asegurarRecaptcha() {
  if (window.recaptchaVerifier) return window.recaptchaVerifier;
  window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
  return window.recaptchaVerifier;
}

async function iniciarMfa() {
  if (!usuarioActual) {
    mostrarWarn("Primero inicia sesión.");
    return;
  }
  const phoneNumber = document.getElementById("mfaPhone").value.trim();
  if (!phoneNumber.startsWith("+")) {
    mostrarWarn("Escribe el número con indicativo, por ejemplo +573112454282.");
    return;
  }
  const session = await multiFactor(usuarioActual).getSession();
  const provider = new PhoneAuthProvider(auth);
  mfaVerificationId = await provider.verifyPhoneNumber({ phoneNumber, session }, asegurarRecaptcha());
  document.getElementById("mfaCodeWrap").classList.remove("hidden");
  mostrarWarn("Código enviado por SMS.");
}

async function confirmarMfa() {
  const code = document.getElementById("mfaCode").value.trim();
  const cred = PhoneAuthProvider.credential(mfaVerificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  await multiFactor(usuarioActual).enroll(assertion, "Teléfono principal");
  limpiarWarn();
  document.getElementById("mfaPanel").classList.add("hidden");
}

function iniciarResolucionMfa(error) {
  window.mfaResolver = getMultiFactorResolver(auth, error);
  mostrarWarn("Esta cuenta pide segundo factor por SMS. Usa el flujo de verificación telefónica.");
}

document.getElementById("btnGrupoEntrar").addEventListener("click", entrarGrupo);
document.getElementById("grupoClave").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    entrarGrupo();
  }
});

async function salirApp() {
  localStorage.removeItem(STORAGE_GRUPO);
  if (unsubscribePermisos) unsubscribePermisos();
  await signOut(auth);
  window.location.reload();
}

document.getElementById("btnSalirApp").addEventListener("click", salirApp);
document.getElementById("btnSalirAdmin")?.addEventListener("click", salirApp);
document.getElementById("btnEmailLogin")?.addEventListener("click", loginEmail);
document.getElementById("btnEmailRegister")?.addEventListener("click", registrarEmail);
document.getElementById("btnGoogleLogin")?.addEventListener("click", loginGoogle);
document.getElementById("btnMfaStart")?.addEventListener("click", iniciarMfa);
document.getElementById("btnMfaConfirm")?.addEventListener("click", confirmarMfa);

onAuthStateChanged(auth, async user => {
  usuarioActual = user;
  if (!user) {
    document.body.classList.add("group-locked");
    document.getElementById("groupEntry").classList.add("hidden");
    document.getElementById("mfaPanel").classList.add("hidden");
    return;
  }
  limpiarWarn();
  document.getElementById("mfaPanel").classList.remove("hidden");
  await prepararSesionAutenticada();
});

function renderAdminPanel() {
  if (!modoAdmin) return;
  const select = document.getElementById("adminGrupoSelect");
  const list = document.getElementById("adminList");
  if (!select || !list) return;

  if (!select.options.length) {
    Object.entries(GRUPOS).forEach(([clave, grupo]) => {
      const option = document.createElement("option");
      option.value = clave;
      option.textContent = `${grupo.nombre} (${grupo.clave})`;
      select.appendChild(option);
    });
  }

  select.value = adminGrupoActual;
  const grupo = GRUPOS[adminGrupoActual];
  const nombres = [
    ["diagnostico", "Diagnóstico"],
    ["nivel1", "Nivel Medio"],
    ["examen", "Examen Final"]
  ];

  list.innerHTML = "";
  const info = document.createElement("p");
  info.className = "admin-current-group";
  info.textContent = `${grupo.nombre} · Clave: ${grupo.clave}`;
  list.appendChild(info);

  nombres.forEach(([clave, nombre]) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div>
        <strong>${nombre}</strong>
        <span>${clave === "diagnostico" ? "Permitir entrada al diagnóstico" : "Permiso directo sin completar el requisito anterior"}</span>
      </div>
      <label class="switch" aria-label="Habilitar ${nombre}">
        <input type="checkbox" data-admin-exam="${clave}" ${permisosGrupo[adminGrupoActual]?.[clave] ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    `;
    list.appendChild(row);
  });
  renderAdminStats();
}

async function renderAdminStats() {
  const cont = document.getElementById("adminStats");
  if (!cont || !modoAdmin) return;
  cont.innerHTML = `<div class="stats-card"><h3>Métricas</h3><p>Cargando datos...</p></div>`;
  const snaps = await getDocs(collection(db, "studentState"));
  const acumulado = {};
  Object.keys(GRUPOS).forEach(g => acumulado[g] = { estudiantes: new Set(), intentos: 0, correctas: 0, incorrectas: 0, nota: 0, tiempo: 0 });
  snaps.forEach(snap => {
    const data = snap.data();
    const grupo = data.grupo;
    if (!GRUPOS[grupo]) return;
    const bucket = acumulado[grupo];
    bucket.estudiantes.add(data.uid || snap.id);
    Object.entries(data.resultados || {}).forEach(([clave, value]) => {
      (value.intentos || []).forEach(intento => {
        const m = metricasIntento(clave, intento);
        bucket.intentos++;
        bucket.correctas += m.correctas;
        bucket.incorrectas += m.incorrectas;
        bucket.nota += Number(m.nota);
        bucket.tiempo += m.tiempoEmpleado;
      });
    });
  });
  cont.innerHTML = "";
  Object.entries(acumulado).forEach(([grupo, data]) => {
    const card = document.createElement("div");
    card.className = "stats-card";
    const n = data.intentos || 1;
    card.innerHTML = `
      <h3>${GRUPOS[grupo].nombre}</h3>
      <p><strong>Estudiantes:</strong> ${data.estudiantes.size}</p>
      <p><strong>Intentos:</strong> ${data.intentos}</p>
      <p><strong>Promedio nota:</strong> ${(data.nota / n).toFixed(1)}</p>
      <p><strong>Promedio correctas:</strong> ${(data.correctas / n).toFixed(1)}</p>
      <p><strong>Promedio incorrectas:</strong> ${(data.incorrectas / n).toFixed(1)}</p>
      <p><strong>Promedio tiempo:</strong> ${formatTiempo(Math.round(data.tiempo / n))}</p>
    `;
    cont.appendChild(card);
  });
}

document.getElementById("adminGrupoSelect")?.addEventListener("change", (e) => {
  adminGrupoActual = e.target.value;
  renderAdminPanel();
});

document.getElementById("adminList")?.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-admin-exam]");
  if (!input) return;
  guardarPermisoGrupoRemoto(adminGrupoActual, input.dataset.adminExam, input.checked);
});

/* ────────────────────────────────────────────────────
   13. MOTOR DEL EXAMEN FINAL
──────────────────────────────────────────────────── */
let timerExamenInterval = null;
let timerExamenActivo   = false;
let segsExamen          = 15 * 60;

function iniciarTimerExamen(continuar = false) {
  if (timerExamenActivo) return;
  timerExamenActivo = true;
  if (!continuar) segsExamen = 15 * 60;
  const display  = document.getElementById("timerDisplay");
  const timerBox = document.getElementById("timerBox");
  display.textContent = formatTiempo(segsExamen);

  timerExamenInterval = setInterval(() => {
    const desdeIntento = segundosRestantesIntento("examen", "examen");
    segsExamen = desdeIntento === null ? segsExamen - 1 : desdeIntento;
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
  if (!puedeIniciarIntento("examen")) {
    alert("Ya usaste los 2 intentos permitidos para el examen final.");
    return;
  }
  iniciarIntentoActivo("examen", "examen", PREGUNTAS_EXAMEN.length);
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
function evaluarYMostrarExamen(respuestas, opciones = {}) {
  if (!opciones.restaurando) limpiarIntentoActivo();
  examenIniciado = false;
  examenCompletado = true;
  document.getElementById("submitBtnExamen").style.display = "none";
  const tiempoEmpleado = (15 * 60) - segsExamen;
  if (!opciones.restaurando) guardarResultadoSesion("examen", respuestas, segsExamen);
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
  mostrarProgreso(PREGUNTAS_EXAMEN.length, PREGUNTAS_EXAMEN.length);
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
  if (!opciones.restaurando) sec.scrollIntoView({ behavior: "smooth" });

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
  if (!puedeIniciarIntento("examen")) {
    alert("Ya usaste los 2 intentos permitidos para el examen final.");
    return;
  }
  limpiarIntentoActivo();
  borrarResultadoSesion("examen");
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

function restaurarIntentoActivo() {
  if (!intentoActivo) return;
  if (Date.now() - intentoActivo.ultimaActividad > INACTIVIDAD_MS) {
    limpiarIntentoActivo();
    return;
  }

  const restante = Math.max(0, Math.ceil((intentoActivo.vence - Date.now()) / 1000));

  if (intentoActivo.tipo === "diag") {
    activarNav("diagnostico");
    renderizarPreguntas();
    aplicarRespuestasGuardadas("diag", "diagnostico", PREGUNTAS);
    document.getElementById("startScreen").hidden = true;
    document.getElementById("diagFormWrap").hidden = false;
    actualizarProgreso();
    segundosRestantes = restante;
    if (restante <= 0) evaluarYMostrar(respuestasDesdeIntento(PREGUNTAS, "diag"));
    else iniciarTimer(true);
    return;
  }

  if (intentoActivo.tipo === "nivel" && PREGUNTAS_NIVELES[intentoActivo.clave]) {
    nivelActual = intentoActivo.clave;
    activarNav(nivelActual);
    abrirNivel(nivelActual);
    nivelIniciado = true;
    nivelCompletadoVisible = false;
    document.getElementById("nivelBloqueado").hidden = true;
    document.getElementById("startScreenNivel").hidden = true;
    document.getElementById("nivelFormWrap").hidden = false;
    renderizarNivel();
    aplicarRespuestasGuardadas("nivel", nivelActual, PREGUNTAS_NIVELES[nivelActual]);
    actualizarProgresoNivel();
    segsNivel = restante;
    if (restante <= 0) evaluarYMostrarNivel(respuestasDesdeIntento(PREGUNTAS_NIVELES[nivelActual], "nivel"));
    else iniciarTimerNivel(true);
    return;
  }

  if (intentoActivo.tipo === "examen") {
    activarNav("examen");
    examenIniciado = true;
    examenCompletado = false;
    document.getElementById("examenBloqueado").hidden = true;
    document.getElementById("startScreenExamen").hidden = true;
    document.getElementById("examenFormWrap").hidden = false;
    renderizarExamen();
    aplicarRespuestasGuardadas("examen", "examen", PREGUNTAS_EXAMEN);
    actualizarProgresoExamen();
    segsExamen = restante;
    if (restante <= 0) evaluarYMostrarExamen(respuestasDesdeIntento(PREGUNTAS_EXAMEN, "examen"));
    else iniciarTimerExamen(true);
  }
}
