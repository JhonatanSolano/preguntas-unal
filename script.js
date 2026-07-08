import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import {
  getAuth,
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  signOut,
  updatePhoneNumber,
  updatePassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCx2xCjNzfeH_KfQKMuKImuE13X6DnAk7I",
  authDomain: "preguntas-tipo-examen.firebaseapp.com",
  projectId: "preguntas-tipo-examen",
  storageBucket: "preguntas-tipo-examen.firebasestorage.app",
  messagingSenderId: "235600414785",
  appId: "1:235600414785:web:780282c2c2379fb39d9ec0"
};

const APP_CONFIG = {
  name: "Matemáticas En Tu Bolsillo",
  recaptchaSiteKey: "6LcmOT0tAAAAAPfwCOhqA1nzfz3YOx8McE_mpFEZ",
  asesorEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/generateAiResponse",
  passwordResetEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/sendPasswordResetEmailCustom",
  emailVerificationEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/sendEmailVerificationCustom"
};

const app = initializeApp(firebaseConfig);
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(APP_CONFIG.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
} catch (err) {
  console.warn("No se pudo iniciar App Check. La autenticación continuará sin App Check.", err);
}
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
setPersistence(auth, browserLocalPersistence);
document.title = APP_CONFIG.name;

const ADMIN_EMAIL = "solanojhonatan2000@gmail.com";
const SIMBOLOS_PERMITIDOS = "!@#$%^&*()_+-=[]{};:,.?";
let usuarioActual = null;
let perfilActual = null;
let unsubscribePermisos = null;
let unsubscribeAdminStudents = null;
let unsubscribeClassMembership = null;
let unsubscribeNotifications = null;
let unsubscribeMessages = null;
let unsubscribeReplies = null;
let renderizandoAdminStudents = false;
let classMembershipValid = true;
let registroEnCurso = false;
let phoneVerificationId = "";
let phoneVerificationExpiresAt = 0;
let recaptchaVerifier = null;
let phoneCountdownInterval = null;
let recoverVerificationId = "";
let recoverVerificationExpiresAt = 0;
let recoverCountdownInterval = null;
let recoverCandidate = null;
let recoverRecaptchaVerifier = null;
let advisorMessages = [];
let advisorMode = null;
let advisorLoading = false;
let internalNotifications = [];
let internalMessages = [];
let internalReplies = [];
let activeMessageId = "";
let recoverAttemptCount = 0;
let seccionActual = "inicio";
let savedRichSelection = null;
const EMOJIS_MENSAJE = [
  ["😀", "feliz sonrisa alegre"], ["😃", "sonrisa feliz"], ["😄", "risa feliz"], ["😁", "sonrisa grande"], ["😆", "risa"], ["😅", "risa sudor"], ["😂", "llorando risa fuerte"], ["🤣", "carcajada llorando fuerte"], ["😭", "cara llorando fuerte"], ["😉", "guiño"], ["😘", "beso"], ["😗", "beso"], ["😙", "beso feliz"], ["😚", "beso tierno"], ["🥰", "amor cariño"], ["😍", "enamorado corazones"], ["🤩", "estrella emoción"], ["🥳", "celebración fiesta"], ["🤔", "pensando duda"], ["🙄", "ojos arriba"], ["🙂", "sonrisa suave"], ["🥲", "sonrisa lágrima"], ["🥺", "tierno triste"], ["😊", "feliz amable"], ["😌", "tranquilo"], ["😔", "triste"], ["😇", "ángel"], ["😈", "diablo"], ["⭐", "estrella"], ["👍", "bien pulgar"], ["❤️", "corazón amor"]
];
const SECCIONES_ESTUDIANTE = new Set(["inicio", "perfil", "examenes", "diagnostico", "nivel1", "examen", "estadisticas", "mensajes", "asesorIA", "configuracion", "soporte"]);
const SECCIONES_PROFESOR = new Set(["admin", "perfil", "examenes", "adminMetricas", "mensajes", "asesorIA", "configuracion", "soporte"]);
const PHONE_CODE_DURATION_MS = 2 * 60 * 1000;
const MAX_PROFILE_PHOTO_INPUT_MB = 12;
const MAX_MESSAGE_ATTACHMENT_MB = 8;
const PROFILE_PHOTO_MAX_SIDE = 900;
const PROFILE_PHOTO_QUALITY = 0.82;

const PHONE_CODES = [
  { code: "+57", label: "Colombia (+57)" },
  { code: "+58", label: "Venezuela (+58)" }
];

const GEO_COUNTRY_FALLBACK = [
  { id: "CO", name: "Colombia", iso2: "CO", iso3: "COL", phoneCode: "+57" },
  { id: "VE", name: "Venezuela", iso2: "VE", iso3: "VEN", phoneCode: "+58" }
];
const geoCache = {
  countries: null,
  regions: {},
  municipalities: {}
};

/* ════════════════════════════════════════════════════════
   Matemáticas En Tu Bolsillo · script.js
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

function setExamHeaderActivo(activo) {
  document.body.classList.toggle("exam-active", activo);
}

/** Inicia el countdown */
function iniciarTimer(continuar = false) {
  if (timerActivo) return;
  timerActivo = true;
  setExamHeaderActivo(true);
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
  if (!timerNivelActivo && !timerExamenActivo) setExamHeaderActivo(false);
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
  const base = claveBaseResultado(clave);
  if (base === "diagnostico") return PREGUNTAS;
  if (base === "examen") return PREGUNTAS_EXAMEN;
  return PREGUNTAS_NIVELES.nivel1;
}

function claveBaseResultado(clave) {
  return String(clave).includes("::") ? String(clave).split("::").pop() : clave;
}

function claveResultado(clave, banco = bancoActivo) {
  if (String(clave).includes("::")) return clave;
  return `${banco}::${clave}`;
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
const STORAGE_BANCO_ACTIVO = "preguntasUnalBancoActivo";
const STORAGE_CLASE_ACTIVA = "preguntasUnalClaseActiva";
const STORAGE_ADMIN_CLASE = "preguntasUnalAdminClaseActiva";
const STORAGE_SECCION_ACTIVA = "matematicasBolsilloSeccionActiva";
const STORAGE_ASESOR_CHAT = "matematicasBolsilloAsesorIA";
const STORAGE_INVITE_TOKEN = "matematicasBolsilloInviteToken";
const INACTIVIDAD_MS = 10 * 60 * 1000;
const ASESOR_INACTIVIDAD_MS = 10 * 60 * 1000;
const BANCOS_DISPONIBLES = ["principal", ...Array.from({ length: 10 }, (_, i) => `reserva${i + 1}`)];
const NOMBRES_BANCOS = Object.fromEntries(BANCOS_DISPONIBLES.map((banco, idx) => [
  banco,
  idx === 0 ? "Banco principal" : `Reserva ${idx}`
]));
const ASESOR_QUICK_REPLIES = [
  ["Resolver pregunta", "Resolver una pregunta"],
  ["Ejercicios tipo examen", "Generar ejercicios tipo examen"],
  ["Practicar por tema", "Practicar por tema"],
  ["Revisar error", "Revisar mi error"],
  ["Plan de estudio", "Crear plan de estudio"]
];
const ASESOR_TEACHER_QUICK_REPLIES = [
  ["Planear clase", "Ayúdame a planear una clase"],
  ["Crear examen", "Crear un examen de matemáticas"],
  ["Redactar correo", "Redactar un correo para mis estudiantes"],
  ["Diseñar actividad", "Diseñar una actividad de práctica"],
  ["Retroalimentar grupo", "Crear retroalimentación para un grupo"]
];
const ASESOR_MODE_LABELS = {
  solve: "Resolver pregunta",
  generate: "Ejercicios tipo examen",
  practice: "Practicar por tema",
  review: "Revisar error",
  guide: "Plan de estudio"
};
const ASESOR_MODE_PROMPTS = {
  solve: "Listo. Pega el enunciado o escribe la pregunta y te explico el tema, la idea clave, los pasos y un consejo para examen.",
  generate: "Perfecto. Dime tema, cantidad y dificultad. Ej: 5 preguntas de funciones, nivel medio, con solución.",
  practice: "Vamos a practicar. Dime el tema: álgebra, funciones, geometría, trigonometría, probabilidad, estadística o lectura de gráficas.",
  review: "Pega el enunciado, tu respuesta y la respuesta correcta si la tienes. Te explico dónde estuvo el error y cómo evitarlo.",
  guide: "Dime cuántos días tienes, qué examen preparas y tus temas flojos. Te armo una ruta corta de estudio."
};
const ASESOR_INITIAL_MESSAGE = {
  id: "initial-advisor-message",
  sender: "bot",
  text: "Hola. Soy tu Asesor IA de matemáticas. Puedo ayudarte a resolver preguntas, practicar por tema, revisar errores o crear un plan de estudio."
};
const ASESOR_TEACHER_INITIAL_MESSAGE = {
  id: "initial-advisor-teacher-message",
  sender: "bot",
  text: "Hola, profe. Soy tu Asesor IA. Puedo ayudarte a planear clases, crear exámenes, diseñar actividades, redactar correos para estudiantes y preparar retroalimentaciones."
};
let intentoActivo = cargarIntentoActivo();
let resultadosSesion = cargarResultadosSesion();
let bancoActivo = localStorage.getItem(STORAGE_BANCO_ACTIVO) || "principal";
let claseActiva = localStorage.getItem(STORAGE_CLASE_ACTIVA) || "";
let claseActualInfo = null;
let clasePendienteIngreso = null;
let adminClaseActiva = localStorage.getItem(STORAGE_ADMIN_CLASE) || "";
let adminClases = [];

function rolUsuario(perfil = perfilActual) {
  if (usuarioActual?.email?.toLowerCase() === ADMIN_EMAIL) return "teacher";
  return perfil?.role || perfil?.tipoCuenta || "";
}

function esProfesor(perfil = perfilActual) {
  return rolUsuario(perfil) === "teacher";
}

function requiereSeleccionRol(perfil = perfilActual) {
  return !!usuarioActual && !rolUsuario(perfil);
}

function aulaActualValida() {
  return !!grupoActivo && grupoActivo !== "admin" && classMembershipValid;
}

function nombreAulaPorId(id = grupoActivo) {
  if (!id) return "Aula";
  if (id === claseActiva && (claseActualInfo?.name || perfilActual?.className)) {
    return claseActualInfo?.name || perfilActual?.className;
  }
  return adminClases.find(c => c.id === id)?.name || perfilActual?.className || "Aula";
}

function aulaPorId(id) {
  return adminClases.find(c => c.id === id) || null;
}

function idsAulasAdmin() {
  return adminClases.map(c => c.id).filter(Boolean);
}

function refEstadoUsuario(uid = usuarioActual?.uid) {
  return uid ? doc(db, "studentState", uid) : null;
}

function refPerfilUsuario(uid = usuarioActual?.uid) {
  return uid ? doc(db, "users", uid) : null;
}

function refPermisosGrupo(grupo) {
  return doc(db, "classPermissions", grupo);
}

function refClase(id) {
  return doc(db, "classes", id);
}

function safeEmailId(email) {
  return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function generarTokenSeguro(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, value => chars[value % chars.length]).join("");
}

function enlaceInvitacionAula(token) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("classInvite", token);
  return url.toString();
}

function capturarInvitacionUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("classInvite");
  if (!token) return;
  localStorage.setItem(STORAGE_INVITE_TOKEN, token);
  params.delete("classInvite");
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", clean);
}

function normalizarTelefono(code = "", phone = "") {
  const indicativo = String(code || "").trim().replace(/[^\d+]/g, "") || "+57";
  const numero = String(phone || "").trim().replace(/[^\d]/g, "");
  return numero ? `${indicativo}${numero}` : "";
}

function recoveryPhoneId(phoneNumber = "") {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

function normalizarNombre(nombre = "") {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function sincronizarIndiceRecuperacion(perfil = perfilActual) {
  if (!usuarioActual?.uid || !perfil?.phoneVerified || !perfil?.phone || !perfil?.email) return;
  const phoneNumber = normalizarTelefono(perfil.phoneCode || "+57", perfil.phone);
  const phoneId = recoveryPhoneId(phoneNumber);
  if (!phoneId) return;
  await setDoc(doc(db, "recoveryContacts", phoneId), {
    uid: usuarioActual.uid,
    email: perfil.email,
    displayName: perfil.displayName || usuarioActual.displayName || "",
    nameKey: normalizarNombre(perfil.displayName || usuarioActual.displayName || ""),
    phoneNumber,
    phoneVerified: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function normalizarResultados(raw = {}) {
  const normalizados = {};
  Object.entries(raw).forEach(([clave, valor]) => {
    const value = valor?.intentos ? valor : { intentos: [valor].filter(Boolean) };
    normalizados[clave] = value;
    if (!String(clave).includes("::") && ["diagnostico", "nivel1", "examen"].includes(clave)) {
      normalizados[`principal::${clave}`] = value;
    }
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
    claseId: claseActiva || "",
    aulaId: claseActiva || grupoActivo || "",
    aulaNombre: claseActualInfo?.name || perfilActual?.className || "",
    bancoActivo,
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
  if (data.aulaId || data.claseId || data.grupo) grupoActivo = data.aulaId || data.claseId || data.grupo;
  if (data.aulaId || data.claseId) {
    claseActiva = data.aulaId || data.claseId;
    localStorage.setItem(STORAGE_CLASE_ACTIVA, claseActiva);
  }
  if (data.bancoActivo && BANCOS_DISPONIBLES.includes(data.bancoActivo)) {
    bancoActivo = data.bancoActivo;
    localStorage.setItem(STORAGE_BANCO_ACTIVO, bancoActivo);
  }
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
    return normalizarResultados(JSON.parse(localStorage.getItem(RESULTADOS_KEY) || "{}"));
  } catch {
    return {};
  }
}

function guardarResultadosSesion(syncRemoto = true) {
  localStorage.setItem(RESULTADOS_KEY, JSON.stringify(resultadosSesion));
  actualizarBancoEstudiante();
  if (syncRemoto) guardarEstadoRemoto();
}

function guardarResultadoSesion(clave, respuestas, restante) {
  const key = claveResultado(clave);
  const intento = {
    respuestas,
    restante: Math.max(0, restante),
    guardado: Date.now()
  };
  const previos = resultadosSesion[key]?.intentos || [];
  resultadosSesion[key] = { intentos: [...previos, intento].slice(0, 2) };
  guardarResultadosSesion();
  notificarIntentoCompletado(clave, previos.length + 1);
}

function nombreEvaluacion(clave) {
  if (clave === "diagnostico") return "Diagnóstico";
  if (clave === "nivel1") return "Nivel Medio";
  if (clave === "examen") return "Examen Final";
  return NIVELES_META[clave]?.titulo || clave;
}

function notificarIntentoCompletado(clave, intentoNumero) {
  if (!usuarioActual?.email || modoAdmin) return;
  const examName = nombreEvaluacion(clave);
  const studentName = perfilActual?.displayName || usuarioActual.displayName || usuarioActual.email;
  crearNotificacion({
    targetEmail: usuarioActual.email.toLowerCase(),
    targetUid: usuarioActual.uid,
    type: "exam-finished",
    title: `${examName} terminado`,
    body: `Terminaste el intento ${intentoNumero} de ${examName}.`,
    classId: claseActiva || grupoActivo || ""
  }).catch(() => {});
  const teacherEmail = perfilActual?.classOwnerEmail || claseActualInfo?.ownerEmail || "";
  if (teacherEmail) {
    crearNotificacion({
      targetEmail: teacherEmail.toLowerCase(),
      targetUid: perfilActual?.classOwnerUid || claseActualInfo?.ownerUid || "",
      type: "student-exam-finished",
      title: `${studentName} terminó ${examName}`,
      body: `${studentName} completó el intento ${intentoNumero} de ${examName}.`,
      classId: claseActiva || grupoActivo || ""
    }).catch(() => {});
  }
}

function borrarResultadoSesion(clave) {
  const key = claveResultado(clave);
  const previos = resultadosSesion[key]?.intentos || [];
  resultadosSesion[key] = { intentos: previos };
  guardarResultadosSesion();
}

function limpiarResultadosSesion() {
  resultadosSesion = {};
  localStorage.removeItem(RESULTADOS_KEY);
  guardarEstadoRemoto();
}

function resultadoActual(clave) {
  const intentos = resultadosSesion[claveResultado(clave)]?.intentos || [];
  return intentos[intentos.length - 1] || null;
}

function intentosUsados(clave) {
  return (resultadosSesion[claveResultado(clave)]?.intentos || []).length;
}

function puedeIniciarIntento(clave) {
  return intentosUsados(clave) < 2;
}

function indiceBancoActivo() {
  return Math.max(0, BANCOS_DISPONIBLES.indexOf(bancoActivo));
}

function bancoCompletado(banco = bancoActivo) {
  return ["diagnostico", "nivel1", "examen"].every(clave => {
    const intentos = resultadosSesion[claveResultado(clave, banco)]?.intentos || [];
    return intentos.length > 0;
  });
}

function guardarBancoActivo() {
  localStorage.setItem(STORAGE_BANCO_ACTIVO, bancoActivo);
  guardarEstadoRemoto();
}

function cambiarBanco(delta) {
  const idx = indiceBancoActivo();
  const nuevoIdx = idx + delta;
  if (nuevoIdx < 0 || nuevoIdx >= BANCOS_DISPONIBLES.length) return;
  if (delta > 0 && !bancoCompletado()) {
    alert("Para pasar al siguiente banco debes completar diagnóstico, nivel medio y examen final.");
    return;
  }
  limpiarIntentoActivo();
  bancoActivo = BANCOS_DISPONIBLES[nuevoIdx];
  guardarBancoActivo();
  sincronizarCompletadosGuardados();
  reiniciarVistasBancoActual();
  actualizarBancoEstudiante();
  actualizarGrupoActualPanel();
  activarNav("inicio");
}

function reiniciarVistasBancoActual() {
  document.getElementById("diagFormWrap").hidden = true;
  document.getElementById("resultsSection").hidden = true;
  document.getElementById("startScreen").hidden = false;
  document.getElementById("questionsContainer").innerHTML = "";
  reiniciarEstadoNivelVisual();
  reiniciarEstadoExamenFinal(false);
  resetTimer();
  mostrarProgreso(0, PREGUNTAS.length);
}

function aplicarVisibilidadResultadoIntento(clave, sectionId, retryButtonId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const usados = intentosUsados(clave);
  const esPrimerIntento = usados === 1;
  const intentosAgotados = usados >= 2;
  section.classList.toggle("first-attempt-result", esPrimerIntento);

  const retryButton = document.getElementById(retryButtonId);
  if (!retryButton) return;
  retryButton.hidden = intentosAgotados;
  retryButton.textContent = esPrimerIntento ? "↺ Hacer último intento (2 de 2)" : "↺ Hacer intento";
}

function iniciarIntentoActivo(tipo, clave, total) {
  intentoActivo = {
    tipo,
    clave,
    banco: bancoActivo,
    total,
    respuestas: {},
    inicio: Date.now(),
    vence: Date.now() + DURACION_SEG * 1000,
    ultimaActividad: Date.now()
  };
  guardarIntentoActivo();
}

function intentoCoincide(tipo, clave) {
  return intentoActivo && intentoActivo.tipo === tipo && intentoActivo.clave === clave && (intentoActivo.banco || "principal") === bancoActivo;
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
  aplicarVisibilidadResultadoIntento("diagnostico", "resultsSection", "btnRestart");
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
    if (!confirmarSalidaMensajes(sec)) return;
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
    texto.textContent = "Este diagnóstico todavía no está habilitado para tu aula.";
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
  cerrarAccordions();
  if (sec !== "perfil") limpiarVerificacionTelefonoTemporal();
  if (sec !== "mensajes") limpiarBorradorMensajeProfesor();
  document.getElementById("sectionInicio").classList.toggle("hidden", sec !== "inicio");
  document.getElementById("sectionExamenes").classList.toggle("hidden", sec !== "examenes");
  document.getElementById("sectionDiagnostico").classList.toggle("hidden", sec !== "diagnostico");
  document.getElementById("sectionNivel").classList.toggle("hidden", !sec.startsWith("nivel"));
  document.getElementById("sectionExamen").classList.toggle("hidden", sec !== "examen");
  document.getElementById("sectionEstadisticas").classList.toggle("hidden", sec !== "estadisticas");
  document.getElementById("sectionPerfil").classList.toggle("hidden", sec !== "perfil");
  document.getElementById("sectionConfiguracion").classList.toggle("hidden", sec !== "configuracion");
  document.getElementById("sectionAdmin").classList.toggle("hidden", sec !== "admin");
  document.getElementById("sectionAdminMetricas").classList.toggle("hidden", sec !== "adminMetricas");
  document.getElementById("sectionSoporte").classList.toggle("hidden", sec !== "soporte");
  document.getElementById("sectionMensajes")?.classList.toggle("hidden", sec !== "mensajes");
  document.getElementById("sectionAsesorIA")?.classList.toggle("hidden", sec !== "asesorIA");
  if (sec === "diagnostico") actualizarEstadoDiagnostico();
  if (sec === "examenes") renderExamenesHub();
  if (sec === "admin") renderAdminPanel();
  if (sec === "estadisticas") renderStudentStats();
  if (sec === "inicio") actualizarBienvenida();
  if (sec === "perfil") renderProfile();
  if (sec === "configuracion") renderConfiguracion();
  if (sec === "mensajes") renderMessagesPanel();
  if (sec === "asesorIA") renderAsesorInfo();
  if (sec === "admin") renderAdminWelcome();
  if (sec === "adminMetricas") {
    document.getElementById("adminMetricsPanel").hidden = false;
    renderAdminStats();
  }
  seccionActual = sec;
  if (usuarioActual) {
    localStorage.setItem(STORAGE_SECCION_ACTIVA, sec);
  }
}

function hayBorradorMensajeProfesor() {
  if (!modoAdmin) return false;
  const subject = document.getElementById("messageSubject")?.value.trim() || "";
  const files = document.getElementById("messageAttachments")?.files?.length || 0;
  return !!(subject || richMessageHasContent() || files);
}

function limpiarBorradorMensajeProfesor() {
  if (!modoAdmin) return;
  const subject = document.getElementById("messageSubject");
  const files = document.getElementById("messageAttachments");
  if (subject) subject.value = "";
  setRichMessageHtml("");
  if (files) files.value = "";
}

function confirmarSalidaMensajes(secDestino = "") {
  if (seccionActual !== "mensajes" || secDestino === "mensajes" || !hayBorradorMensajeProfesor()) return true;
  return confirm("Tienes un mensaje sin enviar. Si sales de Mensajes se borrará el asunto, el contenido y los adjuntos escritos. ¿Deseas salir de todos modos?");
}

function activarNav(sec) {
  if (!confirmarSalidaMensajes(sec)) return false;
  if (!modoAdmin && !aulaActualValida() && ["diagnostico", "nivel1", "examen"].includes(sec)) {
    sec = "examenes";
    setTimeout(() => {
      const locked = document.getElementById("examsLockedMsg");
      if (locked) {
        locked.hidden = false;
        locked.textContent = "Primero debes pertenecer a una clase o aula.";
      }
    }, 0);
  }
  if (!modoAdmin && !aulaActualValida() && ["inicio", "estadisticas"].includes(sec)) {
    sec = "configuracion";
    setTimeout(() => {
      const status = document.getElementById("settingsClassStatus");
      if (status) status.textContent = "Primero debes pertenecer a una clase o aula. Ingresa el código cuando lo tengas.";
    }, 0);
  }
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === sec));
  mostrarSeccion(sec);
  return true;
}

function seccionRestaurable() {
  const fallback = modoAdmin ? "admin" : "inicio";
  const guardada = localStorage.getItem(STORAGE_SECCION_ACTIVA) || "";
  const permitidas = modoAdmin ? SECCIONES_PROFESOR : SECCIONES_ESTUDIANTE;
  if (!permitidas.has(guardada)) return fallback;
  if (!modoAdmin && !aulaActualValida() && ["diagnostico", "nivel1", "examen", "estadisticas"].includes(guardada)) {
    return "configuracion";
  }
  return guardada;
}

function cerrarAccordions() {
  document.querySelectorAll("details.accordion-card, details.profile-panel, details.phone-panel").forEach(details => {
    details.open = false;
  });
}

function aplicarModoUsuario() {
  document.body.classList.toggle("admin-mode", modoAdmin);
  document.getElementById("advisorWidget")?.classList.toggle("hidden", !usuarioActual);
  actualizarGrupoActualPanel();
  actualizarBienvenida();
  actualizarDrawer();
}

function actualizarGrupoActualPanel() {
  const panel = document.getElementById("grupoActualPanel");
  if (!panel) return;
  if (modoAdmin || !aulaActualValida()) {
    panel.hidden = true;
    panel.textContent = "";
    return;
  }
  panel.hidden = false;
  const claseTxt = claseActualInfo?.name || perfilActual?.className || nombreAulaPorId();
  panel.textContent = `${claseTxt} · ${NOMBRES_BANCOS[bancoActivo]}`;
}

function actualizarBienvenida() {
  const panel = document.getElementById("welcomePanel");
  const titulo = document.getElementById("welcomeTitle");
  const texto = document.getElementById("studentWelcomeText");
  const foto = document.getElementById("studentWelcomePhoto");
  if (!panel || !titulo) return;
  if (modoAdmin) {
    panel.hidden = true;
    return;
  }
  const nombreBase = perfilActual?.displayName || usuarioActual?.displayName || "estudiante";
  const primerNombre = nombreBase.trim().split(/\s+/)[0] || "estudiante";
  titulo.textContent = `Bienvenido ${primerNombre}`;
  if (foto) {
    foto.src = perfilActual?.photoURL || usuarioActual?.photoURL || "assets/icon-180.png";
    foto.alt = `Foto de perfil de ${primerNombre}`;
  }
  if (texto) {
    texto.textContent = aulaActualValida()
      ? "Desde aquí puedes presentar los exámenes habilitados por tu profesor, revisar tu avance, recibir mensajes del aula, consultar estadísticas y apoyarte en el Asesor IA para estudiar mejor."
      : "Completa tu perfil y entra a un aula con el código de tu profesor para desbloquear exámenes, mensajes, estadísticas y herramientas de estudio.";
  }
  panel.hidden = false;
  actualizarBancoEstudiante();
}

function renderExamenesHub() {
  const locked = document.getElementById("examsLockedMsg");
  const intro = document.getElementById("examsHubIntro");
  const studentHub = document.getElementById("studentExamHub");
  const adminPanel = document.getElementById("adminExamBankPanel");
  if (modoAdmin) {
    if (locked) locked.hidden = true;
    if (intro) intro.textContent = "Consulta los bancos de preguntas organizados por banco y nivel.";
    studentHub?.classList.add("hidden");
    adminPanel?.classList.remove("hidden");
    renderAdminExamBanks();
    return;
  }
  studentHub?.classList.remove("hidden");
  adminPanel?.classList.add("hidden");
  const sinAula = !aulaActualValida();
  if (locked) {
    locked.hidden = !sinAula;
    locked.textContent = "Primero debes pertenecer a una clase o aula.";
  }
  if (intro) {
    intro.textContent = sinAula
      ? "Cuando ingreses el código de aula, podrás presentar los exámenes habilitados por tu profesor."
      : "Elige el examen que vas a presentar o revisar.";
  }
  document.querySelectorAll("[data-go-exam]").forEach(btn => {
    btn.disabled = sinAula;
    btn.classList.toggle("disabled", sinAula);
  });
}

function renderAsesorInfo() {
  const section = document.getElementById("sectionAsesorIA");
  if (!section) return;
  const intro = section.querySelector(".asesor-info-panel > p");
  const grid = section.querySelector(".advisor-feature-grid");
  if (modoAdmin) {
    if (intro) intro.textContent = "Tu asistente docente te ayuda a planear clases, crear evaluaciones, preparar comunicaciones y diseñar actividades matemáticas.";
    if (grid) {
      grid.innerHTML = [
        ["Planear clases", "Estructura objetivos, tiempos, explicación, práctica guiada y cierre."],
        ["Crear exámenes", "Diseña evaluaciones con opciones, soluciones y niveles de dificultad."],
        ["Redactar correos", "Prepara mensajes claros para estudiantes según tus indicaciones."],
        ["Diseñar actividades", "Crea talleres, guías, rúbricas y ejercicios por tema."],
        ["Retroalimentar grupos", "Convierte métricas o resultados en recomendaciones pedagógicas."]
      ].map(([title, text]) => `<article><strong>${title}</strong><span>${text}</span></article>`).join("");
    }
    return;
  }
  if (intro) intro.textContent = "Tu tutor de matemáticas está listo para ayudarte a estudiar, resolver dudas y practicar con intención.";
  if (grid) {
    grid.innerHTML = [
      ["Resolver preguntas", "Pega un enunciado y recibe explicación paso a paso."],
      ["Ejercicios tipo examen", "Pide preguntas por tema, cantidad y dificultad."],
      ["Practicar por tema", "Entrena álgebra, funciones, geometría, probabilidad y más."],
      ["Revisar errores", "Entiende por qué fallaste y cómo evitarlo en el examen."],
      ["Plan de estudio", "Organiza una ruta corta según tus temas flojos."]
    ].map(([title, text]) => `<article><strong>${title}</strong><span>${text}</span></article>`).join("");
  }
}

function preguntasNivelMedioParaBanco(banco, aulaId = adminClaseActiva || grupoActivo || "aula") {
  const semilla = `${aulaId || "aula"}-${banco}`;
  const idx = [...semilla].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5 + 1;
  return PREGUNTAS_MEDIO_GRUPOS[`grupo${idx}`] || PREGUNTAS_MEDIO_GRUPOS.grupo1;
}

function renderQuestionPreviewList(preguntas) {
  return preguntas.map(q => `
    <details class="accordion-card question-preview">
      <summary>Pregunta ${q.id}</summary>
      <p>${q.pregunta || ""}</p>
      ${q.formula ? `<div class="q-formula">${q.formula}</div>` : ""}
      <ol type="A">
        ${q.opciones.map((opcion, idx) => `<li class="${idx === q.correcta ? "correct-answer" : ""}">${opcion}</li>`).join("")}
      </ol>
    </details>
  `).join("");
}

function renderAdminExamBanks() {
  const cont = document.getElementById("adminExamBankPanel");
  if (!cont) return;
  const niveles = [
    ["diagnostico", "Diagnóstico", () => PREGUNTAS],
    ["nivel1", "Nivel Medio", banco => preguntasNivelMedioParaBanco(banco)],
    ["examen", "Examen Final", () => PREGUNTAS_EXAMEN]
  ];
  cont.innerHTML = BANCOS_DISPONIBLES.map(banco => `
    <details class="accordion-card admin-bank-card">
      <summary>${NOMBRES_BANCOS[banco]}</summary>
      <div class="admin-bank-levels">
        ${niveles.map(([clave, nombre, resolver]) => {
          const preguntas = resolver(banco);
          return `
            <details class="accordion-card admin-level-card">
              <summary>${nombre} · ${preguntas.length} preguntas</summary>
              <div class="question-preview-list" data-admin-bank="${banco}" data-admin-level="${clave}">
                ${renderQuestionPreviewList(preguntas)}
              </div>
            </details>
          `;
        }).join("")}
      </div>
    </details>
  `).join("");
  reRenderKatex(cont);
}

function continuarSinAula() {
  document.getElementById("loginCard")?.classList.add("hidden");
  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  activarNav("perfil");
}

function actualizarBancoEstudiante() {
  const title = document.getElementById("studentBankTitle");
  const text = document.getElementById("studentBankText");
  const progress = document.getElementById("studentBankProgress");
  const prev = document.getElementById("btnBancoAnterior");
  const next = document.getElementById("btnBancoSiguiente");
  if (!title || !text || !progress || !prev || !next) return;
  const idx = indiceBancoActivo();
  const completado = bancoCompletado();
  title.textContent = `${NOMBRES_BANCOS[bancoActivo]} (${idx + 1} de ${BANCOS_DISPONIBLES.length})`;
  text.textContent = completado
    ? "Este banco ya está completo. Puedes revisar sus resultados o avanzar al siguiente banco."
    : "Completa diagnóstico, nivel medio y examen final para avanzar al siguiente banco.";
  const items = [
    ["diagnostico", "Diagnóstico"],
    ["nivel1", "Nivel Medio"],
    ["examen", "Examen Final"]
  ];
  progress.innerHTML = items.map(([clave, nombre]) => {
    const hecho = (resultadosSesion[claveResultado(clave)]?.intentos || []).length > 0;
    return `<div class="bank-progress-item ${hecho ? "done" : ""}">${hecho ? "✓" : "○"} ${nombre}</div>`;
  }).join("");
  prev.disabled = idx === 0;
  next.disabled = !completado || idx === BANCOS_DISPONIBLES.length - 1;
}

function abrirDrawer() {
  document.getElementById("sideDrawer")?.classList.remove("hidden");
  document.getElementById("drawerBackdrop")?.classList.remove("hidden");
}

function cerrarDrawer() {
  document.getElementById("sideDrawer")?.classList.add("hidden");
  document.getElementById("drawerBackdrop")?.classList.add("hidden");
}

function actualizarDrawer() {
  const name = document.getElementById("drawerUserName");
  if (name) name.textContent = perfilActual?.displayName || usuarioActual?.displayName || APP_CONFIG.name;
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !modoAdmin));
  document.querySelectorAll(".student-only").forEach(el => el.classList.toggle("hidden", modoAdmin));
}

function renderAdminWelcome() {
  const title = document.getElementById("adminWelcomeTitle");
  const img = document.getElementById("adminWelcomePhoto");
  if (!title || !img) return;
  const nombre = perfilActual?.displayName || usuarioActual?.displayName || "Profesor";
  title.textContent = `Bienvenido, ${nombre}`;
  img.src = perfilActual?.photoData || usuarioActual?.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23e8f0fb'/%3E%3Ctext x='60' y='70' text-anchor='middle' font-size='46' fill='%23003865'%3E%F0%9F%91%A8%E2%80%8D%F0%9F%8F%AB%3C/text%3E%3C/svg%3E";
}

function renderConfiguracion() {
  document.querySelector(".student-settings")?.classList.toggle("hidden", modoAdmin);
  document.getElementById("adminSettingsPanel")?.classList.toggle("hidden", !modoAdmin);
  actualizarEstadoNotificaciones();
  if (modoAdmin) renderAdminPanel();
  else {
    document.getElementById("settingsBankPanel")?.classList.toggle("hidden", !aulaActualValida());
    document.getElementById("createPasswordSection")?.classList.toggle("hidden", tienePasswordActual());
    document.getElementById("updatePasswordSection")?.classList.toggle("hidden", !tienePasswordActual());
    actualizarBancoEstudiante();
  }
}

function soporteNotificaciones() {
  return "Notification" in window;
}

function notificationStatusId() {
  return modoAdmin ? "adminNotificationStatus" : "studentNotificationStatus";
}

function actualizarEstadoNotificaciones() {
  const supported = soporteNotificaciones();
  const enabled = !!perfilActual?.notificationsEnabled && supported && Notification.permission === "granted";
  document.querySelectorAll("[data-notification-toggle]").forEach(toggle => {
    toggle.checked = enabled;
    toggle.disabled = !supported;
  });
  const statusId = notificationStatusId();
  const status = document.getElementById(statusId);
  if (!status) return;
  status.classList.toggle("error", !supported || Notification.permission === "denied");
  if (!supported) status.textContent = "Este navegador no permite notificaciones.";
  else if (Notification.permission === "denied") status.textContent = "El permiso está bloqueado. Actívalo desde la configuración del navegador o dispositivo.";
  else if (enabled) status.textContent = "Notificaciones activadas.";
  else status.textContent = "Notificaciones desactivadas.";
}

async function cambiarNotificaciones(e) {
  if (!usuarioActual) return;
  const toggle = e.target;
  const quiereActivar = toggle.checked;
  const status = document.getElementById(toggle.id === "adminNotificationToggle" ? "adminNotificationStatus" : "studentNotificationStatus");
  if (!soporteNotificaciones()) {
    toggle.checked = false;
    if (status) {
      status.textContent = "Este navegador no permite notificaciones.";
      status.classList.add("error");
    }
    return;
  }
  if (!quiereActivar) {
    await guardarPerfilUsuario({ notificationsEnabled: false, notificationPermission: Notification.permission });
    actualizarEstadoNotificaciones();
    return;
  }
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    toggle.checked = false;
    await guardarPerfilUsuario({ notificationsEnabled: false, notificationPermission: permission });
    actualizarEstadoNotificaciones();
    return;
  }
  await guardarPerfilUsuario({ notificationsEnabled: true, notificationPermission: permission });
  actualizarEstadoNotificaciones();
  try {
    new Notification(APP_CONFIG.name, {
      body: "Notificaciones activadas correctamente.",
      icon: "assets/icon-180.png"
    });
  } catch {
    // Algunos navegadores aceptan el permiso pero bloquean la notificación de prueba.
  }
}

function lanzarNotificacionLocal(title, body) {
  if (!perfilActual?.notificationsEnabled || !soporteNotificaciones() || Notification.permission !== "granted") return;
  try {
    new Notification(title || APP_CONFIG.name, { body, icon: "assets/icon-180.png" });
  } catch {
    // El navegador puede bloquear notificaciones aunque el permiso exista.
  }
}

function detenerListenersComunicacion() {
  if (unsubscribeNotifications) unsubscribeNotifications();
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeReplies) unsubscribeReplies();
  unsubscribeNotifications = null;
  unsubscribeMessages = null;
  unsubscribeReplies = null;
}

function iniciarListenersComunicacion() {
  if (!usuarioActual?.email) return;
  detenerListenersComunicacion();
  const email = usuarioActual.email.toLowerCase();
  unsubscribeNotifications = onSnapshot(
    query(collection(db, "notifications"), where("targetEmail", "==", email)),
    snap => {
      const prevUnread = internalNotifications.filter(n => !n.read).length;
      internalNotifications = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderNotificationBell();
      const latestUnread = internalNotifications.find(n => !n.read);
      if (latestUnread && internalNotifications.filter(n => !n.read).length > prevUnread) {
        lanzarNotificacionLocal(latestUnread.title || APP_CONFIG.name, latestUnread.body || "Tienes una nueva notificación.");
        if (latestUnread.messageId && latestUnread.messageId === activeMessageId) {
          cargarRespuestasDelMensaje(activeMessageId).then(() => renderMessageDetail(activeMessageId));
        }
      }
    },
    err => console.warn("No se pudieron escuchar notificaciones.", err)
  );
  const messageQuery = modoAdmin
    ? query(collection(db, "classMessages"), where("ownerUid", "==", usuarioActual.uid))
    : query(collection(db, "classMessages"), where("toEmails", "array-contains", email));
  unsubscribeMessages = onSnapshot(messageQuery, snap => {
    internalMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderMessagesPanel();
  }, err => console.warn("No se pudieron escuchar mensajes.", err));
  const repliesQuery = modoAdmin
    ? query(collection(db, "messageReplies"), where("ownerUid", "==", usuarioActual.uid))
    : query(collection(db, "messageReplies"), where("fromEmail", "==", email));
  unsubscribeReplies = onSnapshot(repliesQuery, snap => {
    internalReplies = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    renderMessagesPanel();
    if (activeMessageId) renderMessageDetail(activeMessageId);
  }, err => console.warn("No se pudieron escuchar respuestas.", err));
}

function mezclarRespuestas(respuestas = []) {
  const merged = new Map(internalReplies.map(reply => [reply.id, reply]));
  respuestas.forEach(reply => merged.set(reply.id, reply));
  internalReplies = [...merged.values()]
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
}

function renderNotificationBell() {
  const bell = document.getElementById("btnNotificationBell");
  const dot = document.getElementById("notificationDot");
  if (!bell || !dot) return;
  bell.classList.toggle("hidden", !usuarioActual);
  dot.hidden = !internalNotifications.some(n => !n.read);
}

function toggleNotificationsPopover(force) {
  const pop = document.getElementById("notificationsPopover");
  if (!pop) return;
  const open = typeof force === "boolean" ? force : pop.classList.contains("hidden");
  pop.classList.toggle("hidden", !open);
  if (open) renderNotificationsList();
}

function renderNotificationsList() {
  const cont = document.getElementById("notificationsList");
  if (!cont) return;
  if (!internalNotifications.length) {
    cont.innerHTML = `<p class="mini-help">No tienes notificaciones.</p>`;
    return;
  }
  cont.innerHTML = internalNotifications.map(n => `
    <button type="button" class="notification-item ${n.read ? "" : "unread"}" data-notification-id="${n.id}">
      <strong>${escapeHtml(n.title || "Notificación")}</strong>
      <span>${escapeHtml(n.body || "")}</span>
    </button>
  `).join("");
}

async function abrirNotificacion(id) {
  const item = internalNotifications.find(n => n.id === id);
  if (!item) return;
  await updateDoc(doc(db, "notifications", id), { read: true, readAt: serverTimestamp() }).catch(() => {});
  toggleNotificationsPopover(false);
  if (item.messageId) {
    activarNav("mensajes");
    abrirDetalleMensaje(item.messageId);
    return;
  }
  activarNav("mensajes");
}

function archivoSeguro(nombre = "archivo") {
  return nombre.replace(/[^\w.\-]+/g, "_").slice(0, 90);
}

async function subirAdjuntos(files, folder) {
  const list = [...(files || [])];
  const attachments = [];
  for (const file of list) {
    if (file.size > MAX_MESSAGE_ATTACHMENT_MB * 1024 * 1024) {
      throw new Error(`El archivo ${file.name} supera ${MAX_MESSAGE_ATTACHMENT_MB} MB.`);
    }
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${archivoSeguro(file.name)}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
    attachments.push({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url: await getDownloadURL(ref),
      path
    });
  }
  return attachments;
}

async function estudiantesActivosDeClase(classId) {
  const snap = await getDocs(query(collection(db, "classStudents"), where("classId", "==", classId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(est => (est.status || "activo") === "activo" && est.email);
}

async function crearNotificacion(payload) {
  await setDoc(doc(collection(db, "notifications")), {
    ...payload,
    read: false,
    createdAt: serverTimestamp()
  });
}

function renderMessagesPanel() {
  const compose = document.getElementById("teacherMessageCompose");
  const intro = document.getElementById("messagesIntro");
  const list = document.getElementById("messageThreadList");
  if (!list) return;
  compose?.classList.toggle("hidden", !modoAdmin);
  if (intro) intro.textContent = modoAdmin
    ? "Envía mensajes internos por aula. Los estudiantes responden únicamente desde la app."
    : "Lee mensajes de tu profesor y responde internamente desde la app.";
  const select = document.getElementById("messageClassSelect");
  if (select && modoAdmin) {
    select.innerHTML = adminClases.length
      ? adminClases.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code || "")})</option>`).join("")
      : `<option value="">Sin aulas creadas</option>`;
    select.value = adminClaseActiva || adminClases[0]?.id || "";
  }
  if (!internalMessages.length) {
    list.innerHTML = `<p class="mini-help">Aún no hay mensajes.</p>`;
    return;
  }
  list.innerHTML = internalMessages.map(msg => `
    <article class="message-thread-card">
      <button type="button" data-open-message="${msg.id}">
        <strong>${escapeHtml(msg.subject || "Sin asunto")}</strong>
        <span>${escapeHtml(msg.className || "Aula")} · ${escapeHtml(msg.fromName || msg.teacherName || "Profesor")}</span>
        <small>${escapeHtml((msg.body || "").slice(0, 130))}</small>
      </button>
    </article>
  `).join("");
}

function renderAttachments(attachments = []) {
  if (!attachments.length) return "";
  return `<div class="message-attachments">${attachments.map(a =>
    `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.name || "Adjunto")}</a>`
  ).join("")}</div>`;
}

function sanitizeRichHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const allowedTags = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "FONT", "H1", "H2", "H3", "H4",
    "HR", "I", "IFRAME", "IMG", "LI", "OL", "P", "S", "SPAN", "STRONG", "SUB",
    "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "U", "UL"
  ]);
  const allowedAttrs = new Set(["href", "src", "alt", "title", "target", "rel", "class", "style", "data-latex", "data-rich-control", "data-table-action", "contenteditable", "face", "size"]);
  const safeUrl = value => /^(https?:|data:image\/)/i.test(String(value || ""));
  const cleanNode = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }
        [...child.attributes].forEach(attr => {
          const name = attr.name.toLowerCase();
          const value = attr.value;
          const isUrl = name === "href" || name === "src";
          if (!allowedAttrs.has(name) || (isUrl && !safeUrl(value))) {
            child.removeAttribute(attr.name);
          }
        });
        if (child.tagName === "A") {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener");
        }
        if (child.tagName === "IFRAME") {
          child.setAttribute("loading", "lazy");
          child.setAttribute("allowfullscreen", "true");
        }
        cleanNode(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    });
  };
  cleanNode(template.content);
  return template.innerHTML.trim();
}

function richEditor() {
  return document.getElementById("messageBody");
}

function richMessageHtml() {
  const clone = richEditor()?.cloneNode(true);
  if (!clone) return "";
  clone.querySelectorAll("[data-rich-control]").forEach(node => node.remove());
  clone.querySelectorAll(".rich-table-wrap, .math-wrap").forEach(node => {
    node.removeAttribute("contenteditable");
  });
  clone.querySelectorAll(".rich-table").forEach(node => {
    node.removeAttribute("contenteditable");
  });
  return sanitizeRichHtml(clone.innerHTML || "");
}

function richMessageText() {
  return (richEditor()?.innerText || "").replace(/\u00a0/g, " ").trim();
}

function richMessageHasContent() {
  const html = richMessageHtml();
  return !!(richMessageText() || /<(img|iframe|table|span|div)[\s>]/i.test(html));
}

function setRichMessageHtml(html = "") {
  const editor = richEditor();
  if (!editor) return;
  editor.innerHTML = html;
  if (!html) resetRichEditorDefaults();
}

function focusRichEditor() {
  const editor = richEditor();
  if (!editor) return null;
  editor.focus();
  if (savedRichSelection) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRichSelection);
  }
  return editor;
}

function execRich(command, value = null) {
  focusRichEditor();
  document.execCommand(command, false, value);
  saveRichSelection();
  updateRichToolbarState();
}

function resetRichEditorDefaults() {
  const editor = richEditor();
  if (!editor) return;
  editor.style.textAlign = "left";
  savedRichSelection = null;
  ["bold", "italic", "underline", "strikeThrough"].forEach(command => {
    try {
      if (document.queryCommandState(command)) document.execCommand(command, false, null);
    } catch {
      // El navegador puede no permitir consultar un comando sin foco.
    }
  });
  setTimeout(updateRichToolbarState, 0);
}

function setRichPanel(panel = "editar") {
  const toolbar = document.querySelector(".message-toolbar");
  if (!toolbar) return;
  toolbar.dataset.activePanel = panel;
  document.querySelectorAll("[data-rich-panel]").forEach(btn => {
    const active = btn.dataset.richPanel === panel;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function enfocarEditorAlFinal() {
  const editor = richEditor();
  if (!editor) return;
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  saveRichSelection();
}

function normalizarLatexPlantilla(latex = "") {
  return String(latex || "")
    .replace(/\\\\([a-zA-Z]+)/g, "\\$1")
    .replace(/\\\\,/g, "\\,")
    .replace(/\\\\to/g, "\\to");
}

function renderRichMessage(html = "", fallbackText = "") {
  const safe = sanitizeRichHtml(html);
  return safe ? safe : renderMarkdownBasico(fallbackText || "");
}

function saveRichSelection() {
  const editor = richEditor();
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    savedRichSelection = range.cloneRange();
  }
}

function updateRichToolbarState() {
  const editor = richEditor();
  const emptyEditor = !richMessageHasContent();
  const commands = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"];
  commands.forEach(command => {
    const btn = document.querySelector(`[data-rich-command="${command}"]`);
    if (!btn) return;
    let active = false;
    try {
      active = document.queryCommandState(command);
    } catch {
      active = false;
    }
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (editor && emptyEditor) editor.style.textAlign = "left";
}

async function cargarRespuestasDelMensaje(messageId) {
  if (!messageId) return;
  try {
    const snap = await getDocs(query(collection(db, "messageReplies"), where("messageId", "==", messageId)));
    mezclarRespuestas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.warn("No se pudieron cargar todas las respuestas del mensaje.", err);
  }
}

function setReplyFormEnabled(enabled, message = "") {
  const form = document.getElementById("messageReplyForm");
  const body = document.getElementById("messageReplyBody");
  const files = document.getElementById("messageReplyAttachments");
  const button = form?.querySelector("button[type='submit']");
  const status = document.getElementById("messageReplyStatus");
  form?.classList.toggle("reply-disabled", !enabled);
  if (body) body.disabled = !enabled;
  if (files) files.disabled = !enabled;
  if (button) button.disabled = !enabled;
  if (status) {
    status.textContent = message;
    status.classList.toggle("error", !enabled && !!message);
  }
}

async function destinatariosActivosMensaje(msg) {
  if (!msg?.classId) return [];
  const activos = await estudiantesActivosDeClase(msg.classId);
  const permitidos = new Set((msg.toEmails || []).map(email => String(email || "").toLowerCase()));
  return activos.filter(est => permitidos.has(String(est.email || "").toLowerCase()));
}

async function actualizarEstadoRespuestaMensaje(messageId) {
  const msg = internalMessages.find(m => m.id === messageId);
  if (!msg || activeMessageId !== messageId) return;
  if (modoAdmin) {
    const activos = await destinatariosActivosMensaje(msg).catch(() => []);
    if (activeMessageId !== messageId) return;
    setReplyFormEnabled(
      activos.length > 0,
      activos.length ? "" : "No puedes responder: ya no hay estudiantes activos de esta aula en este hilo."
    );
    return;
  }
  const puedeResponder = aulaActualValida() && classMembershipValid && msg.classId === claseActiva;
  setReplyFormEnabled(
    puedeResponder,
    puedeResponder ? "" : "No puedes responder: ya no perteneces a esta aula."
  );
}

function renderMessageDetail(messageId) {
  const msg = internalMessages.find(m => m.id === messageId);
  if (!msg) return;
  activeMessageId = messageId;
  const cont = document.getElementById("messageDetailContent");
  const overlay = document.getElementById("messageDetailOverlay");
  if (!cont || !overlay) return;
  const replies = internalReplies.filter(r => r.messageId === messageId);
  const replyInput = document.getElementById("messageReplyBody");
  if (replyInput) {
    replyInput.placeholder = modoAdmin
      ? "Responder internamente al estudiante"
      : "Responder internamente al profesor";
  }
  cont.innerHTML = `
    <h2>${escapeHtml(msg.subject || "Mensaje")}</h2>
    <p class="mini-help">${escapeHtml(msg.className || "Aula")} · ${escapeHtml(msg.fromName || msg.teacherName || "Profesor")}</p>
    <div class="message-body rich-message-output">${renderRichMessage(msg.bodyHtml, msg.body || "")}</div>
    ${renderAttachments(msg.attachments)}
    <h3>Respuestas</h3>
    <div class="message-replies">
      ${replies.length ? replies.map(reply => `
        <article class="${reply.fromUid === usuarioActual?.uid ? "own" : ""}">
          <strong>${escapeHtml(reply.fromName || reply.fromEmail || "Usuario")}</strong>
          <div>${renderMarkdownBasico(reply.body || "")}</div>
          ${renderAttachments(reply.attachments)}
        </article>
      `).join("") : `<p class="mini-help">Aún no hay respuestas.</p>`}
    </div>
  `;
  reRenderKatex(cont);
  document.getElementById("messageReplyForm")?.classList.toggle("hidden", false);
  setReplyFormEnabled(true, "");
  overlay.classList.remove("hidden");
  actualizarEstadoRespuestaMensaje(messageId);
}

async function abrirDetalleMensaje(messageId) {
  activeMessageId = messageId;
  await cargarRespuestasDelMensaje(messageId);
  renderMessageDetail(messageId);
}

async function enviarMensajeAula() {
  const status = document.getElementById("messageComposeStatus");
  const classId = document.getElementById("messageClassSelect")?.value || adminClaseActiva;
  const clase = aulaPorId(classId);
  const subject = document.getElementById("messageSubject")?.value.trim() || "";
  const body = richMessageText();
  const bodyHtml = richMessageHtml();
  if (!clase || !subject || !richMessageHasContent()) {
    if (status) status.textContent = "Selecciona aula, asunto y mensaje.";
    return;
  }
  const students = await estudiantesActivosDeClase(classId);
  if (!students.length) {
    if (status) status.textContent = "Esta aula aún no tiene estudiantes activos.";
    return;
  }
  if (status) status.textContent = "Enviando mensaje...";
  try {
    const ref = doc(collection(db, "classMessages"));
    const teacherName = perfilActual?.displayName || usuarioActual?.displayName || usuarioActual?.email || "Profesor";
    await setDoc(ref, {
      classId,
      className: clase.name,
      ownerUid: usuarioActual.uid,
      teacherEmail: usuarioActual.email,
      fromUid: usuarioActual.uid,
      fromEmail: usuarioActual.email,
      fromName: teacherName,
      toEmails: students.map(s => s.email.toLowerCase()),
      subject,
      body,
      bodyHtml,
      attachments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const attachments = await subirAdjuntos(document.getElementById("messageAttachments")?.files, `classMessages/${ref.id}`);
    if (attachments.length) {
      await updateDoc(ref, {
        attachments,
        updatedAt: serverTimestamp()
      });
    }
    await Promise.all(students.map(est => crearNotificacion({
      targetEmail: est.email.toLowerCase(),
      targetUid: est.userUid || "",
      type: "class-message",
      title: subject,
      body: `Nuevo mensaje de ${teacherName} en ${clase.name}.`,
      messageId: ref.id,
      classId
    })));
    document.getElementById("messageSubject").value = "";
    setRichMessageHtml("");
    document.getElementById("messageAttachments").value = "";
    if (status) status.textContent = `Mensaje enviado a ${students.length} estudiante(s).`;
  } catch (err) {
    console.error(err);
    if (status) status.textContent = err.message || "No se pudo enviar el mensaje.";
  }
}

async function responderMensaje(e) {
  e.preventDefault();
  const status = document.getElementById("messageReplyStatus");
  const msg = internalMessages.find(m => m.id === activeMessageId);
  const body = document.getElementById("messageReplyBody")?.value.trim() || "";
  if (!msg || !body) {
    if (status) status.textContent = "Escribe una respuesta.";
    return;
  }
  let estudiantesDestino = [];
  if (modoAdmin) {
    estudiantesDestino = await destinatariosActivosMensaje(msg);
    if (!estudiantesDestino.length) {
      setReplyFormEnabled(false, "No puedes responder: ya no hay estudiantes activos de esta aula en este hilo.");
      return;
    }
  } else if (!aulaActualValida() || !classMembershipValid || msg.classId !== claseActiva) {
    setReplyFormEnabled(false, "No puedes responder: ya no perteneces a esta aula.");
    return;
  }
  if (status) {
    status.textContent = "Enviando respuesta...";
    status.classList.remove("error");
  }
  try {
    const ref = doc(collection(db, "messageReplies"));
    const fromName = perfilActual?.displayName || usuarioActual?.displayName || usuarioActual?.email || "Usuario";
    await setDoc(ref, {
      messageId: msg.id,
      classId: msg.classId,
      ownerUid: msg.ownerUid,
      fromUid: usuarioActual.uid,
      fromEmail: usuarioActual.email,
      fromName,
      body,
      attachments: [],
      createdAt: serverTimestamp()
    });
    const attachments = await subirAdjuntos(document.getElementById("messageReplyAttachments")?.files, `messageReplies/${ref.id}`);
    if (attachments.length) {
      await updateDoc(ref, { attachments });
    }
    if (modoAdmin) {
      await Promise.all(estudiantesDestino.map(est => crearNotificacion({
        targetEmail: est.email.toLowerCase(),
        targetUid: est.userUid || "",
        type: "message-reply",
        title: `Respuesta a: ${msg.subject || "mensaje"}`,
        body: `${fromName} respondió en el hilo del aula.`,
        messageId: msg.id,
        classId: msg.classId
      })));
    } else if (msg.teacherEmail) {
      await crearNotificacion({
        targetEmail: msg.teacherEmail.toLowerCase(),
        targetUid: msg.ownerUid || "",
        type: "message-reply",
        title: `Respuesta a: ${msg.subject || "mensaje"}`,
        body: `${fromName} respondió tu mensaje.`,
        messageId: msg.id,
        classId: msg.classId
      });
    }
    document.getElementById("messageReplyBody").value = "";
    document.getElementById("messageReplyAttachments").value = "";
    if (status) status.textContent = "Respuesta enviada.";
  } catch (err) {
    console.error(err);
    if (status) status.textContent = err.message || "No se pudo enviar la respuesta.";
  }
}

function insertarHtmlEnEditor(html = "") {
  if (!savedRichSelection) enfocarEditorAlFinal();
  focusRichEditor();
  document.execCommand("insertHTML", false, html);
  saveRichSelection();
}

function enfocarEditorDespuesDeInsercion() {
  const editor = richEditor();
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  editor.focus();
  const range = selection.getRangeAt(0);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  saveRichSelection();
}

function videoEmbedUrl(url = "") {
  const raw = String(url || "").trim();
  const youtube = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = raw.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return raw;
}

function insertarTablaMensaje() {
  const rows = Math.max(1, Math.min(8, Number(prompt("Número de filas", "3")) || 3));
  const cols = Math.max(1, Math.min(8, Number(prompt("Número de columnas", "3")) || 3));
  const cells = "<td><br></td>".repeat(cols);
  insertarHtmlEnEditor(`
    <div class="rich-table-wrap">
      <button class="rich-remove-btn" type="button" data-rich-control="delete-table" title="Eliminar tabla">×</button>
      <div class="rich-table-tools" data-rich-control="table-tools" contenteditable="false">
        <button type="button" data-rich-control="table-action" data-table-action="add-row">+ fila</button>
        <button type="button" data-rich-control="table-action" data-table-action="remove-row">- fila</button>
        <button type="button" data-rich-control="table-action" data-table-action="add-col">+ columna</button>
        <button type="button" data-rich-control="table-action" data-table-action="remove-col">- columna</button>
      </div>
      <table class="rich-table" contenteditable="true"><tbody>${`<tr>${cells}</tr>`.repeat(rows)}</tbody></table>
    </div><p><br></p>`);
}

function tablaDesdeNodo(node) {
  return node?.closest?.(".rich-table-wrap") || null;
}

function celdaTablaDesdeSeleccion() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  let node = selection.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.("td,th") || null;
}

function tablaActiva() {
  return tablaDesdeNodo(celdaTablaDesdeSeleccion()) || richEditor()?.querySelector(".rich-table-wrap:last-of-type");
}

function modificarTabla(action, tableWrap = tablaActiva()) {
  const table = tableWrap?.querySelector("table");
  if (!table) return;
  const rows = [...table.rows];
  const selectedCell = celdaTablaDesdeSeleccion();
  const selectedRow = selectedCell?.parentElement || rows[rows.length - 1];
  const colIndex = selectedCell ? selectedCell.cellIndex : Math.max(0, (rows[0]?.cells.length || 1) - 1);
  if (action === "delete") {
    tableWrap.remove();
    saveRichSelection();
    return;
  }
  if (action === "add-row") {
    const refRow = selectedRow || table.rows[table.rows.length - 1];
    const cols = Math.max(1, refRow?.cells.length || rows[0]?.cells.length || 1);
    const row = table.insertRow(refRow ? refRow.rowIndex + 1 : -1);
    for (let i = 0; i < cols; i++) row.insertCell(i).innerHTML = "<br>";
  }
  if (action === "remove-row" && rows.length > 1 && selectedRow) {
    table.deleteRow(selectedRow.rowIndex);
  }
  if (action === "add-col") {
    rows.forEach(row => row.insertCell(Math.min(colIndex + 1, row.cells.length)).innerHTML = "<br>");
  }
  if (action === "remove-col" && rows[0]?.cells.length > 1) {
    rows.forEach(row => row.deleteCell(Math.min(colIndex, row.cells.length - 1)));
  }
  saveRichSelection();
}

function insertarEmojiMensaje() {
  const search = document.getElementById("emojiSearch");
  if (search) search.value = "";
  renderEmojiPicker();
  document.getElementById("emojiOverlay")?.classList.remove("hidden");
}

function insertarLinkMensaje() {
  const url = prompt("URL del enlace", "https://");
  if (!url) return;
  execRich("createLink", url);
}

function insertarImagenMensaje() {
  const url = prompt("URL de la imagen", "https://");
  if (!url) return;
  insertarHtmlEnEditor(`<img src="${escapeHtml(url)}" alt="Imagen del mensaje" />`);
}

function insertarVideoMensaje() {
  const url = videoEmbedUrl(prompt("URL del video de YouTube, Vimeo o enlace embebible", "https://"));
  if (!url) return;
  insertarHtmlEnEditor(`<div class="rich-video"><iframe src="${escapeHtml(url)}" title="Video del mensaje"></iframe></div><p><br></p>`);
}

function ejecutarInsercionRica(tipo) {
  const acciones = {
    link: insertarLinkMensaje,
    image: insertarImagenMensaje,
    video: insertarVideoMensaje,
    table: insertarTablaMensaje,
    emoji: insertarEmojiMensaje,
    equation: abrirEditorEcuacion
  };
  acciones[tipo]?.();
}

function abrirVistaPreviaMensaje() {
  const overlay = document.getElementById("messagePreviewOverlay");
  const subject = document.getElementById("messagePreviewSubject");
  const content = document.getElementById("messagePreviewContent");
  if (!overlay || !content) return;
  if (subject) subject.textContent = document.getElementById("messageSubject")?.value.trim() || "Sin asunto";
  content.innerHTML = renderRichMessage(richMessageHtml(), richMessageText());
  overlay.classList.remove("hidden");
  reRenderKatex(content);
}

function renderEquationPreview() {
  const preview = document.getElementById("equationPreview");
  const input = document.getElementById("equationInput");
  if (!preview || !input) return;
  const raw = input.value.trim();
  const latex = normalizarLatexPlantilla(raw);
  if (input.value !== latex) input.value = latex;
  preview.textContent = "";
  if (!latex) {
    preview.innerHTML = `<span class="mini-help">Escribe una ecuación o elige una plantilla.</span>`;
    return;
  }
  try {
    if (window.katex) katex.render(latex, preview, { throwOnError: false, displayMode: true });
    else preview.textContent = latex;
  } catch {
    preview.textContent = latex;
  }
}

function abrirEditorEcuacion() {
  document.getElementById("equationOverlay")?.classList.remove("hidden");
  document.getElementById("equationInput")?.focus();
  renderEquationPreview();
}

function insertarEcuacion(displayMode = false) {
  const input = document.getElementById("equationInput");
  const latex = normalizarLatexPlantilla(input?.value.trim() || "");
  if (!latex) {
    renderEquationPreview();
    input?.focus();
    return;
  }
  const temp = document.createElement(displayMode ? "div" : "span");
  temp.className = displayMode ? "math-block" : "math-inline";
  temp.dataset.latex = latex;
  temp.contentEditable = "false";
  try {
    if (window.katex) katex.render(latex, temp, { throwOnError: false, displayMode });
    else temp.textContent = latex;
  } catch {
    temp.textContent = latex;
  }
  const wrapTag = displayMode ? "div" : "span";
  const html = `<${wrapTag} class="math-wrap ${displayMode ? "math-wrap-block" : "math-wrap-inline"}" contenteditable="false">${temp.outerHTML}<button class="rich-remove-btn math-remove" type="button" data-rich-control="delete-equation" title="Eliminar ecuación">×</button></${wrapTag}>${displayMode ? "<p><br></p>" : "&nbsp;"}`;
  insertarHtmlEnEditor(html);
  document.getElementById("equationOverlay")?.classList.add("hidden");
  enfocarEditorDespuesDeInsercion();
}

function renderEmojiPicker(filter = "") {
  const grid = document.getElementById("emojiGrid");
  if (!grid) return;
  const term = String(filter || "").trim().toLowerCase();
  const emojis = EMOJIS_MENSAJE.filter(([emoji, tags]) => !term || emoji.includes(term) || tags.includes(term));
  grid.innerHTML = emojis.map(([emoji]) => `
    <button type="button" data-emoji="${emoji}" aria-label="Insertar ${emoji}">${emoji}</button>
  `).join("") || `<p class="mini-help">Sin resultados.</p>`;
}

function renderStudentStats() {
  const cont = document.getElementById("studentStats");
  if (!cont) return;
  if (!aulaActualValida()) {
    cont.innerHTML = `<div class="stats-card"><h3>Sin aula activa</h3><p>Tu aula anterior ya no está disponible. Puedes conservar tu perfil y configuración, pero para ver métricas o presentar exámenes debes ingresar a una nueva aula con su código.</p></div>`;
    return;
  }
  const nombres = { diagnostico: "Diagnóstico", nivel1: "Nivel Medio", examen: "Examen Final" };
  cont.innerHTML = "";
  Object.entries(nombres).forEach(([clave, nombre]) => {
    const intentos = resultadosSesion[claveResultado(clave)]?.intentos || [];
    const card = document.createElement("div");
    card.className = "stats-card";
    if (!intentos.length) {
      card.innerHTML = `<h3>${nombre}</h3><p>Sin intentos registrados en ${NOMBRES_BANCOS[bancoActivo]}.</p>`;
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

document.getElementById("btnBancoAnterior")?.addEventListener("click", () => cambiarBanco(-1));
document.getElementById("btnBancoSiguiente")?.addEventListener("click", () => cambiarBanco(1));

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
  nivel1: { titulo: "Nivel Medio", descripcion: "Práctica intermedia con preguntas asignadas por aula.", requisito: "diagnostico", requisitoTexto: "Completa primero el diagnóstico." }
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
  const semilla = `${grupoActivo || claseActiva || "aula"}-${bancoActivo}`;
  const idx = [...semilla].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5 + 1;
  PREGUNTAS_NIVELES.nivel1 = PREGUNTAS_MEDIO_GRUPOS[`grupo${idx}`] || PREGUNTAS_MEDIO_GRUPOS.grupo1;
}

const GRUPOS = {};
const STORAGE_GRUPO = "preguntasUnalGrupoActivo";
const STORAGE_PERMISOS = "preguntasUnalPermisosPorAula";
const STORAGE_BANCOS = "preguntasUnalBancosPorAula";
const DEFAULT_HABILITADOS = { diagnostico: true, nivel1: false, examen: false };
const DEFAULT_BANCOS = { diagnostico: "principal", nivel1: "principal", examen: "principal" };
let permisosGrupo = cargarPermisosGrupo();
let bancosGrupo = cargarBancosGrupo();
let grupoActivo = localStorage.getItem(STORAGE_GRUPO) || "";
let modoAdmin = grupoActivo === "admin";
let adminGrupoActual = adminClaseActiva || "";
let nivelActual = "nivel1";
let nivelIniciado = false;
let nivelCompletadoVisible = false;
let timerNivelInterval = null;
let timerNivelActivo = false;
let segsNivel = DURACION_SEG;

function cargarPermisosGrupo() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PERMISOS) || "{}");
  } catch {
    localStorage.removeItem(STORAGE_PERMISOS);
    return {};
  }
}

function guardarPermisosGrupo() {
  localStorage.setItem(STORAGE_PERMISOS, JSON.stringify(permisosGrupo));
}

function cargarBancosGrupo() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_BANCOS) || "{}");
  } catch {
    localStorage.removeItem(STORAGE_BANCOS);
    return {};
  }
}

function guardarBancosGrupo() {
  localStorage.setItem(STORAGE_BANCOS, JSON.stringify(bancosGrupo));
}

async function guardarPermisoGrupoRemoto(grupo, examen, valor) {
  permisosGrupo[grupo] = { ...DEFAULT_HABILITADOS, ...(permisosGrupo[grupo] || {}), [examen]: valor };
  guardarPermisosGrupo();
  await setDoc(refPermisosGrupo(grupo), {
    permisos: permisosGrupo[grupo],
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function guardarBancoGrupoRemoto(grupo, nivel, banco) {
  bancosGrupo[grupo] = { ...DEFAULT_BANCOS, ...(bancosGrupo[grupo] || {}), [nivel]: banco };
  guardarBancosGrupo();
  await setDoc(refPermisosGrupo(grupo), {
    bancos: bancosGrupo[grupo],
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function cargarPermisosRemotos(aulas = []) {
  const permisos = {};
  const bancos = {};
  const ids = [...new Set((aulas.length ? aulas : [grupoActivo]).filter(id => id && id !== "admin"))];
  await Promise.all(ids.map(async grupo => {
    const snap = await getDoc(refPermisosGrupo(grupo));
    const data = snap.exists() ? snap.data() : {};
    permisos[grupo] = { ...DEFAULT_HABILITADOS, ...(data.permisos || {}) };
    bancos[grupo] = { ...DEFAULT_BANCOS, ...(data.bancos || {}) };
    if (!snap.exists()) {
      await setDoc(refPermisosGrupo(grupo), { permisos: permisos[grupo], bancos: bancos[grupo], updatedAt: serverTimestamp() }, { merge: true });
    }
  }));
  permisosGrupo = permisos;
  bancosGrupo = bancos;
  guardarPermisosGrupo();
  guardarBancosGrupo();
}

function escucharPermisosGrupo(grupo) {
  if (unsubscribePermisos) unsubscribePermisos();
  unsubscribePermisos = onSnapshot(refPermisosGrupo(grupo), snap => {
    const data = snap.exists() ? snap.data() : {};
    permisosGrupo[grupo] = { ...DEFAULT_HABILITADOS, ...(data.permisos || {}) };
    bancosGrupo[grupo] = { ...DEFAULT_BANCOS, ...(data.bancos || {}) };
    guardarPermisosGrupo();
    guardarBancosGrupo();
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
  return !!grupoActivo && !!{ ...DEFAULT_HABILITADOS, ...(permisosGrupo[grupoActivo] || {}) }[clave];
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
  if (!aulaActualValida()) return false;
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
  setExamHeaderActivo(true);
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
  if (!timerActivo && !timerExamenActivo) setExamHeaderActivo(false);
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
  aplicarVisibilidadResultadoIntento(nivelActual, "resultsSectionNivel", "btnRestartNivel");
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

function detallePassword(password) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    numbers: (password.match(/\d/g) || []).length >= 2,
    symbol: [...password].some(ch => SIMBOLOS_PERMITIDOS.includes(ch))
  };
}

function actualizarReglasPassword() {
  const password = document.getElementById("registerPassword")?.value || "";
  const detalle = detallePassword(password);
  Object.entries(detalle).forEach(([regla, ok]) => {
    document.querySelector(`#passwordRules [data-rule="${regla}"]`)?.classList.toggle("valid", ok);
  });
  const valido = Object.values(detalle).every(Boolean);
  const btn = document.getElementById("btnEmailRegister");
  if (btn) btn.disabled = !valido;
  return valido;
}

function actualizarReglasPasswordEn(panelId, password) {
  const detalle = detallePassword(password || "");
  Object.entries(detalle).forEach(([regla, ok]) => {
    document.querySelector(`#${panelId} [data-rule="${regla}"]`)?.classList.toggle("valid", ok);
  });
  return Object.values(detalle).every(Boolean);
}

function tienePasswordActual() {
  return usuarioActual?.providerData?.some(provider => provider.providerId === "password");
}

function mensajePasswordFirebase(err) {
  const code = err?.code || "";
  if (code.includes("requires-recent-login")) return "Por seguridad debes cerrar sesión, volver a ingresar y repetir la operación.";
  if (code.includes("provider-already-linked") || code.includes("credential-already-in-use") || code.includes("email-already-in-use")) return "Ya tiene contraseña.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "La contraseña actual no es correcta.";
  if (code.includes("weak-password")) return "La nueva contraseña no cumple los requisitos de seguridad.";
  return "No se pudo completar la operación. Revisa los datos e intenta nuevamente.";
}

function mostrarAuthInicial() {
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.getElementById("roleChoiceCard")?.classList.add("hidden");
  document.querySelector(".auth-tabs")?.classList.remove("hidden");
  document.querySelector(".auth-divider")?.classList.remove("hidden");
  document.getElementById("loginPanel")?.classList.remove("hidden");
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("tabLogin")?.classList.add("active");
  document.getElementById("tabRegister")?.classList.remove("active");
  document.getElementById("btnGoogleLogin")?.closest(".auth-actions")?.classList.remove("hidden");
  document.getElementById("groupEntry")?.classList.add("hidden");
  document.getElementById("btnAuthClose")?.classList.remove("hidden");
}

function mostrarLoginCard() {
  document.getElementById("loginCard")?.classList.remove("hidden");
  cambiarAuthMode("login");
}

function mostrarRegisterCard() {
  document.getElementById("loginCard")?.classList.remove("hidden");
  cambiarAuthMode("register");
}

function cerrarAuthCard() {
  if (usuarioActual && !grupoActivo) {
    mostrarEntradaGrupo();
    return;
  }
  document.getElementById("loginCard")?.classList.add("hidden");
}

function mostrarEntradaGrupo() {
  document.getElementById("roleChoiceCard")?.classList.add("hidden");
  document.getElementById("loginCard")?.classList.remove("hidden");
  document.getElementById("btnAuthClose")?.classList.add("hidden");
  document.querySelector(".auth-tabs")?.classList.add("hidden");
  document.querySelector(".auth-divider")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.add("hidden");
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("btnGoogleLogin")?.closest(".auth-actions")?.classList.add("hidden");
  document.getElementById("groupEntry")?.classList.remove("hidden");
  clasePendienteIngreso = null;
  document.getElementById("classCodeStep")?.classList.remove("hidden");
  document.getElementById("groupCodeStep")?.classList.add("hidden");
  document.getElementById("groupEntryText").textContent = "Cuenta validada. Ingresa el código del aula compartido por tu profesor o continúa más tarde desde configuración.";
}

function toggleLandingMenu() {
  document.querySelector(".landing-nav")?.classList.toggle("open");
}

function saludoBienvenida(nombre = "", genero = "") {
  const primero = nombre.trim().split(/\s+/)[0] || "";
  const base = genero === "Femenino" ? "¡Bienvenida nuevamente" : "¡Bienvenido nuevamente";
  return `${base}${primero ? `, ${primero}` : ""}!`;
}

function mostrarSplashBienvenida() {
  const splash = document.getElementById("welcomeSplash");
  if (!splash) return Promise.resolve();
  const nombre = perfilActual?.displayName || usuarioActual?.displayName || "estudiante";
  document.getElementById("splashTitle").textContent = saludoBienvenida(nombre, perfilActual?.gender || "");
  document.getElementById("splashText").textContent = "Nos alegra verte otra vez. Prepárate para seguir aprendiendo matemáticas.";
  splash.classList.remove("hidden");
  return new Promise(resolve => {
    setTimeout(() => {
      splash.classList.add("hidden");
      resolve();
    }, 2400);
  });
}

function mostrarWarn(msg) {
  const warn = document.getElementById("grupoWarn");
  warn.textContent = msg;
  warn.hidden = false;
}

function limpiarWarn() {
  const warn = document.getElementById("grupoWarn");
  warn.hidden = true;
  warn.classList.remove("error");
}

function setStatus(id, msg, tipo = "ok") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", tipo === "error");
}

function poblarPhoneCodes(selectId, value = "+57") {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = PHONE_CODES.map(item => `<option value="${item.code}">${item.label}</option>`).join("");
  select.value = value;
}

function sortByName(items) {
  return [...items].sort((a, b) => String(a.name || a.nombre || "").localeCompare(String(b.name || b.nombre || ""), "es"));
}

async function cargarGeoCountries() {
  if (geoCache.countries) return geoCache.countries;
  try {
    const snap = await getDocs(collection(db, "countries"));
    const countries = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    geoCache.countries = sortByName(countries.length ? countries : GEO_COUNTRY_FALLBACK);
  } catch {
    geoCache.countries = sortByName(GEO_COUNTRY_FALLBACK);
  }
  return geoCache.countries;
}

async function cargarGeoRegions(countryId) {
  if (!countryId) return [];
  if (geoCache.regions[countryId]) return geoCache.regions[countryId];
  try {
    const snap = await getDocs(collection(db, "countries", countryId, "regions"));
    geoCache.regions[countryId] = sortByName(snap.docs.map(item => ({ id: item.id, ...item.data() })));
  } catch {
    geoCache.regions[countryId] = [];
  }
  return geoCache.regions[countryId];
}

async function cargarGeoMunicipalities(countryId, regionId) {
  if (!countryId || !regionId) return [];
  const key = `${countryId}:${regionId}`;
  if (geoCache.municipalities[key]) return geoCache.municipalities[key];
  try {
    const snap = await getDocs(collection(db, "countries", countryId, "regions", regionId, "municipalities"));
    geoCache.municipalities[key] = sortByName(snap.docs.map(item => ({ id: item.id, ...item.data() })));
  } catch {
    geoCache.municipalities[key] = [];
  }
  return geoCache.municipalities[key];
}

function optionGeo(item, selectedValue = "") {
  const value = item.id || item.code || item.codigo || item.name || item.nombre;
  const name = item.name || item.nombre || value;
  const code = item.code || item.codigo || item.iso2 || "";
  const selected = value === selectedValue || name === selectedValue || code === selectedValue ? "selected" : "";
  return `<option value="${value}" data-name="${name}" data-code="${code}" data-iso2="${item.iso2 || ""}" data-iso3="${item.iso3 || ""}" ${selected}>${name}</option>`;
}

async function poblarUbicacion(prefix, valores = {}) {
  const country = document.getElementById(`${prefix}Country`);
  const region = document.getElementById(`${prefix}Region`);
  const city = document.getElementById(`${prefix}City`);
  if (!country || !region || !city) return;

  country.innerHTML = `<option value="">Cargando países...</option>`;
  region.innerHTML = `<option value="">Selecciona un país primero</option>`;
  city.innerHTML = `<option value="">Selecciona departamento / estado primero</option>`;

  const countries = await cargarGeoCountries();
  const selectedCountry = valores.countryId || valores.countryIso2 || valores.country || "";
  country.innerHTML = `<option value="">País</option>${countries.map(item => optionGeo(item, selectedCountry)).join("")}`;

  const renderRegions = async () => {
    const countryId = country.value;
    region.innerHTML = countryId ? `<option value="">Cargando departamentos / estados...</option>` : `<option value="">Selecciona un país primero</option>`;
    city.innerHTML = `<option value="">Selecciona departamento / estado primero</option>`;
    if (!countryId) return;
    const regions = await cargarGeoRegions(countryId);
    const selectedRegion = valores.regionId || valores.regionCode || valores.region || "";
    region.innerHTML = regions.length
      ? `<option value="">Departamento / estado</option>${regions.map(item => optionGeo(item, selectedRegion)).join("")}`
      : `<option value="">Catálogo pendiente para este país</option>`;
    await renderCities();
  };

  const renderCities = async () => {
    const countryId = country.value;
    const regionId = region.value;
    city.innerHTML = regionId ? `<option value="">Cargando municipios...</option>` : `<option value="">Selecciona departamento / estado primero</option>`;
    if (!countryId || !regionId) return;
    const municipalities = await cargarGeoMunicipalities(countryId, regionId);
    const selectedCity = valores.cityId || valores.cityCode || valores.city || "";
    city.innerHTML = municipalities.length
      ? `<option value="">Municipio</option>${municipalities.map(item => optionGeo(item, selectedCity)).join("")}`
      : `<option value="">Catálogo pendiente para esta división</option>`;
  };

  country.onchange = async () => {
    valores.region = "";
    valores.regionId = "";
    valores.city = "";
    valores.cityId = "";
    await renderRegions();
  };
  region.onchange = async () => {
    valores.city = "";
    valores.cityId = "";
    await renderCities();
  };
  await renderRegions();
}

function calcularEdad(fecha) {
  if (!fecha) return "—";
  const nacimiento = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return "—";
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad >= 0 ? edad : "—";
}

function perfilBasicoDesdeFormulario(prefix) {
  const country = document.getElementById(`${prefix}Country`);
  const region = document.getElementById(`${prefix}Region`);
  const city = document.getElementById(`${prefix}City`);
  const countryOpt = country?.selectedOptions?.[0];
  const regionOpt = region?.selectedOptions?.[0];
  const cityOpt = city?.selectedOptions?.[0];
  const countryName = countryOpt?.dataset.name || "";
  const regionName = regionOpt?.dataset.name || "";
  const cityName = cityOpt?.dataset.name || "";
  return {
    phoneCode: document.getElementById(`${prefix}PhoneCode`)?.value || "+57",
    phone: document.getElementById(`${prefix}Phone`)?.value.trim() || "",
    birthDate: document.getElementById(`${prefix}Birth`)?.value || "",
    gender: document.getElementById(`${prefix}Gender`)?.value || "",
    countryId: country?.value || "",
    countryCode: countryOpt?.dataset.code || "",
    countryIso2: countryOpt?.dataset.iso2 || country?.value || "",
    countryIso3: countryOpt?.dataset.iso3 || "",
    countryName,
    country: countryName || country?.value || "",
    regionId: region?.value || "",
    regionCode: regionOpt?.dataset.code || "",
    regionName,
    region: regionName || region?.value || "",
    cityId: city?.value || "",
    cityCode: cityOpt?.dataset.code || "",
    cityName,
    city: cityName || city?.value || ""
  };
}

function renderProfile() {
  if (!usuarioActual) return;
  const profile = perfilActual || {};
  const displayName = profile.displayName || usuarioActual.displayName || "";
  const photo = profile.photoData || usuarioActual.photoURL || "";
  const activeClassCount = adminClases.filter(c => (c.status || "activa") === "activa").length;
  document.getElementById("profileNameTitle").textContent = displayName || "Perfil";
  document.getElementById("profileEmailText").textContent = usuarioActual.email || "";
  document.getElementById("profileAgeChip").textContent = `Edad: ${calcularEdad(profile.birthDate)}`;
  const groupChip = document.getElementById("profileGroupChip");
  if (groupChip) groupChip.remove();
  document.getElementById("profileClassChip").textContent = modoAdmin
    ? `Aulas activas: ${activeClassCount}`
    : `Aula: ${profile.className || claseActualInfo?.name || "sin aula"}`;
  document.getElementById("profileCreatedChip").textContent = `Registro: ${profile.createdLabel || "—"}`;
  document.getElementById("profilePhoneChip").textContent = profile.phoneVerified ? "Teléfono verificado" : "Teléfono sin verificar";
  document.getElementById("profilePhotoPreview").src = photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23e8f0fb'/%3E%3Ctext x='60' y='68' text-anchor='middle' font-size='44' fill='%23003865'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
  document.getElementById("profileName").value = displayName;
  document.getElementById("profileBirth").value = profile.birthDate || "";
  document.getElementById("profileGender").value = profile.gender || "";
  poblarPhoneCodes("profilePhoneCode", profile.phoneCode || "+57");
  document.getElementById("profilePhone").value = profile.phoneVerified ? "" : (profile.phone || "");
  document.getElementById("profilePhoneCodeInput").value = "";
  poblarUbicacion("profile", profile);
  document.getElementById("teacherDeletePanel")?.classList.toggle("hidden", !modoAdmin);
}

function codigoClaseAleatorio() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function normalizarCodigoClase(code) {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
}

async function buscarClasePorCodigo(code) {
  const codigoOriginal = String(code || "").trim();
  const codigo = normalizarCodigoClase(codigoOriginal);
  if (!codigo) return null;
  let snap = await getDocs(query(collection(db, "classes"), where("codeKey", "==", codigo)));
  if (snap.empty) {
    snap = await getDocs(query(collection(db, "classes"), where("code", "==", codigoOriginal)));
  }
  if (snap.empty && codigoOriginal.toUpperCase() !== codigoOriginal) {
    snap = await getDocs(query(collection(db, "classes"), where("code", "==", codigoOriginal.toUpperCase())));
  }
  if (snap.empty) {
    const all = await getDocs(collection(db, "classes"));
    const encontrado = all.docs.find(d => normalizarCodigoClase(d.data().code || d.data().codeKey) === codigo);
    if (!encontrado) return null;
    return { id: encontrado.id, ...encontrado.data() };
  }
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function crearClaseAdmin() {
  const status = document.getElementById("adminClassStatus");
  const btn = document.getElementById("btnCreateClass");
  const name = document.getElementById("adminClassName")?.value.trim();
  if (!name) {
    status.textContent = "Escribe el nombre del aula.";
    return;
  }
  status.textContent = "Creando aula...";
  if (btn) btn.disabled = true;
  try {
    let code = "";
    for (let i = 0; i < 30; i++) {
      const candidate = codigoClaseAleatorio();
      const exists = await buscarClasePorCodigo(candidate);
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      status.textContent = "No se pudo generar un código único. Intenta de nuevo.";
      return;
    }
    const ref = doc(collection(db, "classes"));
    const payload = {
      name,
      code,
      codeKey: normalizarCodigoClase(code),
      ownerEmail: usuarioActual.email,
      ownerUid: usuarioActual.uid,
      status: "activa",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, payload);
    adminClaseActiva = ref.id;
    localStorage.setItem(STORAGE_ADMIN_CLASE, adminClaseActiva);
    adminClases = [{ id: ref.id, ...payload }, ...adminClases.filter(c => c.id !== ref.id)];
    renderClassSelectors();
    await cargarClasesAdmin();
    document.getElementById("adminClassName").value = "";
    status.textContent = `Aula creada. Código generado: ${code}`;
  } catch (err) {
    console.error(err);
    status.textContent = "No se pudo crear el aula. Revisa reglas de Firestore y conexión.";
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cargarClasesAdmin() {
  if (!modoAdmin || !usuarioActual) return;
  try {
    const snap = await getDocs(query(collection(db, "classes"), where("ownerUid", "==", usuarioActual.uid)));
    adminClases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if ((!adminClaseActiva || !adminClases.some(c => c.id === adminClaseActiva)) && adminClases.length) {
      adminClaseActiva = adminClases[0].id;
      localStorage.setItem(STORAGE_ADMIN_CLASE, adminClaseActiva);
    }
    adminGrupoActual = adminClaseActiva || idsAulasAdmin()[0] || "";
    await cargarPermisosRemotos(idsAulasAdmin());
    renderClassSelectors();
    renderProfile();
    escucharEstudiantesAdmin();
    renderAdminStudentsByClass().catch(err => console.warn("No se pudieron cargar estudiantes.", err));
  } catch (err) {
    console.warn("No se pudieron cargar clases.", err);
    renderClassSelectors();
  }
}

function escucharEstudiantesAdmin() {
  if (!modoAdmin || !usuarioActual) return;
  if (unsubscribeAdminStudents) unsubscribeAdminStudents();
  unsubscribeAdminStudents = onSnapshot(
    query(collection(db, "classStudents"), where("ownerUid", "==", usuarioActual.uid)),
    () => renderAdminStudentsByClass().catch(err => console.warn("No se pudieron actualizar estudiantes.", err)),
    err => console.warn("No se pudo escuchar estudiantes en tiempo real.", err)
  );
}

function renderClassSelectors() {
  const select = document.getElementById("adminClassSelect");
  const bulkClass = document.getElementById("bulkStudentClass");
  const studentClass = document.getElementById("adminStudentGroupSelect");
  const options = adminClases.length
    ? adminClases.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("")
    : `<option value="">Sin aulas creadas</option>`;
  if (select) {
    select.innerHTML = options;
    select.value = adminClaseActiva || "";
  }
  if (bulkClass) {
    bulkClass.innerHTML = options;
    bulkClass.value = adminClaseActiva || "";
  }
  if (studentClass) {
    studentClass.innerHTML = options;
    studentClass.value = adminClaseActiva || "";
  }
}

function parseStudentLines(raw) {
  return raw.split(/\n|;/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const angle = line.match(/^(.*?)<([^>]+)>$/);
      if (angle) {
        return { name: angle[1].trim(), email: angle[2].trim().toLowerCase() };
      }
      const comma = line.match(/^(.*?),\s*([^,\s]+@gmail\.com)$/i);
      if (comma) {
        return { name: comma[1].trim(), email: comma[2].trim().toLowerCase() };
      }
      const email = line.match(/[A-Z0-9._%+-]+@gmail\.com/i)?.[0]?.toLowerCase() || "";
      return { name: line.replace(email, "").replace(/[<>,]/g, "").trim(), email };
    })
    .filter(item => item.email.endsWith("@gmail.com"));
}

async function estudiantesDeClase(classId) {
  const snap = await getDocs(query(collection(db, "classStudents"), where("classId", "==", classId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function renderAdminStudentsByClass() {
  const cont = document.getElementById("adminStudentsByClass");
  if (!cont || !modoAdmin) return;
  if (renderizandoAdminStudents) return;
  renderizandoAdminStudents = true;
  if (!adminClases.length) {
    cont.innerHTML = `<p class="mini-help">Aún no hay aulas creadas.</p>`;
    renderizandoAdminStudents = false;
    return;
  }
  cont.innerHTML = `<p class="mini-help">Cargando estudiantes...</p>`;
  try {
    const groups = await Promise.all(adminClases.map(async clase => ({
      clase,
      estudiantes: await estudiantesDeClase(clase.id)
    })));
    cont.innerHTML = groups.map(({ clase, estudiantes }) => `
      <details class="accordion-card class-students-card">
        <summary>${clase.name} · ${clase.code} · ${estudiantes.length} estudiante(s)</summary>
        <div class="class-toolbar">
          <div>
            <strong>${clase.name}</strong>
            <span>Código de aula: ${clase.code}</span>
          </div>
          <button class="btn btn-outline" data-delete-class="${clase.id}" type="button">Eliminar aula</button>
        </div>
        <div class="class-actions-panel">
          <textarea class="admin-input" rows="3" data-class-add-input="${clase.id}" placeholder="Nombre Apellido <correo@gmail.com>"></textarea>
          <div class="result-actions">
            <button class="btn btn-primary" data-add-students-class="${clase.id}" type="button">Agregar estudiantes a esta aula</button>
          </div>
          <p class="bank-status" data-class-status="${clase.id}"></p>
        </div>
        <input class="admin-input student-search" data-class-search="${clase.id}" placeholder="Buscar estudiante" />
        <div class="student-list" data-class-list="${clase.id}">
          ${estudiantes.length ? estudiantes.map(est => renderStudentRow(est)).join("") : `<p class="mini-help">Sin estudiantes registrados.</p>`}
        </div>
      </details>
    `).join("");
  } finally {
    renderizandoAdminStudents = false;
  }
}

function renderStudentRow(est) {
  const fecha = est.registeredLabel || est.createdLabel || "—";
  const opciones = adminClases.map(aula =>
    `<option value="${aula.id}" ${est.classId === aula.id || est.grupo === aula.id ? "selected" : ""}>${aula.name}</option>`
  ).join("");
  return `
    <div class="student-row" data-student-row data-search="${(est.name || "")} ${est.email}">
      <div>
        <strong>${est.name || "Nombre pendiente"}</strong>
        <span>${est.email}</span>
        <small>Registro: ${fecha} · Estado: ${est.status || "pendiente"}</small>
      </div>
      <select class="admin-input" data-student-group="${est.id}" aria-label="Cambiar aula">${opciones}</select>
      <button class="btn btn-outline" data-delete-student="${est.id}" type="button">Eliminar</button>
    </div>
  `;
}

async function guardarPerfilUsuario(extra = {}) {
  const uid = usuarioActual?.uid || extra.uid;
  if (!uid) return;
  const email = usuarioActual?.email || extra.email || "";
  perfilActual = {
    ...(perfilActual || {}),
    uid,
    email,
    displayName: extra.displayName || perfilActual?.displayName || usuarioActual?.displayName || "",
    role: extra.role || perfilActual?.role || (email === ADMIN_EMAIL ? "teacher" : ""),
    tipoCuenta: extra.tipoCuenta || perfilActual?.tipoCuenta || extra.role || (email === ADMIN_EMAIL ? "teacher" : ""),
    isAdmin: Object.prototype.hasOwnProperty.call(extra, "isAdmin")
      ? extra.isAdmin
      : (extra.role === "teacher" || perfilActual?.role === "teacher" || email === ADMIN_EMAIL),
    grupo: Object.prototype.hasOwnProperty.call(extra, "grupo") ? extra.grupo : (grupoActivo || perfilActual?.grupo || ""),
    classId: Object.prototype.hasOwnProperty.call(extra, "classId") ? extra.classId : (claseActiva || perfilActual?.classId || ""),
    className: extra.className || perfilActual?.className || claseActualInfo?.name || "",
    createdLabel: perfilActual?.createdLabel || new Date().toLocaleDateString("es-CO"),
    ...extra
  };
  await setDoc(doc(db, "users", uid), { ...perfilActual, updatedAt: serverTimestamp() }, { merge: true });
  if (perfilActual.phoneVerified) {
    await sincronizarIndiceRecuperacion(perfilActual);
  }
}

async function cargarPerfilUsuario() {
  if (!usuarioActual) return null;
  const snap = await getDoc(refPerfilUsuario());
  perfilActual = snap.exists() ? snap.data() : null;
  return perfilActual;
}

async function prepararSesionAutenticada() {
  await cargarPerfilUsuario();
  if (requiereSeleccionRol()) {
    await mostrarSplashBienvenida();
    mostrarSeleccionRol();
    return;
  }
  modoAdmin = esProfesor();
  if (modoAdmin) {
    await mostrarSplashBienvenida();
    grupoActivo = "admin";
    localStorage.setItem(STORAGE_GRUPO, grupoActivo);
    document.body.classList.remove("group-locked");
    aplicarModoUsuario();
    iniciarListenersComunicacion();
    activarNav(seccionRestaurable());
    guardarPerfilUsuario({ role: "teacher", isAdmin: true, grupo: "admin" }).catch(err => console.warn("No se pudo guardar perfil admin.", err));
    cargarClasesAdmin().catch(err => console.warn("No se pudieron cargar clases admin.", err));
    return;
  }

  await cargarEstadoRemoto();
  await mostrarSplashBienvenida();
  iniciarListenersComunicacion();

  if (await aceptarInvitacionPendiente()) {
    return;
  }

  if (perfilActual?.classId || claseActiva) {
    const aulaId = perfilActual?.classId || claseActiva;
    const aulaSnap = await getDoc(refClase(aulaId));
    if (!aulaSnap.exists()) {
      grupoActivo = "";
      claseActiva = "";
      claseActualInfo = null;
      localStorage.removeItem(STORAGE_GRUPO);
      localStorage.removeItem(STORAGE_CLASE_ACTIVA);
      limpiarIntentoActivo();
      await guardarPerfilUsuario({ grupo: "", classId: "", className: "", classCode: "" });
      await guardarEstadoRemoto();
      document.body.classList.remove("group-locked");
      aplicarModoUsuario();
      activarNav("perfil");
      return;
    }
    grupoActivo = aulaId;
    claseActiva = aulaId;
    claseActualInfo = { id: aulaId, ...aulaSnap.data() };
    const matriculaSnap = await getDoc(doc(db, "classStudents", `${aulaId}_${safeEmailId(usuarioActual.email || "")}`));
    if (!matriculaSnap.exists()) {
      await limpiarAulaLocalYRemota("Ya no perteneces a esa aula. Ingresa un nuevo código para continuar.");
      return;
    }
    classMembershipValid = true;
    localStorage.setItem(STORAGE_GRUPO, grupoActivo);
    localStorage.setItem(STORAGE_CLASE_ACTIVA, claseActiva);
    await cargarPermisosRemotos([grupoActivo]);
    aplicarBancoNivelMedio();
    escucharPermisosGrupo(grupoActivo);
    escucharMembresiaClase(grupoActivo);
    sincronizarCompletadosGuardados();
  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  iniciarListenersComunicacion();
  activarNav(seccionRestaurable());
    actualizarEstadoDiagnostico();
    restaurarIntentoActivo();
    return;
  }

  mostrarEntradaGrupo();
}

async function entrarGrupo() {
  if (!usuarioActual) {
    mostrarWarn("Primero inicia sesión o regístrate.");
    return;
  }
  const codigoClase = document.getElementById("claseCodigo").value.trim();
  const clase = await validarClaseIngreso(codigoClase);
  if (!clase) {
    return;
  }
  grupoActivo = clase.id;
  claseActiva = clase.id;
  claseActualInfo = clase;
  classMembershipValid = true;
  modoAdmin = false;
  localStorage.setItem(STORAGE_GRUPO, grupoActivo);
  localStorage.setItem(STORAGE_CLASE_ACTIVA, claseActiva);
  await guardarPerfilUsuario({
    grupo: grupoActivo,
    isAdmin: false,
    classId: clase.id,
    className: clase.name,
    classCode: clase.code,
    classOwnerUid: clase.ownerUid || "",
    classOwnerEmail: clase.ownerEmail || ""
  });
  await sincronizarRegistroEstudianteClase(clase.id, grupoActivo);
  await guardarEstadoRemoto();
  await cargarPermisosRemotos([grupoActivo]);
  aplicarBancoNivelMedio();
  escucharPermisosGrupo(grupoActivo);
  escucharMembresiaClase(grupoActivo);
  limpiarWarn();
  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  activarNav("inicio");
  actualizarEstadoDiagnostico();
}

async function validarClaseIngreso(codigoClase = document.getElementById("claseCodigo").value.trim()) {
  try {
    const clase = await buscarClasePorCodigo(codigoClase);
    if (!clase) {
      mostrarWarn("Código de aula incorrecto o inexistente.");
      document.getElementById("grupoWarn").classList.add("error");
      return null;
    }
    clasePendienteIngreso = clase;
    limpiarWarn();
    return clase;
  } catch (err) {
    console.error("Error consultando código de clase:", err);
    mostrarWarn("No fue posible validar el código de aula. Revisa que las reglas de Firebase permitan leer aulas.");
    document.getElementById("grupoWarn").classList.add("error");
    return null;
  }
}

async function sincronizarRegistroEstudianteClase(classId, grupo, extra = {}) {
  if (!usuarioActual?.email || !classId) return;
  const ref = doc(db, "classStudents", `${classId}_${safeEmailId(usuarioActual.email)}`);
  const ownerUid = extra.ownerUid || claseActualInfo?.ownerUid || perfilActual?.classOwnerUid || "";
  const ownerEmail = extra.ownerEmail || claseActualInfo?.ownerEmail || perfilActual?.classOwnerEmail || "";
  await setDoc(ref, {
    classId,
    className: claseActualInfo?.name || perfilActual?.className || "",
    classCode: claseActualInfo?.code || perfilActual?.classCode || "",
    email: usuarioActual.email,
    name: extra.name || perfilActual?.displayName || usuarioActual.displayName || "",
    grupo: classId,
    aulaId: classId,
    groupName: claseActualInfo?.name || perfilActual?.className || "",
    status: "activo",
    registeredLabel: perfilActual?.createdLabel || new Date().toLocaleDateString("es-CO"),
    userUid: usuarioActual.uid,
    ownerUid,
    ownerEmail,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function crearInvitacionClase(clase, { email, name = "" }) {
  const inviteToken = generarTokenSeguro();
  const id = `${clase.id}_${safeEmailId(email)}`;
  const teacherName = perfilActual?.displayName || usuarioActual?.displayName || usuarioActual?.email || "Profesor";
  await setDoc(doc(db, "classInvites", id), {
    classId: clase.id,
    className: clase.name,
    classCode: clase.code,
    studentEmail: email,
    email,
    studentName: name || "",
    teacherUid: usuarioActual.uid,
    ownerUid: usuarioActual.uid,
    teacherEmail: usuarioActual.email || "",
    teacherName,
    status: "pending",
    inviteToken,
    acceptUrl: enlaceInvitacionAula(inviteToken),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function aceptarInvitacionPendiente() {
  const token = localStorage.getItem(STORAGE_INVITE_TOKEN);
  if (!token || !usuarioActual?.email) return false;
  const snap = await getDocs(query(
    collection(db, "classInvites"),
    where("inviteToken", "==", token),
    where("status", "==", "pending"),
    where("email", "==", usuarioActual.email)
  ));
  if (snap.empty) {
    localStorage.removeItem(STORAGE_INVITE_TOKEN);
    mostrarWarn("La invitación ya no está disponible o ya fue utilizada.");
    return false;
  }
  const inviteDoc = snap.docs[0];
  const invite = inviteDoc.data();
  if ((invite.email || invite.studentEmail || "").toLowerCase() !== usuarioActual.email.toLowerCase()) {
    mostrarWarn("Esta invitación corresponde a otro correo. Inicia sesión con el correo invitado.");
    return false;
  }
  const claseSnap = await getDoc(refClase(invite.classId));
  if (!claseSnap.exists()) {
    localStorage.removeItem(STORAGE_INVITE_TOKEN);
    mostrarWarn("El aula de esta invitación ya no existe.");
    return false;
  }
  const clase = { id: invite.classId, ...claseSnap.data() };
  grupoActivo = clase.id;
  claseActiva = clase.id;
  claseActualInfo = clase;
  classMembershipValid = true;
  localStorage.setItem(STORAGE_GRUPO, grupoActivo);
  localStorage.setItem(STORAGE_CLASE_ACTIVA, claseActiva);
  await sincronizarRegistroEstudianteClase(clase.id, clase.id, {
    name: perfilActual?.displayName || invite.studentName || "",
    ownerUid: clase.ownerUid || invite.ownerUid || invite.teacherUid || "",
    ownerEmail: clase.ownerEmail || invite.teacherEmail || ""
  });
  await updateDoc(inviteDoc.ref, {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    acceptedByUid: usuarioActual.uid,
    updatedAt: serverTimestamp()
  });
  await guardarPerfilUsuario({
    grupo: clase.id,
    classId: clase.id,
    className: clase.name,
    classCode: clase.code,
    classOwnerUid: clase.ownerUid || invite.ownerUid || invite.teacherUid || "",
    classOwnerEmail: clase.ownerEmail || invite.teacherEmail || ""
  });
  await guardarEstadoRemoto();
  await cargarPermisosRemotos([grupoActivo]);
  aplicarBancoNivelMedio();
  escucharPermisosGrupo(grupoActivo);
  escucharMembresiaClase(grupoActivo);
  localStorage.removeItem(STORAGE_INVITE_TOKEN);
  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  activarNav("inicio");
  actualizarEstadoDiagnostico();
  mostrarWarn(`Te uniste al aula ${clase.name}.`);
  return true;
}

async function limpiarAulaLocalYRemota(mensaje = "El profesor te retiró del aula. Para continuar, ingresa un nuevo código de aula.") {
  classMembershipValid = false;
  grupoActivo = "";
  claseActiva = "";
  claseActualInfo = null;
  localStorage.removeItem(STORAGE_GRUPO);
  localStorage.removeItem(STORAGE_CLASE_ACTIVA);
  limpiarIntentoActivo();
  if (unsubscribePermisos) unsubscribePermisos();
  await guardarPerfilUsuario({ grupo: "", classId: "", className: "", classCode: "", classOwnerUid: "", classOwnerEmail: "" }).catch(() => {});
  await guardarEstadoRemoto().catch(() => {});
  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  activarNav("configuracion");
  const status = document.getElementById("settingsClassStatus");
  if (status) {
    status.textContent = mensaje;
    status.classList.add("error");
  }
}

function escucharMembresiaClase(classId) {
  if (unsubscribeClassMembership) unsubscribeClassMembership();
  if (!usuarioActual?.email || !classId || modoAdmin) return;
  const id = `${classId}_${safeEmailId(usuarioActual.email)}`;
  unsubscribeClassMembership = onSnapshot(doc(db, "classStudents", id), snap => {
    if (snap.exists()) {
      classMembershipValid = true;
      return;
    }
    if (grupoActivo === classId) {
      limpiarAulaLocalYRemota();
    }
  }, err => console.warn("No se pudo escuchar la matrícula del aula.", err));
}

async function loginEmail() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (requiereVerificacionEmail(cred.user) && cred.user.email?.toLowerCase() !== ADMIN_EMAIL) {
      await signOut(auth);
      mostrarWarn("Debes verificar tu correo. Revisa Gmail y abre el enlace de verificación antes de iniciar sesión.");
      return;
    }
  } catch (err) {
    mostrarWarn("No se pudo ingresar. Revisa correo y contraseña.");
  }
}

async function registrarEmail() {
  const nombre = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const role = document.getElementById("registerRole")?.value || "";
  const perfilRegistro = perfilBasicoDesdeFormulario("register");
  if (nombre.length < 3) {
    mostrarWarn("Escribe un nombre de usuario de mínimo 3 caracteres.");
    return;
  }
  if (!email.endsWith("@gmail.com")) {
    mostrarWarn("Solo se permiten correos @gmail.com.");
    return;
  }
  if (!["teacher", "student"].includes(role)) {
    mostrarWarn("Selecciona si tu cuenta será de profesor o estudiante.");
    return;
  }
  if (!actualizarReglasPassword() || !validarPassword(password)) {
    mostrarWarn("La contraseña debe tener mínimo 8 caracteres, una mayúscula, dos números y un símbolo permitido.");
    return;
  }
  if (!perfilRegistro.birthDate || !perfilRegistro.gender || !perfilRegistro.country || !perfilRegistro.region || !perfilRegistro.city) {
    mostrarWarn("Completa fecha de nacimiento, sexo o género, país, departamento y ciudad.");
    return;
  }
  try {
    registroEnCurso = true;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });
    await guardarPerfilUsuario({
      uid: cred.user.uid,
      email,
      displayName: nombre,
      role,
      tipoCuenta: role,
      isAdmin: role === "teacher" || email === ADMIN_EMAIL,
      phoneVerified: false,
      ...perfilRegistro
    });
    await enviarVerificacionEmailPersonalizada(email);
    await signOut(auth);
    registroEnCurso = false;
    cambiarAuthMode("login");
    mostrarWarn("Cuenta creada. Te enviamos un correo de verificación; abre el enlace y luego inicia sesión.");
  } catch {
    registroEnCurso = false;
    mostrarWarn("No se pudo registrar ese correo.");
  }
}

async function loginGoogle() {
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await guardarDatosGoogleIniciales(cred.user);
  } catch (err) {
    mostrarWarn("No se pudo ingresar con Google.");
  }
}

async function guardarDatosGoogleIniciales(user) {
  if (!user) return;
  const snap = await getDoc(doc(db, "users", user.uid));
  const existente = snap.exists() ? snap.data() : {};
  const googleProvider = user.providerData?.find(p => p.providerId === "google.com");
  const inicial = {
    uid: user.uid,
    email: user.email || "",
    googleUid: googleProvider?.uid || "",
    googleDisplayName: googleProvider?.displayName || user.displayName || "",
    googlePhotoURL: googleProvider?.photoURL || user.photoURL || "",
    displayName: existente.displayName || perfilActual?.displayName || user.displayName || googleProvider?.displayName || "",
    photoData: existente.photoData || perfilActual?.photoData || googleProvider?.photoURL || user.photoURL || "",
    role: existente.role || perfilActual?.role || "",
    tipoCuenta: existente.tipoCuenta || perfilActual?.tipoCuenta || "",
    isAdmin: existente.isAdmin || existente.role === "teacher" || user.email?.toLowerCase() === ADMIN_EMAIL,
    grupo: existente.grupo || grupoActivo || "",
    classId: existente.classId || claseActiva || "",
    className: existente.className || claseActualInfo?.name || "",
    classCode: existente.classCode || claseActualInfo?.code || "",
    authProvider: "google.com"
  };
  await guardarPerfilUsuario(inicial);
}

async function recuperarPassword() {
  const email = (document.getElementById("forgotPasswordEmail")?.value || document.getElementById("loginEmail")?.value || "").trim().toLowerCase();
  if (!email.endsWith("@gmail.com")) {
    setStatus("forgotPasswordStatus", "Escribe tu correo Gmail registrado.", "error");
    return;
  }
  try {
    const response = await fetch(APP_CONFIG.passwordResetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error(await response.text());
    setStatus("forgotPasswordStatus", "Te enviamos un correo para restablecer la contraseña desde Matemáticas En Tu Bolsillo.");
  } catch {
    setStatus("forgotPasswordStatus", "No se pudo enviar la recuperación. Revisa el correo.", "error");
  }
}

async function enviarVerificacionEmailPersonalizada(email) {
  const response = await fetch(APP_CONFIG.emailVerificationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (!response.ok) throw new Error(await response.text());
}

function abrirPanelRecuperarPassword() {
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.remove("hidden");
  document.getElementById("forgotPasswordPanel")?.classList.remove("hidden");
  document.getElementById("forgotPasswordEmail").value = document.getElementById("loginEmail")?.value || "";
  setStatus("forgotPasswordStatus", "");
}

function abrirPanelRecuperarUsuario() {
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.remove("hidden");
  document.getElementById("recoverEmailPanel")?.classList.remove("hidden");
  poblarPhoneCodes("recoverPhoneCode", document.getElementById("recoverPhoneCode")?.value || "+57");
  const backBtn = document.getElementById("btnRecoverBack");
  if (backBtn) backBtn.textContent = "Volver al inicio de sesión";
  setRecoverStep(1);
  setStatus("recoverStatus", "");
  mostrarSoporteRecuperacion(false);
}

function mostrarSeleccionRol() {
  document.body.classList.add("group-locked");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.getElementById("roleChoiceCard")?.classList.remove("hidden");
  setStatus("roleChoiceStatus", "");
}

async function guardarRolUsuario(role) {
  if (!["teacher", "student"].includes(role)) return;
  setStatus("roleChoiceStatus", "Guardando tipo de cuenta...");
  await guardarPerfilUsuario({
    role,
    tipoCuenta: role,
    isAdmin: role === "teacher",
    grupo: role === "teacher" ? "admin" : (grupoActivo || "")
  });
  document.getElementById("roleChoiceCard")?.classList.add("hidden");
  await prepararSesionAutenticada();
}

function volverLoginDesdeRecuperacion() {
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.querySelector(".auth-divider")?.classList.remove("hidden");
  cambiarAuthMode("login");
  document.getElementById("forgotPasswordPanel")?.classList.remove("hidden");
  document.getElementById("loginCard")?.classList.remove("hidden");
}

function telefonoCompletoRecuperacion() {
  return normalizarTelefono(
    document.getElementById("recoverPhoneCode")?.value || "+57",
    document.getElementById("recoverPhone")?.value || ""
  );
}

function setRecoverStep(step) {
  document.querySelectorAll(".recovery-wizard span").forEach((item, idx) => {
    item.classList.toggle("active", idx < step);
  });
}

function mensajeRecuperacionProtegido() {
  return "No fue posible verificar tu identidad. Para proteger tu información debes comunicarte con soporte.";
}

function mostrarSoporteRecuperacion(mostrar = true) {
  document.getElementById("btnRecoverSupport")?.classList.toggle("hidden", !mostrar);
}

function toggleWhatsappWidget() {
  const widget = document.getElementById("whatsappWidget");
  const btn = document.getElementById("btnWhatsappInfo");
  ajustarLadoWhatsapp();
  const abierto = !widget?.classList.contains("open");
  widget?.classList.toggle("open", abierto);
  btn?.setAttribute("aria-expanded", String(abierto));
}

function ajustarLadoWhatsapp() {
  const widget = document.getElementById("whatsappWidget");
  if (!widget) return;
  const rect = widget.getBoundingClientRect();
  widget.classList.toggle("side-right", rect.left < window.innerWidth / 2);
}

function ajustarWhatsappAlBorde() {
  const widget = document.getElementById("whatsappWidget");
  if (!widget) return;
  const rect = widget.getBoundingClientRect();
  const margen = 10;
  const x = rect.left + rect.width / 2 < window.innerWidth / 2
    ? margen
    : window.innerWidth - rect.width - margen;
  widget.style.left = `${Math.max(margen, x)}px`;
  widget.style.right = "auto";
  ajustarLadoWhatsapp();
}

function activarArrastreWhatsapp() {
  const widget = document.getElementById("whatsappWidget");
  const btn = document.getElementById("btnWhatsappInfo");
  if (!widget || !btn) return;

  let arrastrando = false;
  let movido = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;

  const ubicar = (clientX, clientY) => {
    const rect = widget.getBoundingClientRect();
    const margen = 10;
    const maxX = window.innerWidth - rect.width - margen;
    const maxY = window.innerHeight - rect.height - margen;
    widget.style.left = `${Math.min(Math.max(clientX - offsetX, margen), Math.max(margen, maxX))}px`;
    widget.style.top = `${Math.min(Math.max(clientY - offsetY, margen), Math.max(margen, maxY))}px`;
    widget.style.right = "auto";
    widget.style.bottom = "auto";
    ajustarLadoWhatsapp();
  };

  btn.addEventListener("pointerdown", e => {
    arrastrando = true;
    movido = false;
    const rect = widget.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    btn.setPointerCapture?.(e.pointerId);
  });
  btn.addEventListener("pointermove", e => {
    if (!arrastrando) return;
    movido = movido || Math.hypot(e.clientX - startX, e.clientY - startY) > 6;
    if (!movido) return;
    widget.classList.add("dragging");
    widget.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    ubicar(e.clientX, e.clientY);
  });
  btn.addEventListener("pointerup", e => {
    if (!arrastrando) return;
    arrastrando = false;
    widget.classList.remove("dragging");
    btn.releasePointerCapture?.(e.pointerId);
    if (movido) ajustarWhatsappAlBorde();
    if (!movido) toggleWhatsappWidget();
  });
}

function normalizarTextoAsesor(input = "") {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function detectarModoAsesor(input = "") {
  const normalized = normalizarTextoAsesor(input);
  if (modoAdmin && /correo|mensaje|comunicado|email|padres|estudiantes/.test(normalized)) return "guide";
  if (modoAdmin && /clase|planea|planear|actividad|rubrica|retroalimentacion|evaluacion/.test(normalized)) return "guide";
  if (/generar|crear ejercicios|ejercicios tipo|preguntas tipo|banco|examen/.test(normalized)) return "generate";
  if (/resolver|resuelve|solucionar|calcula|hallar|halla|factoriza|simplifica|pregunta|enunciado|cuanto es/.test(normalized)) return "solve";
  if (/practicar|practica|tema|entrenar|repasar/.test(normalized)) return "practice";
  if (/revisar|error|me equivoque|respuesta incorrecta|por que/.test(normalized)) return "review";
  if (/plan|ruta|guia|clase|taller|quiz|evaluacion|material/.test(normalized)) return "guide";
  return null;
}

function modoExplicitoAsesor(input = "") {
  const normalized = normalizarTextoAsesor(input);
  if (normalized === "resolver una pregunta" || normalized === "resolver pregunta") return "solve";
  if (normalized === "generar ejercicios tipo examen" || normalized === "ejercicios tipo examen") return "generate";
  if (normalized === "practicar por tema") return "practice";
  if (normalized === "revisar mi error" || normalized === "revisar error") return "review";
  if (normalized === "crear plan de estudio" || normalized === "plan de estudio") return "guide";
  return null;
}

function cargarEstadoAsesor() {
  try {
    const raw = localStorage.getItem(STORAGE_ASESOR_CHAT);
    if (!raw) throw new Error("empty");
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.messages) || Date.now() - (saved.updatedAt || 0) > ASESOR_INACTIVIDAD_MS) {
      throw new Error("expired");
    }
    advisorMessages = saved.messages;
    advisorMode = saved.activeMode || null;
  } catch {
    advisorMessages = [modoAdmin ? ASESOR_TEACHER_INITIAL_MESSAGE : ASESOR_INITIAL_MESSAGE];
    advisorMode = null;
  }
}

function guardarEstadoAsesor() {
  localStorage.setItem(STORAGE_ASESOR_CHAT, JSON.stringify({
    messages: advisorMessages,
    activeMode: advisorMode,
    updatedAt: Date.now()
  }));
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderMarkdownBasico(text = "") {
  const html = escapeHtml(text)
    .replace(/^### (.*)$/gm, "<span class=\"msg-title\">$1</span>")
    .replace(/\[small\]([\s\S]*?)\[\/small\]/g, "<span class=\"msg-small\">$1</span>")
    .replace(/\[large\]([\s\S]*?)\[\/large\]/g, "<span class=\"msg-large\">$1</span>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

function renderAsesorQuickReplies() {
  const cont = document.getElementById("advisorQuickReplies");
  if (!cont) return;
  const replies = modoAdmin ? ASESOR_TEACHER_QUICK_REPLIES : ASESOR_QUICK_REPLIES;
  cont.innerHTML = replies.map(([label, value]) =>
    `<button type="button" data-advisor-quick="${escapeHtml(value)}">${escapeHtml(label)}</button>`
  ).join("");
}

function renderAsesorMessages() {
  const cont = document.getElementById("advisorMessages");
  if (!cont) return;
  cont.innerHTML = advisorMessages.map(msg => `
    <article class="advisor-message ${msg.sender === "user" ? "user" : "bot"}">
      <span>${msg.sender === "user" ? "Tú" : "∑"}</span>
      <div>${renderMarkdownBasico(msg.text || "")}</div>
    </article>
  `).join("");
  reRenderKatex(cont);
  cont.scrollTop = cont.scrollHeight;
  guardarEstadoAsesor();
}

function contextoAsesor(mode = advisorMode) {
  return {
    app: APP_CONFIG.name,
    role: modoAdmin ? "teacher" : "student",
    className: claseActualInfo?.name || perfilActual?.className || "",
    bank: NOMBRES_BANCOS[bancoActivo] || bancoActivo,
    mode: mode || "menu",
    modeLabel: mode ? ASESOR_MODE_LABELS[mode] : "Menú",
    instruction: modoAdmin
      ? "El usuario es profesor. Ayúdale a planear clases, crear exámenes, redactar correos a estudiantes, diseñar actividades, preparar rúbricas, retroalimentaciones y materiales matemáticos."
      : (mode ? ASESOR_MODE_PROMPTS[mode] : "Ayuda al estudiante a escoger entre resolver pregunta, generar ejercicios, practicar por tema, revisar error o crear plan de estudio.")
  };
}

async function enviarMensajeAsesor(text) {
  const input = String(text || "").trim();
  if (!input || advisorLoading) return;
  abrirAsesorIA();
  advisorMessages.push({ id: `${Date.now()}-user`, sender: "user", text: input });
  renderAsesorMessages();

  const explicitMode = modoExplicitoAsesor(input);
  if (explicitMode) {
    advisorMode = explicitMode;
    advisorMessages.push({ id: `${Date.now()}-bot`, sender: "bot", text: ASESOR_MODE_PROMPTS[explicitMode] });
    renderAsesorMessages();
    return;
  }
  const inferredMode = detectarModoAsesor(input);
  const modeForRequest = inferredMode || advisorMode;
  if (inferredMode) advisorMode = inferredMode;

  advisorLoading = true;
  const status = document.getElementById("advisorStatus");
  if (status) status.textContent = "El Asesor IA está pensando...";
  try {
    const history = advisorMessages
      .filter(msg => msg.sender === "bot" || msg.sender === "user")
      .slice(-12)
      .map(msg => ({ role: msg.sender === "bot" ? "model" : "user", parts: [{ text: msg.text }] }));
    const response = await fetch(APP_CONFIG.asesorEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, currentUserInput: input, currentData: contextoAsesor(modeForRequest) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo generar respuesta.");
    advisorMessages.push({ id: `${Date.now()}-bot`, sender: "bot", text: data.responseText || "No recibí respuesta del modelo." });
  } catch (err) {
    console.error(err);
    advisorMessages.push({
      id: `${Date.now()}-bot`,
      sender: "bot",
      text: "No pude conectar con el Asesor IA en este momento. Revisa que la Cloud Function `generateAiResponse` esté desplegada y que la variable GEMINI_API_KEY esté configurada."
    });
  } finally {
    advisorLoading = false;
    if (status) status.textContent = "";
    renderAsesorMessages();
  }
}

function abrirAsesorIA() {
  cargarEstadoAsesor();
  renderAsesorQuickReplies();
  renderAsesorMessages();
  document.getElementById("advisorChatPanel")?.classList.remove("hidden");
  document.getElementById("btnAdvisorFloat")?.setAttribute("aria-expanded", "true");
}

function cerrarAsesorIA() {
  document.getElementById("advisorChatPanel")?.classList.add("hidden");
  document.getElementById("btnAdvisorFloat")?.setAttribute("aria-expanded", "false");
}

function actualizarCronometroRecuperacion() {
  const countdown = document.getElementById("recoverCountdown");
  const sendBtn = document.getElementById("btnRecoverSendCode");
  const restante = recoverVerificationExpiresAt - Date.now();
  if (!countdown || !sendBtn) return;

  if (recoverVerificationId && restante > 0) {
    countdown.hidden = false;
    countdown.textContent = formatCountdown(restante);
    sendBtn.disabled = true;
    sendBtn.textContent = `Reenviar en ${formatCountdown(restante)}`;
    return;
  }

  clearInterval(recoverCountdownInterval);
  recoverCountdownInterval = null;
  countdown.hidden = true;
  sendBtn.disabled = false;
  sendBtn.textContent = recoverVerificationId ? "Enviar nuevo código" : "Enviar código";
}

function iniciarCronometroRecuperacion() {
  clearInterval(recoverCountdownInterval);
  actualizarCronometroRecuperacion();
  recoverCountdownInterval = setInterval(actualizarCronometroRecuperacion, 1000);
}

async function prepararRecaptchaRecuperacion() {
  if (!recoverRecaptchaVerifier) {
    recoverRecaptchaVerifier = new RecaptchaVerifier(auth, "recoverRecaptcha", { size: "invisible" });
    await recoverRecaptchaVerifier.render();
  }
  return recoverRecaptchaVerifier;
}

async function buscarCandidatoRecuperacion() {
  const phoneNumber = telefonoCompletoRecuperacion();
  const phoneId = recoveryPhoneId(phoneNumber);
  const nameKey = normalizarNombre(document.getElementById("recoverName")?.value || "");
  if (!phoneId || !nameKey) {
    setStatus("recoverStatus", "Completa nombre y teléfono para continuar.", "error");
    mostrarSoporteRecuperacion(false);
    return null;
  }
  const snap = await getDoc(doc(db, "recoveryContacts", phoneId));
  if (!snap.exists()) {
    setStatus("recoverStatus", mensajeRecuperacionProtegido(), "error");
    mostrarSoporteRecuperacion(true);
    return null;
  }
  const data = snap.data();
  if (!data.phoneVerified || data.nameKey !== nameKey) {
    setStatus("recoverStatus", mensajeRecuperacionProtegido(), "error");
    mostrarSoporteRecuperacion(true);
    return null;
  }
  mostrarSoporteRecuperacion(false);
  return { ...data, phoneNumber };
}

async function enviarCodigoRecuperacion() {
  const btn = document.getElementById("btnRecoverSendCode");
  if (recoverAttemptCount >= 3) {
    setStatus("recoverStatus", "Demasiados intentos. Comunícate con soporte para proteger tu cuenta.", "error");
    mostrarSoporteRecuperacion(true);
    return;
  }
  btn.disabled = true;
  setStatus("recoverStatus", "Validando datos antes de enviar el código...");
  try {
    recoverAttemptCount += 1;
    recoverCandidate = await buscarCandidatoRecuperacion();
    if (!recoverCandidate) {
      btn.disabled = false;
      return;
    }
    const verifier = await prepararRecaptchaRecuperacion();
    const provider = new PhoneAuthProvider(auth);
    recoverVerificationId = await provider.verifyPhoneNumber(recoverCandidate.phoneNumber, verifier);
    recoverVerificationExpiresAt = Date.now() + PHONE_CODE_DURATION_MS;
    setRecoverStep(2);
    setStatus("recoverStatus", "Código enviado. Tienes 2 minutos para validarlo.");
    iniciarCronometroRecuperacion();
  } catch (err) {
    console.error("Error en recuperación de usuario:", err);
    btn.disabled = false;
    setStatus("recoverStatus", mensajeErrorTelefono(err), "error");
  }
}

async function verificarCodigoRecuperacion() {
  const code = document.getElementById("recoverCodeInput").value.trim();
  if (!recoverCandidate || !recoverVerificationId || Date.now() > recoverVerificationExpiresAt) {
    setStatus("recoverStatus", "El código venció. Solicita uno nuevo.", "error");
    actualizarCronometroRecuperacion();
    return;
  }
  if (!code) {
    setStatus("recoverStatus", "Escribe el código recibido por SMS.", "error");
    return;
  }
  try {
    registroEnCurso = true;
    const credential = PhoneAuthProvider.credential(recoverVerificationId, code);
    const cred = await signInWithCredential(auth, credential);
    if (cred.user.uid !== recoverCandidate.uid) {
      throw new Error("El teléfono verificado no coincide con el usuario registrado.");
    }
    const email = recoverCandidate.email;
    await signOut(auth);
    registroEnCurso = false;
    document.body.classList.add("group-locked");
    abrirPanelRecuperarUsuario();
    recoverVerificationId = "";
    recoverVerificationExpiresAt = 0;
    clearInterval(recoverCountdownInterval);
    actualizarCronometroRecuperacion();
    setRecoverStep(3);
    setStatus("recoverStatus", `Hemos encontrado tu cuenta. Correo electrónico registrado: ${email}`);
    const backBtn = document.getElementById("btnRecoverBack");
    if (backBtn) backBtn.textContent = "Ir a iniciar sesión";
  } catch (err) {
    registroEnCurso = false;
    if (auth.currentUser && !auth.currentUser.email) {
      await signOut(auth).catch(() => {});
    }
    console.error("No se pudo validar recuperación:", err);
    setStatus("recoverStatus", "Código inválido o vencido. Para proteger tu información, verifica el código o comunícate con soporte.", "error");
  }
}

function cambiarAuthMode(modo) {
  const login = modo === "login";
  document.getElementById("btnAuthClose")?.classList.remove("hidden");
  document.getElementById("loginPanel").classList.toggle("hidden", !login);
  document.getElementById("registerPanel").classList.toggle("hidden", login);
  document.getElementById("recoverEmailPanel")?.classList.add("hidden");
  document.getElementById("tabLogin").classList.toggle("active", login);
  document.getElementById("tabRegister").classList.toggle("active", !login);
  if (!login) inicializarRegistroPerfil();
  limpiarWarn();
}

function inicializarRegistroPerfil() {
  poblarPhoneCodes("registerPhoneCode", document.getElementById("registerPhoneCode")?.value || "+57");
  poblarUbicacion("register", {
    country: document.getElementById("registerCountry")?.value || "",
    region: document.getElementById("registerRegion")?.value || "",
    city: document.getElementById("registerCity")?.value || ""
  });
}

async function guardarPerfilDesdeFormulario() {
  if (!usuarioActual) return;
  const nombre = document.getElementById("profileName").value.trim();
  if (nombre.length < 3) {
    document.getElementById("profileStatus").textContent = "El nombre debe tener mínimo 3 caracteres.";
    return;
  }
  const datos = {
    ...perfilBasicoDesdeFormulario("profile"),
    displayName: nombre
  };
  await updateProfile(usuarioActual, { displayName: nombre });
  await guardarPerfilUsuario(datos);
  renderProfile();
  actualizarBienvenida();
  document.getElementById("profileStatus").textContent = "Perfil actualizado.";
}

function setPhoneStatus(message, type = "") {
  const status = document.getElementById("phoneStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", type === "error");
  status.classList.toggle("ok", type === "ok");
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function detenerCronometroTelefono() {
  clearInterval(phoneCountdownInterval);
  phoneCountdownInterval = null;
}

function actualizarCronometroTelefono() {
  const countdown = document.getElementById("phoneCountdown");
  const sendBtn = document.getElementById("btnSendPhoneCode");
  const restante = phoneVerificationExpiresAt - Date.now();
  if (!countdown || !sendBtn) return;

  if (phoneVerificationId && restante > 0) {
    countdown.hidden = false;
    countdown.textContent = formatCountdown(restante);
    sendBtn.disabled = true;
    sendBtn.textContent = `Reenviar en ${formatCountdown(restante)}`;
    return;
  }

  detenerCronometroTelefono();
  countdown.hidden = true;
  sendBtn.disabled = false;
  if (phoneVerificationId) {
    phoneVerificationId = "";
    phoneVerificationExpiresAt = 0;
    setPhoneStatus("El tiempo finalizó. Pide otro código.", "error");
  }
  sendBtn.textContent = "Enviar código";
}

function limpiarVerificacionTelefonoTemporal() {
  if (!phoneVerificationId && !document.getElementById("profilePhone")?.value && !document.getElementById("profilePhoneCodeInput")?.value) return;
  phoneVerificationId = "";
  phoneVerificationExpiresAt = 0;
  detenerCronometroTelefono();
  const countdown = document.getElementById("phoneCountdown");
  const sendBtn = document.getElementById("btnSendPhoneCode");
  if (countdown) countdown.hidden = true;
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Enviar código";
  }
  const phone = document.getElementById("profilePhone");
  const code = document.getElementById("profilePhoneCodeInput");
  if (phone) phone.value = "";
  if (code) code.value = "";
}

function iniciarCronometroTelefono() {
  detenerCronometroTelefono();
  actualizarCronometroTelefono();
  phoneCountdownInterval = setInterval(actualizarCronometroTelefono, 1000);
}

function mensajeErrorTelefono(err) {
  const code = err?.code || "";
  const mensajes = {
    "auth/invalid-phone-number": "El número no es válido. Revisa el indicativo del país y los dígitos.",
    "auth/too-many-requests": "Firebase bloqueó temporalmente los SMS por demasiados intentos. Espera unos minutos.",
    "auth/quota-exceeded": "Se superó la cuota de SMS de Firebase para este proyecto.",
    "auth/captcha-check-failed": "reCAPTCHA no pudo validar la solicitud. Recarga la página e intenta de nuevo.",
    "auth/app-not-authorized": "Este dominio no está autorizado en Firebase Authentication.",
    "auth/operation-not-allowed": "El proveedor Teléfono no está habilitado en Firebase Authentication."
  };
  return mensajes[code] || "No se pudo enviar el SMS. Revisa el número o intenta de nuevo.";
}

async function prepararRecaptchaTelefono() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, "phoneRecaptcha", {
      size: "invisible"
    });
    await recaptchaVerifier.render();
  }
  return recaptchaVerifier;
}

function reiniciarRecaptchaTelefono() {
  try {
    recaptchaVerifier?.clear();
  } catch {
    // Firebase puede limpiar internamente el widget antes de llegar aquí.
  }
  recaptchaVerifier = null;
}

function comprimirFotoPerfil(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      img.onload = () => {
        const scale = Math.min(1, PROFILE_PHOTO_MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", PROFILE_PHOTO_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function cargarFotoPerfil(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const status = document.getElementById("profileStatus");
  if (file.size > MAX_PROFILE_PHOTO_INPUT_MB * 1024 * 1024) {
    status.textContent = `Usa una imagen menor a ${MAX_PROFILE_PHOTO_INPUT_MB} MB.`;
    return;
  }
  status.textContent = "Procesando foto...";
  try {
    const photoData = await comprimirFotoPerfil(file);
    await guardarPerfilUsuario({ photoData });
    renderProfile();
    status.textContent = "Foto actualizada.";
  } catch (err) {
    console.error("Error procesando foto:", err);
    status.textContent = "No se pudo procesar la foto. Intenta con otra imagen.";
  }
}

function telefonoCompletoDesdePerfil() {
  const code = document.getElementById("profilePhoneCode")?.value || "+57";
  const raw = document.getElementById("profilePhone")?.value.trim().replace(/[^\d]/g, "") || "";
  return raw ? `${code}${raw}` : "";
}

async function enviarCodigoTelefono() {
  const phoneNumber = telefonoCompletoDesdePerfil();
  if (!usuarioActual || !phoneNumber || phoneNumber.length < 8) {
    setPhoneStatus("Escribe un teléfono válido con indicador de país.", "error");
    return;
  }
  const sendBtn = document.getElementById("btnSendPhoneCode");
  sendBtn.disabled = true;
  setPhoneStatus("Validando reCAPTCHA y enviando SMS...");
  try {
    const verifier = await prepararRecaptchaTelefono();
    const provider = new PhoneAuthProvider(auth);
    phoneVerificationId = await provider.verifyPhoneNumber(phoneNumber, verifier);
    phoneVerificationExpiresAt = Date.now() + PHONE_CODE_DURATION_MS;
    setPhoneStatus("Código enviado. Tienes 2 minutos para verificarlo.", "ok");
    iniciarCronometroTelefono();
  } catch (err) {
    console.error("Error enviando SMS:", err);
    reiniciarRecaptchaTelefono();
    sendBtn.disabled = false;
    sendBtn.textContent = phoneVerificationId ? "Enviar nuevo código" : "Enviar código";
    setPhoneStatus(mensajeErrorTelefono(err), "error");
  }
}

async function verificarCodigoTelefono() {
  const code = document.getElementById("profilePhoneCodeInput").value.trim();
  if (!phoneVerificationId || Date.now() > phoneVerificationExpiresAt) {
    setPhoneStatus("El código venció. Solicita uno nuevo.", "error");
    actualizarCronometroTelefono();
    return;
  }
  if (!code) {
    setPhoneStatus("Escribe el código recibido por SMS.", "error");
    return;
  }
  try {
    const credential = PhoneAuthProvider.credential(phoneVerificationId, code);
    await updatePhoneNumber(usuarioActual, credential);
    await guardarPerfilUsuario({
      phoneCode: document.getElementById("profilePhoneCode").value,
      phone: document.getElementById("profilePhone").value.trim(),
      phoneVerified: true
    });
    phoneVerificationId = "";
    phoneVerificationExpiresAt = 0;
    detenerCronometroTelefono();
    actualizarCronometroTelefono();
    document.getElementById("profilePhone").value = "";
    document.getElementById("profilePhoneCodeInput").value = "";
    await cargarPerfilUsuario();
    renderProfile();
    setPhoneStatus("Teléfono verificado correctamente.", "ok");
  } catch {
    setPhoneStatus("Código inválido o verificación no aceptada por Firebase.", "error");
  }
}

async function estudianteCambiarClase() {
  const status = document.getElementById("settingsClassStatus");
  if (pruebaActivaActual()) {
    status.textContent = "No es posible cambiar de aula porque el estudiante se encuentra realizando un examen.";
    return;
  }
  const clase = await buscarClasePorCodigo(document.getElementById("settingsClassCode").value);
  if (!clase) {
    status.textContent = "El código de aula no existe.";
    return;
  }
  claseActiva = clase.id;
  claseActualInfo = clase;
  grupoActivo = clase.id;
  classMembershipValid = true;
  localStorage.setItem(STORAGE_CLASE_ACTIVA, claseActiva);
  localStorage.setItem(STORAGE_GRUPO, grupoActivo);
  await guardarPerfilUsuario({
    classId: clase.id,
    className: clase.name,
    classCode: clase.code,
    classOwnerUid: clase.ownerUid || "",
    classOwnerEmail: clase.ownerEmail || "",
    grupo: clase.id
  });
  await sincronizarRegistroEstudianteClase(clase.id, clase.id);
  await guardarEstadoRemoto();
  await cargarPermisosRemotos([grupoActivo]);
  aplicarBancoNivelMedio();
  escucharPermisosGrupo(grupoActivo);
  escucharMembresiaClase(grupoActivo);
  aplicarModoUsuario();
  actualizarEstadoDiagnostico();
  status.textContent = `Ahora estás en el aula ${clase.name}.`;
  renderProfile();
}

async function crearPasswordEstudiante() {
  const status = document.getElementById("createPasswordStatus");
  const password = document.getElementById("createPasswordNew")?.value || "";
  const confirm = document.getElementById("createPasswordConfirm")?.value || "";
  setStatus("createPasswordStatus", "");
  if (tienePasswordActual()) {
    setStatus("createPasswordStatus", "Ya tiene contraseña.", "error");
    return;
  }
  if (!actualizarReglasPasswordEn("createPasswordRules", password)) {
    setStatus("createPasswordStatus", "La contraseña no cumple todos los requisitos.", "error");
    return;
  }
  if (password !== confirm) {
    setStatus("createPasswordStatus", "Las contraseñas no coinciden.", "error");
    return;
  }
  try {
    const credential = EmailAuthProvider.credential(usuarioActual.email, password);
    await linkWithCredential(usuarioActual, credential);
    await usuarioActual.reload();
    usuarioActual = auth.currentUser;
    document.getElementById("createPasswordNew").value = "";
    document.getElementById("createPasswordConfirm").value = "";
    actualizarReglasPasswordEn("createPasswordRules", "");
    renderConfiguracion();
    setStatus("createPasswordStatus", "Contraseña creada correctamente.");
  } catch (err) {
    setStatus("createPasswordStatus", mensajePasswordFirebase(err), "error");
  }
}

async function actualizarPasswordEstudiante() {
  const actual = document.getElementById("updatePasswordCurrent")?.value || "";
  const nueva = document.getElementById("updatePasswordNew")?.value || "";
  const confirm = document.getElementById("updatePasswordConfirm")?.value || "";
  setStatus("updatePasswordStatus", "");
  if (!tienePasswordActual()) {
    setStatus("updatePasswordStatus", "Aún no tienes contraseña. Usa la opción Crear contraseña.", "error");
    return;
  }
  if (!actual) {
    setStatus("updatePasswordStatus", "Escribe tu contraseña actual.", "error");
    return;
  }
  if (!actualizarReglasPasswordEn("updatePasswordRules", nueva)) {
    setStatus("updatePasswordStatus", "La nueva contraseña no cumple todos los requisitos.", "error");
    return;
  }
  if (nueva !== confirm) {
    setStatus("updatePasswordStatus", "Las contraseñas nuevas no coinciden.", "error");
    return;
  }
  try {
    const credential = EmailAuthProvider.credential(usuarioActual.email, actual);
    await reauthenticateWithCredential(usuarioActual, credential);
    await updatePassword(usuarioActual, nueva);
    ["updatePasswordCurrent", "updatePasswordNew", "updatePasswordConfirm"].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
    actualizarReglasPasswordEn("updatePasswordRules", "");
    setStatus("updatePasswordStatus", "Contraseña actualizada correctamente.");
  } catch (err) {
    setStatus("updatePasswordStatus", mensajePasswordFirebase(err), "error");
  }
}

async function adminCambiarGrupoEstudiante() {
  const email = document.getElementById("adminStudentEmail").value.trim().toLowerCase();
  const grupo = document.getElementById("adminStudentGroupSelect").value;
  const status = document.getElementById("adminStudentStatus");
  const aula = aulaPorId(grupo);
  if (!email.endsWith("@gmail.com") || !aula) {
    status.textContent = "Escribe un correo Gmail válido y selecciona aula.";
    return;
  }
  await crearInvitacionClase(aula, { email });
  status.textContent = `Invitación enviada a ${email} para unirse a ${aula.name}.`;
}

async function registrarEstudiantesBulk() {
  const status = document.getElementById("bulkStudentStatus");
  const raw = document.getElementById("bulkStudentEmails").value;
  const claseId = document.getElementById("bulkStudentClass")?.value || adminClaseActiva;
  await registrarEstudiantesEnClase(claseId, raw, status);
  document.getElementById("bulkStudentEmails").value = "";
}

async function registrarEstudiantesEnClase(claseId, raw, status) {
  if (!claseId) {
    if (status) status.textContent = "Primero crea o selecciona un aula.";
    return;
  }
  const clase = adminClases.find(c => c.id === claseId);
  const students = parseStudentLines(raw);
  const unique = [...new Map(students.map(item => [item.email, item])).values()];
  if (!unique.length || !clase) {
    if (status) status.textContent = "Agrega correos Gmail válidos y selecciona aula.";
    return;
  }
  if (status) status.textContent = "Creando invitaciones...";
  await Promise.all(unique.map(student => crearInvitacionClase(clase, student)));
  if (status) status.textContent = `${unique.length} invitación(es) enviada(s) para ${clase.name}.`;
  await renderAdminStudentsByClass();
}

async function eliminarClaseAdmin(classId) {
  const clase = aulaPorId(classId);
  if (!clase) return;
  const mensaje = `Eliminar aula: ${clase.name}\n\nEsta acción es permanente. Se eliminarán todos los estudiantes inscritos en esta aula, sus avances, resultados, métricas, permisos y bancos de preguntas asociados.\n\nEsta información no se podrá recuperar.`;
  if (!confirm(mensaje)) return;
  await eliminarDatosAula(classId);
  if (adminClaseActiva === classId) {
    adminClaseActiva = "";
    localStorage.removeItem(STORAGE_ADMIN_CLASE);
  }
  await cargarClasesAdmin();
  renderAdminPanel();
}

async function eliminarDatosAula(classId) {
  const estudiantes = await estudiantesDeClase(classId);
  const estadosAula = await getDocs(query(collection(db, "studentState"), where("aulaId", "==", classId)));
  const estadosClase = await getDocs(query(collection(db, "studentState"), where("claseId", "==", classId)));
  const perfilesAula = await getDocs(query(collection(db, "users"), where("classId", "==", classId)));
  const estadosIds = new Map([...estadosAula.docs, ...estadosClase.docs].map(item => [item.id, item]));
  await Promise.all([
    ...estudiantes.map(est => deleteDoc(doc(db, "classStudents", est.id))),
    ...[...estadosIds.values()].map(item => deleteDoc(item.ref)),
    ...perfilesAula.docs.map(item => updateDoc(item.ref, {
      grupo: "",
      classId: "",
      className: "",
      classCode: "",
      updatedAt: serverTimestamp()
    })),
    deleteDoc(refPermisosGrupo(classId)).catch(() => {}),
    deleteDoc(refClase(classId))
  ]);
}

async function eliminarCuentaProfesor() {
  const status = document.getElementById("teacherDeleteStatus");
  const password = document.getElementById("teacherDeletePassword")?.value || "";
  if (!modoAdmin || !usuarioActual?.email) {
    status.textContent = "Esta opción solo está disponible para cuentas de profesor.";
    return;
  }
  if (!password) {
    status.textContent = "Escribe tu contraseña para confirmar la eliminación.";
    return;
  }
  const mensaje = "Eliminar cuenta de profesor\n\nEsta acción es permanente. Si continúas, no podrás recuperar la cuenta y se eliminarán todas tus aulas, estudiantes inscritos, avances, métricas, resultados, permisos y bancos de preguntas asociados.\n\n¿Deseas continuar?";
  if (!confirm(mensaje)) return;
  try {
    status.textContent = "Eliminando cuenta y datos asociados...";
    const credential = EmailAuthProvider.credential(usuarioActual.email, password);
    await reauthenticateWithCredential(usuarioActual, credential);
    await cargarClasesAdmin();
    const aulasProfesor = [...adminClases];
    await Promise.all(aulasProfesor.map(aula => eliminarDatosAula(aula.id)));
    const recoverySnap = await getDocs(query(collection(db, "recoveryContacts"), where("uid", "==", usuarioActual.uid)));
    await Promise.all(recoverySnap.docs.map(item => deleteDoc(item.ref)));
    await setDoc(refEstadoUsuario(), { deleted: true, deletedAt: serverTimestamp(), resultados: {}, intentoActivo: null }, { merge: true });
    await deleteDoc(refPerfilUsuario());
    await deleteDoc(refEstadoUsuario()).catch(() => {});
    await deleteUser(usuarioActual);
    localStorage.clear();
    window.location.reload();
  } catch (err) {
    console.error(err);
    status.textContent = "No se pudo eliminar la cuenta. Revisa la contraseña o vuelve a iniciar sesión.";
  }
}

async function cambiarGrupoEstudianteRegistrado(id, grupo) {
  const aula = aulaPorId(grupo);
  if (!aula) return;
  await setDoc(doc(db, "classStudents", id), {
    grupo: aula.id,
    aulaId: aula.id,
    classId: aula.id,
    className: aula.name,
    classCode: aula.code,
    groupName: aula.name,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await renderAdminStudentsByClass();
}

async function eliminarEstudianteRegistrado(id) {
  if (!confirm("¿Eliminar este estudiante de la clase?")) return;
  const ref = doc(db, "classStudents", id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  await deleteDoc(ref);
  const uid = data.userUid || "";
  const email = (data.email || "").toLowerCase();
  if (uid) {
    await updateDoc(doc(db, "users", uid), {
      grupo: "",
      classId: "",
      className: "",
      classCode: "",
      classOwnerUid: "",
      classOwnerEmail: "",
      updatedAt: serverTimestamp()
    }).catch(() => {});
    await setDoc(doc(db, "studentState", uid), {
      grupo: "",
      aulaId: "",
      claseId: "",
      aulaNombre: "",
      intentoActivo: null,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  } else if (email) {
    const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", email))).catch(() => null);
    await Promise.all((usersSnap?.docs || []).map(userDoc => updateDoc(userDoc.ref, {
      grupo: "",
      classId: "",
      className: "",
      classCode: "",
      classOwnerUid: "",
      classOwnerEmail: "",
      updatedAt: serverTimestamp()
    }).catch(() => {})));
  }
  await renderAdminStudentsByClass();
}

async function eliminarDatosCuentaActual() {
  if (!usuarioActual) return;
  const uid = usuarioActual.uid;
  const email = (usuarioActual.email || "").toLowerCase();
  const deletes = [];

  const recoverySnap = await getDocs(query(collection(db, "recoveryContacts"), where("uid", "==", uid))).catch(() => null);
  if (recoverySnap) deletes.push(...recoverySnap.docs.map(item => deleteDoc(item.ref)));

  const classByUid = await getDocs(query(collection(db, "classStudents"), where("userUid", "==", uid))).catch(() => null);
  if (classByUid) deletes.push(...classByUid.docs.map(item => deleteDoc(item.ref)));

  if (email) {
    const classByEmail = await getDocs(query(collection(db, "classStudents"), where("email", "==", email))).catch(() => null);
    if (classByEmail) deletes.push(...classByEmail.docs.map(item => deleteDoc(item.ref)));
  }

  deletes.push(deleteDoc(refPerfilUsuario()).catch(() => {}));
  deletes.push(deleteDoc(refEstadoUsuario()).catch(() => {}));
  await Promise.all(deletes);
}

async function eliminarCuentaActual() {
  const status = document.getElementById("deleteAccountStatus");
  const password = document.getElementById("deleteAccountPassword").value;
  const confirmed = document.getElementById("deleteAccountConfirm").checked;
  if (!confirmed) {
    status.textContent = "Debes confirmar que entiendes que la acción es irreversible.";
    return;
  }
  if (!password || !usuarioActual?.email) {
    status.textContent = "Escribe tu contraseña para confirmar.";
    return;
  }
  try {
    const credential = EmailAuthProvider.credential(usuarioActual.email, password);
    await reauthenticateWithCredential(usuarioActual, credential);
    await eliminarDatosCuentaActual();
    await deleteUser(usuarioActual);
    localStorage.clear();
    window.location.reload();
  } catch {
    status.textContent = "No se pudo eliminar la cuenta. Revisa la contraseña o vuelve a iniciar sesión.";
  }
}

function alternarPassword(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

function requiereVerificacionEmail(user) {
  return user?.providerData?.some(provider => provider.providerId === "password") && !user.emailVerified;
}

document.getElementById("btnValidarClase")?.addEventListener("click", entrarGrupo);
document.getElementById("btnGrupoEntrar")?.addEventListener("click", entrarGrupo);
document.getElementById("grupoClave")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    entrarGrupo();
  }
});
document.getElementById("claseCodigo")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    entrarGrupo();
  }
});

async function salirApp() {
  if (!confirmarSalidaMensajes("salir")) return;
  localStorage.removeItem(STORAGE_GRUPO);
  localStorage.removeItem(STORAGE_BANCO_ACTIVO);
  localStorage.removeItem(STORAGE_CLASE_ACTIVA);
  localStorage.removeItem(STORAGE_ADMIN_CLASE);
  localStorage.removeItem(STORAGE_SECCION_ACTIVA);
  if (unsubscribePermisos) unsubscribePermisos();
  if (unsubscribeAdminStudents) unsubscribeAdminStudents();
  if (unsubscribeClassMembership) unsubscribeClassMembership();
  await signOut(auth);
  window.location.reload();
}

document.getElementById("btnSalirApp")?.addEventListener("click", salirApp);
document.getElementById("btnDrawerSalirApp")?.addEventListener("click", salirApp);
document.getElementById("btnSalirAdmin")?.addEventListener("click", salirApp);
document.getElementById("btnEmailLogin")?.addEventListener("click", loginEmail);
document.getElementById("btnEmailRegister")?.addEventListener("click", registrarEmail);
document.getElementById("btnGoogleLogin")?.addEventListener("click", loginGoogle);
document.getElementById("btnForgotPassword")?.addEventListener("click", abrirPanelRecuperarPassword);
document.getElementById("btnSendPasswordRecovery")?.addEventListener("click", recuperarPassword);
document.getElementById("btnForgotPasswordBack")?.addEventListener("click", volverLoginDesdeRecuperacion);
document.getElementById("btnRecoverPasswordClose")?.addEventListener("click", volverLoginDesdeRecuperacion);
document.getElementById("btnShowLogin")?.addEventListener("click", mostrarLoginCard);
document.getElementById("btnShowLoginNav")?.addEventListener("click", mostrarLoginCard);
document.getElementById("btnShowLoginBottom")?.addEventListener("click", mostrarLoginCard);
document.getElementById("btnShowRegister")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("btnShowRegisterNav")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("btnShowRegisterBottom")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("btnAuthClose")?.addEventListener("click", cerrarAuthCard);
document.getElementById("btnLandingMenu")?.addEventListener("click", toggleLandingMenu);
document.querySelectorAll(".landing-nav a").forEach(link => {
  link.addEventListener("click", () => document.querySelector(".landing-nav")?.classList.remove("open"));
});
document.getElementById("btnForgotUser")?.addEventListener("click", abrirPanelRecuperarUsuario);
document.getElementById("btnRecoverUserClose")?.addEventListener("click", volverLoginDesdeRecuperacion);
document.getElementById("btnRecoverBack")?.addEventListener("click", volverLoginDesdeRecuperacion);
document.getElementById("btnRecoverSendCode")?.addEventListener("click", enviarCodigoRecuperacion);
document.getElementById("btnRecoverVerifyCode")?.addEventListener("click", verificarCodigoRecuperacion);
activarArrastreWhatsapp();
document.getElementById("btnAdvisorFloat")?.addEventListener("click", () => {
  const panel = document.getElementById("advisorChatPanel");
  if (panel?.classList.contains("hidden")) abrirAsesorIA();
  else cerrarAsesorIA();
});
document.getElementById("btnAdvisorClose")?.addEventListener("click", cerrarAsesorIA);
document.getElementById("btnOpenAdvisorSection")?.addEventListener("click", abrirAsesorIA);
document.getElementById("advisorForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("advisorInput");
  const value = input?.value || "";
  if (input) input.value = "";
  enviarMensajeAsesor(value);
});
document.getElementById("advisorQuickReplies")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-advisor-quick]");
  if (btn) enviarMensajeAsesor(btn.dataset.advisorQuick || "");
});
document.getElementById("btnNotificationBell")?.addEventListener("click", () => toggleNotificationsPopover());
document.getElementById("btnCloseNotifications")?.addEventListener("click", () => toggleNotificationsPopover(false));
document.getElementById("notificationsList")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-notification-id]");
  if (btn) abrirNotificacion(btn.dataset.notificationId);
});
document.addEventListener("pointerdown", e => {
  const pop = document.getElementById("notificationsPopover");
  const bell = document.getElementById("btnNotificationBell");
  if (!pop || pop.classList.contains("hidden")) return;
  if (pop.contains(e.target) || bell?.contains(e.target)) return;
  toggleNotificationsPopover(false);
});
document.getElementById("btnSendClassMessage")?.addEventListener("click", enviarMensajeAula);
document.getElementById("messageBody")?.addEventListener("keyup", saveRichSelection);
document.getElementById("messageBody")?.addEventListener("mouseup", saveRichSelection);
document.getElementById("messageBody")?.addEventListener("focus", () => {
  saveRichSelection();
  updateRichToolbarState();
});
document.getElementById("messageBody")?.addEventListener("input", () => {
  saveRichSelection();
  updateRichToolbarState();
});
document.getElementById("messageBody")?.addEventListener("keyup", () => {
  saveRichSelection();
  updateRichToolbarState();
});
document.getElementById("messageBody")?.addEventListener("mouseup", () => {
  saveRichSelection();
  updateRichToolbarState();
});
document.getElementById("messageBody")?.addEventListener("focus", () => {
  saveRichSelection();
  updateRichToolbarState();
});
document.getElementById("messageBody")?.addEventListener("pointerdown", e => {
  const control = e.target.closest?.("[data-rich-control]");
  if (control) return;
  const editor = e.currentTarget;
  setTimeout(() => {
    editor.focus();
    saveRichSelection();
    updateRichToolbarState();
  }, 0);
});
document.getElementById("messageBody")?.addEventListener("touchend", () => setTimeout(() => {
  saveRichSelection();
  updateRichToolbarState();
}, 0));
document.addEventListener("selectionchange", () => {
  const editor = richEditor();
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  saveRichSelection();
  updateRichToolbarState();
});
document.querySelector(".message-toolbar")?.addEventListener("mousedown", e => {
  if (e.target.closest("button")) e.preventDefault();
});
document.querySelectorAll("[data-rich-panel]").forEach(btn => {
  btn.addEventListener("click", () => setRichPanel(btn.dataset.richPanel || "formato"));
});
document.querySelectorAll("[data-rich-command]").forEach(btn => {
  btn.addEventListener("click", () => execRich(btn.dataset.richCommand));
});
document.querySelectorAll("[data-rich-select]").forEach(select => {
  select.addEventListener("change", e => {
    if (e.target.value) execRich(e.target.dataset.richSelect, e.target.value);
    e.target.value = "";
  });
});
document.querySelectorAll("[data-rich-color]").forEach(input => {
  input.addEventListener("input", e => execRich(e.target.dataset.richColor, e.target.value));
});
document.querySelectorAll("[data-rich-insert]").forEach(btn => {
  btn.addEventListener("click", () => ejecutarInsercionRica(btn.dataset.richInsert));
});
document.querySelectorAll("[data-table-action]").forEach(btn => {
  btn.addEventListener("click", () => modificarTabla(btn.dataset.tableAction));
});
document.getElementById("messageBody")?.addEventListener("click", e => {
  const deleteTable = e.target.closest?.("[data-rich-control='delete-table']");
  if (deleteTable) {
    modificarTabla("delete", tablaDesdeNodo(deleteTable));
    return;
  }
  const tableAction = e.target.closest?.("[data-rich-control='table-action']");
  if (tableAction) {
    modificarTabla(tableAction.dataset.tableAction, tablaDesdeNodo(tableAction));
    return;
  }
  const deleteEquation = e.target.closest?.("[data-rich-control='delete-equation']");
  if (deleteEquation) {
    deleteEquation.closest(".math-wrap")?.remove();
    saveRichSelection();
  }
});
document.getElementById("btnPreviewMessage")?.addEventListener("click", abrirVistaPreviaMensaje);
document.getElementById("btnCloseMessagePreview")?.addEventListener("click", () => document.getElementById("messagePreviewOverlay")?.classList.add("hidden"));
document.getElementById("messagePreviewOverlay")?.addEventListener("pointerdown", e => {
  if (e.target.id === "messagePreviewOverlay") e.currentTarget.classList.add("hidden");
});
document.getElementById("btnCloseEmojiPicker")?.addEventListener("click", () => document.getElementById("emojiOverlay")?.classList.add("hidden"));
document.getElementById("emojiOverlay")?.addEventListener("pointerdown", e => {
  if (e.target.id === "emojiOverlay") e.currentTarget.classList.add("hidden");
});
document.getElementById("emojiGrid")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-emoji]");
  if (!btn) return;
  insertarHtmlEnEditor(escapeHtml(btn.dataset.emoji));
  document.getElementById("emojiOverlay")?.classList.add("hidden");
});
document.getElementById("emojiSearch")?.addEventListener("input", e => renderEmojiPicker(e.target.value));
document.getElementById("btnCloseEquationEditor")?.addEventListener("click", () => document.getElementById("equationOverlay")?.classList.add("hidden"));
document.getElementById("equationOverlay")?.addEventListener("pointerdown", e => {
  if (e.target.id === "equationOverlay") e.currentTarget.classList.add("hidden");
});
document.getElementById("equationInput")?.addEventListener("input", renderEquationPreview);
document.getElementById("equationPalette")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-eq-template]");
  const input = document.getElementById("equationInput");
  if (!btn || !input) return;
  input.value = normalizarLatexPlantilla(btn.dataset.eqTemplate);
  input.focus();
  renderEquationPreview();
});
document.getElementById("btnInsertInlineEquation")?.addEventListener("click", () => insertarEcuacion(false));
document.getElementById("btnInsertBlockEquation")?.addEventListener("click", () => insertarEcuacion(true));
document.getElementById("messageBody")?.addEventListener("input", () => {
  const status = document.getElementById("messageComposeStatus");
  if (status && status.textContent === "Mensaje enviado.") status.textContent = "";
});
document.getElementById("messageThreadList")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-open-message]");
  if (btn) abrirDetalleMensaje(btn.dataset.openMessage);
});
document.getElementById("btnCloseMessageDetail")?.addEventListener("click", () => {
  activeMessageId = "";
  document.getElementById("messageDetailOverlay")?.classList.add("hidden");
});
document.getElementById("messageDetailOverlay")?.addEventListener("pointerdown", e => {
  if (e.target.id === "messageDetailOverlay") {
    activeMessageId = "";
    e.currentTarget.classList.add("hidden");
  }
});
document.getElementById("messageReplyForm")?.addEventListener("submit", responderMensaje);
document.addEventListener("pointerdown", e => {
  const panel = document.getElementById("advisorChatPanel");
  const floatBtn = document.getElementById("btnAdvisorFloat");
  if (!panel || panel.classList.contains("hidden")) return;
  if (panel.contains(e.target) || floatBtn?.contains(e.target)) return;
  cerrarAsesorIA();
});
document.getElementById("btnClassLater")?.addEventListener("click", continuarSinAula);
document.querySelectorAll("[data-go-exam]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!aulaActualValida()) {
      renderExamenesHub();
      return;
    }
    activarNav(btn.dataset.goExam);
    if (btn.dataset.goExam?.startsWith("nivel")) abrirNivel(btn.dataset.goExam);
  });
});
document.querySelectorAll("[data-role-choice]").forEach(btn => {
  btn.addEventListener("click", () => guardarRolUsuario(btn.dataset.roleChoice));
});
document.getElementById("tabLogin")?.addEventListener("click", () => cambiarAuthMode("login"));
document.getElementById("tabRegister")?.addEventListener("click", () => cambiarAuthMode("register"));
document.getElementById("registerPassword")?.addEventListener("input", actualizarReglasPassword);
document.getElementById("btnSaveProfile")?.addEventListener("click", guardarPerfilDesdeFormulario);
document.getElementById("btnChoosePhoto")?.addEventListener("click", () => document.getElementById("profilePhotoInput")?.click());
document.getElementById("btnTakePhoto")?.addEventListener("click", () => document.getElementById("profileCameraInput")?.click());
document.getElementById("profilePhotoInput")?.addEventListener("change", e => cargarFotoPerfil(e.target.files?.[0]));
document.getElementById("profileCameraInput")?.addEventListener("change", e => cargarFotoPerfil(e.target.files?.[0]));
document.getElementById("btnRemovePhoto")?.addEventListener("click", async () => {
  await guardarPerfilUsuario({ photoData: "" });
  renderProfile();
  document.getElementById("profileStatus").textContent = "Foto eliminada.";
});
document.getElementById("profilePhotoPreview")?.addEventListener("click", () => {
  document.getElementById("photoFullImage").src = document.getElementById("profilePhotoPreview").src;
  document.getElementById("photoOverlay").classList.remove("hidden");
});
document.getElementById("btnClosePhotoOverlay")?.addEventListener("click", () => document.getElementById("photoOverlay").classList.add("hidden"));
document.getElementById("btnSendPhoneCode")?.addEventListener("click", enviarCodigoTelefono);
document.getElementById("btnVerifyPhoneCode")?.addEventListener("click", verificarCodigoTelefono);
document.getElementById("btnSettingsChangeGroup")?.addEventListener("click", estudianteCambiarClase);
document.getElementById("btnSettingsBancoAnterior")?.addEventListener("click", () => cambiarBanco(-1));
document.getElementById("btnSettingsBancoSiguiente")?.addEventListener("click", () => cambiarBanco(1));
document.getElementById("btnSettingsChangeClass")?.addEventListener("click", estudianteCambiarClase);
document.getElementById("btnCreatePassword")?.addEventListener("click", crearPasswordEstudiante);
document.getElementById("btnUpdatePassword")?.addEventListener("click", actualizarPasswordEstudiante);
document.getElementById("createPasswordNew")?.addEventListener("input", e => actualizarReglasPasswordEn("createPasswordRules", e.target.value));
document.getElementById("updatePasswordNew")?.addEventListener("input", e => actualizarReglasPasswordEn("updatePasswordRules", e.target.value));
document.getElementById("btnCreateClass")?.addEventListener("click", crearClaseAdmin);
document.getElementById("adminClassSelect")?.addEventListener("change", e => {
  adminClaseActiva = e.target.value;
  adminGrupoActual = adminClaseActiva;
  localStorage.setItem(STORAGE_ADMIN_CLASE, adminClaseActiva);
  const bulkClass = document.getElementById("bulkStudentClass");
  if (bulkClass) bulkClass.value = adminClaseActiva;
  renderAdminStudentsByClass().catch(err => console.warn("No se pudieron cargar estudiantes.", err));
  renderAdminPanel();
  if (!document.getElementById("adminMetricsPanel")?.hidden) renderAdminStats();
});
document.getElementById("btnBulkStudents")?.addEventListener("click", registrarEstudiantesBulk);
document.getElementById("btnDeleteSelectedClass")?.addEventListener("click", () => {
  const selected = document.getElementById("adminClassSelect")?.value || adminClaseActiva;
  eliminarClaseAdmin(selected);
});
document.getElementById("adminStudentsByClass")?.addEventListener("input", e => {
  const search = e.target.closest("[data-class-search]");
  if (!search) return;
  const classId = search.dataset.classSearch;
  const term = search.value.trim().toLowerCase();
  document.querySelectorAll(`[data-class-list="${classId}"] [data-student-row]`).forEach(row => {
    row.hidden = term && !row.dataset.search.toLowerCase().includes(term);
  });
});
document.getElementById("adminStudentsByClass")?.addEventListener("change", e => {
  const select = e.target.closest("[data-student-group]");
  if (!select) return;
  cambiarGrupoEstudianteRegistrado(select.dataset.studentGroup, select.value);
});
document.getElementById("adminStudentsByClass")?.addEventListener("click", e => {
  const addBtn = e.target.closest("[data-add-students-class]");
  if (addBtn) {
    const classId = addBtn.dataset.addStudentsClass;
    const input = document.querySelector(`[data-class-add-input="${classId}"]`);
    const status = document.querySelector(`[data-class-status="${classId}"]`);
    registrarEstudiantesEnClase(classId, input?.value || "", status).then(() => {
      if (input) input.value = "";
    });
    return;
  }
  const deleteClassBtn = e.target.closest("[data-delete-class]");
  if (deleteClassBtn) {
    eliminarClaseAdmin(deleteClassBtn.dataset.deleteClass);
    return;
  }
  const btn = e.target.closest("[data-delete-student]");
  if (!btn) return;
  eliminarEstudianteRegistrado(btn.dataset.deleteStudent);
});
document.getElementById("btnDeleteAccount")?.addEventListener("click", eliminarCuentaActual);
document.getElementById("btnDeleteTeacherAccount")?.addEventListener("click", eliminarCuentaProfesor);
document.getElementById("btnAdminChangeStudentGroup")?.addEventListener("click", adminCambiarGrupoEstudiante);
document.getElementById("btnDrawerToggle")?.addEventListener("click", () => {
  if (document.getElementById("sideDrawer").classList.contains("hidden")) abrirDrawer();
  else cerrarDrawer();
});
document.getElementById("btnDrawerClose")?.addEventListener("click", cerrarDrawer);
document.getElementById("drawerBackdrop")?.addEventListener("click", cerrarDrawer);
document.getElementById("btnDrawerHome")?.addEventListener("click", () => {
  if (activarNav(modoAdmin ? "admin" : "inicio")) cerrarDrawer();
});
document.querySelectorAll(".drawer-link[data-section]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (activarNav(btn.dataset.section)) cerrarDrawer();
  });
});
document.addEventListener("toggle", e => {
  const details = e.target;
  if (!(details instanceof HTMLDetailsElement) || !details.open) return;
  details.parentElement?.querySelectorAll(":scope > details.accordion-card, :scope > details.profile-panel, :scope > details.phone-panel").forEach(other => {
    if (other !== details) other.open = false;
  });
}, true);
document.querySelectorAll("[data-toggle-password]").forEach(btn => {
  btn.addEventListener("click", () => alternarPassword(btn.dataset.togglePassword));
});
document.querySelectorAll("[data-notification-toggle]").forEach(toggle => {
  toggle.addEventListener("change", cambiarNotificaciones);
});

window.addEventListener("beforeunload", e => {
  if (!hayBorradorMensajeProfesor()) return;
  e.preventDefault();
  e.returnValue = "";
});

document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.defaultPrevented) return;
  const target = e.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.type === "file" || target.type === "checkbox" || target.type === "radio") return;
  const explicitTargets = {
    loginEmail: "btnEmailLogin",
    loginPassword: "btnEmailLogin",
    registerName: "btnEmailRegister",
    registerEmail: "btnEmailRegister",
    registerPassword: "btnEmailRegister",
    claseCodigo: "btnValidarClase",
    forgotPasswordEmail: "btnSendPasswordRecovery",
    recoverName: "btnRecoverSendCode",
    recoverPhone: "btnRecoverSendCode",
    recoverCodeInput: "btnRecoverVerifyCode",
    profilePhone: "btnSendPhoneCode",
    profilePhoneCodeInput: "btnVerifyPhoneCode",
    settingsClassCode: "btnSettingsChangeClass",
    createPasswordNew: "btnCreatePassword",
    createPasswordConfirm: "btnCreatePassword",
    updatePasswordCurrent: "btnUpdatePassword",
    updatePasswordNew: "btnUpdatePassword",
    updatePasswordConfirm: "btnUpdatePassword",
    deleteAccountPassword: "btnDeleteAccount",
    teacherDeletePassword: "btnDeleteTeacherAccount",
    adminClassName: "btnCreateClass",
    adminStudentEmail: "btnAdminChangeStudentGroup"
  };
  const explicit = explicitTargets[target.id] ? document.getElementById(explicitTargets[target.id]) : null;
  if (explicit && !explicit.disabled) {
    e.preventDefault();
    explicit.click();
    return;
  }
  const panel = target.closest(".auth-form, .group-entry, .profile-panel, .accordion-card, .admin-panel, .settings-shell, .profile-shell");
  if (!panel) return;
  const button = panel.querySelector("button.btn-primary:not([disabled]), button.btn-secondary:not([disabled])");
  if (!button) return;
  e.preventDefault();
  button.click();
});

capturarInvitacionUrl();
inicializarRegistroPerfil();

onAuthStateChanged(auth, async user => {
  usuarioActual = user;
  if (!user) {
    if (unsubscribeAdminStudents) unsubscribeAdminStudents();
    unsubscribeAdminStudents = null;
    if (unsubscribeClassMembership) unsubscribeClassMembership();
    unsubscribeClassMembership = null;
    detenerListenersComunicacion();
    classMembershipValid = true;
    document.getElementById("advisorWidget")?.classList.add("hidden");
    cerrarAsesorIA();
    document.body.classList.add("group-locked");
    mostrarAuthInicial();
    return;
  }
  if (registroEnCurso) return;
  if (requiereVerificacionEmail(user) && user.email?.toLowerCase() !== ADMIN_EMAIL) {
    await signOut(auth);
    document.body.classList.add("group-locked");
    mostrarAuthInicial();
    mostrarWarn("Tu correo aún no está verificado. Abre el enlace que llegó a Gmail.");
    return;
  }
  limpiarWarn();
  if (user.providerData?.some(provider => provider.providerId === "google.com")) {
    await guardarDatosGoogleIniciales(user);
  }
  await prepararSesionAutenticada();
});

function renderAdminPanel() {
  if (!modoAdmin) return;
  const list = document.getElementById("adminList");
  if (!list) return;
  renderClassSelectors();

  adminGrupoActual = adminClaseActiva || idsAulasAdmin()[0] || "";
  if (adminGrupoActual) {
    cargarPermisosRemotos([adminGrupoActual]).catch(err => console.warn("No se pudieron cargar permisos del aula.", err));
  }
  const aula = aulaPorId(adminGrupoActual);
  const nombres = [
    ["diagnostico", "Diagnóstico"],
    ["nivel1", "Nivel Medio"],
    ["examen", "Examen Final"]
  ];

  list.innerHTML = "";
  const info = document.createElement("p");
  info.className = "admin-current-group";
  info.textContent = aula ? `${aula.name} · Código: ${aula.code}` : "Selecciona o crea un aula para configurar permisos.";
  list.appendChild(info);

  if (!aula) {
    renderBankPanel();
    return;
  }

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
  renderBankPanel();
  if (!document.getElementById("adminMetricsPanel")?.hidden) renderAdminStats();
}

function renderBankPanel() {
  const nivelSelect = document.getElementById("bankNivelSelect");
  const bancoSelect = document.getElementById("bankBancoSelect");
  if (!nivelSelect || !bancoSelect) return;

  if (!bancoSelect.options.length) {
    bancoSelect.innerHTML = BANCOS_DISPONIBLES.map(banco => `<option value="${banco}">${NOMBRES_BANCOS[banco]}</option>`).join("");
  }
  adminGrupoActual = adminClaseActiva || adminGrupoActual || idsAulasAdmin()[0] || "";
  const nivel = nivelSelect.value || "diagnostico";
  bancoSelect.value = bancosGrupo[adminGrupoActual]?.[nivel] || "principal";
}

async function renderAdminStats() {
  const cont = document.getElementById("adminStats");
  if (!cont || !modoAdmin) return;
  cont.innerHTML = `<div class="stats-card"><h3>Métricas</h3><p>Cargando datos...</p></div>`;
  const snaps = await getDocs(collection(db, "studentState"));
  const acumulado = {};
  adminClases.forEach(aula => acumulado[aula.id] = { aula, estudiantes: new Set(), intentos: 0, correctas: 0, incorrectas: 0, nota: 0, tiempo: 0 });
  snaps.forEach(snap => {
    const data = snap.data();
    const grupo = data.aulaId || data.claseId || data.grupo;
    if (!acumulado[grupo]) return;
    if (adminClaseActiva && grupo !== adminClaseActiva) return;
    const bucket = acumulado[grupo];
    bucket.estudiantes.add(data.uid || snap.id);
    const resultados = data.resultados || {};
    Object.entries(resultados).forEach(([clave, value]) => {
      if (!String(clave).includes("::") && resultados[`principal::${clave}`]) return;
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
  const ranking = Object.entries(acumulado)
    .filter(([, data]) => data.intentos > 0)
    .map(([grupo, data]) => ({
      grupo,
      data,
      promedioNota: data.nota / data.intentos,
      promedioCorrectas: data.correctas / data.intentos,
      promedioIncorrectas: data.incorrectas / data.intentos,
      promedioTiempo: data.tiempo / data.intentos
    }))
    .sort((a, b) => b.promedioNota - a.promedioNota || b.promedioCorrectas - a.promedioCorrectas || a.promedioTiempo - b.promedioTiempo);

  if (ranking.length) {
    const mejor = ranking[0];
    const bestCard = document.createElement("div");
    bestCard.className = "stats-card";
    bestCard.innerHTML = `
      <h3>Mejor aula: ${mejor.data.aula?.name || "Aula"}</h3>
      <p><strong>Estudiantes:</strong> ${mejor.data.estudiantes.size}</p>
      <p><strong>Intentos:</strong> ${mejor.data.intentos}</p>
      <p><strong>Promedio nota:</strong> ${mejor.promedioNota.toFixed(1)}</p>
      <p><strong>Promedio correctas:</strong> ${mejor.promedioCorrectas.toFixed(1)}</p>
      <p><strong>Promedio incorrectas:</strong> ${mejor.promedioIncorrectas.toFixed(1)}</p>
      <p><strong>Promedio tiempo:</strong> ${formatTiempo(Math.round(mejor.promedioTiempo))}</p>
    `;
    cont.appendChild(bestCard);
  }

  Object.entries(acumulado).forEach(([grupo, data]) => {
    const card = document.createElement("div");
    card.className = "stats-card";
    const n = data.intentos || 1;
    card.innerHTML = `
      <h3>${data.aula?.name || "Aula"}</h3>
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

document.getElementById("bankGrupoSelect")?.addEventListener("change", (e) => {
  adminGrupoActual = e.target.value;
  renderAdminPanel();
});

document.getElementById("bankNivelSelect")?.addEventListener("change", renderBankPanel);

document.getElementById("btnGuardarBanco")?.addEventListener("click", async () => {
  const grupo = adminClaseActiva || adminGrupoActual;
  const nivel = document.getElementById("bankNivelSelect")?.value || "diagnostico";
  const banco = document.getElementById("bankBancoSelect")?.value || "principal";
  const status = document.getElementById("bankStatus");
  if (!grupo) {
    if (status) status.textContent = "Primero crea o selecciona un aula.";
    return;
  }
  await guardarBancoGrupoRemoto(grupo, nivel, banco);
  if (status) status.textContent = `Banco guardado para ${nombreAulaPorId(grupo)}.`;
  renderBankPanel();
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
  setExamHeaderActivo(true);
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
  if (!timerActivo && !timerNivelActivo) setExamHeaderActivo(false);
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
  aplicarVisibilidadResultadoIntento("examen", "resultsSectionExamen", "btnRestartExamen");
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
