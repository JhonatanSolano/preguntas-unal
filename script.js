import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken
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
  linkWithPopup,
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
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  deleteObject,
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
  emailVerificationEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/sendEmailVerificationCustom",
  deepDeleteEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/deleteInstitutionDeep",
  blockInstitutionEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/blockInstitutionPremium",
  institutionMemberEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/manageInstitutionMembers",
  removeInstitutionStudentEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/removeInstitutionClassStudent",
  examAccessEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/getExamAccessState",
  examAccessUpdateEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/updateExamAccessConfig",
  teacherExamQuestionsEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/getTeacherExamQuestions",
  examAttemptSubmitEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/submitExamAttempt",
  examAttemptFeedbackEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/getExamAttemptFeedback",
  academicReportEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/getAcademicReport",
  payments: {
    provider: "Wompi",
    checkoutReady: true,
    checkoutEndpoint: "https://us-central1-preguntas-tipo-examen.cloudfunctions.net/createPaymentIntent",
    studentPriceCOP: 10000,
    teacherPriceCOP: null
  },
  support: {
    email: "soporte@matematicasentubolsillo.com",
    infoEmail: "info@matematicasentubolsillo.com"
  }
};

const app = initializeApp(firebaseConfig);
let appCheck = null;
window.__matematicasAppCheckStatus = {
  initialized: false,
  tokenReady: false,
  lastError: ""
};
try {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(APP_CONFIG.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
  window.__matematicasAppCheckStatus.initialized = true;
  getAppCheckToken(appCheck, true)
    .then(() => {
      window.__matematicasAppCheckStatus.tokenReady = true;
      window.__matematicasAppCheckStatus.lastError = "";
      console.info("App Check verificado correctamente para Matemáticas En Tu Bolsillo.");
    })
    .catch(err => {
      window.__matematicasAppCheckStatus.tokenReady = false;
      window.__matematicasAppCheckStatus.lastError = String(err?.message || err);
      console.error("No se pudo obtener token de App Check.", err);
    });
} catch (err) {
  window.__matematicasAppCheckStatus.lastError = String(err?.message || err);
  console.warn("No se pudo iniciar App Check. La autenticación continuará sin App Check.", err);
}
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
setPersistence(auth, browserLocalPersistence);
document.title = APP_CONFIG.name;

async function obtenerHeadersAppCheck() {
  if (!appCheck) throw new Error("No se pudo verificar la seguridad de la app. Recarga e intenta nuevamente.");
  const token = await getAppCheckToken(appCheck, false);
  if (!token?.token) throw new Error("No se pudo verificar la seguridad de la app. Recarga e intenta nuevamente.");
  return { "X-Firebase-AppCheck": token.token };
}

async function fetchConAppCheck(endpoint, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...(await obtenerHeadersAppCheck())
  };
  return fetch(endpoint, { ...options, headers });
}

async function authedFetch(endpoint, options = {}, forceRefreshToken = false) {
  if (!usuarioActual) throw new Error("Debes iniciar sesión.");
  const idToken = await usuarioActual.getIdToken(forceRefreshToken);
  const headers = {
    ...(options.headers || {}),
    "Authorization": `Bearer ${idToken}`,
    ...(await obtenerHeadersAppCheck())
  };
  return fetch(endpoint, { ...options, headers });
}

const ADMIN_EMAIL = "solanojhonatan2000@gmail.com";
const STORAGE_LOGIN_EXPECTED_TYPE = "matematicasBolsilloLoginExpectedType";
const INDEPENDENT_CLASS_CODE = "J5AEDJ";
const INDEPENDENT_CLASS_NAME = "Matemáticas En Tu Bolsillo";
const SIMBOLOS_PERMITIDOS = "!@#$%^&*()_+-=[]{};:,.?";
const TIMEZONE_BY_COUNTRY = {
  CO: {
    countryCode: "CO",
    countryNames: ["colombia"],
    label: "Colombia",
    timeZone: "America/Bogota",
    offsetMinutes: -300
  },
  VE: {
    countryCode: "VE",
    countryNames: ["venezuela"],
    label: "Venezuela",
    timeZone: "America/Caracas",
    offsetMinutes: -240
  }
};
let usuarioActual = null;
let perfilActual = null;
let unsubscribePermisos = null;
let unsubscribeAdminStudents = null;
let unsubscribeClassMembership = null;
let unsubscribeNotifications = null;
let unsubscribeMessages = null;
let unsubscribeReplies = null;
let unsubscribeBillingHistory = null;
let renderizandoAdminStudents = false;
let classMembershipValid = true;
let registroEnCurso = false;
let loginExpectedTypePending = "";
let loginRejectMessagePending = "";
let suppressAuthResetOnce = false;
let googleAuthFlowInProgress = false;
let autoClassEnrollmentInProgress = false;
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
const avatarProfileCache = new Map();
let activeMessageId = "";
let equationInsertTarget = "message";
let teacherQuestions = [];
let teacherQuestionImageFile = null;
let paymentStep = 0;
let selectedPaymentMethod = "pse";
let selectedCheckoutPlanId = "";
let billingHistoryItems = [];
let activeBillingTab = "subscription";
let planChangeInProgress = false;
let messageHistoryClassId = "";
let recoverAttemptCount = 0;
let seccionActual = "inicio";
let historialSecciones = [];
let historialAdelante = [];
let savedRichSelection = null;
let teacherReportRows = [];
let teacherReportFiltered = [];
let teacherReportPage = 1;
let teacherReportSort = { key: "studentName", dir: "asc" };
const attachmentPreviewUrls = new Map();
const EMOJIS_MENSAJE = [
  ["😀", "feliz sonrisa alegre"], ["😃", "sonrisa feliz"], ["😄", "risa feliz"], ["😁", "sonrisa grande"], ["😆", "risa"], ["😅", "risa sudor"], ["😂", "llorando risa fuerte"], ["🤣", "carcajada llorando fuerte"], ["😭", "cara llorando fuerte"], ["😉", "guiño"], ["😘", "beso"], ["😗", "beso"], ["😙", "beso feliz"], ["😚", "beso tierno"], ["🥰", "amor cariño"], ["😍", "enamorado corazones"], ["🤩", "estrella emoción"], ["🥳", "celebración fiesta"], ["🤔", "pensando duda"], ["🙄", "ojos arriba"], ["🙂", "sonrisa suave"], ["🥲", "sonrisa lágrima"], ["🥺", "tierno triste"], ["😊", "feliz amable"], ["😌", "tranquilo"], ["😔", "triste"], ["😇", "ángel"], ["😈", "diablo"], ["⭐", "estrella"], ["👍", "bien pulgar"], ["❤️", "corazón amor"]
];
const SECCIONES_ESTUDIANTE = new Set(["inicio", "perfil", "aprendizaje", "insignias", "examenes", "diagnostico", "nivel1", "examen", "estadisticas", "mensajes", "asesorIA", "suscripcion", "configuracion", "facturacion", "soporte"]);
const SECCIONES_PROFESOR = new Set(["admin", "perfil", "aprendizaje", "examenes", "adminMetricas", "reportes", "mensajes", "asesorIA", "suscripcion", "configuracion", "facturacion", "soporte"]);
const SECCIONES_ESTUDIANTE_INSTITUCIONAL = new Set(["inicio", "perfil", "aprendizaje", "insignias", "examenes", "diagnostico", "nivel1", "examen", "estadisticas", "mensajes", "asesorIA", "configuracion", "soporte"]);
const SECCIONES_PROFESOR_INSTITUCIONAL = new Set(["admin", "perfil", "aprendizaje", "examenes", "adminMetricas", "reportes", "mensajes", "asesorIA", "configuracion", "soporte"]);
const SECCIONES_INSTITUCION = new Set(["inicio", "perfil", "adminMetricas", "suscripcion", "facturacion", "configuracion", "soporte"]);
const PHONE_CODE_DURATION_MS = 2 * 60 * 1000;
const MAX_PROFILE_PHOTO_INPUT_MB = 12;
const MAX_MESSAGE_ATTACHMENT_MB = 8;
const PROFILE_PHOTO_MAX_SIDE = 900;
const PROFILE_PHOTO_QUALITY = 0.82;
const PROFILE_PHOTO_FULL_MAX_SIDE = 1800;
const PROFILE_PHOTO_FULL_QUALITY = 0.92;
const REPORT_PAGE_SIZE = 10;
const LEARNING_STORAGE_KEY = "matematicasBolsilloLearningProgress";
const LEARNING_LAST_KEY = "matematicasBolsilloLearningLast";
const LEARNING_RESOURCE_COLLECTION = "learningResources";
const LEARNING_RESOURCE_MAX_PDF_MB = 25;
const LEARNING_RESOURCE_MAX_VIDEO_MB = 180;
const LEARNING_RESOURCE_MAX_IMAGE_MB = 8;
let learningProgressRemote = {};
let learningProgressRemoteLoadedFor = "";
let learningResourcesCache = new Map();
let learningManagerSavedSnapshot = "";
const EXAM_DURATIONS_BY_LEVEL = {
  diagnostico: 15 * 60,
  nivel1: 25 * 60,
  examen: 35 * 60
};
const LEVEL_LABELS = {
  facil: "Fácil",
  medio: "Medio",
  avanzado: "Avanzado"
};
const LEVEL_TO_EXAM = {
  facil: "diagnostico",
  medio: "nivel1",
  avanzado: "examen"
};
const EXAM_TO_LEVEL = {
  diagnostico: "facil",
  nivel1: "medio",
  examen: "avanzado"
};
const MATH_DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "$", right: "$", display: false },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false }
];

function slugifyLearningId(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tema";
}

function makeLearningLevels(branchTitle, topicTitle, subtopicTitle) {
  const clean = subtopicTitle || topicTitle;
  return {
    facil: {
      theory: `En este nivel reconoces la idea central de ${clean}. La meta es identificar sus elementos, leer ejemplos simples y conectar el concepto con problemas cotidianos.`,
      example: [`Observa el concepto de ${clean}.`, `Identifica los datos principales.`, `Relaciona la pregunta con una operación o representación básica.`],
      practice: { question: `¿Cuál es el primer paso para estudiar ${clean}?`, options: ["Identificar datos y objetivo", "Memorizar sin comprender", "Saltar directo al resultado"], answer: 0 }
    },
    medio: {
      theory: `En este nivel aplicas ${clean} en ejercicios con varios pasos. La atención está en justificar el procedimiento y elegir una estrategia adecuada.`,
      example: [`Lee el enunciado y separa la información relevante.`, `Selecciona una representación: tabla, gráfica, ecuación o diagrama.`, `Resuelve paso a paso y verifica la coherencia del resultado.`],
      practice: { question: `Para resolver un ejercicio medio de ${clean}, conviene`, options: ["Organizar datos antes de operar", "Responder por intuición", "Ignorar las unidades"], answer: 0 }
    },
    avanzado: {
      theory: `En este nivel conectas ${clean} con otras ramas de matemáticas. Se trabajan argumentos, modelación y problemas tipo examen con mayor carga conceptual.`,
      example: [`Modela la situación usando herramientas de ${topicTitle}.`, `Compara métodos y escoge el más eficiente.`, `Interpreta el resultado dentro del contexto del problema.`],
      practice: { question: `Un buen cierre avanzado en ${clean} debe incluir`, options: ["Resultado, interpretación y verificación", "Solo la respuesta final", "Un procedimiento incompleto"], answer: 0 }
    }
  };
}

function makeLearningSubtopic(branchTitle, topicTitle, title, summary = "") {
  return {
    id: slugifyLearningId(title),
    title,
    summary: summary || `Estudia ${title} con teoría, ejemplos, recursos y práctica por niveles.`,
    keyConcepts: ["Definición", "Representación", "Aplicación", "Verificación"],
    levels: makeLearningLevels(branchTitle, topicTitle, title)
  };
}

function makeLearningTopic(branchTitle, id, title, summary, subtopics, keyConcepts = []) {
  return {
    id,
    title,
    summary,
    keyConcepts: keyConcepts.length ? keyConcepts : ["Conceptos base", "Procedimientos", "Aplicaciones"],
    subtopics: subtopics.map(item => Array.isArray(item)
      ? makeLearningSubtopic(branchTitle, title, item[0], item[1])
      : makeLearningSubtopic(branchTitle, title, item)
    )
  };
}

const LEARNING_CATALOG = [
  {
    id: "aritmetica",
    title: "Aritmética",
    icon: "🔢",
    description: "Números, operaciones, razones y proporcionalidad.",
    topics: [
      makeLearningTopic("Aritmética", "numeros-operaciones", "Números y operaciones", "Construye sentido numérico y fluidez operativa.", ["Números naturales", "Números enteros", "Números racionales", "Fracciones", "Decimales", "Potencias", "Raíces", "Notación científica"]),
      makeLearningTopic("Aritmética", "proporcionalidad", "Proporcionalidad", "Relaciona cantidades y compara magnitudes.", ["Razones", "Proporciones", "Regla de tres", "Porcentajes", "Escalas", "Variación directa", "Variación inversa"])
    ]
  },
  {
    id: "algebra",
    title: "Álgebra",
    icon: "🧩",
    description: "Expresiones, ecuaciones, factorización y patrones.",
    topics: [
      makeLearningTopic("Álgebra", "expresiones", "Expresiones algebraicas", "Manipula símbolos para representar relaciones.", ["Variables", "Términos semejantes", "Productos notables", "Simplificación", "Valor numérico"]),
      makeLearningTopic("Álgebra", "ecuaciones", "Ecuaciones y despejes", "Transforma igualdades sin perder equivalencia.", ["Ecuaciones lineales", "Ecuaciones con fracciones", "Ecuaciones cuadráticas", "Despeje de fórmulas", "Inecuaciones"]),
      makeLearningTopic("Álgebra", "factorizacion", "Factorización", "Convierte expresiones en productos útiles.", ["Factor común", "Trinomios", "Diferencia de cuadrados", "Agrupación", "Suma y diferencia de cubos"]),
      makeLearningTopic("Álgebra", "sistemas", "Sistemas de ecuaciones", "Resuelve relaciones simultáneas.", ["Método gráfico", "Sustitución", "Eliminación", "Sistemas 2x2", "Aplicaciones"])
    ]
  },
  {
    id: "funciones",
    title: "Funciones",
    icon: "📈",
    description: "Dominio, rango, gráficas, modelos y transformaciones.",
    topics: [
      makeLearningTopic("Funciones", "fundamentos", "Fundamentos de funciones", "Comprende qué hace que una relación sea función.", ["Concepto de función", "Partes de una función", "Dominio", "Rango", "Puntos de corte", "Evaluación de funciones"]),
      makeLearningTopic("Funciones", "graficas-transformaciones", "Gráficas y transformaciones", "Lee y transforma gráficas con sentido visual.", ["Gráfica", "Traslaciones", "Reflexiones", "Estiramientos", "Compresiones", "Función inversa"]),
      makeLearningTopic("Funciones", "tipos-funciones", "Tipos de funciones", "Reconoce familias y modelos frecuentes.", ["Funciones lineales", "Funciones cuadráticas", "Funciones polinómicas", "Funciones racionales", "Funciones exponenciales", "Funciones logarítmicas", "Funciones trigonométricas", "Funciones por partes"])
    ]
  },
  {
    id: "geometria",
    title: "Geometría",
    icon: "📐",
    description: "Figuras, medidas, semejanza, áreas y volumen.",
    topics: [
      makeLearningTopic("Geometría", "figuras-planas", "Figuras planas", "Analiza formas y medidas en el plano.", ["Ángulos", "Triángulos", "Cuadriláteros", "Polígonos", "Circunferencia", "Área y perímetro"]),
      makeLearningTopic("Geometría", "geometria-espacial", "Geometría espacial", "Comprende cuerpos, superficies y volumen.", ["Prismas", "Pirámides", "Cilindros", "Conos", "Esferas", "Volumen", "Área superficial"]),
      makeLearningTopic("Geometría", "semejanza-congruencia", "Semejanza y congruencia", "Compara figuras con argumentos geométricos.", ["Criterios de congruencia", "Criterios de semejanza", "Teorema de Tales", "Escalas", "Pitágoras"])
    ]
  },
  {
    id: "trigonometria",
    title: "Trigonometría",
    icon: "📏",
    description: "Razones trigonométricas, identidades y aplicaciones.",
    topics: [
      makeLearningTopic("Trigonometría", "razones", "Razones trigonométricas", "Relaciona ángulos y lados.", ["Seno", "Coseno", "Tangente", "Triángulos rectángulos", "Ángulos especiales"]),
      makeLearningTopic("Trigonometría", "identidades", "Identidades trigonométricas", "Simplifica y demuestra relaciones.", ["Identidad pitagórica", "Ángulo doble", "Suma y diferencia", "Ecuaciones trigonométricas"]),
      makeLearningTopic("Trigonometría", "leyes", "Leyes y aplicaciones", "Resuelve triángulos no rectángulos.", ["Ley de senos", "Ley de cosenos", "Rumbos", "Alturas", "Modelación periódica"])
    ]
  },
  {
    id: "geometria-analitica",
    title: "Geometría analítica",
    icon: "🧭",
    description: "Rectas, cónicas y distancia en el plano.",
    topics: [
      makeLearningTopic("Geometría analítica", "plano-cartesiano", "Plano cartesiano", "Ubica y mide relaciones entre puntos.", ["Coordenadas", "Distancia", "Punto medio", "Pendiente", "Ecuación de la recta"]),
      makeLearningTopic("Geometría analítica", "conicas", "Cónicas", "Estudia curvas algebraicas fundamentales.", ["Circunferencia", "Parábola", "Elipse", "Hipérbola", "Forma general"])
    ]
  },
  {
    id: "precalculo",
    title: "Precálculo",
    icon: "🧠",
    description: "Puente entre álgebra, funciones y cálculo.",
    topics: [
      makeLearningTopic("Precálculo", "modelos", "Modelos y análisis", "Prepara herramientas para límites y cálculo.", ["Composición de funciones", "Función inversa", "Crecimiento", "Continuidad intuitiva", "Tasas de cambio"]),
      makeLearningTopic("Precálculo", "sucesiones", "Sucesiones y series", "Reconoce patrones numéricos avanzados.", ["Sucesiones aritméticas", "Sucesiones geométricas", "Series", "Sumatorias", "Inducción básica"])
    ]
  },
  {
    id: "calculo-diferencial",
    title: "Cálculo diferencial",
    icon: "∂",
    description: "Límites, continuidad y derivadas.",
    topics: [
      makeLearningTopic("Cálculo diferencial", "limites", "Límites y continuidad", "Analiza comportamiento cercano.", ["Idea de límite", "Límites laterales", "Indeterminaciones", "Continuidad", "Asíntotas"]),
      makeLearningTopic("Cálculo diferencial", "derivadas", "Derivadas", "Mide cambios instantáneos.", ["Definición de derivada", "Reglas de derivación", "Regla de la cadena", "Derivadas implícitas", "Optimización", "Aplicaciones"])
    ]
  },
  {
    id: "calculo-integral",
    title: "Cálculo integral",
    icon: "∫",
    description: "Antiderivadas, áreas y acumulación.",
    topics: [
      makeLearningTopic("Cálculo integral", "integrales", "Integrales", "Comprende acumulación y área bajo la curva.", ["Antiderivadas", "Integral definida", "Teorema fundamental", "Sustitución", "Integración por partes", "Áreas"])
    ]
  },
  {
    id: "calculo-vectorial",
    title: "Cálculo multivariable y vectorial",
    icon: "🧮",
    description: "Funciones de varias variables, campos y vectores.",
    topics: [
      makeLearningTopic("Cálculo multivariable y vectorial", "varias-variables", "Funciones de varias variables", "Extiende el cálculo al espacio.", ["Vectores", "Derivadas parciales", "Gradiente", "Integrales dobles", "Integrales triples", "Campos vectoriales"])
    ]
  },
  {
    id: "ecuaciones-diferenciales",
    title: "Ecuaciones diferenciales",
    icon: "🌀",
    description: "Modelos de cambio y soluciones dinámicas.",
    topics: [
      makeLearningTopic("Ecuaciones diferenciales", "primer-orden", "Ecuaciones de primer orden", "Modela fenómenos con tasas de cambio.", ["Variables separables", "Ecuaciones lineales", "Crecimiento y decaimiento", "Campos de pendientes", "Modelación"]),
      makeLearningTopic("Ecuaciones diferenciales", "segundo-orden", "Ecuaciones de segundo orden", "Analiza sistemas físicos y oscilaciones.", ["Homogéneas", "Coeficientes constantes", "Movimiento armónico", "Condiciones iniciales"])
    ]
  },
  {
    id: "algebra-lineal",
    title: "Álgebra lineal",
    icon: "🔷",
    description: "Matrices, vectores, espacios y transformaciones.",
    topics: [
      makeLearningTopic("Álgebra lineal", "matrices", "Matrices y sistemas", "Organiza información y resuelve sistemas.", ["Operaciones con matrices", "Determinantes", "Inversa", "Sistemas lineales", "Eliminación gaussiana"]),
      makeLearningTopic("Álgebra lineal", "espacios", "Vectores y espacios", "Comprende dimensión y transformaciones.", ["Vectores", "Combinación lineal", "Base", "Dimensión", "Transformaciones lineales", "Valores propios"])
    ]
  },
  {
    id: "probabilidad",
    title: "Probabilidad",
    icon: "🎲",
    description: "Azar, conteo, eventos y toma de decisiones.",
    topics: [
      makeLearningTopic("Probabilidad", "probabilidad-basica", "Probabilidad básica", "Calcula posibilidades y compara eventos.", ["Espacio muestral", "Eventos", "Regla de Laplace", "Complemento", "Eventos independientes"]),
      makeLearningTopic("Probabilidad", "conteo", "Conteo y combinatoria", "Cuenta sin listar todos los casos.", ["Principio multiplicativo", "Permutaciones", "Combinaciones", "Diagramas de árbol", "Probabilidad condicional"])
    ]
  },
  {
    id: "estadistica",
    title: "Estadística",
    icon: "📊",
    description: "Datos, gráficos, medidas, inferencia y decisiones.",
    topics: [
      makeLearningTopic("Estadística", "descriptiva", "Estadística descriptiva", "Resume información con números y gráficos.", ["Tablas de frecuencia", "Media", "Mediana", "Moda", "Rango", "Desviación estándar", "Gráficos"]),
      makeLearningTopic("Estadística", "inferencia", "Inferencia estadística", "Toma decisiones con muestras.", ["Muestreo", "Distribuciones", "Intervalos de confianza", "Pruebas de hipótesis", "Correlación"])
    ]
  },
  {
    id: "logica-discreta",
    title: "Lógica y matemática discreta",
    icon: "⚙️",
    description: "Argumentos, conjuntos, conteo, grafos y estructuras discretas.",
    topics: [
      makeLearningTopic("Lógica y matemática discreta", "logica", "Lógica matemática", "Construye argumentos válidos.", ["Proposiciones", "Conectores", "Tablas de verdad", "Implicación", "Cuantificadores", "Demostraciones"]),
      makeLearningTopic("Lógica y matemática discreta", "discreta", "Matemática discreta", "Estudia estructuras finitas.", ["Conjuntos", "Relaciones", "Funciones discretas", "Grafos", "Recurrencias", "Aritmética modular"])
    ]
  },
  {
    id: "complejos",
    title: "Números complejos",
    icon: "ℂ",
    description: "Plano complejo, forma polar y operaciones.",
    topics: [
      makeLearningTopic("Números complejos", "fundamentos-complejos", "Fundamentos complejos", "Amplía los números reales al plano.", ["Unidad imaginaria", "Forma binómica", "Plano complejo", "Módulo", "Argumento", "Forma polar", "Fórmula de Euler"])
    ]
  }
];

const BADGE_CATALOG = [
  { id: "primer-paso", icon: "🌱", title: "Primer paso", description: "Completa tu primer subtema en cualquier nivel.", target: 1, type: "completed" },
  { id: "rutina-semanal", icon: "📅", title: "Rutina semanal", description: "Cumple tu meta semanal de 3 sesiones de estudio.", target: 3, type: "weekly" },
  { id: "racha-3", icon: "🔥", title: "Racha de 3 días", description: "Estudia durante 3 días consecutivos.", target: 3, type: "streak" },
  { id: "explorador", icon: "🧭", title: "Explorador de temas", description: "Completa 5 subtemas distintos.", target: 5, type: "completed" },
  { id: "dominio", icon: "🏅", title: "Dominio inicial", description: "Completa 12 niveles de aprendizaje.", target: 12, type: "completed" },
  { id: "constancia", icon: "💎", title: "Constancia matemática", description: "Alcanza una racha de 7 días de estudio.", target: 7, type: "streak" }
];
const PHONE_CODES = [
  { code: "+57", label: "Colombia (+57)", flag: "", country: "Colombia" },
  { code: "+58", label: "Venezuela (+58)", flag: "", country: "Venezuela" }
];

function setPendingLoginType(type) {
  loginExpectedTypePending = type || "";
  try {
    if (loginExpectedTypePending) {
      sessionStorage.setItem(STORAGE_LOGIN_EXPECTED_TYPE, loginExpectedTypePending);
    } else {
      sessionStorage.removeItem(STORAGE_LOGIN_EXPECTED_TYPE);
    }
  } catch {}
}

function getPendingLoginType() {
  try {
    return loginExpectedTypePending || sessionStorage.getItem(STORAGE_LOGIN_EXPECTED_TYPE) || "";
  } catch {
    return loginExpectedTypePending || "";
  }
}

function clearPendingLoginType() {
  loginExpectedTypePending = "";
  try {
    sessionStorage.removeItem(STORAGE_LOGIN_EXPECTED_TYPE);
  } catch {}
}

const PLANES_COMERCIALES = {
  independentStudent: {
    id: "student-monthly",
    name: "Estudiante independiente",
    priceCOP: 10000,
    subtitle: "Para preparación individual ICFES, admisión UNAL y práctica personal.",
    benefits: ["Acceso mensual individual", "Exámenes y estadísticas", "Mensajes y Asesor IA", "Sin institución asociada"]
  },
  institution: [
    { id: "institution-0010", range: "1 a 10 estudiantes", label: "Institución inicial", priceCOP: 50000, maxInstitutionUsers: 1, maxTeachers: 1, maxStudents: 10, includes: "1 usuario de institución, 1 profesor y 10 alumnos" },
    { id: "institution-1125", range: "11 a 25 estudiantes", label: "Institución básica", priceCOP: 100000, maxInstitutionUsers: 1, maxTeachers: 1, maxStudents: 25, includes: "1 usuario de institución, 1 profesor y 25 alumnos" },
    { id: "institution-2660", range: "26 a 60 estudiantes", label: "Institución media", priceCOP: 150000, maxInstitutionUsers: 2, maxTeachers: 2, maxStudents: 60, includes: "2 usuarios de institución, 2 profesores y 60 alumnos" },
    { id: "institution-61100", range: "61 a 100 estudiantes", label: "Institución avanzada", priceCOP: 200000, maxInstitutionUsers: 2, maxTeachers: 3, maxStudents: 100, includes: "2 usuarios de institución, 3 profesores y 100 alumnos" },
    { id: "institution-101200", range: "101 a 200 estudiantes", label: "Institución amplia", priceCOP: 250000, maxInstitutionUsers: 3, maxTeachers: 4, maxStudents: 200, includes: "3 usuarios de institución, 4 profesores y 200 alumnos" },
    { id: "institution-200plus", range: "Más de 200 estudiantes", label: "Institución corporativa", priceCOP: 350000, maxInstitutionUsers: 4, maxTeachers: 5, maxStudents: 999999, includes: "4 usuarios de institución, 5 profesores y más de 200 alumnos" }
  ]
};

const GEO_COUNTRY_FALLBACK = [
  { id: "CO", name: "Colombia", iso2: "CO", iso3: "COL", phoneCode: "+57" },
  { id: "VE", name: "Venezuela", iso2: "VE", iso3: "VEN", phoneCode: "+58" }
];
const geoCache = {
  countries: null,
  regions: {},
  municipalities: {}
};
const institutionCatalogCache = {
  index: null,
  schoolsByMunicipality: {}
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
    "id": 1,
    "pregunta": "Si \\(x = -2\\), ¿cuánto vale",
    "formula": "\\[ 3x^2 - 5x + 1 \\]",
    "opciones": [
      "11",
      "23",
      "15",
      "7"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-1"
  },
  {
    "id": 2,
    "pregunta": "Simplifica",
    "formula": "\\[ (4x^3 - 2x) + (x^3 + 7x) \\]",
    "opciones": [
      "\\(5x^3 + 9x\\)",
      "\\(5x^3 + 5x\\)",
      "\\(4x^3 + 5x\\)",
      "\\(5x^2 + 5x\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-2"
  },
  {
    "id": 3,
    "pregunta": "Desarrolla el producto notable",
    "formula": "\\[ (x + 4)(x - 4) \\]",
    "opciones": [
      "\\(x^2 - 8x + 16\\)",
      "\\(x^2 + 16\\)",
      "\\(x^2 - 16\\)",
      "\\(x^2 + 8x - 16\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-3"
  },
  {
    "id": 4,
    "pregunta": "Factoriza completamente",
    "formula": "\\[ 6x^2 - 15x \\]",
    "opciones": [
      "\\(3x(2x - 5)\\)",
      "\\(6(x^2 - 15x)\\)",
      "\\(x(6x - 15)\\)",
      "\\(2x(3x - 5)\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-4"
  },
  {
    "id": 5,
    "pregunta": "Resuelve la ecuación",
    "formula": "\\[ 3x - 7 = 11 \\]",
    "opciones": [
      "4",
      "5",
      "6",
      "7"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-5"
  },
  {
    "id": 6,
    "pregunta": "Desarrolla el cuadrado del binomio",
    "formula": "\\[ (2x - 3)^2 \\]",
    "opciones": [
      "\\(4x^2 - 6x + 9\\)",
      "\\(4x^2 - 12x + 9\\)",
      "\\(2x^2 - 12x + 9\\)",
      "\\(4x^2 + 12x + 9\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-6"
  },
  {
    "id": 7,
    "pregunta": "Factoriza",
    "formula": "\\[ x^2 - 9 \\]",
    "opciones": [
      "\\((x - 9)(x + 1)\\)",
      "\\((x - 3)^2\\)",
      "\\((x - 3)(x + 3)\\)",
      "\\((x + 9)(x - 1)\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-7"
  },
  {
    "id": 8,
    "pregunta": "Resuelve la ecuación cuadrática",
    "formula": "\\[ x^2 - 5x + 6 = 0 \\]",
    "opciones": [
      "1 y 6",
      "2 y 3",
      "−2 y −3",
      "5 y 6"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-8"
  },
  {
    "id": 9,
    "pregunta": "Simplifica la expresión racional",
    "formula": "\\[ \\frac{x^2 - 4}{x - 2} \\]",
    "opciones": [
      "\\(x - 2\\)",
      "\\(x + 2\\)",
      "\\(x + 2,\\; x \\neq 2\\)",
      "\\(x,\\; x \\neq 2\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-9"
  },
  {
    "id": 10,
    "pregunta": "Si la recta \\(y=2x+b\\) pasa por el punto \\((3,11)\\), entonces \\(b\\) vale:",
    "formula": "",
    "opciones": [
      "\\(3\\)",
      "\\(4\\)",
      "\\(5\\)",
      "\\(6\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-10"
  },
  {
    "id": 11,
    "pregunta": "¿Para qué valores de \\(x\\) está definida la expresión",
    "formula": "\\[ \\frac{x + 1}{x^2 - 4} \\]",
    "opciones": [
      "Todo número real",
      "\\(x \\neq 2\\)",
      "\\(x \\neq -2\\)",
      "\\(x \\neq 2\\) y \\(x \\neq -2\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-11"
  },
  {
    "id": 12,
    "pregunta": "Resuelve la desigualdad",
    "formula": "\\[ 2x + 5 > 3x - 1 \\]",
    "opciones": [
      "\\(x > 6\\)",
      "\\(x < 6\\)",
      "\\(x = 6\\)",
      "\\(x \\geq 6\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-12"
  },
  {
    "id": 13,
    "pregunta": "Factoriza el trinomio",
    "formula": "\\[ x^2 + 7x + 10 \\]",
    "opciones": [
      "\\((x + 1)(x + 10)\\)",
      "\\((x + 2)(x + 5)\\)",
      "\\((x + 7)(x + 10)\\)",
      "\\((x + 3)(x + 4)\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-13"
  },
  {
    "id": 14,
    "pregunta": "Si \\(\\displaystyle x + \\frac{1}{x} = 3\\), halla el valor de",
    "formula": "\\[ x^2 + \\frac{1}{x^2} \\]",
    "opciones": [
      "5",
      "6",
      "7",
      "9"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-14"
  },
  {
    "id": 15,
    "pregunta": "Resuelve la ecuación",
    "formula": "\\[ x^2 - 4x + 4 = 0 \\]",
    "opciones": [
      "\\(x = 4\\)",
      "\\(x = 2\\)",
      "\\(x = -2\\)",
      "\\(x = 2\\) (raíz doble)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-15"
  }
];

/* ────────────────────────────────────────────────────
   2. TEMPORIZADOR
   - duración total según dificultad
   - timerInterval: referencia al setInterval activo
   - timerActivo: bandera para evitar doble inicio
──────────────────────────────────────────────────── */
const DURACION_SEG = EXAM_DURATIONS_BY_LEVEL.diagnostico; // compatibilidad: diagnóstico/fácil
let segundosRestantes = DURACION_SEG;
let timerInterval     = null;
let timerActivo       = false;

/** Formatea segundos → "MM:SS" */
function formatTiempo(seg) {
  const m = Math.floor(seg / 60).toString().padStart(2, "0");
  const s = (seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function duracionExamenSeg(clave = "diagnostico") {
  const base = claveBaseResultado(clave);
  return EXAM_DURATIONS_BY_LEVEL[base] || EXAM_DURATIONS_BY_LEVEL.diagnostico;
}

function duracionIntentoActivo(tipo = "diag", clave = "diagnostico") {
  if (tipo === "nivel") return duracionExamenSeg("nivel1");
  if (tipo === "examen") return duracionExamenSeg("examen");
  return duracionExamenSeg(clave);
}

function etiquetaDuracionNivel(level = "facil") {
  const clave = LEVEL_TO_EXAM[level] || "diagnostico";
  return `${Math.round(duracionExamenSeg(clave) / 60)} minutos`;
}

function setExamHeaderActivo(activo) {
  document.body.classList.toggle("exam-active", activo);
}

function seccionDeIntentoActivo() {
  if (!intentoActivo) return "";
  if (intentoActivo.tipo === "diag") return "diagnostico";
  if (intentoActivo.tipo === "nivel") return intentoActivo.clave || "nivel1";
  if (intentoActivo.tipo === "examen") return "examen";
  return "";
}

/** Inicia el countdown */
function iniciarTimer(continuar = false) {
  if (timerActivo) return;
  timerActivo = true;
  setExamHeaderActivo(true);
  if (!continuar) segundosRestantes = duracionExamenSeg("diagnostico");

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
  segundosRestantes = duracionExamenSeg("diagnostico");
  document.getElementById("timerDisplay").textContent = formatTiempo(segundosRestantes);
}

/** Muestra el overlay de tiempo agotado */
function mostrarOverlayTiempoAgotado() {
  document.getElementById("timeoutOverlay").classList.remove("hidden");
}

/** Oculta el overlay y muestra los resultados con sin-responder = incorrectas */
async function procesarTiempoAgotado() {
  document.getElementById("timeoutOverlay").classList.add("hidden");

  // Las preguntas sin responder se toman como -1 (ninguna opción → incorrecta)
  const respuestas = PREGUNTAS.map(q => {
    const checked = document.querySelector(`input[name="diag-q${q.id}"]:checked`);
    return checked ? parseInt(checked.value, 10) : -1;
  });

  await evaluarYMostrar(respuestas);
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
  const preguntas = intento.questionSnapshot?.length ? intento.questionSnapshot : preguntasPorClave(clave);
  const answerKey = intento.answerKey?.length ? intento.answerKey : preguntas.map(question => question.correcta);
  const total = Number(intento.total || answerKey.length || preguntas.length);
  const correctas = answerKey.reduce((acc, correcta, i) => acc + (intento.respuestas?.[i] === correcta ? 1 : 0), 0);
  const incorrectas = total - correctas;
  const tiempoRestante = Math.max(0, intento.restante || 0);
  const tiempoEmpleado = duracionExamenSeg(clave) - tiempoRestante;
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
const STORAGE_RELOAD_SESION = "matematicasBolsilloReloadSesion";
const STORAGE_ASESOR_CHAT = "matematicasBolsilloAsesorIA";
const STORAGE_INVITE_TOKEN = "matematicasBolsilloInviteToken";
const INACTIVIDAD_MS = 10 * 60 * 1000;
const ASESOR_INACTIVIDAD_MS = 10 * 60 * 1000;
const BANCOS_DISPONIBLES = ["principal", ...Array.from({ length: 10 }, (_, i) => `reserva${i + 1}`)];
const NOMBRES_BANCOS = Object.fromEntries(BANCOS_DISPONIBLES.map((banco, idx) => [
  banco,
  idx === 0 ? "Banco principal" : `Reserva ${idx}`
]));

/* ════════════════════════════════════════════════════════
   BANCO MAESTRO EDITABLE SOLO EN CÓDIGO
   Jhonatan: agrega aquí preguntas globales con imágenes.
   - level: "diagnostico", "nivel1" o "examen"
   - bank: "principal" o "reserva1" ... "reserva10"
   - imageUrl: ruta pública o relativa, por ejemplo "assets/geometria/triangulo-01.png"
   Estas preguntas tienen prioridad sobre las preguntas base.
════════════════════════════════════════════════════════ */
const PREGUNTAS_MAESTRAS_CODIGO = [
  /*
  {
    level: "nivel1",
    bank: "principal",
    pregunta: "Observa la figura y determina el valor de \\(x\\).",
    formula: "",
    imageUrl: "assets/geometria/ejemplo.png",
    imageAlt: "Figura geométrica del ejercicio",
    opciones: ["\\(20^\\circ\\)", "\\(30^\\circ\\)", "\\(40^\\circ\\)", "\\(50^\\circ\\)"],
    correcta: 1,
    explicacion: "La explicación completa puede incluir expresiones como \\(x+60^\\circ=90^\\circ\\)."
  }
  */
];

const BASE_QUESTION_CACHE = {};
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
setExamHeaderActivo(!!intentoActivo);
let resultadosSesion = cargarResultadosSesion();
let bancoActivo = localStorage.getItem(STORAGE_BANCO_ACTIVO) || "principal";
let claseActiva = localStorage.getItem(STORAGE_CLASE_ACTIVA) || "";
let claseActualInfo = null;
let clasePendienteIngreso = null;
let adminClaseActiva = localStorage.getItem(STORAGE_ADMIN_CLASE) || "";
let adminClases = [];
let authIntent = "login";
let examAccessCleanupTimer = null;

function rolUsuario(perfil = perfilActual) {
  if (usuarioActual?.email?.toLowerCase() === ADMIN_EMAIL) return "teacher";
  return perfil?.role || perfil?.tipoCuenta || "";
}

function esProfesor(perfil = perfilActual) {
  return rolUsuario(perfil) === "teacher";
}

function esInstitucion(perfil = perfilActual) {
  return rolUsuario(perfil) === "institution";
}

function esPropietarioPlataforma() {
  return usuarioActual?.email?.toLowerCase() === ADMIN_EMAIL;
}

function cuentaInstitucional(perfil = perfilActual) {
  return perfil?.accountMode === "institutional" || (!!perfil?.institutionDane && !esInstitucion(perfil));
}

function esEstudianteInstitucional(perfil = perfilActual) {
  return rolUsuario(perfil) === "student" && cuentaInstitucional(perfil);
}

function esEstudianteCuenta(perfil = perfilActual) {
  return rolUsuario(perfil) === "student" && !esInstitucion(perfil);
}

function esProfesorInstitucional(perfil = perfilActual) {
  return rolUsuario(perfil) === "teacher" && cuentaInstitucional(perfil) && !esPropietarioPlataforma();
}

function puedeGestionarContenidoAprendizaje(perfil = perfilActual) {
  return !!usuarioActual && esPropietarioPlataforma();
}

function facturacionDisponible(perfil = perfilActual) {
  if (esPropietarioPlataforma()) return true;
  if (esInstitucion(perfil)) return true;
  if (esProfesorInstitucional(perfil) || esEstudianteInstitucional(perfil)) return false;
  return true;
}

function seccionesPermitidasActuales() {
  if (esInstitucion()) return SECCIONES_INSTITUCION;
  if (esProfesorInstitucional()) return SECCIONES_PROFESOR_INSTITUCIONAL;
  if (modoAdmin) return SECCIONES_PROFESOR;
  if (esEstudianteInstitucional()) return SECCIONES_ESTUDIANTE_INSTITUCIONAL;
  return SECCIONES_ESTUDIANTE;
}

function seccionInicioActual() {
  if (modoAdmin) return "admin";
  return "inicio";
}

function suscripcionActiva(perfil = perfilActual) {
  if (esPropietarioPlataforma()) return true;
  if (cuentaInstitucional(perfil) && !esInstitucion(perfil)) {
    if (perfil?.institutionAccessRevoked || perfil?.institutionAccessBlocked || perfil?.institutionPremiumBlocked || perfil?.subscriptionPremiumBlocked || perfil?.institutionMemberStatus === "removed" || perfil?.institutionMemberStatus === "blocked") return false;
    return perfil?.institutionSubscriptionStatus === "active" || perfil?.subscriptionInherited === true || perfil?.subscriptionStatus === "active";
  }
  if (perfil?.subscriptionStatus !== "active") return false;
  const expiresAt = perfil?.subscriptionExpiresAt;
  if (!expiresAt) return true;
  const expiryMs = typeof expiresAt?.toMillis === "function"
    ? expiresAt.toMillis()
    : new Date(expiresAt).getTime();
  return !Number.isFinite(expiryMs) || expiryMs > Date.now();
}

function esEstudianteIndependiente(perfil = perfilActual) {
  return rolUsuario(perfil) === "student" && !cuentaInstitucional(perfil) && !esInstitucion(perfil);
}

function asesorIaDisponible(perfil = perfilActual) {
  if (esPropietarioPlataforma()) return true;
  if (esInstitucion(perfil)) return false;
  const role = rolUsuario(perfil);
  if (role !== "student" && role !== "teacher") return false;
  return suscripcionActiva(perfil);
}

function exigirAccesoAsesor(mensaje = "Activa Premium para conversar con el Asesor IA.") {
  if (asesorIaDisponible()) return true;
  if (!suscripcionActiva() && !cuentaInstitucional() && !esInstitucion()) return exigirSuscripcion(mensaje);
  const status = document.getElementById("advisorStatus") || document.getElementById("paymentStatus");
  if (status) {
    status.textContent = "El Asesor IA solo está disponible para estudiantes y profesores con acceso Premium.";
    status.className = "bank-status error";
    setTimeout(() => {
      if (status.textContent.includes("Asesor IA solo")) status.textContent = "";
    }, 5000);
  }
  return false;
}

function tienePruebaDiagnosticoGratis(perfil = perfilActual) {
  return esEstudianteIndependiente(perfil) && !suscripcionActiva(perfil);
}

function tienePlanGratisIndependiente(perfil = perfilActual) {
  return esEstudianteIndependiente(perfil) && !suscripcionActiva(perfil);
}

function bancoGratisIndependienteHabilitado(bank = bancoActivo, perfil = perfilActual) {
  if (!tienePlanGratisIndependiente(perfil)) return true;
  return (bank || "principal") === "principal";
}

function examenGratisIndependienteHabilitado(clave, bank = bancoActivo, perfil = perfilActual) {
  if (!tienePlanGratisIndependiente(perfil)) return true;
  return bancoGratisIndependienteHabilitado(bank, perfil) && ["diagnostico", "nivel1", "examen"].includes(clave);
}

function seccionPermitidaPruebaGratis(section) {
  return tienePruebaDiagnosticoGratis() && ["inicio", "perfil", "aprendizaje", "insignias", "examenes", "diagnostico", "nivel1", "examen", "estadisticas", "suscripcion", "facturacion", "configuracion", "soporte"].includes(section);
}

function seccionRequiereSuscripcion(section) {
  if (section === "configuracion") return modoAdmin || esInstitucion();
  if (seccionPermitidaPruebaGratis(section)) return false;
  return new Set([
    "examenes", "diagnostico", "nivel1", "examen", "estadisticas",
    "adminMetricas", "mensajes", "asesorIA"
  ]).has(section);
}

function exigirSuscripcion(mensaje = "Activa tu suscripción para usar esta función.") {
  if (suscripcionActiva()) return true;
  activarNav("suscripcion");
  const status = document.getElementById("paymentStatus");
  if (status) {
    status.textContent = mensaje;
    status.className = "bank-status error";
  }
  return false;
}

function precioSuscripcion() {
  return planPagoSeleccionado()?.priceCOP || 0;
}

function formatoPrecioCOP(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "Precio por definir";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value));
}

function planesDisponiblesPago() {
  if (esInstitucion()) {
    return PLANES_COMERCIALES.institution.map(plan => ({
      ...plan,
      name: plan.label,
      subtitle: `${plan.range}. Incluye ${plan.includes}.`
    }));
  }
  if (esEstudianteIndependiente()) {
    const plan = PLANES_COMERCIALES.independentStudent;
    return [{
      id: plan.id,
      name: plan.name,
      subtitle: plan.subtitle,
      priceCOP: plan.priceCOP,
      includes: "Un estudiante independiente"
    }];
  }
  return [];
}

function planPagoSeleccionado() {
  const available = planesDisponiblesPago();
  if (!available.length) return null;
  return available.find(plan => plan.id === selectedCheckoutPlanId) || available[0];
}

function planActualFacturacionId() {
  const direct = perfilActual?.subscriptionPlanId || perfilActual?.planId || "";
  const available = planesDisponiblesPago();
  if (direct && available.some(plan => plan.id === direct)) return direct;
  const amount = Number(perfilActual?.subscriptionAmountCOP || 0);
  if (amount) {
    const byAmount = available.find(plan => Number(plan.priceCOP) === amount);
    if (byAmount) return byAmount.id;
  }
  const planName = String(perfilActual?.subscriptionPlan || "").toLowerCase();
  return available.find(plan =>
    planName.includes(String(plan.name || "").toLowerCase()) ||
    planName.includes(String(plan.label || "").toLowerCase())
  )?.id || "";
}

function planInstitucionalActual(perfil = perfilActual) {
  if (!perfil) return null;
  const direct = perfil.subscriptionPlanId || perfil.planId || "";
  if (direct) {
    const byId = PLANES_COMERCIALES.institution.find(plan => plan.id === direct);
    if (byId) return byId;
  }
  const amount = Number(perfil.subscriptionAmountCOP || 0);
  if (amount) {
    const byAmount = PLANES_COMERCIALES.institution.find(plan => Number(plan.priceCOP) === amount);
    if (byAmount) return byAmount;
  }
  const planName = String(perfil.subscriptionPlan || "").toLowerCase();
  return PLANES_COMERCIALES.institution.find(plan =>
    planName.includes(String(plan.label || "").toLowerCase()) ||
    planName.includes(String(plan.range || "").toLowerCase()) ||
    planName.includes(String(plan.id || "").toLowerCase())
  ) || null;
}

function limitesPlanInstitucional(perfil = perfilActual) {
  const plan = planInstitucionalActual(perfil);
  return {
    plan,
    maxInstitutionUsers: Number(plan?.maxInstitutionUsers || perfil?.maxInstitutionUsers || 0),
    maxTeachers: Number(plan?.maxTeachers || perfil?.maxTeachers || 0),
    maxStudents: Number(plan?.maxStudents || perfil?.maxStudents || 0)
  };
}

function asegurarPlanPagoSeleccionado() {
  const selected = planPagoSeleccionado();
  selectedCheckoutPlanId = selected?.id || "";
  return selected;
}

function normalizarDane(value = "") {
  return String(value).trim().replace(/\D/g, "");
}

function memberDocId(institutionDane, email) {
  return `${normalizarDane(institutionDane)}_${email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

async function buscarMiembroInstitucionalPorEmail(email) {
  if (!email) return null;
  const snap = await getDocs(query(collection(db, "institutionMembers"), where("email", "==", email.toLowerCase())));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function buscarMiembroInstitucional(email, dane) {
  const normalizedDane = normalizarDane(dane);
  const snap = await getDocs(query(collection(db, "institutionMembers"), where("email", "==", email.toLowerCase())));
  const found = snap.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .find(member => normalizarDane(member.institutionDane) === normalizedDane);
  return found || null;
}

async function institucionTienePlanActivo(dane) {
  const snap = await getDoc(doc(db, "institutions", normalizarDane(dane)));
  if (!snap.exists()) return { active: false, data: null };
  const data = snap.data();
  const status = data.subscriptionStatus || data.status || "";
  return {
    active: status === "active" || data.subscriptionInherited === true,
    data
  };
}

function nombreMetodoPago(method = selectedPaymentMethod) {
  return {
    pse: "PSE · débito bancario",
    nequi: "Nequi",
    "credit-card": "Tarjeta de crédito",
    "debit-card": "Tarjeta débito",
    card: "Tarjeta guardada"
  }[method] || "PSE";
}

function tipoMetodoWompi(method = selectedPaymentMethod) {
  if (method === "pse") return "PSE";
  if (method === "nequi") return "NEQUI";
  return "CARD";
}

function renderPasoPago() {
  document.querySelectorAll("[data-payment-slide]").forEach(slide => {
    slide.classList.toggle("active", Number(slide.dataset.paymentSlide) === paymentStep);
  });
  document.querySelectorAll("[data-payment-step-dot]").forEach(dot => {
    const step = Number(dot.dataset.paymentStepDot);
    dot.classList.toggle("active", step === paymentStep);
    dot.classList.toggle("complete", step < paymentStep);
  });
  const previous = document.getElementById("btnPaymentPrevious");
  const next = document.getElementById("btnPaymentNext");
  if (previous) previous.hidden = paymentStep === 0;
  if (next) next.hidden = paymentStep === 2;
}

function renderSubscriptionPanel() {
  const active = suscripcionActiva();
  const selectedPlan = asegurarPlanPagoSeleccionado();
  const role = esInstitucion() ? "Institución" : (esProfesor() ? "Profesor" : "Estudiante");
  const price = formatoPrecioCOP(precioSuscripcion());
  const title = document.getElementById("subscriptionStatusTitle");
  const text = document.getElementById("subscriptionStatusText");
  const icon = document.getElementById("subscriptionStatusIcon");
  if (title) title.textContent = active ? "Suscripción activa" : "Suscripción pendiente";
  if (text) {
    text.textContent = active
      ? "Tienes acceso completo a las herramientas incluidas en tu cuenta."
      : "Tu perfil está disponible, pero las funciones académicas permanecen bloqueadas.";
  }
  if (icon) icon.textContent = active ? "✓" : "◷";
  document.getElementById("subscriptionStatusCard")?.classList.toggle("active", active);
  const planName = document.getElementById("subscriptionPlanName");
  const planDescription = document.getElementById("subscriptionPlanDescription");
  const availablePlans = planesDisponiblesPago();
  const planGrid = document.querySelector(".checkout-plan-grid");
  if (planGrid) {
    planGrid.innerHTML = availablePlans.length
      ? availablePlans.map(plan => `
          <button class="checkout-plan-card ${plan.id === selectedCheckoutPlanId ? "active" : ""}" type="button" data-checkout-plan="${escapeHtml(plan.id)}">
            <span>${escapeHtml(plan.name)}</span>
            <strong>${escapeHtml(formatoPrecioCOP(plan.priceCOP))}/mes</strong>
            <small>${escapeHtml(plan.subtitle || plan.includes || "")}</small>
          </button>
        `).join("")
      : `<div class="checkout-plan-card active"><span>Plan institucional</span><strong>Incluido por la institución</strong><small>La facturación la administra la institución educativa.</small></div>`;
  }
  if (planName) planName.textContent = selectedPlan?.name || (esProfesor() ? "Plan institucional para docentes" : "Plan estudiante independiente");
  if (planDescription) {
    planDescription.textContent = selectedPlan?.subtitle || (esProfesor()
      ? "Para docentes autorizados por una institución. La institución administra cupos, profesores y estudiantes."
      : "Acceso individual mensual para practicar, presentar exámenes, revisar métricas y usar el Asesor IA.");
  }
  const priceLabel = document.querySelector(".subscription-price");
  if (priceLabel) priceLabel.textContent = price;
  const email = document.getElementById("paymentSummaryEmail");
  const plan = document.getElementById("paymentSummaryPlan");
  const method = document.getElementById("paymentSummaryMethod");
  const taxes = document.getElementById("paymentSummaryTaxes");
  if (email) email.textContent = usuarioActual?.email || "—";
  if (plan) plan.textContent = `${selectedPlan?.name || `Plan ${role}`} · ${price}`;
  if (method) method.textContent = nombreMetodoPago();
  if (taxes) taxes.textContent = "Incluidos cuando aplique según la pasarela y la normativa colombiana.";
  const bigPrice = document.getElementById("checkoutBigPrice");
  if (bigPrice) bigPrice.textContent = price;
  document.getElementById("paymentCarousel")?.classList.toggle("hidden", active && !planChangeInProgress);
  renderPasoPago();
}

function aplicarEstadoSuscripcion() {
  const active = suscripcionActiva();
  document.body.classList.toggle("subscription-locked", !active);
  document.querySelectorAll(".drawer-link[data-section]").forEach(button => {
    const locked = !active && seccionRequiereSuscripcion(button.dataset.section);
    button.classList.toggle("subscription-disabled", locked);
    button.setAttribute("aria-disabled", String(locked));
  });
  document.getElementById("advisorWidget")?.classList.toggle("hidden", !usuarioActual || !active || esInstitucion());
  if (!active) {
    detenerListenersComunicacion();
    internalMessages = [];
    internalReplies = [];
    activeMessageId = "";
    renderMessagesPanel();
  } else if (usuarioActual?.email) {
    iniciarListenersComunicacion();
  }
  renderSubscriptionPanel();
}

function fechaFacturacion(value) {
  if (!value) return "—";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function beneficiosPlan() {
  if (!suscripcionActiva()) {
    return ["Perfil personal y acceso general limitado", "Conservación de la información de la cuenta"];
  }
  return esProfesor()
    ? [
        "Creación y administración de aulas",
        "Bancos, exámenes y preguntas personalizadas",
        "Mensajería y seguimiento académico",
        "Métricas por aula y Asesor IA"
      ]
    : [
        "Exámenes y bancos habilitados por el profesor",
        "Dos intentos y resultados persistentes",
        "Estadísticas de aprendizaje",
        "Mensajería académica y Asesor IA"
      ];
}

function metodosPagoPerfil() {
  return Array.isArray(perfilActual?.paymentMethods)
    ? perfilActual.paymentMethods.filter(method => method && method.id)
    : [];
}

function estadoPagoLegible(status = "") {
  return {
    APPROVED: "Aprobado",
    DECLINED: "Rechazado",
    ERROR: "Error",
    VOIDED: "Anulado",
    PENDING: "Pendiente",
    pending: "Pendiente",
    approved: "Aprobado",
    declined: "Rechazado",
    failed: "Fallido"
  }[status] || status || "Pendiente";
}

function renderBillingTabs() {
  document.querySelectorAll("[data-billing-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.billingTab === activeBillingTab);
  });
  document.querySelectorAll("[data-billing-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.billingPanel === activeBillingTab);
  });
}

function renderBillingHistory() {
  const container = document.getElementById("billingHistory");
  if (!container) return;
  if (!billingHistoryItems.length) {
    container.innerHTML = `<p class="mini-help">Aún no hay pagos registrados.</p>`;
    return;
  }
  container.innerHTML = billingHistoryItems.map(item => {
    const amount = formatoPrecioCOP(item.amountInCents ? Number(item.amountInCents) / 100 : item.amountCOP);
    const date = fechaFacturacion(item.paidAt || item.createdAt);
    const method = item.paymentMethodLabel || nombreMetodoPago(String(item.paymentMethod || "").toLowerCase());
    const status = estadoPagoLegible(item.status);
    const reference = item.reference || item.transactionId || item.id || "—";
    const canDownloadReceipt = String(item.status || "").toUpperCase() === "APPROVED" || status === "Aprobado";
    return `
      <article class="billing-history-row">
        <div>
          <strong>${escapeHtml(item.planName || item.planId || "Plan")}</strong>
          <small>${escapeHtml(date)} · ${escapeHtml(method)}</small>
        </div>
        <div>
          <strong>${escapeHtml(amount)}</strong>
          <small>${escapeHtml(status)} · Ref. ${escapeHtml(reference)}</small>
        </div>
        ${canDownloadReceipt ? `<button class="btn btn-outline" type="button" data-download-receipt="${escapeHtml(item.id)}">Comprobante</button>` : `<button class="btn btn-outline" type="button" disabled>Sin comprobante</button>`}
      </article>
    `;
  }).join("");
}

function construirComprobantePagoHtml(item) {
  const amount = formatoPrecioCOP(item.amountInCents ? Number(item.amountInCents) / 100 : item.amountCOP);
  const date = fechaFacturacion(item.paidAt || item.createdAt);
  const method = item.paymentMethodLabel || nombreMetodoPago(String(item.paymentMethod || "").toLowerCase());
  const reference = item.reference || item.transactionId || item.id || "—";
  const receiptTitle = nombreComprobantePago(item);
  const plan = item.planName || item.planId || "Plan";
  const buyer = perfilActual?.institutionName || perfilActual?.displayName || usuarioActual?.displayName || usuarioActual?.email || "Usuario";
  const logoSrc = new URL("assets/icon-180.png", window.location.href).href;
  const institution = item.institutionName
    ? `<tr><td>Institución</td><td>${escapeHtml(item.institutionName)}</td></tr>`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(receiptTitle)}</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f4fbfc;color:#162838;margin:0;padding:32px}
    main{max-width:760px;margin:auto;background:white;border:1px solid #d8e8ee;border-radius:18px;padding:32px}
    .receipt-head{display:flex;gap:14px;align-items:center;margin-bottom:18px}
    .receipt-head img{width:62px;height:62px;object-fit:contain;border:1px solid #e3edf2;border-radius:16px;background:#fff;box-shadow:0 8px 22px rgba(15,58,84,.12)}
    h1{color:#06345f;margin:0 0 8px}.brand{color:#0d9488;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;margin:24px 0;background:#fbfdff;border-radius:12px;overflow:hidden}
    td{padding:13px;border-bottom:1px solid #e3edf2}td:first-child{color:#66788a;width:36%}td:last-child{font-weight:700}
    .ok{color:#0d9488}.note{font-size:13px;color:#66788a;line-height:1.55}
    .actions{display:none}
    @media print{body{background:white;padding:0}.actions{display:none}main{border:0}}
  </style>
</head>
<body>
  <main>
    <div class="actions">
      <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
    </div>
    <div class="receipt-head">
      <img src="${escapeHtml(logoSrc)}" alt="Matemáticas En Tu Bolsillo">
      <div>
        <p class="brand">Matemáticas En Tu Bolsillo</p>
        <h1>Comprobante de pago</h1>
      </div>
    </div>
    <p>Hola ${escapeHtml(buyer)}, este documento soporta el pago aprobado de tu suscripción.</p>
    <table>
      <tbody>
        <tr><td>Plan adquirido</td><td>${escapeHtml(plan)}</td></tr>
        ${institution}
        <tr><td>Valor pagado</td><td>${escapeHtml(amount)}</td></tr>
        <tr><td>Estado</td><td class="ok">Aprobado</td></tr>
        <tr><td>Medio de pago</td><td>${escapeHtml(method)}</td></tr>
        <tr><td>Referencia</td><td>${escapeHtml(reference)}</td></tr>
        <tr><td>Fecha</td><td>${escapeHtml(date)}</td></tr>
      </tbody>
    </table>
    <p class="note">Este comprobante es emitido por Matemáticas En Tu Bolsillo como soporte interno del pago confirmado por Wompi. No reemplaza factura electrónica si la normatividad aplicable exige un documento adicional.</p>
    <p class="note">Soporte: soporte@matematicasentubolsillo.com</p>
  </main>
</body>
</html>`;
}

function nombreComprobantePago(item) {
  const rawReference = item?.reference || item?.transactionId || item?.id || "sin-referencia";
  const reference = String(rawReference).replace(/[\\/:*?"<>|]+/g, "-").trim() || "sin-referencia";
  return `Comprobante ${reference}`;
}

function descargarComprobantePago(transactionId) {
  const item = billingHistoryItems.find(row => row.id === transactionId);
  if (!item) return;
  abrirComprobantePago(item);
}

function abrirComprobantePago(item) {
  document.getElementById("receiptViewerOverlay")?.remove();
  const receiptTitle = nombreComprobantePago(item);
  const overlay = document.createElement("div");
  overlay.id = "receiptViewerOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(5,25,40,.72);
    display:flex;align-items:center;justify-content:center;padding:18px;
    backdrop-filter:blur(8px);
  `;
  overlay.innerHTML = `
    <section style="width:min(980px,100%);height:min(92vh,860px);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 26px 80px rgba(0,0,0,.35);display:flex;flex-direction:column">
      <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #dbe8ee;background:#f8fbfc">
        <strong style="color:#06345f">Comprobante de pago</strong>
        <div style="display:flex;gap:10px;align-items:center">
          <button type="button" data-print-receipt style="border:0;border-radius:999px;background:linear-gradient(135deg,#0f3a54,#0f766e);color:#fff;font-weight:800;padding:10px 16px;cursor:pointer">Imprimir / guardar PDF</button>
          <button type="button" data-close-receipt aria-label="Cerrar" style="width:42px;height:42px;border:0;border-radius:50%;background:#eaf4f7;color:#06345f;font-size:24px;font-weight:800;cursor:pointer">×</button>
        </div>
      </header>
      <iframe title="${escapeHtml(receiptTitle)}" style="width:100%;height:100%;border:0;background:#f4fbfc"></iframe>
    </section>
  `;
  const iframe = overlay.querySelector("iframe");
  iframe.srcdoc = construirComprobantePagoHtml(item);
  iframe.addEventListener("load", () => {
    try {
      iframe.contentDocument.title = receiptTitle;
    } catch (error) {
      console.warn("No se pudo asignar el título del comprobante.", error);
    }
  });
  const close = () => overlay.remove();
  overlay.addEventListener("click", event => {
    if (event.target === overlay || event.target.closest("[data-close-receipt]")) close();
    if (event.target.closest("[data-print-receipt]")) {
      const previousTitle = document.title;
      try {
        document.title = receiptTitle;
        iframe.contentDocument.title = receiptTitle;
      } catch (error) {
        console.warn("No se pudo preparar el nombre sugerido del PDF.", error);
      }
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        document.title = previousTitle || APP_CONFIG.name;
      }, 1200);
    }
  });
  document.body.appendChild(overlay);
}

function abrirSelectorCambioPlan() {
  if (!esInstitucion()) {
    paymentStep = 0;
    activarNav("suscripcion");
    return;
  }
  document.getElementById("planChangeOverlay")?.remove();
  const currentPlanId = planActualFacturacionId();
  const plans = PLANES_COMERCIALES.institution;
  const overlay = document.createElement("div");
  overlay.id = "planChangeOverlay";
  overlay.className = "app-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <section class="plan-change-modal">
      <button class="modal-x" type="button" data-close-plan-change aria-label="Cerrar">×</button>
      <span class="section-kicker">Planes institucionales</span>
      <h2>Cambiar o mejorar plan</h2>
      <p class="mini-help">Selecciona el nuevo rango institucional. Tu plan actual aparece bloqueado para evitar comprar el mismo plan.</p>
      <div class="plan-change-grid">
        ${plans.map(plan => {
          const current = plan.id === currentPlanId;
          return `
            <button class="plan-change-card ${current ? "current" : ""}" type="button" data-change-plan="${escapeHtml(plan.id)}" ${current ? "disabled" : ""}>
              <span>${escapeHtml(plan.label)}</span>
              <strong>${escapeHtml(formatoPrecioCOP(plan.priceCOP))}/mes</strong>
              <small>${escapeHtml(plan.range)} · ${escapeHtml(plan.includes)}</small>
              ${current ? `<em>Plan actual</em>` : `<em>Seleccionar</em>`}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
  const close = () => overlay.remove();
  overlay.addEventListener("click", event => {
    if (event.target === overlay || event.target.closest("[data-close-plan-change]")) {
      close();
      return;
    }
    const button = event.target.closest("[data-change-plan]");
    if (!button || button.disabled) return;
    selectedCheckoutPlanId = button.dataset.changePlan || "";
    planChangeInProgress = true;
    paymentStep = 1;
    close();
    activarNav("suscripcion");
    renderSubscriptionPanel();
  });
  document.body.appendChild(overlay);
}

function renderBillingPanel() {
  if (usuarioActual && !unsubscribeBillingHistory) escucharHistorialFacturacion();
  const active = suscripcionActiva();
  const plan = perfilActual?.subscriptionPlan || (active ? `Plan ${esProfesor() ? "Profesor" : "Estudiante"}` : "Sin suscripción activa");
  const amount = formatoPrecioCOP(perfilActual?.subscriptionAmountCOP || precioSuscripcion());
  const nextBilling = perfilActual?.subscriptionNextBillingAt || perfilActual?.subscriptionExpiresAt;
  const paused = perfilActual?.subscriptionPaymentPaused === true || perfilActual?.subscriptionAutoRenew === false;
  const badge = document.getElementById("billingStatusBadge");
  if (badge) {
    badge.textContent = active ? (paused ? "Renovación suspendida" : "Plan activo") : "Sin plan activo";
    badge.classList.toggle("active", active && !paused);
    badge.classList.toggle("paused", active && paused);
  }
  const planName = document.getElementById("billingPlanName");
  const summary = document.getElementById("billingPlanSummary");
  if (planName) planName.textContent = plan;
  if (summary) summary.textContent = active
    ? `Suscripción para ${esProfesor() ? "profesores" : "estudiantes"} con acceso a las herramientas académicas del plan.`
    : "Activa un plan para desbloquear las funciones académicas.";
  const started = document.getElementById("billingStartedAt");
  const expires = document.getElementById("billingExpiresAt");
  const next = document.getElementById("billingNextCharge");
  const amountElement = document.getElementById("billingAmount");
  const autoRenew = document.getElementById("billingAutoRenew");
  if (started) started.textContent = fechaFacturacion(perfilActual?.subscriptionStartedAt);
  if (expires) expires.textContent = fechaFacturacion(perfilActual?.subscriptionExpiresAt);
  if (next) next.textContent = paused ? "Suspendido" : fechaFacturacion(nextBilling);
  if (amountElement) amountElement.textContent = amount;
  if (autoRenew) autoRenew.textContent = active ? (paused ? "Desactivada" : "Activada") : "—";
  const renewal = document.getElementById("billingRenewalCopy");
  if (renewal) {
    renewal.textContent = active && !paused
      ? `Tu plan se renovará automáticamente el ${fechaFacturacion(nextBilling)}. Se te cobrará ${amount} al mes.`
      : active
        ? `La renovación automática está suspendida. Si no la reactivas antes del ${fechaFacturacion(perfilActual?.subscriptionExpiresAt)}, perderás los beneficios del plan.`
        : "No hay una renovación programada.";
  }
  const benefits = document.getElementById("billingBenefits");
  if (benefits) benefits.innerHTML = beneficiosPlan().map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const upgradeButton = document.getElementById("btnUpgradePlan");
  if (upgradeButton) {
    const canChangePlan = esInstitucion();
    upgradeButton.hidden = !canChangePlan;
    upgradeButton.textContent = "Cambiar o mejorar plan";
  }
  const toggle = document.getElementById("billingPauseToggle");
  if (toggle) {
    toggle.checked = paused;
    toggle.disabled = !active;
  }
  const methods = metodosPagoPerfil();
  const methodsContainer = document.getElementById("billingPaymentMethods");
  if (methodsContainer) {
    methodsContainer.innerHTML = methods.length
      ? methods.map(method => `
          <div class="billing-payment-row">
            <span class="billing-payment-icon">${escapeHtml((method.brand || method.type || "Pago").slice(0, 8))}</span>
            <div>
              <strong>${escapeHtml(method.label || `${method.brand || method.type || "Método"} terminada en ${method.last4 || "••••"}`)}</strong>
              <small>${method.isDefault ? "Método principal" : "Método alternativo"} · ${escapeHtml(method.provider || APP_CONFIG.payments.provider)}</small>
            </div>
            <button class="btn btn-outline" type="button" data-default-payment-method="${escapeHtml(method.id)}" ${method.isDefault ? "disabled" : ""}>Principal</button>
            <button class="btn btn-outline" type="button" data-remove-payment-method="${escapeHtml(method.id)}" ${methods.length < 2 ? "disabled" : ""}>Eliminar</button>
          </div>
        `).join("")
      : `<p class="mini-help">No tienes formas de pago guardadas.</p>`;
  }
  renderBillingTabs();
  renderBillingHistory();
}

async function registrarSolicitudFacturacion(type, extra = {}) {
  if (!usuarioActual) return false;
  const requestRef = doc(collection(db, "billingRequests"));
  await setDoc(requestRef, {
    uid: usuarioActual.uid,
    email: usuarioActual.email || "",
    type,
    status: "pending",
    ...extra,
    createdAt: serverTimestamp()
  });
  return true;
}

async function solicitarIntencionPago(payload) {
  if (!usuarioActual) throw new Error("Debes iniciar sesión.");
  const endpoint = APP_CONFIG.payments.checkoutEndpoint;
  if (!endpoint) throw new Error("No hay endpoint de pagos configurado.");
  const response = await authedFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No fue posible iniciar el pago.");
  return data;
}

function escucharHistorialFacturacion() {
  if (unsubscribeBillingHistory) {
    unsubscribeBillingHistory();
    unsubscribeBillingHistory = null;
  }
  billingHistoryItems = [];
  if (!usuarioActual) {
    renderBillingHistory();
    return;
  }
  const q = query(collection(db, "billingTransactions"), where("uid", "==", usuarioActual.uid), orderBy("createdAt", "desc"), limit(50));
  unsubscribeBillingHistory = onSnapshot(q, snap => {
    billingHistoryItems = snap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => {
        const dateA = (a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime() || 0);
        const dateB = (b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime() || 0);
        return dateB - dateA;
      });
    renderBillingPanel();
  }, error => {
    console.error("No se pudo cargar historial de facturación", error);
    billingHistoryItems = [];
    renderBillingHistory();
  });
}

function requiereSeleccionRol(perfil = perfilActual) {
  return !!usuarioActual && !!perfil && !rolUsuario(perfil);
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

function tieneClavesRespuesta(preguntas = []) {
  return preguntas.every(question =>
    Number.isInteger(Number(question.correcta)) &&
    Number(question.correcta) >= 0 &&
    Number(question.correcta) <= 3
  );
}

function preguntaDesdeFeedbackItem(item = {}, fallback = {}) {
  return {
    ...fallback,
    id: Number(item.id || fallback.id || 0),
    pregunta: item.pregunta || fallback.pregunta || "",
    formula: item.formula || fallback.formula || "",
    imageUrl: item.imageUrl || fallback.imageUrl || "",
    imageAlt: item.imageAlt || fallback.imageAlt || "",
    opciones: Array.isArray(item.opciones) ? item.opciones : (fallback.opciones || []),
    correcta: Number.isInteger(Number(item.correcta)) ? Number(item.correcta) : -1,
    explicacion: item.explicacion || fallback.explicacion || "",
    _questionSource: item.source || fallback._questionSource || "",
    _questionId: item.questionId || fallback._questionId || ""
  };
}

async function cargarPreguntasRetroalimentacionOficial(clave, preguntas = []) {
  if (modoAdmin || !APP_CONFIG.examAttemptFeedbackEndpoint || !retroalimentacionPublicada(clave)) return preguntas;
  const intento = resultadoActual(clave);
  if (!intento?.serverAttemptId) return preguntas;
  try {
    const data = await postBackendAutenticado(APP_CONFIG.examAttemptFeedbackEndpoint, {
      attemptId: intento.serverAttemptId,
      ...timezoneUsuarioPayload()
    });
    const graded = Array.isArray(data.gradedSnapshot) ? data.gradedSnapshot : [];
    if (!data.ok || !graded.length) return preguntas;
    return graded.map((item, index) => preguntaDesdeFeedbackItem(item, preguntas[index] || { id: index + 1 }));
  } catch (error) {
    console.warn("No se pudo cargar la retroalimentación oficial.", error);
    return preguntas;
  }
}

function aplicarMetricasServidorAIntento(intento, serverResult = null) {
  if (!intento || !serverResult?.ok) return intento;
  intento.serverGraded = true;
  intento.serverAttemptId = serverResult.attemptId || "";
  intento.serverMetrics = {
    correctas: Number(serverResult.correctas || 0),
    incorrectas: Number(serverResult.incorrectas || 0),
    porcentaje: Number(serverResult.porcentaje || 0),
    nota: Number(serverResult.nota || 0),
    tiempoTotalSegundos: Number(serverResult.tiempoTotalSegundos || 0),
    segundosPorPregunta: Number(serverResult.segundosPorPregunta || 0)
  };
  return intento;
}

function crearIntentoResultado(clave, respuestas, restante) {
  const preguntas = preguntasPorClave(clave).map(clonarPregunta);
  return {
    respuestas,
    restante: Math.max(0, restante),
    guardado: Date.now(),
    total: preguntas.length,
    answerKey: preguntas.map(question => question.correcta),
    questionSnapshot: preguntas
  };
}

function guardarIntentoResultado(clave, intento, attemptNumber, registrarOficial = true) {
  const key = claveResultado(clave);
  const previos = resultadosSesion[key]?.intentos || [];
  resultadosSesion[key] = { intentos: [...previos, intento].slice(0, 2) };
  guardarResultadosSesion();
  if (registrarOficial) registrarIntentoOficial(clave, intento, attemptNumber).then(serverResult => {
    if (!serverResult?.ok) return;
    aplicarMetricasServidorAIntento(intento, serverResult);
    resultadosSesion[key] = {
      intentos: (resultadosSesion[key]?.intentos || []).map(item => item === intento ? intento : item)
    };
    guardarResultadosSesion(false);
  }).catch(error => {
    console.warn("No se pudo registrar el intento oficial en servidor.", error);
  });
  notificarIntentoCompletado(clave, attemptNumber);
}

function guardarResultadoSesion(clave, respuestas, restante) {
  const key = claveResultado(clave);
  const previos = resultadosSesion[key]?.intentos || [];
  guardarIntentoResultado(clave, crearIntentoResultado(clave, respuestas, restante), previos.length + 1, true);
}

async function guardarResultadoSesionConServidor(clave, respuestas, restante) {
  const key = claveResultado(clave);
  const previos = resultadosSesion[key]?.intentos || [];
  const intento = crearIntentoResultado(clave, respuestas, restante);
  const attemptNumber = previos.length + 1;
  try {
    const serverResult = await registrarIntentoOficial(clave, intento, attemptNumber);
    aplicarMetricasServidorAIntento(intento, serverResult);
  } catch (error) {
    console.warn("No se pudo registrar el intento oficial en servidor.", error);
  }
  guardarIntentoResultado(clave, intento, attemptNumber, false);
  return intento.serverMetrics || null;
}

async function registrarIntentoOficial(clave, intento, attemptNumber = 1) {
  if (!usuarioActual || modoAdmin) return null;
  const classId = claseActiva || grupoActivo || perfilActual?.classId || perfilActual?.aulaId || "";
  if (!classId || !APP_CONFIG.examAttemptSubmitEndpoint) return null;
  const payload = {
    classId,
    level: claveBaseResultado(clave),
    bank: bancoActivo || "principal",
    respuestas: intento.respuestas || [],
    restante: intento.restante || 0,
    attemptNumber,
    questionSnapshot: (intento.questionSnapshot || []).map(question => ({
      id: question.id,
      _questionId: question._questionId || "",
      _questionSource: question._questionSource || "legacy",
      opciones: question.opciones || []
    })),
    ...timezoneUsuarioPayload()
  };
  return postBackendAutenticado(APP_CONFIG.examAttemptSubmitEndpoint, payload);
}

function aplicarSnapshotIntento(clave, intento) {
  if (!intento?.questionSnapshot?.length) return;
  const questions = intento.questionSnapshot.map(clonarPregunta);
  const base = claveBaseResultado(clave);
  if (base === "diagnostico") PREGUNTAS.splice(0, PREGUNTAS.length, ...questions);
  else if (base === "examen") PREGUNTAS_EXAMEN.splice(0, PREGUNTAS_EXAMEN.length, ...questions);
  else PREGUNTAS_NIVELES.nivel1 = questions;
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
  if (tienePlanGratisIndependiente() && BANCOS_DISPONIBLES[nuevoIdx] !== "principal") {
    alert("El plan gratis solo habilita el Banco principal. Activa Premium para acceder a los bancos de reserva.");
    activarNav("suscripcion");
    return;
  }
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
  if (!usados) return;
  const feedbackPublicado = retroalimentacionPublicada(clave);
  const esPrimerIntento = usados === 1 && !feedbackPublicado;
  const intentosAgotados = usados >= 2;
  section.classList.toggle("first-attempt-result", esPrimerIntento);
  section.classList.toggle("feedback-locked-result", !feedbackPublicado);
  renderAvisoRetroalimentacion(section, clave, feedbackPublicado);

  const retryButton = document.getElementById(retryButtonId);
  if (!retryButton) return;
  retryButton.hidden = intentosAgotados;
  retryButton.textContent = esPrimerIntento ? "↺ Hacer último intento (2 de 2)" : "↺ Hacer intento";
}

function retroalimentacionPublicada(clave) {
  if (modoAdmin) return true;
  if (esEstudianteIndependiente()) return intentosUsados(clave) >= 2;
  if (!grupoActivo) return false;
  const cached = examAccessStateCache[`${grupoActivo}::${clave}`];
  if (cached) return cached.feedbackPublished === true;
  return normalizarExamSettings(examSettingsGrupo[grupoActivo] || {})[clave]?.feedbackPublished === true;
}

function renderAvisoRetroalimentacion(section, clave, publicada) {
  let aviso = section.querySelector("[data-feedback-pending]");
  if (publicada) {
    aviso?.remove();
    return;
  }
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.dataset.feedbackPending = "true";
    aviso.className = "feedback-pending-card";
    const target = section.querySelector(".result-actions") || section.firstElementChild;
    section.insertBefore(aviso, target || null);
  }
  aviso.innerHTML = `
    <strong>Retroalimentación pendiente de publicación</strong>
    <p>${esEstudianteIndependiente()
      ? `Tu resultado general ya está guardado. Las respuestas correctas, explicaciones y soluciones aparecerán cuando termines tu segundo intento de ${escapeHtml(nombreExamen(clave))}.`
      : `Tu resultado general ya está guardado. Las respuestas correctas, explicaciones y soluciones aparecerán cuando el profesor publique la retroalimentación de ${escapeHtml(nombreExamen(clave))} para tu aula.`
    }</p>
  `;
}

function feedbackVideoHtml(question = {}) {
  const url = question.videoUrl || question.solutionVideoUrl || question.videoExplicacionUrl || "";
  if (!url) return "";
  const safeUrl = escapeHtml(url);
  const isEmbed = /youtube\.com\/embed\/|player\.vimeo\.com\/video\//i.test(url);
  if (isEmbed) {
    return `<div class="fb-video"><strong>Video explicativo:</strong><iframe src="${safeUrl}" title="Video explicativo de la pregunta" loading="lazy" allowfullscreen></iframe></div>`;
  }
  return `<div class="fb-video"><strong>Video explicativo:</strong><a href="${safeUrl}" target="_blank" rel="noopener">Abrir video de la solución</a></div>`;
}

function iniciarIntentoActivo(tipo, clave, total) {
  const duracionSeg = duracionIntentoActivo(tipo, clave);
  intentoActivo = {
    tipo,
    clave,
    banco: bancoActivo,
    total,
    respuestas: {},
    inicio: Date.now(),
    vence: Date.now() + duracionSeg * 1000,
    duracionSeg,
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
    ${q.imageUrl ? `
      <button class="question-image-button" type="button" data-question-image="${escapeHtml(q.imageUrl)}" aria-label="Ampliar imagen de la pregunta">
        <img src="${escapeHtml(q.imageUrl)}" alt="${escapeHtml(q.imageAlt || "Imagen de apoyo para la pregunta")}" />
      </button>
    ` : ""}
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

form.addEventListener("submit", async (e) => {
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

  await evaluarYMostrar(respuestas);
  resultsSection.scrollIntoView({ behavior: "smooth" });
});

/**
 * Función central compartida por envío manual y tiempo agotado.
 * Recibe array de respuestas (índice 0-3 o -1 = sin responder).
 */
async function evaluarYMostrar(respuestas, opciones = {}) {
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

  const puedeMostrarClaves = tieneClavesRespuesta(PREGUNTAS);
  if (!opciones.restaurando) {
    const serverMetrics = puedeMostrarClaves
      ? null
      : await guardarResultadoSesionConServidor("diagnostico", respuestas, segundosRestantes);
    if (serverMetrics) {
      correctas = serverMetrics.correctas;
      incorrectas = serverMetrics.incorrectas;
      porcentaje = serverMetrics.porcentaje;
      nota = serverMetrics.nota;
      badge = calcBadge(porcentaje);
    } else if (puedeMostrarClaves) {
      guardarResultadoSesion("diagnostico", respuestas, segundosRestantes);
    } else {
      guardarResultadoSesion("diagnostico", respuestas, segundosRestantes);
    }
  }
  await mostrarResultados(respuestas, correctas, incorrectas, porcentaje, nota, badge);
  mostrarProgreso(PREGUNTAS.length, PREGUNTAS.length);
  resetTimer();
  if (!opciones.restaurando) resultsSection.scrollIntoView({ behavior: "smooth" });
}

/* ────────────────────────────────────────────────────
   6. PRESENTACIÓN – Resultados
──────────────────────────────────────────────────── */

async function mostrarResultados(respuestas, correctas, incorrectas, pct, nota, badge) {
  resultsSection.hidden = false;
  const tiempoEmpleado = duracionExamenSeg("diagnostico") - segundosRestantes;
  const preguntasResultado = await cargarPreguntasRetroalimentacionOficial("diagnostico", PREGUNTAS);
  const puedeMostrarClaves = tieneClavesRespuesta(preguntasResultado);

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
    calcBalance(correctas, preguntasResultado.length, tiempoEmpleado);

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
    barC.style.height = Math.round((correctas  / preguntasResultado.length) * MAX_PX) + "px";
    barW.style.height = Math.round((incorrectas / preguntasResultado.length) * MAX_PX) + "px";
  }, 150);

  /* ── Tabla resumen (con LaTeX) ── */
  const tbody = document.getElementById("summaryBody");
  tbody.innerHTML = "";
  if (!puedeMostrarClaves) {
    tbody.innerHTML = `<tr><td colspan="4">Resultado guardado oficialmente. La retroalimentación se mostrará cuando el profesor la publique.</td></tr>`;
  } else preguntasResultado.forEach((q, i) => {
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
  if (!puedeMostrarClaves) {
    feedbackEl.innerHTML = `<div class="feedback-pending-card"><strong>Retroalimentación protegida</strong><p>Las respuestas correctas y explicaciones permanecen ocultas hasta que el profesor las publique.</p></div>`;
  } else preguntasResultado.forEach((q, i) => {
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
      ${feedbackVideoHtml(q)}
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
    const qResultado = preguntasResultado[i] || q;
    const card = document.getElementById(`diag-card-${q.id}`);
    if (!card) return;
    const sinResp = respuestas[i] === -1;
    const ok = !sinResp && respuestas[i] === qResultado.correcta;
    if (puedeMostrarClaves) card.classList.add(ok ? "result-correct" : "result-wrong");
    card.querySelectorAll("input[type='radio']").forEach(inp => { inp.disabled = true; });
    card.querySelectorAll(".option-label").forEach((lbl, idx) => {
      if (!puedeMostrarClaves) return;
      if (idx === qResultado.correcta) lbl.classList.add("opt-correct");
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
    if (!confirmarCambioSeccion(sec)) return;
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
        aplicarSnapshotIntento("examen", resultadoExamen);
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
    aplicarSnapshotIntento("diagnostico", resultadoDiag);
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

function asegurarEnlaceReporteExamen(sec) {
  const sectionByKey = {
    diagnostico: "sectionDiagnostico",
    nivel1: "sectionNivel",
    examen: "sectionExamen"
  };
  const titleByKey = {
    diagnostico: "Diagnóstico",
    nivel1: "Nivel Medio",
    examen: "Examen Final"
  };
  const section = document.getElementById(sectionByKey[sec]);
  if (!section || section.querySelector(".exam-report-link")) return;
  const subject = `Reporte de problema en ${titleByKey[sec]} - Matemáticas En Tu Bolsillo`;
  const body = [
    "Hola, soporte.",
    "",
    "Quiero reportar un problema durante un examen.",
    "",
    `Examen: ${titleByKey[sec]}`,
    `Usuario: ${usuarioActual?.email || "Sin correo activo"}`,
    "",
    "Descripción del problema:"
  ].join("\n");
  const link = document.createElement("a");
  link.className = "exam-report-link";
  link.href = `mailto:${APP_CONFIG.support.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  link.textContent = "Reportar un problema";
  section.prepend(link);
}

function mostrarSeccion(sec) {
  cerrarAccordions();
  if (sec !== "perfil") limpiarVerificacionTelefonoTemporal();
  if (sec !== "mensajes") limpiarBorradorMensajeProfesor();
  if (sec !== "examenes") limpiarBorradorPreguntaProfesor();
  if (sec !== "suscripcion") planChangeInProgress = false;
  if (sec !== "aprendizaje") cerrarLearningManagerEditor({ force: true });
  document.getElementById("sectionInicio").classList.toggle("hidden", sec !== "inicio");
  document.getElementById("sectionAprendizaje")?.classList.toggle("hidden", sec !== "aprendizaje");
  document.getElementById("sectionInsignias")?.classList.toggle("hidden", sec !== "insignias");
  document.getElementById("sectionSuscripcion")?.classList.toggle("hidden", sec !== "suscripcion");
  document.getElementById("sectionFacturacion")?.classList.toggle("hidden", sec !== "facturacion");
  document.getElementById("sectionExamenes").classList.toggle("hidden", sec !== "examenes");
  document.getElementById("sectionDiagnostico").classList.toggle("hidden", sec !== "diagnostico");
  document.getElementById("sectionNivel").classList.toggle("hidden", !sec.startsWith("nivel"));
  document.getElementById("sectionExamen").classList.toggle("hidden", sec !== "examen");
  document.getElementById("sectionEstadisticas").classList.toggle("hidden", sec !== "estadisticas");
  document.getElementById("sectionPerfil").classList.toggle("hidden", sec !== "perfil");
  document.getElementById("sectionConfiguracion").classList.toggle("hidden", sec !== "configuracion");
  document.getElementById("sectionAdmin").classList.toggle("hidden", sec !== "admin");
  document.getElementById("sectionAdminMetricas").classList.toggle("hidden", sec !== "adminMetricas");
  document.getElementById("sectionReportes")?.classList.toggle("hidden", sec !== "reportes");
  document.getElementById("sectionSoporte").classList.toggle("hidden", sec !== "soporte");
  document.getElementById("sectionMensajes")?.classList.toggle("hidden", sec !== "mensajes");
  document.getElementById("sectionAsesorIA")?.classList.toggle("hidden", sec !== "asesorIA");
  if (sec === "diagnostico") actualizarEstadoDiagnostico();
  if (["diagnostico", "nivel1", "examen"].includes(sec)) asegurarEnlaceReporteExamen(sec);
  if (sec === "examenes") renderExamenesHub();
  if (sec === "admin") renderAdminPanel();
  if (sec === "estadisticas") renderStudentStats();
  if (sec === "inicio") actualizarBienvenida();
  if (sec === "aprendizaje") renderLearningPanel();
  if (sec === "insignias") renderBadgesPanel();
  if (sec === "perfil") renderProfile();
  if (sec === "configuracion") renderConfiguracion();
  if (sec === "mensajes") renderMessagesPanel();
  if (sec === "asesorIA") renderAsesorInfo();
  if (sec === "suscripcion") renderSubscriptionPanel();
  if (sec === "facturacion") {
    if (seccionActual !== "facturacion") activeBillingTab = "subscription";
    renderBillingPanel();
  }
  if (sec === "reportes") renderTeacherReportsPanel();
  if (sec === "admin") renderAdminWelcome();
  if (sec === "adminMetricas") {
    document.getElementById("adminMetricsPanel").hidden = false;
    renderAdminStats();
  }
  if (sec === "aprendizaje") {
    const grupoPanel = document.getElementById("grupoActualPanel");
    if (grupoPanel) {
      grupoPanel.hidden = true;
      grupoPanel.textContent = "";
    }
  } else {
    actualizarGrupoActualPanel();
  }
  seccionActual = sec;
  if (usuarioActual) {
    localStorage.setItem(STORAGE_SECCION_ACTIVA, sec);
  }
  requestAnimationFrame(() => {
    const activeSection = document.querySelector(".main-content:not(.hidden)");
    if (activeSection) activeSection.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    animarSeccionActiva();
  });
}

function animarSeccionActiva() {
  const activeSection = document.querySelector(".main-content:not(.hidden)");
  if (!activeSection || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  activeSection.classList.remove("ui-section-enter");
  void activeSection.offsetWidth;
  activeSection.classList.add("ui-section-enter");
  const items = activeSection.querySelectorAll(".section-card, .accordion-card, .profile-panel, .billing-card, .learning-resource-grid article, .learning-practice, .learning-teacher-content, .badge-card, .badges-next-card, .exam-hub-card, .student-row, .institution-class-row, .exam-access-card");
  items.forEach((item, index) => {
    if (index >= 16) return;
    item.style.setProperty("--ui-stagger", `${Math.min(index * 28, 224)}ms`);
    item.classList.remove("ui-item-enter");
    void item.offsetWidth;
    item.classList.add("ui-item-enter");
  });
}

const SCROLL_GESTURE_FALLBACK_MAX_DELTA = 420;
function normalizarDeltaGestual(deltaY, factor = 1) {
  const abs = Math.abs(deltaY);
  if (abs < 1) return 0;
  return Math.sign(deltaY) * Math.min(abs * factor, SCROLL_GESTURE_FALLBACK_MAX_DELTA);
}
function puedeUsarScrollGlobal(target = document.body) {
  if (document.body.classList.contains("landing-menu-open") || document.body.classList.contains("public-modal-open")) return false;
  return !target?.closest?.("input, textarea, select, iframe, embed, object, [contenteditable='true'], .auth-shell:not(.hidden), .app-modal-overlay:not(.hidden), .message-detail-overlay:not(.hidden), .overlay:not(.hidden), .side-drawer, .notifications-list, .message-thread, .advisor-chat-log");
}
function instalarRescateScrollGlobal() {
  if (window.__matematicasNativeScrollFallback) return;
  window.__matematicasNativeScrollFallback = true;
  let touchY = 0;
  window.addEventListener("wheel", event => {
    if (!puedeUsarScrollGlobal(event.target) || !event.deltaY || event.ctrlKey) return;
    const before = window.scrollY || document.documentElement.scrollTop || 0;
    requestAnimationFrame(() => {
      const after = window.scrollY || document.documentElement.scrollTop || 0;
      if (Math.abs(after - before) > 0.5) return;
      window.scrollBy({ top: normalizarDeltaGestual(event.deltaY, 2.4), left: 0, behavior: "auto" });
    });
  }, { passive: true });
  window.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    touchY = event.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchmove", event => {
    if (!puedeUsarScrollGlobal(event.target) || event.touches.length !== 1) return;
    const currentY = event.touches[0].clientY;
    const deltaY = touchY - currentY;
    if (Math.abs(deltaY) < 2) return;
    const before = window.scrollY || document.documentElement.scrollTop || 0;
    requestAnimationFrame(() => {
      const after = window.scrollY || document.documentElement.scrollTop || 0;
      if (Math.abs(after - before) > 0.5) return;
      window.scrollBy({ top: normalizarDeltaGestual(deltaY, 1.8), left: 0, behavior: "auto" });
    });
    touchY = currentY;
  }, { passive: true });
}
instalarRescateScrollGlobal();
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

function hayBorradorPreguntaProfesor() {
  if (!modoAdmin) return false;
  const ids = [
    "teacherQuestionText",
    "teacherOptionA",
    "teacherOptionB",
    "teacherOptionC",
    "teacherOptionD",
    "teacherQuestionExplanation"
  ];
  const hasText = ids.some(id => document.getElementById(id)?.value.trim());
  const hasCorrectAnswer = !!document.getElementById("teacherCorrectOption")?.value;
  return !!(hasText || hasCorrectAnswer || teacherQuestionImageFile);
}

function limpiarBorradorPreguntaProfesor() {
  if (!modoAdmin || !hayBorradorPreguntaProfesor()) return;
  resetTeacherQuestionBuilder();
}

function confirmarSalidaPreguntaProfesor(secDestino = "") {
  if (
    seccionActual !== "examenes" ||
    secDestino === "examenes" ||
    !hayBorradorPreguntaProfesor()
  ) return true;
  return confirm(
    "Tienes una pregunta sin guardar. Si sales de Exámenes, el enunciado, las opciones, la explicación, las ecuaciones y la imagen seleccionada se borrarán permanentemente. ¿Deseas salir de todos modos?"
  );
}

function confirmarCambioSeccion(secDestino = "") {
  if (intentoActivo) {
    const destinoIntento = seccionDeIntentoActivo();
    if (secDestino !== destinoIntento) {
      alert("Debes finalizar el examen actual antes de navegar a otra sección.");
      return false;
    }
  }
  return confirmarSalidaMensajes(secDestino) && confirmarSalidaPreguntaProfesor(secDestino);
}

function actualizarBotonVolver() {
  const backButton = document.getElementById("btnSectionBack");
  const forwardButton = document.getElementById("btnSectionForward");
  if (backButton) {
    backButton.disabled = historialSecciones.length === 0;
    backButton.setAttribute("aria-disabled", String(backButton.disabled));
  }
  if (forwardButton) {
    forwardButton.disabled = historialAdelante.length === 0;
    forwardButton.setAttribute("aria-disabled", String(forwardButton.disabled));
  }
}

function activarNav(sec, options = {}) {
  if (!confirmarCambioSeccion(sec)) return false;
  if (sec === "aprendizaje") cerrarDrawer();
  const permitidasActuales = seccionesPermitidasActuales();
  if (!permitidasActuales.has(sec)) sec = seccionInicioActual();
  if (!suscripcionActiva() && seccionRequiereSuscripcion(sec)) {
    sec = "suscripcion";
    setTimeout(() => {
      const status = document.getElementById("paymentStatus");
      if (status) {
        status.textContent = "Activa tu suscripción para desbloquear esta sección.";
        status.className = "bank-status error";
      }
    }, 0);
  }
  if (!modoAdmin && !aulaActualValida() && ["diagnostico", "nivel1", "examen"].includes(sec)) {
    sec = "examenes";
    setTimeout(() => {
      const locked = document.getElementById("examsLockedMsg");
      if (locked) {
        locked.hidden = false;
        locked.textContent = esEstudianteIndependiente() ? "Tu aula se asigna automáticamente." : "Tu institución debe asignarte a un aula.";
      }
    }, 0);
  }
  if (suscripcionActiva() && !modoAdmin && !aulaActualValida() && ["inicio", "estadisticas"].includes(sec)) {
    sec = "configuracion";
    setTimeout(() => {
      const status = document.getElementById("settingsClassStatus");
      if (status) status.textContent = esEstudianteIndependiente() ? "Tu aula se asigna automáticamente." : "Tu institución debe asignarte a un aula.";
    }, 0);
  }
  if (sec !== seccionActual && !options.fromHistory) {
    const permitidas = seccionesPermitidasActuales();
    if (permitidas.has(seccionActual)) {
      historialSecciones.push(seccionActual);
      historialSecciones = historialSecciones.slice(-30);
      historialAdelante = [];
    }
  }
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === sec));
  mostrarSeccion(sec);
  actualizarBotonVolver();
  return true;
}

function volverSeccionAnterior() {
  while (historialSecciones.length) {
    const destino = historialSecciones.pop();
    if (!destino || destino === seccionActual) continue;
    const origen = seccionActual;
    if (activarNav(destino, { fromHistory: true })) {
      historialAdelante.push(origen);
      historialAdelante = historialAdelante.slice(-30);
      actualizarBotonVolver();
      return;
    }
    historialSecciones.push(destino);
    break;
  }
  actualizarBotonVolver();
}

function avanzarSeccionSiguiente() {
  while (historialAdelante.length) {
    const destino = historialAdelante.pop();
    if (!destino || destino === seccionActual) continue;
    const origen = seccionActual;
    if (activarNav(destino, { fromHistory: true })) {
      historialSecciones.push(origen);
      historialSecciones = historialSecciones.slice(-30);
      actualizarBotonVolver();
      return;
    }
    historialAdelante.push(destino);
    break;
  }
  actualizarBotonVolver();
}

function seccionRestaurable() {
  const fallback = seccionInicioActual();
  const guardada = localStorage.getItem(STORAGE_SECCION_ACTIVA) || "";
  const permitidas = seccionesPermitidasActuales();
  if (!permitidas.has(guardada)) return fallback;
  if (!suscripcionActiva() && seccionRequiereSuscripcion(guardada)) return "suscripcion";
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
  actualizarGrupoActualPanel();
  actualizarBienvenida();
  actualizarDrawer();
  aplicarEstadoSuscripcion();
  sincronizarControlesLanding();
}

function actualizarGrupoActualPanel() {
  const panel = document.getElementById("grupoActualPanel");
  if (!panel) return;
  panel.hidden = true;
  panel.textContent = "";
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
    texto.textContent = tienePruebaDiagnosticoGratis()
      ? "Tienes activa la versión gratuita: perteneces automáticamente al aula Matemáticas En Tu Bolsillo y puedes completar el Banco principal con diagnóstico, nivel medio y examen final, cada uno con sus dos intentos, métricas y retroalimentación. Para bancos de reserva, mensajes, Asesor IA y demás beneficios debes activar Premium."
      : !suscripcionActiva()
      ? "Tu cuenta está activa, pero las herramientas académicas están limitadas hasta que actives una suscripción o ingreses mediante una institución con plan vigente. Puedes completar tu perfil, revisar Suscripción y Facturación, y contactar soporte si necesitas ayuda."
      : aulaActualValida()
      ? "Desde aquí puedes presentar los exámenes habilitados por tu profesor, revisar tu avance, recibir mensajes del aula, consultar estadísticas y apoyarte en el Asesor IA para estudiar mejor."
      : esEstudianteIndependiente()
        ? "Tu aula se asigna automáticamente. Activa Premium para desbloquear exámenes, estadísticas, mensajes y herramientas de estudio."
        : "Tu institución debe asignarte a un aula para desbloquear exámenes, mensajes, estadísticas y herramientas de estudio.";
  }
  panel.querySelector(".bank-progress-panel")?.classList.toggle("hidden", esInstitucion());
  panel.hidden = false;
  if (!esInstitucion()) actualizarBancoEstudiante();
}

function renderExamenesHub() {
  const locked = document.getElementById("examsLockedMsg");
  const intro = document.getElementById("examsHubIntro");
  const studentHub = document.getElementById("studentExamHub");
  const adminPanel = document.getElementById("adminExamBankPanel");
  const teacherBuilder = document.getElementById("teacherQuestionBuilder");
  if (modoAdmin) {
    if (locked) locked.hidden = true;
    if (intro) intro.textContent = "Consulta los bancos de preguntas organizados por banco y nivel.";
    studentHub?.classList.add("hidden");
    adminPanel?.classList.remove("hidden");
    teacherBuilder?.classList.remove("hidden");
    renderAdminExamBanks();
    initializeTeacherQuestionBuilder();
    return;
  }
  studentHub?.classList.remove("hidden");
  adminPanel?.classList.add("hidden");
  teacherBuilder?.classList.add("hidden");
  const sinAula = !aulaActualValida();
  if (locked) {
    locked.hidden = !sinAula;
    locked.textContent = esEstudianteIndependiente() ? "Tu aula se asigna automáticamente." : "Tu institución debe asignarte a un aula.";
  }
  if (intro) {
    intro.textContent = sinAula
      ? "Cuando ingreses el código de aula, podrás presentar los exámenes habilitados por tu profesor."
      : tienePruebaDiagnosticoGratis()
      ? "Tu versión gratuita incluye el Banco principal completo: diagnóstico, nivel medio y examen final, con dos intentos, métricas y retroalimentación. Para bancos de reserva, mensajes y Asesor IA debes activar Premium."
      : "Elige el examen que vas a presentar o revisar.";
  }
  document.querySelectorAll("[data-go-exam]").forEach(btn => {
    const clave = btn.dataset.goExam;
    const bloqueadoGratis = !examenGratisIndependienteHabilitado(clave);
    const config = normalizarExamSettings(examSettingsGrupo[grupoActivo] || {})[clave] || {};
    const estado = estadoExamenDesdeConfig(config);
    const noDisponible = !bloqueadoGratis && !sinAula && estado !== "available";
    btn.disabled = sinAula || bloqueadoGratis || noDisponible;
    btn.classList.toggle("disabled", sinAula || bloqueadoGratis || noDisponible);
    btn.title = bloqueadoGratis ? "Disponible con Plan Premium." : noDisponible ? estadoExamenTexto(estado) : "";
    let badge = btn.querySelector(".exam-status-badge");
    if (!badge) {
      badge = document.createElement("small");
      badge.className = "exam-status-badge";
      btn.appendChild(badge);
    }
    badge.textContent = sinAula
      ? "Sin aula"
      : bloqueadoGratis
      ? "Premium"
      : estadoExamenTexto(estado);
  });
}

function enfocarExamenProfesorDesdeAprendizaje(examKey = "diagnostico") {
  activarNav("examenes");
  setTimeout(() => {
    renderExamenesHub();
    const banco = bancoActivo || "principal";
    const bankCard = [...document.querySelectorAll("[data-admin-bank-card]")].find(card => card.dataset.adminBankCard === banco) || document.querySelector("[data-admin-bank-card]");
    if (bankCard) bankCard.open = true;
    const scope = bankCard || document;
    const levelCard = [...scope.querySelectorAll("[data-admin-level-card]")].find(card => card.dataset.adminLevelCard === examKey) || [...document.querySelectorAll("[data-admin-level-card]")].find(card => card.dataset.adminLevelCard === examKey);
    if (levelCard) {
      levelCard.open = true;
      levelCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      document.getElementById("adminExamBankPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const levelSelect = document.getElementById("teacherQuestionLevel");
    if (levelSelect && [...levelSelect.options].some(option => option.value === examKey)) levelSelect.value = examKey;
  }, 80);
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

function clonarPregunta(question) {
  return { ...question, opciones: [...(question.opciones || [])] };
}

function preguntasBaseNivel(level, bank = bancoActivo) {
  if (level === "diagnostico") {
    if (!BASE_QUESTION_CACHE.diagnostico) {
      BASE_QUESTION_CACHE.diagnostico = PREGUNTAS
        .filter(question => !question._questionSource)
        .map(clonarPregunta);
    }
    return BASE_QUESTION_CACHE.diagnostico.map(clonarPregunta);
  }
  if (level === "examen") {
    if (!BASE_QUESTION_CACHE.examen) {
      BASE_QUESTION_CACHE.examen = PREGUNTAS_EXAMEN
        .filter(question => !question._questionSource)
        .map(clonarPregunta);
    }
    return BASE_QUESTION_CACHE.examen.map(clonarPregunta);
  }
  return preguntasNivelMedioParaBanco(bank).map(clonarPregunta);
}

function textoSeguroConSaltos(value = "") {
  return escapeHtml(String(value || "").trim()).replace(/\n/g, "<br>");
}

function convertirPreguntaDoc(data, fallbackId = 1) {
  const latex = String(data.questionLatex || "").trim();
  const explanationLatex = String(data.explanationLatex || "").trim();
  const correctRaw = data.correctOption ?? data.correcta;
  const correctValue = Number(correctRaw);
  return {
    id: fallbackId,
    pregunta: textoSeguroConSaltos(data.questionText || data.pregunta || ""),
    formula: latex ? `\\[${latex}\\]` : (data.formula || ""),
    imageUrl: data.imageUrl || "",
    imageAlt: String(data.imageAlt || "Imagen de apoyo para la pregunta"),
    opciones: (data.options || data.opciones || []).map(option => textoSeguroConSaltos(option)),
    correcta: Number.isInteger(correctValue) && correctValue >= 0 && correctValue <= 3 ? correctValue : -1,
    explicacion: [
      textoSeguroConSaltos(data.explanationText || data.explicacion || ""),
      explanationLatex ? `\\[${explanationLatex}\\]` : ""
    ].filter(Boolean).join("<br>"),
    _questionSource: data._questionSource || "teacher",
    _questionId: data._questionId || data.id || ""
  };
}

function preguntasMaestrasPara(level, bank) {
  return PREGUNTAS_MAESTRAS_CODIGO
    .filter(question => question.level === level && (question.bank || "principal") === bank)
    .map((question, index) => convertirPreguntaDoc({ ...question, _questionSource: "master", _questionId: question.id || "" }, index + 1));
}

function preguntasDocentePara(level, bank, classId = claseActiva || adminClaseActiva || "") {
  return teacherQuestions
    .filter(question =>
      question.level === level &&
      question.bank === bank &&
      question.active !== false &&
      (!question.classId || question.classId === classId)
    )
    .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0))
    .map((question, index) => convertirPreguntaDoc({ ...question, _questionSource: "teacher", _questionId: question.id || "" }, index + 1));
}

function combinarPreguntasNivel(level, bank = bancoActivo, classId = claseActiva || adminClaseActiva || "") {
  const limite = level === "diagnostico" ? 15 : 10;
  const priority = [
    ...preguntasMaestrasPara(level, bank),
    ...preguntasDocentePara(level, bank, classId),
    ...preguntasBaseNivel(level, bank)
  ];
  return priority.slice(0, limite).map((question, index) => ({ ...question, id: index + 1 }));
}

function aplicarPreguntasCombinadas(level, bank = bancoActivo) {
  const combined = combinarPreguntasNivel(level, bank);
  if (level === "diagnostico") PREGUNTAS.splice(0, PREGUNTAS.length, ...combined);
  else if (level === "examen") PREGUNTAS_EXAMEN.splice(0, PREGUNTAS_EXAMEN.length, ...combined);
  else PREGUNTAS_NIVELES.nivel1 = combined;
  return combined;
}

function ownerUidPreguntasActual() {
  if (modoAdmin) return usuarioActual?.uid || "";
  return perfilActual?.classOwnerUid || claseActualInfo?.ownerUid || "";
}

async function cargarPreguntasDocente(ownerUid = ownerUidPreguntasActual()) {
  if (!ownerUid || !usuarioActual) {
    teacherQuestions = [];
    return [];
  }
  if (!modoAdmin && claseActiva && APP_CONFIG.teacherExamQuestionsEndpoint) {
    const levels = ["diagnostico", "nivel1", "examen"];
    const batches = await Promise.all(levels.map(level =>
      postBackendAutenticado(APP_CONFIG.teacherExamQuestionsEndpoint, {
        ownerUid,
        classId: claseActiva,
        level,
        bank: bancoActivo || "principal",
        ...timezoneUsuarioPayload()
      }).then(data => Array.isArray(data.questions) ? data.questions : [])
    ));
    teacherQuestions = batches.flat();
    return teacherQuestions;
  }
  const snap = await getDocs(query(collection(db, "teacherQuestions"), where("ownerUid", "==", ownerUid)));
  teacherQuestions = snap.docs.map(questionDoc => ({ id: questionDoc.id, ...questionDoc.data() }));
  return teacherQuestions;
}

async function prepararPreguntasActivas(level) {
  try {
    await cargarPreguntasDocente();
  } catch (error) {
    console.warn("No se pudieron cargar las preguntas personalizadas.", error);
    teacherQuestions = [];
  }
  return aplicarPreguntasCombinadas(level, bancoActivo);
}

function renderQuestionPreviewList(preguntas) {
  return preguntas.map(q => `
    <details class="accordion-card question-preview">
      <summary>Pregunta ${q.id}</summary>
      <p>${q.pregunta || ""}</p>
      ${q.formula ? `<div class="q-formula">${q.formula}</div>` : ""}
      ${q.imageUrl ? `<button class="question-image-button" type="button" data-question-image="${escapeHtml(q.imageUrl)}" aria-label="Ampliar imagen"><img src="${escapeHtml(q.imageUrl)}" alt="${escapeHtml(q.imageAlt || "Imagen de la pregunta")}" /></button>` : ""}
      <ol type="A">
        ${q.opciones.map((opcion, idx) => `<li class="${idx === q.correcta ? "correct-answer" : ""}">${opcion}</li>`).join("")}
      </ol>
      <div class="question-preview-explanation"><strong>Explicación</strong><p>${q.explicacion || "Sin explicación."}</p></div>
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
    <details class="accordion-card admin-bank-card" data-admin-bank-card="${escapeHtml(banco)}">
      <summary>${NOMBRES_BANCOS[banco]}</summary>
      <div class="admin-bank-levels">
        ${niveles.map(([clave, nombre, resolver]) => {
          const preguntas = modoAdmin
            ? combinarPreguntasNivel(clave, banco)
            : resolver(banco);
          return `
            <details class="accordion-card admin-level-card" data-admin-level-card="${escapeHtml(clave)}">
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

function renderQuestionLatexPreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  const latex = normalizarLatexPlantilla(input.value.trim());
  if (!latex) {
    preview.innerHTML = `<span class="mini-help">La ecuación aparecerá aquí.</span>`;
    return;
  }
  preview.textContent = "";
  try {
    if (window.katex) katex.render(latex, preview, { throwOnError: false, displayMode: true });
    else preview.textContent = latex;
  } catch {
    preview.textContent = latex;
  }
}

function insertIntoTextField(field, text, cursorInsideTemplate = false) {
  if (!field) return;
  const start = Number.isInteger(field.selectionStart) ? field.selectionStart : field.value.length;
  const end = Number.isInteger(field.selectionEnd) ? field.selectionEnd : start;
  field.setRangeText(text, start, end, "end");
  let cursor = start + text.length;
  if (cursorInsideTemplate) {
    const firstEmptyGroup = text.indexOf("{}");
    if (firstEmptyGroup >= 0) cursor = start + firstEmptyGroup + 1;
    else {
      const firstParenthesis = text.indexOf("()");
      if (firstParenthesis >= 0) cursor = start + firstParenthesis + 1;
    }
  }
  field.setSelectionRange?.(cursor, cursor);
  field.focus();
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderTeacherInlinePreview(fieldId) {
  const field = document.getElementById(fieldId);
  const preview = document.querySelector(`[data-field-preview="${fieldId}"]`);
  if (!field || !preview) return;
  const value = field.value.trim();
  preview.classList.toggle("empty", !value);
  preview.textContent = value || "La vista previa aparecerá aquí.";
  if (value) reRenderKatex(preview);
}

function teacherQuestionDraft() {
  const correctRaw = document.getElementById("teacherCorrectOption")?.value ?? "";
  const classId = document.getElementById("teacherQuestionClass")?.value || "";
  const selectedClass = aulaPorId(classId);
  return {
    classId,
    className: selectedClass?.name || "",
    level: document.getElementById("teacherQuestionLevel")?.value || "diagnostico",
    bank: document.getElementById("teacherQuestionBank")?.value || "principal",
    questionText: document.getElementById("teacherQuestionText")?.value.trim() || "",
    questionLatex: normalizarLatexPlantilla(document.getElementById("teacherQuestionLatex")?.value.trim() || ""),
    options: ["A", "B", "C", "D"].map(letter => document.getElementById(`teacherOption${letter}`)?.value.trim() || ""),
    correctOption: correctRaw === "" ? -1 : Number(correctRaw),
    explanationText: document.getElementById("teacherQuestionExplanation")?.value.trim() || "",
    explanationLatex: normalizarLatexPlantilla(document.getElementById("teacherExplanationLatex")?.value.trim() || "")
  };
}

function validateTeacherQuestion(data) {
  if (!data.classId || !aulaPorId(data.classId)) return "Selecciona el aula que recibirá esta pregunta.";
  if (!data.questionText && !data.questionLatex && !teacherQuestionImageFile) {
    return "Escribe un enunciado, agrega una ecuación o selecciona una imagen.";
  }
  if (data.options.some(option => !option)) return "Completa las cuatro opciones de respuesta.";
  if (!Number.isInteger(data.correctOption) || data.correctOption < 0 || data.correctOption > 3) {
    return "Selecciona cuál de las cuatro opciones es correcta.";
  }
  if (!data.explanationText && !data.explanationLatex) {
    return "Escribe la explicación que verá el estudiante.";
  }
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (teacherQuestionImageFile && !allowedImageTypes.includes(teacherQuestionImageFile.type)) {
    return "Solo puedes adjuntar imágenes JPG, PNG, WebP o GIF.";
  }
  if (teacherQuestionImageFile && teacherQuestionImageFile.size > 6 * 1024 * 1024) {
    return "La imagen debe pesar máximo 6 MB.";
  }
  const limit = data.level === "diagnostico" ? 15 : 10;
  const occupied = preguntasMaestrasPara(data.level, data.bank).length +
    teacherQuestions.filter(question =>
      question.level === data.level &&
      question.bank === data.bank &&
      question.classId === data.classId &&
      question.active !== false
    ).length;
  if (occupied >= limit) {
    return `Este banco ya completó sus ${limit} preguntas personalizadas. Elimina una antes de agregar otra.`;
  }
  return "";
}

function renderTeacherQuestionPreview() {
  const preview = document.getElementById("teacherQuestionLivePreview");
  const status = document.getElementById("teacherQuestionStatus");
  if (!preview) return;
  const data = teacherQuestionDraft();
  const validation = validateTeacherQuestion(data);
  if (validation) {
    if (status) {
      status.textContent = validation;
      status.className = "bank-status error";
    }
    return;
  }
  const question = convertirPreguntaDoc({
    ...data,
    imageUrl: teacherQuestionImageFile ? URL.createObjectURL(teacherQuestionImageFile) : ""
  }, 1);
  preview.innerHTML = renderQuestionPreviewList([question]);
  preview.classList.remove("hidden");
  reRenderKatex(preview);
  if (status) status.textContent = "";
}

function resetTeacherQuestionBuilder() {
  [
    "teacherQuestionText",
    "teacherQuestionLatex",
    "teacherOptionA",
    "teacherOptionB",
    "teacherOptionC",
    "teacherOptionD",
    "teacherQuestionExplanation",
    "teacherExplanationLatex"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
  const correct = document.getElementById("teacherCorrectOption");
  if (correct) correct.value = "";
  const imageInput = document.getElementById("teacherQuestionImage");
  if (imageInput) imageInput.value = "";
  teacherQuestionImageFile = null;
  document.getElementById("teacherQuestionImagePreview")?.classList.add("hidden");
  document.getElementById("teacherQuestionLivePreview")?.classList.add("hidden");
  [
    "teacherQuestionText",
    "teacherOptionA",
    "teacherOptionB",
    "teacherOptionC",
    "teacherOptionD",
    "teacherQuestionExplanation"
  ].forEach(renderTeacherInlinePreview);
  renderQuestionLatexPreview("teacherQuestionLatex", "teacherQuestionEquationPreview");
  renderQuestionLatexPreview("teacherExplanationLatex", "teacherExplanationEquationPreview");
}

async function saveTeacherQuestion() {
  const status = document.getElementById("teacherQuestionStatus");
  if (!modoAdmin || !usuarioActual) return;
  if (!exigirSuscripcion("Activa tu suscripción para crear preguntas.")) return;
  const data = teacherQuestionDraft();
  const validation = validateTeacherQuestion(data);
  if (validation) {
    status.textContent = validation;
    status.className = "bank-status error";
    return;
  }
  const button = document.getElementById("btnSaveTeacherQuestion");
  button.disabled = true;
  status.textContent = "Guardando pregunta...";
  status.className = "bank-status";
  const questionRef = doc(collection(db, "teacherQuestions"));
  let storagePath = "";
  try {
    const payload = {
      ...data,
      ownerUid: usuarioActual.uid,
      ownerEmail: (usuarioActual.email || "").toLowerCase(),
      institutionDane: perfilActual?.institutionDane || "",
      institutionName: perfilActual?.institutionName || "",
      active: true,
      imageUrl: "",
      imagePath: "",
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: serverTimestamp()
    };
    await setDoc(questionRef, payload);
    if (teacherQuestionImageFile) {
      const extension = teacherQuestionImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      storagePath = `teacherQuestions/${usuarioActual.uid}/${questionRef.id}/question.${extension}`;
      const imageRef = storageRef(storage, storagePath);
      await uploadBytes(imageRef, teacherQuestionImageFile, {
        contentType: teacherQuestionImageFile.type,
        customMetadata: { ownerUid: usuarioActual.uid, questionId: questionRef.id }
      });
      const imageUrl = await getDownloadURL(imageRef);
      await updateDoc(questionRef, { imageUrl, imagePath: storagePath, updatedAt: serverTimestamp() });
    }
    await cargarPreguntasDocente(usuarioActual.uid);
    resetTeacherQuestionBuilder();
    renderTeacherCreatedQuestions();
    renderAdminExamBanks();
    status.textContent = "Pregunta guardada correctamente.";
    status.className = "bank-status success";
  } catch (error) {
    console.error("No se pudo guardar la pregunta.", error);
    if (storagePath) await deleteObject(storageRef(storage, storagePath)).catch(() => {});
    await deleteDoc(questionRef).catch(() => {});
    status.textContent = "No se pudo guardar la pregunta. Revisa las reglas de Firebase e inténtalo de nuevo.";
    status.className = "bank-status error";
  } finally {
    button.disabled = false;
  }
}

function renderTeacherCreatedQuestions() {
  const container = document.getElementById("teacherCreatedQuestions");
  if (!container || !modoAdmin) return;
  if (!teacherQuestions.length) {
    container.innerHTML = `<p class="mini-help">Todavía no has creado preguntas propias.</p>`;
    return;
  }
  container.innerHTML = teacherQuestions
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    .map(question => {
      const normalized = convertirPreguntaDoc(question, 1);
      return `
        <article class="teacher-created-question">
          <div>
            <span>${escapeHtml(question.className || nombreAulaPorId(question.classId) || "Todas las aulas")} · ${escapeHtml(NOMBRES_BANCOS[question.bank] || question.bank)} · ${escapeHtml(NIVELES_META[question.level]?.titulo || (question.level === "diagnostico" ? "Diagnóstico" : "Examen Final"))}</span>
            <strong>${normalized.pregunta || "Pregunta con contenido visual"}</strong>
          </div>
          ${question.imageUrl ? `<img src="${escapeHtml(question.imageUrl)}" alt="Imagen de la pregunta" />` : ""}
          <button class="btn btn-outline" type="button" data-delete-teacher-question="${question.id}">Eliminar</button>
        </article>
      `;
    }).join("");
}

async function deleteTeacherQuestion(questionId) {
  const question = teacherQuestions.find(item => item.id === questionId);
  if (!question || !confirm("¿Deseas eliminar esta pregunta de forma permanente?")) return;
  try {
    if (question.imagePath) await deleteObject(storageRef(storage, question.imagePath)).catch(() => {});
    await deleteDoc(doc(db, "teacherQuestions", questionId));
    teacherQuestions = teacherQuestions.filter(item => item.id !== questionId);
    renderTeacherCreatedQuestions();
    renderAdminExamBanks();
  } catch (error) {
    console.error("No se pudo eliminar la pregunta.", error);
    alert("No se pudo eliminar la pregunta. Revisa los permisos e intenta de nuevo.");
  }
}

async function initializeTeacherQuestionBuilder() {
  const builder = document.getElementById("teacherQuestionBuilder");
  if (!builder || !modoAdmin || !usuarioActual) return;
  builder.classList.remove("hidden");
  const bankSelect = document.getElementById("teacherQuestionBank");
  const classSelect = document.getElementById("teacherQuestionClass");
  if (bankSelect && !bankSelect.options.length) {
    bankSelect.innerHTML = BANCOS_DISPONIBLES
      .map(bank => `<option value="${bank}">${NOMBRES_BANCOS[bank]}</option>`)
      .join("");
  }
  if (classSelect) {
    classSelect.innerHTML = adminClases.length
      ? adminClases.map(classroom => `<option value="${classroom.id}">${escapeHtml(classroom.name)} (${escapeHtml(classroom.code || "")})</option>`).join("")
      : `<option value="">Primero crea un aula</option>`;
    classSelect.value = adminClaseActiva || adminClases[0]?.id || "";
  }
  [
    "teacherQuestionText",
    "teacherOptionA",
    "teacherOptionB",
    "teacherOptionC",
    "teacherOptionD",
    "teacherQuestionExplanation"
  ].forEach(renderTeacherInlinePreview);
  try {
    await cargarPreguntasDocente(usuarioActual.uid);
    renderTeacherCreatedQuestions();
    renderAdminExamBanks();
  } catch (error) {
    console.warn("No se pudieron consultar las preguntas del profesor.", error);
  }
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
  if (tienePlanGratisIndependiente() && bancoActivo !== "principal") {
    bancoActivo = "principal";
    localStorage.setItem(STORAGE_BANCO_ACTIVO, bancoActivo);
  }
  const idx = indiceBancoActivo();
  const completado = bancoCompletado();
  title.textContent = `${NOMBRES_BANCOS[bancoActivo]} (${idx + 1} de ${BANCOS_DISPONIBLES.length})`;
  text.textContent = tienePlanGratisIndependiente()
    ? "Plan gratis: completa diagnóstico, nivel medio y examen final del Banco principal. Activa Premium para desbloquear todos los bancos de reserva."
    : completado
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
  next.disabled = tienePlanGratisIndependiente() || !completado || idx === BANCOS_DISPONIBLES.length - 1;
  next.title = tienePlanGratisIndependiente() ? "Disponible con Plan Premium." : "";
}

function learningProgressAll() {
  try {
    return {
      ...(JSON.parse(localStorage.getItem(learningLocalStorageKey()) || "{}") || {}),
      ...(learningProgressRemote || {})
    };
  } catch {
    return { ...(learningProgressRemote || {}) };
  }
}

function saveLearningProgressAll(data) {
  localStorage.setItem(learningLocalStorageKey(), JSON.stringify(data || {}));
}

function learningLocalStorageKey() {
  return `${LEARNING_STORAGE_KEY}:${usuarioActual?.uid || "anon"}`;
}

function learningProgressId(branchId, topicId, subtopicId, level) {
  return `${branchId}__${topicId}__${subtopicId || topicId}__${level}`;
}

async function cargarLearningProgressRemoto(force = false) {
  if (!usuarioActual?.uid) return;
  if (!force && learningProgressRemoteLoadedFor === usuarioActual.uid) return;
  const snap = await getDocs(collection(db, "users", usuarioActual.uid, "learningProgress"));
  const data = {};
  snap.forEach(item => {
    data[item.id] = item.data();
  });
  learningProgressRemote = data;
  learningProgressRemoteLoadedFor = usuarioActual.uid;
  const merged = learningProgressAll();
  saveLearningProgressAll(merged);
}

async function guardarLearningProgressRemoto(key, selection, payload) {
  if (!usuarioActual?.uid) return;
  await setDoc(doc(db, "users", usuarioActual.uid, "learningProgress", key), {
    branchId: selection.branchId,
    topicId: selection.topicId,
    subtopicId: selection.subtopicId || selection.topicId,
    level: selection.level,
    completed: true,
    completedAt: payload.completedAt,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function currentLearningResourceId(selection, ownerUid = usuarioActual?.uid || "anon") {
  const scope = selection.scope === "class" ? "class" : "global";
  const target = scope === "class" ? (selection.classId || "sin-aula") : "all";
  return `${ownerUid}__${scope}__${target}__${selection.branchId}__${selection.topicId}__${selection.subtopicId || selection.topicId}__${selection.level}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function learningResourceCacheKey(selection) {
  const classId = selection.classId || claseActiva || perfilActual?.classId || "";
  const scope = selection.scope || "";
  return `${selection.branchId}__${selection.topicId}__${selection.subtopicId || selection.topicId}__${selection.level}__${scope}__${classId}`;
}

async function cargarLearningResource(selection, force = false) {
  const cacheKey = learningResourceCacheKey(selection);
  if (!force && learningResourcesCache.has(cacheKey)) return learningResourcesCache.get(cacheKey);
  const snap = await getDocs(query(
    collection(db, LEARNING_RESOURCE_COLLECTION),
    where("branchId", "==", selection.branchId),
    where("topicId", "==", selection.topicId),
    where("level", "==", selection.level),
    limit(30)
  ));
  let selected = null;
  const currentClassId = selection.classId || claseActiva || perfilActual?.classId || "";
  snap.forEach(item => {
    const data = { id: item.id, ...item.data() };
    const resourceSubtopic = data.subtopicId || data.topicId;
    if (resourceSubtopic !== (selection.subtopicId || selection.topicId)) return;
    const visibleGlobal = data.scope === "global" || !data.scope;
    const visibleClass = data.scope === "class" && data.classId && data.classId === currentClassId;
    const ownResource = esPropietarioPlataforma() && data.ownerUid === usuarioActual?.uid;
    if (!visibleGlobal && !visibleClass && !ownResource) return;
    if (!selected) selected = data;
    if (visibleGlobal && !selected?.classId) selected = data;
    if (visibleClass) selected = data;
    if (ownResource && (selection.scope !== "global" || data.scope === "global")) selected = data;
  });
  learningResourcesCache.set(cacheKey, selected);
  return selected;
}

function canEditLearningResource(resource) {
  return !!resource && esPropietarioPlataforma() && resource.ownerUid === usuarioActual?.uid;
}

function renderLearningResourceSlots(resource) {
  const unit = document.getElementById("learningUnit");
  const pdfSlot = document.getElementById("learningPdfSlot");
  const videoSlot = document.getElementById("learningVideoSlot");
  const imageSlot = document.getElementById("learningContentImageSlot");
  const theoryText = document.getElementById("learningTheoryText");
  const conceptList = document.getElementById("learningConceptList");
  const stepList = document.getElementById("learningStepList");
  const practiceSlot = document.getElementById("learningPracticeTeacherSlot");
  const canEdit = canEditLearningResource(resource);

  if (imageSlot) {
    imageSlot.innerHTML = resource?.imageUrl
      ? `<figure class="learning-content-figure"><img class="learning-content-image" src="${escapeHtml(resource.imageUrl)}" alt="Imagen del tema" loading="lazy" />${canEdit ? `<figcaption><button class="btn btn-outline" type="button" data-learning-remove-file="image">Quitar imagen</button></figcaption>` : ""}</figure>`
      : "";
  }
  if (theoryText && resource?.theoryText) {
    theoryText.innerHTML = renderInlineMathText(resource.theoryText);
  }
  const keyConcepts = Array.isArray(resource?.keyConcepts) ? resource.keyConcepts.filter(Boolean) : [];
  if (conceptList && keyConcepts.length) {
    conceptList.innerHTML = keyConcepts.map(concept => `<li>${escapeHtml(concept)}</li>`).join("");
  }
  if (stepList && resource?.stepsText) {
    stepList.innerHTML = resource.stepsText.split(/\r?\n/).filter(Boolean).map(step => `<li>${renderInlineMathText(step)}</li>`).join("");
  }
  if (practiceSlot) {
    const practiceOptions = Array.isArray(resource?.practiceOptions) ? resource.practiceOptions.filter(Boolean) : [];
    practiceSlot.innerHTML = resource?.practiceQuestion ? `
      <div class="learning-content-block learning-wide">
        <h5>Práctica del profesor</h5>
        <p>${renderInlineMathText(resource.practiceQuestion)}</p>
        ${practiceOptions.length ? `<div class="learning-teacher-options">${practiceOptions.map((option, idx) => `<span class="${Number(resource.practiceAnswer) === idx ? "correct" : ""}">${String.fromCharCode(65 + idx)}. ${renderInlineMathText(option)}</span>`).join("")}</div>` : ""}
      </div>
    ` : "";
  }
  if (pdfSlot) {
    pdfSlot.innerHTML = resource?.pdfUrl
      ? `<p>${escapeHtml(resource.title || "Guía descargable")}</p><div class="learning-pdf-viewer"><iframe src="${escapeHtml(resource.pdfUrl)}#toolbar=0" title="PDF del tema" loading="lazy"></iframe></div><div class="learning-file-actions"><a class="btn btn-outline" href="${escapeHtml(resource.pdfUrl)}" target="_blank" rel="noopener">Ver en ventana</a><a class="btn btn-outline" href="${escapeHtml(resource.pdfUrl)}" download>Descargar PDF</a>${canEdit ? `<button class="btn btn-outline" type="button" data-learning-remove-file="pdf">Quitar PDF</button>` : ""}</div>`
      : `<p>Guía descargable del tema. El profesor podrá agregarla cuando esté disponible.</p><button class="btn btn-outline" type="button" disabled>PDF próximamente</button>`;
  }
  if (videoSlot) {
    const url = resource?.videoUrl || resource?.externalVideoUrl || "";
    const isUploadedVideo = !!resource?.videoUrl;
    videoSlot.innerHTML = url
      ? `<p>${escapeHtml(resource.title || "Video del profesor")}</p>${isUploadedVideo ? `<video class="learning-video-player" src="${escapeHtml(url)}" controls controlsList="nodownload noplaybackrate" playsinline preload="metadata"></video>` : `<div class="learning-video-embed"><iframe src="${escapeHtml(videoEmbedUrl(url))}" title="Video del tema" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`}<div class="learning-file-actions">${canEdit ? `<button class="btn btn-outline" type="button" data-learning-remove-file="video">Quitar video</button>` : ""}</div>`
      : `<p>Espacio listo para insertar videos propios por tema y nivel.</p><button class="btn btn-outline" type="button" disabled>Video próximamente</button>`;
  }
  if (unit && window.renderMathInElement) renderMathInElement(unit, { delimiters: MATH_DELIMITERS, throwOnError: false });
}

function populateLearningManagerResource(resource) {
  if (!puedeGestionarContenidoAprendizaje()) return;
  resetLearningManagerFiles();
  const setValue = (id, value = "") => {
    const input = document.getElementById(id);
    if (input) input.value = value || "";
  };
  setValue("learningManagerTitle", resource?.title || "");
  setValue("learningManagerVideoUrl", resource?.externalVideoUrl || "");
  setValue("learningManagerTheory", resource?.theoryText || "");
  setValue("learningManagerConcepts", Array.isArray(resource?.keyConcepts) ? resource.keyConcepts.join("\n") : "");
  setValue("learningManagerSteps", resource?.stepsText || "");
  setValue("learningManagerPracticeQuestion", resource?.practiceQuestion || "");
  const options = Array.isArray(resource?.practiceOptions) ? resource.practiceOptions : [];
  setValue("learningManagerOption0", options[0] || "");
  setValue("learningManagerOption1", options[1] || "");
  setValue("learningManagerOption2", options[2] || "");
  const answer = document.getElementById("learningManagerPracticeAnswer");
  if (answer) answer.value = Number.isFinite(Number(resource?.practiceAnswer)) ? String(resource.practiceAnswer) : "0";
  learningManagerSavedSnapshot = snapshotLearningManagerEditor();
}

async function renderLearningResourceForSelection(selection) {
  try {
    const resource = await cargarLearningResource(selection);
    renderLearningResourceSlots(resource);
  } catch (error) {
    console.warn("No fue posible cargar recursos de aprendizaje", error);
  }
}

function getLearningLast() {
  try {
    return JSON.parse(localStorage.getItem(LEARNING_LAST_KEY) || "null");
  } catch {
    return null;
  }
}

function setLearningLast(selection) {
  localStorage.setItem(LEARNING_LAST_KEY, JSON.stringify(selection));
}

function resolveLearningSelection(selection = getLearningLast()) {
  const branch = LEARNING_CATALOG.find(item => item.id === selection?.branchId) || LEARNING_CATALOG[0];
  const topic = branch.topics.find(item => item.id === selection?.topicId) || branch.topics[0];
  const subtopics = topic.subtopics?.length ? topic.subtopics : [makeLearningSubtopic(branch.title, topic.title, topic.title, topic.summary)];
  const subtopic = subtopics.find(item => item.id === selection?.subtopicId) || subtopics[0];
  const level = LEVEL_LABELS[selection?.level] ? selection.level : "facil";
  return { branchId: branch.id, topicId: topic.id, subtopicId: subtopic.id, level };
}

function learningProgressSummary() {
  const progress = learningProgressAll();
  const validKeys = new Set();
  LEARNING_CATALOG.forEach(branch => {
    branch.topics.forEach(topic => {
      (topic.subtopics || []).forEach(subtopic => {
        Object.keys(LEVEL_LABELS).forEach(level => {
          validKeys.add(learningProgressId(branch.id, topic.id, subtopic.id, level));
        });
      });
    });
  });
  const total = validKeys.size;
  const completed = Object.entries(progress).filter(([key, item]) => validKeys.has(key) && item?.completed).length;
  return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0 };
}

async function setLearningCompleted(selection) {
  const progress = learningProgressAll();
  const key = learningProgressId(selection.branchId, selection.topicId, selection.subtopicId, selection.level);
  progress[key] = { completed: true, completedAt: new Date().toISOString() };
  learningProgressRemote[key] = progress[key];
  saveLearningProgressAll(progress);
  try {
    await guardarLearningProgressRemoto(key, selection, progress[key]);
  } catch (error) {
    console.warn("No fue posible guardar el progreso de aprendizaje", error);
  }
}

function renderLearningPanel() {
  const branchList = document.getElementById("learningBranches");
  const topicsEl = document.getElementById("learningTopics");
  const subtopicsEl = document.getElementById("learningSubtopics");
  const levelsEl = document.getElementById("learningLevelTabs");
  if (!branchList || !topicsEl || !levelsEl) return;

  const selection = resolveLearningSelection();
  setLearningLast(selection);
  if (usuarioActual?.uid && learningProgressRemoteLoadedFor !== usuarioActual.uid) {
    cargarLearningProgressRemoto().then(() => renderLearningPanel()).catch(console.warn);
  }
  const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
  const topic = branch.topics.find(item => item.id === selection.topicId) || branch.topics[0];
  const subtopic = (topic.subtopics || []).find(item => item.id === selection.subtopicId) || topic.subtopics?.[0] || makeLearningSubtopic(branch.title, topic.title, topic.title, topic.summary);
  const canTrackLearning = esEstudianteCuenta();
  const summary = learningProgressSummary();
  renderLearningMobilePicker(branch, topic, subtopic, selection.level);
  document.getElementById("learningProgressCard")?.classList.toggle("hidden", !canTrackLearning);

  const progressPctEl = document.getElementById("learningProgressPct");
  const progressTextEl = document.getElementById("learningProgressText");
  const progressBarEl = document.getElementById("learningProgressBar");
  if (progressPctEl) progressPctEl.textContent = `${summary.pct}%`;
  if (progressTextEl) progressTextEl.textContent = `${summary.completed} de ${summary.total} niveles completados.`;
  if (progressBarEl) progressBarEl.style.width = `${summary.pct}%`;
  document.getElementById("learningBranchTitle").textContent = branch.title;

  branchList.innerHTML = LEARNING_CATALOG.map(item => `
    <button class="learning-branch ${item.id === branch.id ? "active" : ""}" type="button" data-learning-branch="${escapeHtml(item.id)}">
      <span>${item.icon}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.description)}</small>
    </button>
  `).join("");

  levelsEl.innerHTML = Object.entries(LEVEL_LABELS).map(([level, label]) => `
    <button class="${level === selection.level ? "active" : ""}" type="button" data-learning-level="${escapeHtml(level)}">${escapeHtml(label)}</button>
  `).join("");

  const progress = canTrackLearning ? learningProgressAll() : {};
  topicsEl.innerHTML = branch.topics.map(item => {
    const subtopicCount = item.subtopics?.length || 0;
    const completedCount = canTrackLearning ? (item.subtopics || []).filter(st => progress[learningProgressId(branch.id, item.id, st.id, selection.level)]?.completed).length : 0;
    return `
      <button class="learning-topic ${item.id === topic.id ? "active" : ""}" type="button" data-learning-topic="${escapeHtml(item.id)}">
        <span>${canTrackLearning && completedCount ? "✓" : "○"}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.summary)}</small>
        <em>${canTrackLearning ? `${completedCount}/${subtopicCount} subtemas en ${escapeHtml(LEVEL_LABELS[selection.level])}` : `${subtopicCount} subtemas disponibles`}</em>
      </button>
    `;
  }).join("");

  if (subtopicsEl) {
    subtopicsEl.innerHTML = (topic.subtopics || []).map(item => {
      const completed = progress[learningProgressId(branch.id, topic.id, item.id, selection.level)]?.completed;
      return `
        <button class="learning-subtopic ${item.id === subtopic.id ? "active" : ""}" type="button" data-learning-subtopic="${escapeHtml(item.id)}">
          <span>${canTrackLearning && completed ? "✓" : "○"}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.summary)}</small>
        </button>
      `;
    }).join("");
  }

  renderLearningUnit(branch, topic, subtopic, selection.level);
  renderLearningManager(selection);
}

function renderLearningMobilePicker(branch, topic, subtopic, level) {
  const branchSelect = document.getElementById("learningBranchSelect");
  const topicSelect = document.getElementById("learningTopicSelect");
  const subtopicSelect = document.getElementById("learningSubtopicSelect");
  const levelSelect = document.getElementById("learningLevelSelect");
  if (!branchSelect || !topicSelect || !subtopicSelect || !levelSelect) return;
  branchSelect.innerHTML = LEARNING_CATALOG.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  branchSelect.value = branch.id;
  topicSelect.innerHTML = branch.topics.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  topicSelect.value = topic.id;
  subtopicSelect.innerHTML = (topic.subtopics || []).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  subtopicSelect.value = subtopic.id;
  levelSelect.innerHTML = Object.entries(LEVEL_LABELS).map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("");
  levelSelect.value = level;
}

function learningReportMailto(context = "contenido de aprendizaje") {
  const selection = resolveLearningSelection();
  const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
  const topic = branch.topics.find(item => item.id === selection.topicId) || branch.topics[0];
  const subtopic = (topic.subtopics || []).find(item => item.id === selection.subtopicId) || topic.subtopics?.[0];
  const subject = `Reporte de problema en ${context} - Matemáticas En Tu Bolsillo`;
  const body = [
    "Hola, soporte.",
    "",
    "Quiero reportar un problema en la plataforma.",
    "",
    `Sección: ${context}`,
    `Rama: ${branch.title}`,
    `Tema: ${topic.title}`,
    `Subtema: ${subtopic?.title || "No seleccionado"}`,
    `Nivel: ${LEVEL_LABELS[selection.level] || selection.level}`,
    `Usuario: ${usuarioActual?.email || "Sin correo activo"}`,
    "",
    "Descripción del problema:"
  ].join("\n");
  return `mailto:${APP_CONFIG.support.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderLearningUnit(branch, topic, subtopic, level) {
  const unit = document.getElementById("learningUnit");
  if (!unit) return;
  const data = subtopic.levels?.[level] || subtopic.levels?.facil || makeLearningLevels(branch.title, topic.title, subtopic.title)[level];
  const canTrackLearning = esEstudianteCuenta();
  const progress = canTrackLearning ? learningProgressAll() : {};
  const completed = canTrackLearning && progress[learningProgressId(branch.id, topic.id, subtopic.id, level)]?.completed;
  const examActionText = esProfesor() ? "Ver examen" : "Ir al examen";
  unit.innerHTML = `
    <header class="learning-unit-head">
      <div>
        <span class="section-kicker">${escapeHtml(branch.title)} · ${escapeHtml(topic.title)} · ${escapeHtml(LEVEL_LABELS[level])}</span>
        <h3>${escapeHtml(subtopic.title)}</h3>
        <p>${escapeHtml(subtopic.summary || topic.summary)}</p>
      </div>
      <span class="learning-master-badge ${completed ? "done" : ""}">${canTrackLearning ? (completed ? "Completado" : "En progreso") : "Contenido"}</span>
    </header>

    <div class="learning-resource-grid">
      <article>
        <h4>Teoría interactiva</h4>
        <p id="learningTheoryText">${renderInlineMathText(data.theory)}</p>
      </article>
      <article>
        <h4>Conceptos clave</h4>
        <ul id="learningConceptList">${(subtopic.keyConcepts || topic.keyConcepts || []).map(concept => `<li>${escapeHtml(concept)}</li>`).join("")}</ul>
      </article>
      <article class="learning-wide learning-step-card">
        <h4>Ejemplo paso a paso</h4>
        <ol id="learningStepList">${data.example.map(step => `<li>${renderInlineMathText(step)}</li>`).join("")}</ol>
      </article>
      <div id="learningContentImageSlot" class="learning-content-image-slot learning-wide"></div>
      <article class="learning-wide learning-video-card">
        <h4>Video del profesor</h4>
        <div id="learningVideoSlot">
          <p>Espacio listo para insertar videos propios por tema y nivel.</p>
          <button class="btn btn-outline" type="button" disabled>Video próximamente</button>
        </div>
      </article>
      <article class="learning-wide learning-pdf-card">
        <h4>Material descargable</h4>
        <div id="learningPdfSlot">
          <p>Guía descargable del tema. El profesor podrá agregarla cuando esté disponible.</p>
          <button class="btn btn-outline" type="button" disabled>PDF próximamente</button>
        </div>
      </article>
    </div>

    <div class="learning-practice" data-learning-practice>
      <span class="section-kicker">Práctica</span>
      <h4>Cuando termines este subtema, continúa con el examen ${escapeHtml(LEVEL_LABELS[level])}.</h4>
      <p>La práctica evaluable usa el flujo oficial de exámenes, intentos, tiempos, disponibilidad y retroalimentación que ya tiene tu aula.</p>
      <div id="learningPracticeTeacherSlot" class="learning-practice-teacher-slot"></div>
      <p class="bank-status" data-learning-status></p>
    </div>

    <div class="learning-actions">
      ${canTrackLearning ? `<button class="btn btn-outline ${completed ? "learning-complete-done" : ""}" type="button" id="btnLearningComplete" ${completed ? "disabled" : ""}>${completed ? "Completado" : "Marcar como estudiado"}</button>` : ""}
      <button class="btn btn-primary" type="button" id="btnLearningExam">${examActionText} ${escapeHtml(LEVEL_LABELS[level])} · ${etiquetaDuracionNivel(level)}</button>
      ${puedeGestionarContenidoAprendizaje() ? `<button class="btn btn-outline" type="button" data-learning-edit-resource>Editar contenido</button>` : ""}
      <a class="learning-report-link" href="${learningReportMailto("contenido de aprendizaje")}">Reportar un problema</a>
    </div>
  `;
  if (window.renderMathInElement) renderMathInElement(unit, { delimiters: MATH_DELIMITERS, throwOnError: false });
  renderLearningResourceForSelection({ branchId: branch.id, topicId: topic.id, subtopicId: subtopic.id, level });
}
function renderLearningManager(selection = resolveLearningSelection()) {
  const manager = document.getElementById("learningTeacherManager");
  if (!manager) return;
  if (!puedeGestionarContenidoAprendizaje()) {
    manager.classList.add("hidden");
    return;
  }

  const scopeSel = document.getElementById("learningManagerScope");
  const scopeLabel = document.getElementById("learningManagerScopeLabel");
  const classSel = document.getElementById("learningManagerClass");
  const branchSel = document.getElementById("learningManagerBranch");
  const topicSel = document.getElementById("learningManagerTopic");
  const subtopicSel = document.getElementById("learningManagerSubtopic");
  const levelSel = document.getElementById("learningManagerLevel");
  if (!branchSel || !topicSel || !subtopicSel || !levelSel) return;
  const owner = esPropietarioPlataforma();
  const selectedScope = owner ? (selection.scope || scopeSel?.value || "global") : "class";
  const scopeHelp = document.getElementById("learningManagerScopeHelp");
  if (scopeHelp) {
    scopeHelp.textContent = owner
      ? "Como dueño puedes editar contenido estructural de toda la plataforma o preparar recursos para un aula específica."
      : "El contenido estructural de Aprendizaje solo puede ser editado por el dueño de la app.";
  }
  if (scopeLabel) scopeLabel.classList.toggle("hidden", !owner);
  if (scopeSel) {
    scopeSel.innerHTML = owner
      ? `<option value="global">Toda la plataforma</option><option value="class">Aula específica</option>`
      : `<option value="class">Aula específica</option>`;
    scopeSel.value = owner ? (selectedScope === "class" ? "class" : "global") : "class";
  }
  if (classSel) {
    classSel.innerHTML = adminClases.length
      ? adminClases.map(classroom => `<option value="${escapeHtml(classroom.id)}">${escapeHtml(classroom.name)} (${escapeHtml(classroom.code || "")})</option>`).join("")
      : `<option value="">Sin aulas creadas</option>`;
    classSel.value = selection.classId || adminClaseActiva || adminClases[0]?.id || "";
    classSel.disabled = owner && scopeSel?.value === "global";
  }
  branchSel.innerHTML = LEARNING_CATALOG.map(branch => `<option value="${escapeHtml(branch.id)}">${escapeHtml(branch.title)}</option>`).join("");
  branchSel.value = selection.branchId;
  const branch = LEARNING_CATALOG.find(item => item.id === branchSel.value) || LEARNING_CATALOG[0];
  topicSel.innerHTML = branch.topics.map(topic => `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.title)}</option>`).join("");
  topicSel.value = branch.topics.some(topic => topic.id === selection.topicId) ? selection.topicId : branch.topics[0].id;
  const topic = branch.topics.find(item => item.id === topicSel.value) || branch.topics[0];
  subtopicSel.innerHTML = (topic.subtopics || []).map(subtopic => `<option value="${escapeHtml(subtopic.id)}">${escapeHtml(subtopic.title)}</option>`).join("");
  subtopicSel.value = (topic.subtopics || []).some(subtopic => subtopic.id === selection.subtopicId) ? selection.subtopicId : topic.subtopics?.[0]?.id || topic.id;
  levelSel.innerHTML = Object.entries(LEVEL_LABELS).map(([level, label]) => `<option value="${escapeHtml(level)}">${escapeHtml(label)}</option>`).join("");
  levelSel.value = selection.level;
}

function getLearningManagerSelection() {
  const current = resolveLearningSelection();
  const branchId = document.getElementById("learningManagerBranch")?.value || current.branchId;
  const topicId = document.getElementById("learningManagerTopic")?.value || current.topicId;
  const subtopicId = document.getElementById("learningManagerSubtopic")?.value || current.subtopicId;
  const level = document.getElementById("learningManagerLevel")?.value || current.level;
  const base = resolveLearningSelection({ branchId, topicId, subtopicId, level });
  const owner = esPropietarioPlataforma();
  const scope = owner ? (document.getElementById("learningManagerScope")?.value || "global") : "class";
  return { ...base, scope, classId: document.getElementById("learningManagerClass")?.value || "" };
}

function cargarContenidoBaseEnEditor() {
  if (!esPropietarioPlataforma()) return;
  const selection = resolveLearningSelection();
  const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
  const topic = branch.topics.find(item => item.id === selection.topicId) || branch.topics[0];
  const subtopic = (topic.subtopics || []).find(item => item.id === selection.subtopicId) || topic.subtopics?.[0];
  const data = subtopic?.levels?.[selection.level] || subtopic?.levels?.facil || {};
  const scope = document.getElementById("learningManagerScope");
  if (scope) scope.value = "global";
  renderLearningManager({ ...selection, scope: "global" });
  const title = document.getElementById("learningManagerTitle");
  const theory = document.getElementById("learningManagerTheory");
  const concepts = document.getElementById("learningManagerConcepts");
  const steps = document.getElementById("learningManagerSteps");
  const question = document.getElementById("learningManagerPracticeQuestion");
  const option0 = document.getElementById("learningManagerOption0");
  const option1 = document.getElementById("learningManagerOption1");
  const option2 = document.getElementById("learningManagerOption2");
  if (title) title.value = `${subtopic?.title || topic.title} · ${LEVEL_LABELS[selection.level]}`;
  if (theory) theory.value = normalizeLatexText(data.theory || "");
  if (concepts) concepts.value = (subtopic?.keyConcepts || topic.keyConcepts || []).join("\n");
  if (steps) steps.value = (data.example || []).map(normalizeLatexText).join("\n");
  if (question) question.value = normalizeLatexText(data.practice?.question || "");
  if (option0) option0.value = normalizeLatexText(data.practice?.options?.[0] || "");
  if (option1) option1.value = normalizeLatexText(data.practice?.options?.[1] || "");
  if (option2) option2.value = normalizeLatexText(data.practice?.options?.[2] || "");
  learningManagerSavedSnapshot = snapshotLearningManagerEditor();
  document.getElementById("learningTeacherManager")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function snapshotLearningManagerEditor() {
  const valueIds = ["learningManagerTitle", "learningManagerVideoUrl", "learningManagerTheory", "learningManagerConcepts", "learningManagerSteps", "learningManagerPracticeQuestion", "learningManagerOption0", "learningManagerOption1", "learningManagerOption2", "learningManagerPracticeAnswer"];
  return JSON.stringify(valueIds.map(id => document.getElementById(id)?.value || ""));
}
function learningManagerTieneCambiosSinGuardar() {
  if (!puedeGestionarContenidoAprendizaje()) return false;
  const hasFiles = ["learningManagerImage", "learningManagerPdf", "learningManagerVideo"].some(id => (document.getElementById(id)?.files?.length || 0) > 0);
  return hasFiles || snapshotLearningManagerEditor() !== learningManagerSavedSnapshot;
}

function mostrarLearningManagerEditor() {
  if (!puedeGestionarContenidoAprendizaje()) return;
  const manager = document.getElementById("learningTeacherManager");
  if (!manager) return;
  manager.classList.remove("hidden");
  manager.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarLearningManagerEditor(options = {}) {
  const manager = document.getElementById("learningTeacherManager");
  if (!manager) return true;
  const force = !!options.force;
  if (!force && !manager.classList.contains("hidden") && learningManagerTieneCambiosSinGuardar()) {
    const ok = confirm("Tienes contenido o archivos cargados sin guardar. Si sales ahora se limpiará el editor y perderás esos cambios. ¿Deseas salir sin guardar?");
    if (!ok) return false;
  }
  resetLearningManagerEditor();
  manager.classList.add("hidden");
  return true;
}
function resetLearningManagerEditor() {
  if (!puedeGestionarContenidoAprendizaje()) return;
  ["learningManagerTitle", "learningManagerVideoUrl", "learningManagerTheory", "learningManagerConcepts", "learningManagerSteps", "learningManagerPracticeQuestion", "learningManagerOption0", "learningManagerOption1", "learningManagerOption2"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  const answer = document.getElementById("learningManagerPracticeAnswer");
  if (answer) answer.value = "0";
  resetLearningManagerFiles();
  learningManagerSavedSnapshot = snapshotLearningManagerEditor();
  const status = document.getElementById("learningManagerStatus");
  if (status) {
    status.textContent = "";
    status.className = "bank-status";
  }
}
function resetLearningManagerFiles() {
  ["learningManagerImage", "learningManagerPdf", "learningManagerVideo"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
}

async function subirLearningFile(file, selection, kind, resourceId) {
  if (!file) return {};
  const maxMb = kind === "pdf" ? LEARNING_RESOURCE_MAX_PDF_MB : kind === "image" ? LEARNING_RESOURCE_MAX_IMAGE_MB : LEARNING_RESOURCE_MAX_VIDEO_MB;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`El archivo supera ${maxMb} MB.`);
  if (kind === "image" && !file.type.startsWith("image/")) throw new Error("La imagen debe ser JPG, PNG, WEBP o GIF.");
  if (kind === "pdf" && file.type !== "application/pdf") throw new Error("El material descargable debe ser un archivo PDF.");
  if (kind === "video" && !["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) throw new Error("El video debe estar en formato MP4, WebM o MOV.");
  const path = `learningResources/${usuarioActual.uid}/${resourceId}/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(ref);
  if (kind === "pdf") return { pdfUrl: url, pdfPath: path };
  if (kind === "image") return { imageUrl: url, imagePath: path };
  return { videoUrl: url, videoPath: path };
}

async function guardarLearningResource() {
  if (!puedeGestionarContenidoAprendizaje()) return;
  const status = document.getElementById("learningManagerStatus");
  const title = document.getElementById("learningManagerTitle")?.value.trim() || "";
  const externalVideoUrl = document.getElementById("learningManagerVideoUrl")?.value.trim() || "";
  const theoryText = document.getElementById("learningManagerTheory")?.value.trim() || "";
  const stepsText = document.getElementById("learningManagerSteps")?.value.trim() || "";
  const keyConcepts = (document.getElementById("learningManagerConcepts")?.value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const practiceQuestion = document.getElementById("learningManagerPracticeQuestion")?.value.trim() || "";
  const practiceOptions = [0, 1, 2].map(idx => document.getElementById(`learningManagerOption${idx}`)?.value.trim() || "");
  const practiceAnswer = Number(document.getElementById("learningManagerPracticeAnswer")?.value || 0);
  const image = document.getElementById("learningManagerImage")?.files?.[0] || null;
  const pdf = document.getElementById("learningManagerPdf")?.files?.[0] || null;
  const video = document.getElementById("learningManagerVideo")?.files?.[0] || null;
  const selection = getLearningManagerSelection();
  const resourceId = currentLearningResourceId(selection);
  if (selection.scope === "class" && !selection.classId) {
    if (status) {
      status.textContent = "Selecciona el aula donde se verá este contenido.";
      status.className = "bank-status error";
    }
    return;
  }
  if (!title && !theoryText && !stepsText && !keyConcepts.length && !practiceQuestion && !image && !pdf && !video && !externalVideoUrl) {
    if (status) {
      status.textContent = "Agrega al menos un título, explicación, archivo, video o práctica.";
      status.className = "bank-status error";
    }
    return;
  }
  if (status) {
    status.textContent = "Guardando contenido...";
    status.className = "bank-status error";
  }
  try {
    const uploads = {
      ...(await subirLearningFile(image, selection, "image", resourceId)),
      ...(await subirLearningFile(pdf, selection, "pdf", resourceId)),
      ...(await subirLearningFile(video, selection, "video", resourceId))
    };
    const scope = selection.scope;
    await setDoc(doc(db, LEARNING_RESOURCE_COLLECTION, resourceId), {
      ownerUid: usuarioActual.uid,
      ownerEmail: usuarioActual.email || "",
      branchId: selection.branchId,
      topicId: selection.topicId,
      subtopicId: selection.subtopicId || selection.topicId,
    level: selection.level,
      scope,
      classId: scope === "class" ? selection.classId : "",
      className: scope === "class" ? nombreAulaPorId(selection.classId) : "",
      title,
      externalVideoUrl,
      theoryText,
      keyConcepts,
      stepsText,
      practiceQuestion,
      practiceOptions,
      practiceAnswer: Number.isFinite(practiceAnswer) ? practiceAnswer : 0,
      ...uploads,
      updatedAt: serverTimestamp()
    }, { merge: true });
    learningResourcesCache.delete(learningResourceCacheKey(selection));
    resetLearningManagerFiles();
    learningManagerSavedSnapshot = snapshotLearningManagerEditor();
    if (status) setStatusTemporal("learningManagerStatus", "Contenido guardado. Los estudiantes lo verán en esta unidad.", "ok");
    renderLearningResourceForSelection(selection);
  } catch (error) {
    if (status) {
      status.textContent = error.message || "No fue posible guardar el contenido.";
      status.className = "bank-status error";
    }
  }
}
async function quitarLearningResourceFile(kind) {
  if (!puedeGestionarContenidoAprendizaje()) return;
  const selection = getLearningManagerSelection();
  const resource = await cargarLearningResource(selection, true);
  if (!canEditLearningResource(resource)) {
    alert("Solo el dueño de la app puede editar este contenido.");
    return;
  }
  const labels = { pdf: "PDF", video: "video", image: "imagen" };
  const paths = { pdf: resource.pdfPath, video: resource.videoPath, image: resource.imagePath };
  const updatesByKind = {
    pdf: { pdfUrl: "", pdfPath: "", updatedAt: serverTimestamp() },
    video: { videoUrl: "", videoPath: "", updatedAt: serverTimestamp() },
    image: { imageUrl: "", imagePath: "", updatedAt: serverTimestamp() }
  };
  if (!updatesByKind[kind]) return;
  if (!confirm(`¿Deseas quitar este ${labels[kind]} del contenido?`)) return;
  if (paths[kind]) await deleteObject(storageRef(storage, paths[kind])).catch(() => {});
  await updateDoc(doc(db, LEARNING_RESOURCE_COLLECTION, resource.id), updatesByKind[kind]);
  learningResourcesCache.delete(learningResourceCacheKey(selection));
  await renderLearningResourceForSelection(selection);
}
function normalizeLatexText(value = "") {
  return String(value)
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]")
    .replace(/\\\\frac/g, "\\frac")
    .replace(/\\frac(\d+)(\d+)/g, "\\frac{$1}{$2}");
}

function renderInlineMathText(value = "") {
  return escapeHtml(normalizeLatexText(value));
}

function handleLearningClick(event) {
  const branchButton = event.target.closest("[data-learning-branch]");
  const topicButton = event.target.closest("[data-learning-topic]");
  const subtopicButton = event.target.closest("[data-learning-subtopic]");
  const levelButton = event.target.closest("[data-learning-level]");
  const selection = resolveLearningSelection();

  if (branchButton) {
    const branch = LEARNING_CATALOG.find(item => item.id === branchButton.dataset.learningBranch) || LEARNING_CATALOG[0];
    const topic = branch.topics[0];
    const subtopic = topic.subtopics?.[0];
    setLearningLast({ branchId: branch.id, topicId: topic.id, subtopicId: subtopic?.id || topic.id, level: selection.level });
    renderLearningPanel();
    return;
  }
  if (topicButton) {
    const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
    const topic = branch.topics.find(item => item.id === topicButton.dataset.learningTopic) || branch.topics[0];
    const subtopic = topic.subtopics?.[0];
    setLearningLast({ ...selection, topicId: topic.id, subtopicId: subtopic?.id || topic.id });
    renderLearningPanel();
    return;
  }
  if (subtopicButton) {
    setLearningLast({ ...selection, subtopicId: subtopicButton.dataset.learningSubtopic });
    renderLearningPanel();
    return;
  }
  if (levelButton) {
    setLearningLast({ ...selection, level: levelButton.dataset.learningLevel });
    renderLearningPanel();
  }
}
document.getElementById("sectionAprendizaje")?.addEventListener("click", async event => {
  handleLearningClick(event);
  const completeBtn = event.target.closest("#btnLearningComplete");
  if (completeBtn) {
    if (!esEstudianteCuenta() || completeBtn.disabled) return;
    const selection = resolveLearningSelection();
    await setLearningCompleted(selection);
    renderLearningPanel();
  }
  if (event.target.closest("#btnLearningExam")) {
    const selection = resolveLearningSelection();
    const examKey = LEVEL_TO_EXAM[selection.level] || "diagnostico";
    if (esProfesor()) {
      enfocarExamenProfesorDesdeAprendizaje(examKey);
    } else {
      activarNav(examKey);
      if (examKey === "nivel1") abrirNivel("nivel1");
    }
  }
  if (event.target.closest("[data-learning-edit-resource]")) {
    const selection = getLearningManagerSelection();
    const resource = await cargarLearningResource(selection, true);
    if (resource && canEditLearningResource(resource)) {
      populateLearningManagerResource(resource);
      mostrarLearningManagerEditor();
    } else if (esPropietarioPlataforma()) {
      cargarContenidoBaseEnEditor();
      mostrarLearningManagerEditor();
    } else {
      resetLearningManagerEditor();
      mostrarLearningManagerEditor();
    }
  }
  const removeFileButton = event.target.closest("[data-learning-remove-file]");
  if (removeFileButton) {
    await quitarLearningResourceFile(removeFileButton.dataset.learningRemoveFile);
  }
  if (event.target.closest("#btnLearningResourceSave")) {
    await guardarLearningResource();
  }
  if (event.target.closest("#btnLearningResourceClear")) {
    resetLearningManagerEditor();
  }
  if (event.target.closest("#btnCloseLearningEditor")) {
    cerrarLearningManagerEditor();
  }
});

document.getElementById("sectionAprendizaje")?.addEventListener("change", event => {
  if (event.target.matches("#learningBranchSelect")) {
    const branch = LEARNING_CATALOG.find(item => item.id === event.target.value) || LEARNING_CATALOG[0];
    const topic = branch.topics[0];
    const subtopic = topic.subtopics?.[0];
    setLearningLast({ branchId: branch.id, topicId: topic.id, subtopicId: subtopic?.id || topic.id, level: resolveLearningSelection().level });
    renderLearningPanel();
    return;
  }
  if (event.target.matches("#learningTopicSelect")) {
    const selection = resolveLearningSelection();
    const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
    const topic = branch.topics.find(item => item.id === event.target.value) || branch.topics[0];
    const subtopic = topic.subtopics?.[0];
    setLearningLast({ ...selection, topicId: topic.id, subtopicId: subtopic?.id || topic.id });
    renderLearningPanel();
    return;
  }
  if (event.target.matches("#learningSubtopicSelect")) {
    setLearningLast({ ...resolveLearningSelection(), subtopicId: event.target.value });
    renderLearningPanel();
    return;
  }
  if (event.target.matches("#learningLevelSelect")) {
    setLearningLast({ ...resolveLearningSelection(), level: event.target.value });
    renderLearningPanel();
    return;
  }
  if (!event.target.closest("#learningTeacherManager")) return;
  if (event.target.matches("#learningManagerBranch")) {
    const selection = getLearningManagerSelection();
    const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
    const topic = branch.topics[0];
    renderLearningManager({ ...selection, branchId: branch.id, topicId: topic.id, subtopicId: topic.subtopics?.[0]?.id || topic.id, level: selection.level });
    renderLearningResourceForSelection(getLearningManagerSelection());
    return;
  }
  if (event.target.matches("#learningManagerTopic")) {
    const selection = getLearningManagerSelection();
    const branch = LEARNING_CATALOG.find(item => item.id === selection.branchId) || LEARNING_CATALOG[0];
    const topic = branch.topics.find(item => item.id === selection.topicId) || branch.topics[0];
    renderLearningManager({ ...selection, topicId: topic.id, subtopicId: topic.subtopics?.[0]?.id || topic.id });
    renderLearningResourceForSelection(getLearningManagerSelection());
    return;
  }
  if (event.target.matches("#learningManagerScope")) {
    renderLearningManager(getLearningManagerSelection());
    renderLearningResourceForSelection(getLearningManagerSelection());
    return;
  }
  if (event.target.matches("#learningManagerSubtopic, #learningManagerLevel, #learningManagerClass")) {
    renderLearningResourceForSelection(getLearningManagerSelection());
  }
});


function learningCompletedEntries() {
  return Object.values(learningProgressAll()).filter(item => item?.completed && item?.completedAt);
}

function dateKeyBogota(date) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function learningActivityDays() {
  return [...new Set(learningCompletedEntries().map(item => dateKeyBogota(new Date(item.completedAt))))].sort();
}

function learningCurrentStreak() {
  const days = new Set(learningActivityDays());
  let cursor = new Date();
  let streak = 0;
  for (let i = 0; i < 180; i += 1) {
    const key = dateKeyBogota(cursor);
    if (!days.has(key)) {
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function learningWeekStart(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function learningWeeklyProgress() {
  const start = learningWeekStart();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const sessions = learningCompletedEntries().filter(item => {
    const when = new Date(item.completedAt);
    return when >= start && when < end;
  }).length;
  const target = 3;
  return { sessions, target, pct: Math.min(100, Math.round((sessions / target) * 100)) };
}

function learningBadgeProgress(badge) {
  const completed = learningCompletedEntries().length;
  const weekly = learningWeeklyProgress().sessions;
  const streak = learningCurrentStreak();
  const value = badge.type === "streak" ? streak : badge.type === "weekly" ? weekly : completed;
  return { value, pct: Math.min(100, Math.round((value / badge.target) * 100)), unlocked: value >= badge.target };
}

function renderBadgesPanel() {
  if (!esEstudianteCuenta()) return;
  const summaryEl = document.getElementById("badgesSummaryGrid");
  const nextEl = document.getElementById("badgesNextCard");
  const gridEl = document.getElementById("badgesGrid");
  if (!summaryEl || !nextEl || !gridEl) return;
  if (usuarioActual?.uid && learningProgressRemoteLoadedFor !== usuarioActual.uid) {
    cargarLearningProgressRemoto().then(() => renderBadgesPanel()).catch(console.warn);
  }
  const completed = learningCompletedEntries().length;
  const streak = learningCurrentStreak();
  const weekly = learningWeeklyProgress();
  const badgeStates = BADGE_CATALOG.map(badge => ({ ...badge, ...learningBadgeProgress(badge) }));
  const next = badgeStates.find(badge => !badge.unlocked) || badgeStates[badgeStates.length - 1];
  summaryEl.innerHTML = `
    <article><span>🔥</span><strong>${streak} día(s)</strong><small>Racha actual</small></article>
    <article><span>🎯</span><strong>${weekly.sessions}/${weekly.target}</strong><small>Meta semanal</small></article>
    <article><span>📚</span><strong>${completed}</strong><small>Niveles completados</small></article>
    <article><span>🏅</span><strong>${badgeStates.filter(item => item.unlocked).length}/${badgeStates.length}</strong><small>Insignias obtenidas</small></article>
  `;
  nextEl.innerHTML = `
    <div>
      <span class="section-kicker">Próxima insignia</span>
      <h3>${escapeHtml(next.icon)} ${escapeHtml(next.title)}</h3>
      <p>${escapeHtml(next.description)}</p>
    </div>
    <div class="badge-progress-ring" style="--badge-progress:${next.pct}%"><strong>${next.pct}%</strong><span>${next.value}/${next.target}</span></div>
  `;
  gridEl.innerHTML = badgeStates.map(badge => `
    <article class="badge-card ${badge.unlocked ? "unlocked" : "locked"}">
      <span class="badge-icon">${escapeHtml(badge.icon)}</span>
      <div>
        <strong>${escapeHtml(badge.title)}</strong>
        <p>${escapeHtml(badge.description)}</p>
        <div class="badge-mini-bar"><i style="width:${badge.pct}%"></i></div>
        <small>${badge.unlocked ? "Desbloqueada" : `Pendiente: ${badge.value}/${badge.target}`}</small>
      </div>
    </article>
  `).join("");
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
  const institucion = esInstitucion();
  const permitidas = seccionesPermitidasActuales();
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !(modoAdmin || institucion)));
  document.querySelectorAll(".student-only").forEach(el => el.classList.toggle("hidden", !esEstudianteCuenta()));
  document.querySelectorAll(".drawer-link[data-section]").forEach(el => {
    const section = el.dataset.section;
    el.classList.toggle("hidden", !permitidas.has(section));
  });
}

function renderAdminWelcome() {
  const title = document.getElementById("adminWelcomeTitle");
  const img = document.getElementById("adminWelcomePhoto");
  if (!title || !img) return;
  const nombre = perfilActual?.displayName || usuarioActual?.displayName || "Profesor";
  title.textContent = `Bienvenido, ${nombre}`;
  img.src = perfilActual?.photoData || usuarioActual?.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23e8f0fb'/%3E%3Ctext x='60' y='70' text-anchor='middle' font-size='46' fill='%23003865'%3E%F0%9F%91%A8%E2%80%8D%F0%9F%8F%AB%3C/text%3E%3C/svg%3E";
}

function parseInstitutionMemberLines(raw) {
  return raw.split(/\n|;/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const angle = line.match(/^(.*?)<([^>]+)>$/);
      if (angle) return { name: angle[1].trim(), email: angle[2].trim().toLowerCase() };
      const comma = line.match(/^(.*?),\s*([^,\s]+@[^\s,]+)$/i);
      if (comma) return { name: comma[1].trim(), email: comma[2].trim().toLowerCase() };
      const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
      return { name: line.replace(email, "").replace(/[<>,]/g, "").trim(), email };
    })
    .filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email));
}

function gradosInstitucion(perfil = perfilActual) {
  const counts = perfil?.gradeCounts || {};
  const mode = perfil?.gradeMode || "letter";
  const result = [];
  ["9", "10", "11"].forEach(grade => {
    const total = Number(counts[grade] || 0);
    for (let i = 1; i <= total; i += 1) {
      const suffix = mode === "number" ? String(i) : String.fromCharCode(64 + i);
      result.push(`${grade}${mode === "number" ? "-" : ""}${suffix}`);
    }
  });
  return result;
}

function actualizarSelectGradosInstitucion() {
  const grades = gradosInstitucion();
  ["institutionMemberGrade", "institutionClassGrade"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = grades.length
      ? grades.map(grade => `<option value="${grade}">${grade}</option>`).join("")
      : `<option value="">Sin grados configurados</option>`;
  });
}

async function miembrosInstitucionActual() {
  const dane = normalizarDane(perfilActual?.institutionDane);
  if (!dane) return [];
  const snap = await getDocs(query(collection(db, "institutionMembers"), where("institutionDane", "==", dane)));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function invitacionesInstitucionActual() {
  const dane = normalizarDane(perfilActual?.institutionDane);
  if (!dane) return [];
  const snap = await getDocs(query(collection(db, "classInvites"), where("institutionDane", "==", dane)));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

function estadoVisibleMiembroInstitucion(member, acceptedInviteKeys) {
  const email = String(member.email || "").toLowerCase();
  const key = `${member.classId || ""}::${email}`;
  if (member.status === "removed" || member.status === "blocked") return "bloqueado";
  if (member.status === "active" && member.userUid) return "activo";
  return acceptedInviteKeys.has(key) ? "activo" : "pendiente";
}

async function renderInstitutionPanel() {
  actualizarSelectGradosInstitucion();
  const summary = document.getElementById("institutionSummaryBox");
  const list = document.getElementById("institutionMembersList");
  const [members, requests, invites] = await Promise.all([
    miembrosInstitucionActual().catch(() => []),
    solicitudesInstitucionActual().catch(() => []),
    invitacionesInstitucionActual().catch(() => [])
  ]);
  const acceptedInviteKeys = new Set(invites
    .filter(item => item.status === "accepted")
    .map(item => `${item.classId || ""}::${String(item.email || item.studentEmail || "").toLowerCase()}`));
  const students = members.filter(item => item.role === "student" && item.status !== "removed");
  const teachers = members.filter(item => item.role === "teacher" && item.status !== "removed");
  const limits = limitesPlanInstitucional();
  const grades = gradosInstitucion();
  const classList = document.getElementById("institutionClassesList");
  if (classList) {
    const classes = Array.isArray(adminClases) ? adminClases : [];
    classList.innerHTML = classes.length
      ? classes.map(clase => `<article class="institution-class-row">
          <div>
            <strong>${escapeHtml(clase.name || "Aula sin nombre")}</strong>
            <span>Código de aula: ${escapeHtml(clase.code || "Sin código")}</span>
            <small>Curso o grado: ${escapeHtml(clase.grade || clase.course || "Sin curso")}</small>
          </div>
        </article>`).join("")
      : `<p class="mini-help">Aún no hay aulas creadas.</p>`;
  }
  if (summary) {
    summary.innerHTML = [
      ["Institución", perfilActual?.institutionName || "Sin nombre"],
      ["Código DANE", perfilActual?.institutionDane || "Sin DANE"],
      ["Ubicación", [perfilActual?.institutionDepartmentName, perfilActual?.institutionMunicipalityName].filter(Boolean).join(" · ") || "Sin ubicación"],
      ["Aulas creadas", String(adminClases?.length || 0)],
      ["Estudiantes", limits.maxStudents ? `${students.length} / ${limits.maxStudents}` : String(students.length)],
      ["Profesores", limits.maxTeachers ? `${teachers.length} / ${limits.maxTeachers}` : String(teachers.length)]
    ].map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
  }
  if (list) {
    const pendingHtml = requests.length ? `<details class="class-student-group" open>
      <summary>Solicitudes de inscripción · ${requests.length}</summary>
      <div class="student-row-list">
        ${requests.map(req => {
          const students = Array.isArray(req.students) ? req.students : [];
          const studentSummary = req.action === "add-students"
            ? students.map(student => `${student.name || "Nombre pendiente"} <${student.email || "Sin correo"}>`).join(", ")
            : `${req.studentName || "Nombre pendiente"} <${req.studentEmail || req.studentId || "Sin correo"}>`;
          return `<article class="student-row">
            <div>
              <strong>${req.action === "add-students" ? "Solicitud de inscripción" : "Solicitud de retiro"}</strong>
              <span>Código de aula: ${escapeHtml(req.classCode || "Sin código")} · Aula: ${escapeHtml(req.className || "Sin aula")}</span>
              <small>Estudiante(s): ${escapeHtml(studentSummary || "Sin estudiantes")}</small>
              <small>Solicitó: ${escapeHtml(req.requesterName || req.requesterEmail || "Profesor")} · Fecha: ${escapeHtml(fechaFacturacion(req.createdAt))}</small>
            </div>
            <button class="btn btn-primary" type="button" data-approve-institution-request="${req.id}">Aprobar</button>
            <button class="btn btn-outline danger" type="button" data-reject-institution-request="${req.id}">Rechazar</button>
          </article>`;
        }).join("")}
      </div>
    </details>` : "";
    if (!members.length) {
      list.innerHTML = `${pendingHtml}<p class="mini-help">Aún no hay estudiantes ni profesores registrados por la institución.</p>`;
    } else {
      const byGrade = [...new Set([...grades, ...members.map(item => item.grade || "Sin curso")])];
      list.innerHTML = pendingHtml + (byGrade.map(grade => {
        const items = members.filter(item => (item.grade || "Sin curso") === grade && item.status !== "removed");
        if (!items.length) return "";
        return `<details class="class-student-group">
          <summary>${grade} · ${items.length} integrante(s)</summary>
          <div class="student-row-list">
            ${items.map(item => `<article class="student-row">
              <div><strong>${item.name || item.displayName || "Sin nombre"}</strong><span>${item.email}</span><small>${item.role === "teacher" ? "Profesor" : "Estudiante"} · ${item.className || "Sin aula"} · ${estadoVisibleMiembroInstitucion(item, acceptedInviteKeys)}</small></div>
              <button class="btn btn-outline danger" type="button" data-delete-institution-member="${item.id}">Eliminar</button>
            </article>`).join("")}
          </div>
        </details>`;
      }).join("") || `<p class="mini-help">No hay integrantes activos.</p>`);
    }
  }
}

function validarCupoInstitucional(role, incomingMembers, currentMembers) {
  const limits = limitesPlanInstitucional();
  const max = role === "teacher" ? limits.maxTeachers : limits.maxStudents;
  if (!max) return { ok: true };
  const roleLabel = role === "teacher" ? "profesor" : "estudiante";
  const activeEmails = new Set(currentMembers
    .filter(item => item.role === role && item.status !== "removed")
    .map(item => String(item.email || "").toLowerCase()));
  const activeCount = activeEmails.size;
  const newCount = incomingMembers
    .filter(item => !activeEmails.has(String(item.email || "").toLowerCase()))
    .length;
  if (activeCount + newCount <= max) return { ok: true };
  return {
    ok: false,
    message: `Tu plan actual permite máximo ${max} ${roleLabel}${max === 1 ? "" : "s"}. Ya tienes ${activeCount} registrado(s). Para agregar más, debes mejorar el plan.`
  };
}

async function solicitudesInstitucionActual() {
  const dane = normalizarDane(perfilActual?.institutionDane);
  if (!dane) return [];
  const snap = await getDocs(query(
    collection(db, "institutionRequests"),
    where("institutionDane", "==", dane),
    where("status", "==", "pending")
  ));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function crearSolicitudInstitucional(action, payload = {}) {
  const dane = normalizarDane(perfilActual?.institutionDane || payload.institutionDane);
  if (!dane) throw new Error("No se encontró la institución asociada.");
  const institutionSnap = await getDoc(doc(db, "institutions", dane));
  const institution = institutionSnap.exists() ? institutionSnap.data() : {};
  const requestRef = doc(collection(db, "institutionRequests"));
  const request = {
    institutionDane: dane,
    institutionName: perfilActual?.institutionName || institution.institutionName || "",
    institutionOwnerUid: institution.ownerUid || perfilActual?.institutionOwnerUid || "",
    institutionOwnerEmail: institution.ownerEmail || "",
    action,
    status: "pending",
    requesterUid: usuarioActual.uid,
    requesterEmail: usuarioActual.email || "",
    requesterName: perfilActual?.displayName || usuarioActual.displayName || "",
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(requestRef, request);
  await crearNotificacion({
    type: "institution-request",
    targetUid: request.institutionOwnerUid || "",
    targetEmail: request.institutionOwnerEmail || "",
    institutionDane: dane,
    title: action === "add-students" ? "Solicitud para agregar estudiantes" : "Solicitud para eliminar estudiante",
    body: `${request.requesterName || request.requesterEmail} solicita ${action === "add-students" ? "agregar estudiantes" : "eliminar un estudiante"} en ${request.className || "un aula"}.`,
    requestId: requestRef.id
  });
  await crearNotificacion({
    type: "institution-request-status",
    targetUid: usuarioActual.uid,
    targetEmail: usuarioActual.email || "",
    institutionDane: dane,
    title: "Solicitud enviada",
    body: "Tu solicitud quedó pendiente de aprobación por la institución.",
    requestId: requestRef.id
  });
  return requestRef.id;
}

async function agregarMiembrosInstitucion() {
  const status = document.getElementById("institutionMembersStatus");
  const raw = document.getElementById("institutionBulkMembers")?.value || "";
  const role = document.getElementById("institutionMemberRole")?.value || "student";
  const grade = document.getElementById("institutionMemberGrade")?.value || "";
  const classId = document.getElementById("institutionMemberClass")?.value || "";
  const dane = normalizarDane(perfilActual?.institutionDane);
  const members = [...new Map(parseInstitutionMemberLines(raw).map(item => [item.email, item])).values()];
  if (!classId || !adminClases.some(clase => clase.id === classId)) {
    if (status) {
      status.textContent = "Primero crea y selecciona el aula a la que se unirán.";
      status.className = "bank-status error";
    }
    return;
  }
  if (!dane || !members.length) {
    if (status) {
      status.textContent = "Agrega correos válidos y verifica la institución.";
      status.className = "bank-status error";
    }
    return;
  }
  if (status) {
    status.textContent = "Guardando integrantes...";
    status.className = "bank-status error";
  }
  const currentMembers = await miembrosInstitucionActual().catch(() => []);
  const capacity = validarCupoInstitucional(role, members, currentMembers);
  if (!capacity.ok) {
    if (status) {
      status.textContent = capacity.message;
      status.className = "bank-status error";
    }
    return;
  }
  const response = await authedFetch(APP_CONFIG.institutionMemberEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add",
      institutionDane: dane,
      role,
      grade,
      classId,
      members
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || "No fue posible guardar los integrantes.");
  document.getElementById("institutionBulkMembers").value = "";
  if (status) setStatusTemporal("institutionMembersStatus", result.message || `${members.length} integrante(s) agregado(s) a la institución.`, "success", 5000);
  await renderInstitutionPanel();
}

async function eliminarMiembroInstitucion(id) {
  const ref = doc(db, "institutionMembers", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const member = snap.data();
  if (!confirm(`Eliminar a ${member.name || member.email} de la institución.\n\nPerderá los beneficios institucionales y no podrá acceder como integrante de esta institución.`)) return;
  const response = await authedFetch(APP_CONFIG.institutionMemberEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "remove",
      institutionDane: normalizarDane(member.institutionDane || perfilActual?.institutionDane),
      memberId: id
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || "No fue posible eliminar el integrante.");
  await renderInstitutionPanel();
}

async function aprobarSolicitudInstitucional(id) {
  const ref = doc(db, "institutionRequests", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const request = snap.data();
  if (!confirm("¿Aprobar esta solicitud institucional?")) return;
  if (request.action === "add-students") {
    const classSnap = await getDoc(doc(db, "classes", request.classId));
    if (!classSnap.exists()) throw new Error("El aula solicitada ya no existe.");
    const clase = { id: classSnap.id, ...classSnap.data() };
    const students = Array.isArray(request.students) ? request.students : [];
    await Promise.all(students.map(student => crearInvitacionClase(clase, student)));
  } else if (request.action === "remove-student" && request.studentId) {
    await aplicarEliminacionEstudianteRegistrado(request.studentId);
  }
  await updateDoc(ref, {
    status: "approved",
    reviewedByUid: usuarioActual.uid,
    reviewedByEmail: usuarioActual.email || "",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await crearNotificacion({
    type: "institution-request-status",
    targetUid: request.requesterUid || "",
    targetEmail: request.requesterEmail || "",
    institutionDane: request.institutionDane || "",
    title: "Solicitud aprobada",
    body: `La institución aprobó tu solicitud sobre ${request.className || "el aula"}.`,
    requestId: id
  });
  await renderInstitutionPanel();
}

async function rechazarSolicitudInstitucional(id) {
  const ref = doc(db, "institutionRequests", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const request = snap.data();
  if (!confirm("¿Rechazar esta solicitud institucional?")) return;
  await updateDoc(ref, {
    status: "rejected",
    reviewedByUid: usuarioActual.uid,
    reviewedByEmail: usuarioActual.email || "",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await crearNotificacion({
    type: "institution-request-status",
    targetUid: request.requesterUid || "",
    targetEmail: request.requesterEmail || "",
    institutionDane: request.institutionDane || "",
    title: "Solicitud rechazada",
    body: `La institución rechazó tu solicitud sobre ${request.className || "el aula"}.`,
    requestId: id
  });
  await renderInstitutionPanel();
}

async function eliminarInstitucionCompleta(dane, password = "") {
  const normalized = normalizarDane(dane);
  if (!normalized) return;
  const institutionRef = doc(db, "institutions", normalized);
  const institutionSnap = await getDoc(institutionRef);
  const institutionName = institutionSnap.exists() ? institutionSnap.data().institutionName : normalized;
  const warning = `Eliminar institución: ${institutionName}\n\nEsta acción eliminará de la app el registro institucional, sus estudiantes, profesores, beneficios, permisos y datos asociados. No se podrá recuperar.\n\n¿Deseas continuar?`;
  if (!confirm(warning)) return;
  if (!esPropietarioPlataforma() && password) {
    const credential = EmailAuthProvider.credential(usuarioActual.email, password);
    await reauthenticateWithCredential(usuarioActual, credential);
  }
  const response = await authedFetch(APP_CONFIG.deepDeleteEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      institutionDane: normalized,
      deleteOwnInstitutionAccount: !esPropietarioPlataforma() && esInstitucion()
    })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo eliminar la institución desde el servidor.");
  }
  if (!esPropietarioPlataforma() && esInstitucion()) {
    await signOut(auth);
    location.reload();
  }
}

function perfilConAccesoInstitucionalActivo(data = {}) {
  return !!(
    data.subscriptionInherited === true &&
    data.institutionSubscriptionStatus === "active" &&
    data.institutionAccessRevoked !== true &&
    data.institutionAccessBlocked !== true &&
    data.institutionPremiumBlocked !== true &&
    data.subscriptionPremiumBlocked !== true &&
    data.institutionMemberStatus !== "removed" &&
    data.institutionMemberStatus !== "blocked"
  );
}

function perfilSuscritoParaMetricas(data = {}) {
  if (data.subscriptionStatus === "active") return true;
  return perfilConAccesoInstitucionalActivo(data);
}

function categoriaUsuarioMetricas(data = {}) {
  const role = data.role || data.tipoCuenta || "";
  const email = (data.email || data.correo || "").toLowerCase();
  if (email === ADMIN_EMAIL) return "owner";
  if (role === "institution") return "institutions";
  if (role === "teacher") return "teachers";
  if (role === "student") {
    const institutional = data.accountMode === "institutional" || !!data.institutionDane || data.subscriptionInherited === true;
    return institutional ? "institutionStudents" : "independentStudents";
  }
  return "other";
}

function crearMetricasVaciasApp() {
  return {
    total: { registered: 0, subscribed: 0 },
    institutions: { label: "Instituciones", registered: 0, subscribed: 0 },
    teachers: { label: "Docentes", registered: 0, subscribed: 0 },
    independentStudents: { label: "Estudiantes independientes", registered: 0, subscribed: 0 },
    institutionStudents: { label: "Estudiantes institucionales", registered: 0, subscribed: 0 },
    other: { label: "Otros usuarios", registered: 0, subscribed: 0 }
  };
}

async function renderOwnerAppMetrics(options = {}) {
  const summary = document.getElementById("ownerAppMetricsSummary");
  const breakdown = document.getElementById("ownerAppMetricsBreakdown");
  const status = document.getElementById("ownerAppMetricsStatus");
  const showStatus = !!options.showStatus;
  if (!summary || !breakdown || !esPropietarioPlataforma()) return;
  summary.innerHTML = `<article><strong>...</strong><span>Registrados</span></article><article><strong>...</strong><span>Suscritos</span></article>`;
  breakdown.innerHTML = "";
  if (status && showStatus) {
    status.textContent = "Cargando métricas privadas...";
    status.className = "bank-status error";
  } else if (status) {
    status.textContent = "";
    status.className = "bank-status";
  }
  try {
    const snap = await getDocs(collection(db, "users"));
    const metrics = crearMetricasVaciasApp();
    snap.forEach(item => {
      const data = item.data() || {};
      const category = categoriaUsuarioMetricas(data);
      if (category === "owner") return;
      const target = metrics[category] || metrics.other;
      target.registered += 1;
      metrics.total.registered += 1;
      if (perfilSuscritoParaMetricas(data)) {
        target.subscribed += 1;
        metrics.total.subscribed += 1;
      }
    });
    summary.innerHTML = `
      <article>
        <strong>${metrics.total.registered}</strong>
        <span>Registrados en la app</span>
      </article>
      <article>
        <strong>${metrics.total.subscribed}</strong>
        <span>Suscritos o con acceso activo</span>
      </article>
    `;
    const keys = ["institutions", "teachers", "independentStudents", "institutionStudents", "other"];
    breakdown.innerHTML = keys.map(key => {
      const item = metrics[key];
      const pct = item.registered ? Math.round((item.subscribed / item.registered) * 100) : 0;
      return `
        <article class="owner-metric-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${item.subscribed}/${item.registered}</strong>
          <small>${pct}% con acceso activo</small>
          <div class="owner-metric-bar"><i style="width:${pct}%"></i></div>
        </article>
      `;
    }).join("");
    if (status && showStatus) setStatusTemporal("ownerAppMetricsStatus", "Métricas actualizadas.", "ok", 5000);
  } catch (error) {
    console.warn("No fue posible cargar métricas del dueño", error);
    if (status && showStatus) {
      status.textContent = "No fue posible cargar las métricas.";
      status.className = "bank-status error";
    }
  }
}
async function renderOwnerInstitutions() {
  const cont = document.getElementById("ownerInstitutionsList");
  if (!cont || !esPropietarioPlataforma()) return;
  const snap = await getDocs(collection(db, "institutions")).catch(() => null);
  if (!snap || snap.empty) {
    cont.innerHTML = `<p class="mini-help">No hay instituciones registradas.</p>`;
    return;
  }
  cont.innerHTML = snap.docs.map(item => {
    const data = item.data();
    const blocked = data.subscriptionStatus === "blocked" || data.subscriptionPremiumBlocked === true;
    const status = blocked
      ? `<small class="danger-text">Premium bloqueado hasta nuevo pago o renovación.</small>`
      : `<small>${data.institutionDepartmentName || ""} ${data.institutionMunicipalityName || ""}</small>`;
    return `<article class="student-row owner-institution-row ${blocked ? "student-blocked" : ""}">
      <div><strong>${data.institutionName || item.id}</strong><span>DANE ${data.institutionDane || item.id}</span>${status}</div>
      <button class="btn ${blocked ? "btn-primary" : "btn-outline"}" type="button" data-owner-block-institution="${item.id}" ${blocked ? "disabled" : ""}>${blocked ? "Bloqueada" : "Bloquear institución"}</button>
      <button class="btn btn-outline danger" type="button" data-owner-delete-institution="${item.id}">Eliminar institución</button>
    </article>`;
  }).join("");
}

async function bloquearInstitucionPremium(dane) {
  const normalized = normalizarDane(dane);
  if (!normalized || !APP_CONFIG.blockInstitutionEndpoint) return;
  if (!confirm("¿Deseas bloquear el acceso premium de esta institución?\n\nLa institución seguirá registrada, pero perderá beneficios premium hasta que pague o renueve un plan.")) return;
  const response = await authedFetch(APP_CONFIG.blockInstitutionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ institutionDane: normalized })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No fue posible bloquear la institución.");
  mostrarOk(data.message || "Institución bloqueada hasta nuevo pago o renovación.");
}

function renderConfiguracion() {
  const active = suscripcionActiva();
  const institucion = esInstitucion();
  document.querySelector(".student-settings")?.classList.toggle("hidden", modoAdmin || institucion);
  document.getElementById("adminSettingsPanel")?.classList.toggle("hidden", !modoAdmin || institucion);
  document.getElementById("institutionSettingsPanel")?.classList.toggle("hidden", !institucion);
  document.getElementById("ownerSettingsPanel")?.classList.toggle("hidden", !esPropietarioPlataforma());
  actualizarEstadoNotificaciones();
  if (!active && (modoAdmin || institucion)) {
    exigirSuscripcion("La configuración administrativa se habilita al activar tu suscripción.");
    return;
  }
  if (institucion) renderInstitutionPanel();
  else if (modoAdmin) renderAdminPanel();
  else {
    document.getElementById("settingsBankPanel")?.classList.toggle("hidden", !active || !aulaActualValida());
    document.getElementById("settingsClassPanel")?.classList.add("hidden");
    const status = document.getElementById("settingsClassStatus");
    if (!active && status) {
      status.textContent = "Activa tu suscripción para ingresar o cambiar de aula.";
      status.className = "bank-status error";
    }
    document.getElementById("createPasswordSection")?.classList.toggle("hidden", tienePasswordActual());
    document.getElementById("updatePasswordSection")?.classList.toggle("hidden", !tienePasswordActual());
    if (active) actualizarBancoEstudiante();
  }
  if (esPropietarioPlataforma()) {
    renderOwnerInstitutions();
    renderOwnerAppMetrics();
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
  status.className = "bank-status";
  if (!supported) {
    status.className = "bank-status error";
    status.textContent = "Este navegador no permite notificaciones.";
  } else if (Notification.permission === "denied") {
    status.className = "bank-status error";
    status.textContent = "El permiso está bloqueado. Actívalo desde la configuración del navegador o dispositivo.";
  }
  else status.textContent = "";
}

async function cambiarNotificaciones(e) {
  if (!usuarioActual) return;
  const toggle = e.target;
  const quiereActivar = toggle.checked;
  const status = document.getElementById(toggle.id === "adminNotificationToggle" ? "adminNotificationStatus" : "studentNotificationStatus");
  if (!soporteNotificaciones()) {
    toggle.checked = false;
    if (status) setStatusTemporal(status.id, "Este navegador no permite notificaciones.", "error");
    return;
  }
  if (!quiereActivar) {
    await guardarPerfilUsuario({ notificationsEnabled: false, notificationPermission: Notification.permission });
    actualizarEstadoNotificaciones();
    setStatusTemporal(status?.id || notificationStatusId(), "Notificaciones desactivadas.", "info");
    return;
  }
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    toggle.checked = false;
    await guardarPerfilUsuario({ notificationsEnabled: false, notificationPermission: permission });
    actualizarEstadoNotificaciones();
    setStatusTemporal(
      status?.id || notificationStatusId(),
      permission === "denied"
        ? "El navegador bloqueó las notificaciones. Actívalas en permisos del sitio."
        : "No se activaron las notificaciones. Acepta el permiso del navegador para usarlas.",
      "error"
    );
    return;
  }
  await guardarPerfilUsuario({ notificationsEnabled: true, notificationPermission: permission });
  actualizarEstadoNotificaciones();
  setStatusTemporal(status?.id || notificationStatusId(), "Notificaciones activadas.", "success");
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
  if (!usuarioActual?.email || !suscripcionActiva()) return;
  detenerListenersComunicacion();
  const email = usuarioActual.email.toLowerCase();
  unsubscribeNotifications = onSnapshot(
    query(collection(db, "notifications"), where("targetEmail", "==", email), orderBy("createdAt", "desc"), limit(50)),
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
    ? query(collection(db, "classMessages"), where("ownerUid", "==", usuarioActual.uid), orderBy("createdAt", "desc"), limit(50))
    : query(collection(db, "classMessages"), where("toEmails", "array-contains", email), orderBy("createdAt", "desc"), limit(50));
  unsubscribeMessages = onSnapshot(messageQuery, snap => {
    internalMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderMessagesPanel();
  }, err => console.warn("No se pudieron escuchar mensajes.", err));
  const repliesQuery = modoAdmin
    ? query(collection(db, "messageReplies"), where("ownerUid", "==", usuarioActual.uid), orderBy("createdAt", "desc"), limit(100))
    : query(collection(db, "messageReplies"), where("fromEmail", "==", email), orderBy("createdAt", "desc"), limit(100));
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
    fromUid: usuarioActual?.uid || "",
    fromEmail: usuarioActual?.email || "",
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
  const historySelect = document.getElementById("messageHistoryClassSelect");
  const availableClasses = modoAdmin
    ? adminClases.map(classroom => ({ id: classroom.id, name: classroom.name }))
    : Array.from(new Map(internalMessages.map(message => [
        message.classId,
        { id: message.classId, name: message.className || "Aula" }
      ])).values()).filter(classroom => classroom.id);
  if (historySelect) {
    historySelect.innerHTML = availableClasses.length
      ? availableClasses.map(classroom => `<option value="${classroom.id}">${escapeHtml(classroom.name)}</option>`).join("")
      : `<option value="">Sin conversaciones</option>`;
    if (!availableClasses.some(classroom => classroom.id === messageHistoryClassId)) {
      messageHistoryClassId = modoAdmin
        ? (adminClaseActiva || availableClasses[0]?.id || "")
        : (claseActiva || availableClasses[0]?.id || "");
    }
    historySelect.value = messageHistoryClassId;
  }
  const visibleMessages = messageHistoryClassId
    ? internalMessages.filter(message => message.classId === messageHistoryClassId)
    : internalMessages;
  if (!visibleMessages.length) {
    list.innerHTML = `<p class="mini-help">Aún no hay mensajes.</p>`;
    return;
  }
  const className = visibleMessages[0]?.className || availableClasses.find(classroom => classroom.id === messageHistoryClassId)?.name || "Aula";
  list.innerHTML = `
    <details class="accordion-card message-class-history">
      <summary>${escapeHtml(className)} · ${visibleMessages.length} mensaje(s)</summary>
      <div class="message-class-thread-list">
        ${visibleMessages.map(msg => `
          <article class="message-thread-card">
            <div class="message-thread-content">
              ${renderMessageAvatar(msg)}
              <button type="button" data-open-message="${msg.id}">
                <strong>${escapeHtml(msg.subject || "Sin asunto")}</strong>
                <span>${escapeHtml(msg.className || "Aula")} · ${escapeHtml(msg.fromName || msg.teacherName || "Profesor")}</span>
                <small>${escapeHtml((msg.body || "").slice(0, 130))}</small>
              </button>
              </div>
          </article>
        `).join("")}
      </div>
    </details>`;
}

function datosAvatarMensaje(item = {}) {
  const name = item.fromName || item.teacherName || item.displayName || item.fromEmail || item.teacherEmail || item.email || "Usuario";
  const own = item.fromUid && item.fromUid === usuarioActual?.uid;
  const ownPhoto = own
    ? (perfilActual?.photoData || perfilActual?.photoURL || perfilActual?.googlePhotoURL || usuarioActual?.photoURL || "")
    : "";
  const ownFullPhoto = own
    ? (perfilActual?.photoFullURL || perfilActual?.googlePhotoURL || perfilActual?.photoURL || usuarioActual?.photoURL || perfilActual?.photoData || "")
    : "";
  const photo = item.fromPhoto || item.photoData || item.photoURL || ownPhoto || "";
  const fullPhoto = fotoPerfilAltaCalidad(item.fromFullPhoto || item.photoFullURL || item.googlePhotoURL || item.photoURL || item.fromPhoto || item.photoData || ownFullPhoto || ownPhoto || "");
  const initialSource = String(name || item.fromEmail || item.email || "U").trim();
  const initial = (initialSource[0] || "U").toUpperCase();
  return { name, photo, fullPhoto, initial };
}

function fotoPerfilAltaCalidad(src = "") {
  if (!src) return "";
  if (!/^https?:\/\/[^"\s]+googleusercontent\.com\//i.test(src)) return src;
  let enhanced = src.replace(/=s\d+(?:-c)?(?:-[a-z]+)?$/i, "=s1024-c");
  enhanced = enhanced.replace(/\/s\d+(?:-c)?\//i, "/s1024-c/");
  return enhanced;
}

function renderMessageAvatar(item = {}) {
  const avatar = datosAvatarMensaje(item);
  const label = `Ver foto de ${avatar.name}`;
  if (avatar.photo) {
    return `<button class="message-avatar" type="button" data-avatar-src="${escapeHtml(avatar.fullPhoto || avatar.photo)}" data-avatar-name="${escapeHtml(avatar.name)}" aria-label="${escapeHtml(label)}"><img src="${escapeHtml(avatar.photo)}" alt="" loading="lazy" /></button>`;
  }
  return `<span class="message-avatar message-avatar-initial" aria-label="${escapeHtml(avatar.name)}">${escapeHtml(avatar.initial)}</span>`;
}

async function cargarPerfilAvatar(uid = "") {
  if (!uid || uid === usuarioActual?.uid) return null;
  if (avatarProfileCache.has(uid)) return avatarProfileCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const profile = snap.exists() ? snap.data() : null;
    avatarProfileCache.set(uid, profile);
    return profile;
  } catch (err) {
    console.warn("No se pudo cargar avatar de usuario.", err);
    avatarProfileCache.set(uid, null);
    return null;
  }
}

async function hidratarAvataresMensaje(messageId) {
  if (!messageId || activeMessageId !== messageId) return;
  const items = [
    internalMessages.find(m => m.id === messageId),
    ...internalReplies.filter(r => r.messageId === messageId)
  ].filter(Boolean);
  let changed = false;
  for (const item of items) {
    if (datosAvatarMensaje(item).photo || !item.fromUid || item.fromUid === usuarioActual?.uid) continue;
    const profile = await cargarPerfilAvatar(item.fromUid);
    const photo = profile?.photoData || profile?.photoURL || profile?.googlePhotoURL || "";
    const fullPhoto = profile?.photoFullURL || profile?.googlePhotoURL || profile?.photoURL || profile?.photoData || "";
    if (photo) {
      item.fromPhoto = photo;
      item.fromFullPhoto = fotoPerfilAltaCalidad(fullPhoto);
      changed = true;
    }
  }
  if (changed && activeMessageId === messageId) renderMessageDetail(messageId, { skipHydrate: true });
}

function renderAttachments(attachments = []) {
  if (!attachments.length) return "";
  return `<div class="message-attachments">${attachments.map(a => {
    const name = escapeHtml(a.name || "Adjunto");
    const url = escapeHtml(a.url || "#");
    if (esImagenAdjunto(a)) {
      return `
        <a class="attachment-card attachment-image" href="${url}" target="_blank" rel="noopener" title="Abrir imagen">
          <img src="${url}" alt="${name}" loading="lazy" />
          <span>${name}</span>
        </a>`;
    }
    const icon = esPdfAdjunto(a) ? "PDF" : esWordAdjunto(a) ? "DOC" : "ARCH";
    return `<a class="attachment-card attachment-file" href="${url}" target="_blank" rel="noopener"><strong>${icon}</strong><span>${name}</span></a>`;
  }).join("")}</div>`;
}

function extensionArchivo(nombre = "") {
  return String(nombre || "").split(".").pop()?.toLowerCase() || "";
}

function esImagenAdjunto(file = {}) {
  const type = String(file.type || "").toLowerCase();
  const ext = extensionArchivo(file.name);
  return type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
}

function esPdfAdjunto(file = {}) {
  return String(file.type || "").toLowerCase() === "application/pdf" || extensionArchivo(file.name) === "pdf";
}

function esWordAdjunto(file = {}) {
  const ext = extensionArchivo(file.name);
  const type = String(file.type || "").toLowerCase();
  return ["doc", "docx"].includes(ext) || type.includes("wordprocessingml") || type.includes("msword");
}

function formatoBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function limpiarPreviewAdjuntos(containerId) {
  (attachmentPreviewUrls.get(containerId) || []).forEach(url => URL.revokeObjectURL(url));
  attachmentPreviewUrls.set(containerId, []);
  const cont = document.getElementById(containerId);
  if (cont) cont.innerHTML = "";
}

function accionEliminarAdjunto(inputId, containerId, index, label) {
  return `<button class="attachment-remove-btn" type="button" data-remove-attachment="${index}" data-input-id="${inputId}" data-preview-id="${containerId}">${label}</button>`;
}

function quitarAdjuntoSeleccionado(inputId, containerId, index) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const dt = new DataTransfer();
  [...(input.files || [])].forEach((file, idx) => {
    if (idx !== Number(index)) dt.items.add(file);
  });
  input.files = dt.files;
  renderPreviewAdjuntos(inputId, containerId);
}

function renderPreviewAdjuntos(inputId, containerId) {
  const input = document.getElementById(inputId);
  const cont = document.getElementById(containerId);
  if (!input || !cont) return;
  limpiarPreviewAdjuntos(containerId);
  const files = [...(input.files || [])];
  if (!files.length) return;
  const urls = [];
  cont.innerHTML = files.map((file, index) => {
    const url = URL.createObjectURL(file);
    urls.push(url);
    const name = escapeHtml(file.name);
    const size = formatoBytes(file.size);
    if (esImagenAdjunto(file)) {
      return `
        <article class="attachment-preview-card">
          <a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${name}" /></a>
          <strong>${name}</strong>
          <span>${size}</span>
          <div class="attachment-preview-actions">
            <a href="${url}" target="_blank" rel="noopener">Abrir imagen</a>
            ${accionEliminarAdjunto(inputId, containerId, index, "Eliminar imagen")}
          </div>
        </article>`;
    }
    if (esPdfAdjunto(file)) {
      return `
        <article class="attachment-preview-card attachment-preview-pdf">
          <iframe src="${url}" title="${name}"></iframe>
          <strong>${name}</strong>
          <div class="attachment-preview-actions">
            <a href="${url}" target="_blank" rel="noopener">Abrir PDF</a>
            ${accionEliminarAdjunto(inputId, containerId, index, "Eliminar PDF")}
          </div>
        </article>`;
    }
    return `
      <article class="attachment-preview-card attachment-preview-file">
        <div class="file-badge">${esWordAdjunto(file) ? "DOC" : "ARCH"}</div>
        <strong>${name}</strong>
        <span>${size}</span>
        <div class="attachment-preview-actions">
          <a href="${url}" target="_blank" rel="noopener">Abrir archivo</a>
          ${accionEliminarAdjunto(inputId, containerId, index, "Eliminar archivo")}
        </div>
      </article>`;
  }).join("");
  attachmentPreviewUrls.set(containerId, urls);
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
  document.querySelectorAll("[data-rich-select]").forEach(select => {
    select.value = "";
  });
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

function colocarCursorSiEditorVacio(editor = richEditor()) {
  if (!editor || richMessageHasContent()) return;
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(editor, 0);
  range.collapse(true);
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
    const snap = await getDocs(query(collection(db, "messageReplies"), where("messageId", "==", messageId), orderBy("createdAt", "asc"), limit(100)));
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

function renderMessageDetail(messageId, options = {}) {
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
    <div class="message-detail-author">
      ${renderMessageAvatar(msg)}
      <div>
        <strong>${escapeHtml(msg.fromName || msg.teacherName || "Profesor")}</strong>
        <p class="mini-help">${escapeHtml(msg.className || "Aula")}</p>
      </div>
    </div>
    <div class="message-body rich-message-output">${renderRichMessage(msg.bodyHtml, msg.body || "")}</div>
    ${renderAttachments(msg.attachments)}
    <h3>Respuestas</h3>
    <div class="message-replies">
      ${replies.length ? replies.map(reply => `
        <article class="${reply.fromUid === usuarioActual?.uid ? "own" : ""}">
          <div class="message-reply-author">
            ${renderMessageAvatar(reply)}
            <strong>${escapeHtml(reply.fromName || reply.fromEmail || "Usuario")}</strong>
          </div>
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
  if (!options.skipHydrate) hidratarAvataresMensaje(messageId);
}

async function abrirDetalleMensaje(messageId) {
  activeMessageId = messageId;
  await cargarRespuestasDelMensaje(messageId);
  renderMessageDetail(messageId);
}

async function enviarMensajeAula() {
  const status = document.getElementById("messageComposeStatus");
  if (!exigirSuscripcion("Activa tu suscripción para enviar mensajes al aula.")) return;
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
    const teacherPhoto = perfilActual?.photoData || perfilActual?.photoURL || perfilActual?.googlePhotoURL || usuarioActual?.photoURL || "";
    const teacherFullPhoto = fotoPerfilAltaCalidad(perfilActual?.photoFullURL || perfilActual?.googlePhotoURL || perfilActual?.photoURL || usuarioActual?.photoURL || perfilActual?.photoData || "");
    await setDoc(ref, {
      classId,
      className: clase.name,
      ownerUid: usuarioActual.uid,
      teacherEmail: usuarioActual.email,
      fromUid: usuarioActual.uid,
      fromEmail: usuarioActual.email,
      fromName: teacherName,
      fromPhoto: teacherPhoto,
      fromFullPhoto: teacherFullPhoto,
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
    limpiarPreviewAdjuntos("messageAttachmentPreview");
    if (status) status.textContent = `Mensaje enviado a ${students.length} estudiante(s).`;
  } catch (err) {
    console.error(err);
    if (status) status.textContent = err.message || "No se pudo enviar el mensaje.";
  }
}

async function responderMensaje(e) {
  e.preventDefault();
  if (!exigirSuscripcion("Activa tu suscripción para responder mensajes.")) return;
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
    const fromPhoto = perfilActual?.photoData || perfilActual?.photoURL || perfilActual?.googlePhotoURL || usuarioActual?.photoURL || "";
    const fromFullPhoto = fotoPerfilAltaCalidad(perfilActual?.photoFullURL || perfilActual?.googlePhotoURL || perfilActual?.photoURL || usuarioActual?.photoURL || perfilActual?.photoData || "");
    await setDoc(ref, {
      messageId: msg.id,
      classId: msg.classId,
      ownerUid: msg.ownerUid,
      fromUid: usuarioActual.uid,
      fromEmail: usuarioActual.email,
      fromName,
      fromPhoto,
      fromFullPhoto,
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
    limpiarPreviewAdjuntos("messageReplyAttachmentPreview");
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

function abrirEditorEcuacion(target = "message") {
  equationInsertTarget = target;
  const targetInput = target === "teacher-question"
    ? document.getElementById("teacherQuestionLatex")
    : target === "teacher-explanation"
      ? document.getElementById("teacherExplanationLatex")
      : null;
  const equationInput = document.getElementById("equationInput");
  if (targetInput && equationInput) equationInput.value = targetInput.value || "";
  else if (target.startsWith("inline-field:") && equationInput) equationInput.value = "";
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
  if (equationInsertTarget === "teacher-question" || equationInsertTarget === "teacher-explanation") {
    const targetId = equationInsertTarget === "teacher-question"
      ? "teacherQuestionLatex"
      : "teacherExplanationLatex";
    const previewId = equationInsertTarget === "teacher-question"
      ? "teacherQuestionEquationPreview"
      : "teacherExplanationEquationPreview";
    const target = document.getElementById(targetId);
    if (target) target.value = latex;
    renderQuestionLatexPreview(targetId, previewId);
    document.getElementById("equationOverlay")?.classList.add("hidden");
    equationInsertTarget = "message";
    target?.focus();
    return;
  }
  if (equationInsertTarget.startsWith("inline-field:")) {
    const fieldId = equationInsertTarget.slice("inline-field:".length);
    const field = document.getElementById(fieldId);
    const wrapped = displayMode ? `\\[${latex}\\]` : `\\(${latex}\\)`;
    insertIntoTextField(field, wrapped);
    renderTeacherInlinePreview(fieldId);
    document.getElementById("equationOverlay")?.classList.add("hidden");
    equationInsertTarget = "message";
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
  const nombres = tienePruebaDiagnosticoGratis()
    ? { diagnostico: "Diagnóstico" }
    : { diagnostico: "Diagnóstico", nivel1: "Nivel Medio", examen: "Examen Final" };
  cont.innerHTML = "";
  if (tienePruebaDiagnosticoGratis()) {
    cont.innerHTML = `<div class="stats-card"><h3>Prueba gratuita</h3><p>En el plan gratis puedes consultar únicamente las métricas del examen diagnóstico. Activa Premium para comparar nivel medio, examen final, mensajes y todos los beneficios.</p></div>`;
  }
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
document.getElementById("btnIniciarDiag").addEventListener("click", async () => {
  if (!puedeIniciarIntento("diagnostico")) {
    alert("Ya usaste los 2 intentos permitidos para el diagnóstico.");
    return;
  }
  if (!(await validarDisponibilidadExamen("diagnostico"))) return;
  await prepararPreguntasActivas("diagnostico");
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
    "id": 1,
    "pregunta": "Si \\(\\log_2 x + \\log_2(x-2) = 3\\), el valor de \\(x\\) es:",
    "formula": "",
    "opciones": [
      "\\(x = 4\\)",
      "\\(x = -2\\)",
      "\\(x = 2\\)",
      "\\(x = 8\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-1"
  },
  {
    "id": 2,
    "pregunta": "Si \\(m^{m^2} = 2\\), entonces ¿cuánto vale \\((m+3)(m-3)\\)?",
    "formula": "",
    "opciones": [
      "\\(1\\)",
      "\\(-7\\)",
      "\\(4\\)",
      "\\(-5\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-2"
  },
  {
    "id": 3,
    "pregunta": "¿Cuál es el conjunto solución de la inecuación?",
    "formula": "\\[ \\frac{x^2 - 5x + 6}{x - 1} < 0 \\]",
    "opciones": [
      "\\((-\\infty,1)\\cup(2,3)\\)",
      "\\((1,2)\\cup(3,\\infty)\\)",
      "\\((-\\infty,1)\\cup(3,\\infty)\\)",
      "\\((1,2)\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-3"
  },
  {
    "id": 4,
    "pregunta": "Si \\(f(x) = x^2 - 1\\) y \\(g(x) = \\sqrt{x+1}\\), entonces \\((g \\circ f)(3)\\) vale:",
    "formula": "",
    "opciones": [
      "\\(2\\sqrt{2}\\)",
      "\\(3\\)",
      "\\(\\sqrt{10}\\)",
      "\\(2\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-4"
  },
  {
    "id": 5,
    "pregunta": "Si \\(\\sin\\theta=\\frac{3}{5}\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\tan\\theta\\) vale:",
    "formula": "",
    "opciones": [
      "\\(\\dfrac{3}{4}\\)",
      "\\(\\dfrac{4}{3}\\)",
      "\\(\\dfrac{3}{5}\\)",
      "\\(\\dfrac{5}{4}\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-5"
  },
  {
    "id": 6,
    "pregunta": "Si \\(3^w + 9^w = 90\\), entonces \\(w\\) vale:",
    "formula": "",
    "opciones": [
      "\\(2\\)",
      "\\(7\\)",
      "\\(1\\)",
      "\\(0\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-6"
  },
  {
    "id": 7,
    "pregunta": "La ecuación \\(2\\sin^2\\theta - \\sin\\theta - 1 = 0\\) en \\([0°, 360°)\\) tiene soluciones:",
    "formula": "",
    "opciones": [
      "\\(90°\\) y \\(210°\\)",
      "\\(90°, 210°\\) y \\(330°\\)",
      "\\(270°, 210°\\) y \\(330°\\)",
      "\\(270°\\) y \\(30°\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-7"
  },
  {
    "id": 8,
    "pregunta": "Si las raíces de \\(x^2 + px + q = 0\\) son \\(r\\) y \\(s\\), entonces \\(r^2 + s^2\\) equivale a:",
    "formula": "",
    "opciones": [
      "\\(p^2 - 2q\\)",
      "\\(p^2 + 2q\\)",
      "\\(p^2 - q\\)",
      "\\((p-q)^2\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-8"
  },
  {
    "id": 9,
    "pregunta": "Calcular \\(E=\\log(1000!)-\\log(999!)\\):",
    "formula": "",
    "opciones": [
      "\\(1\\)",
      "\\(2\\)",
      "\\(0\\)",
      "\\(3\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-9"
  },
  {
    "id": 10,
    "pregunta": "En un triángulo con lados \\(a=7\\), \\(b=8\\) y \\(c=9\\), el coseno del ángulo \\(C\\) (opuesto al lado \\(c\\)) es:",
    "formula": "",
    "opciones": [
      "\\(\\dfrac{1}{7}\\)",
      "\\(\\dfrac{11}{56}\\)",
      "\\(\\dfrac{2}{7}\\)",
      "\\(-\\dfrac{1}{14}\\)"
    ],
    "correcta": -1,
    "explicacion": "",
    "_questionSource": "base",
    "_questionId": "base-10"
  }
];

/* ════════════════════════════════════════════════════════
   12. NIVELES – DATOS (5 niveles, 10 preguntas cada uno)
════════════════════════════════════════════════════════ */
const NIVELES_META = {
  nivel1: { titulo: "Nivel Medio", descripcion: "Práctica intermedia con preguntas asignadas por aula.", requisito: "diagnostico", requisitoTexto: "Completa primero el diagnóstico." }
};

const PREGUNTAS_NIVELES = {
  "nivel1": [
    {
      "id": 1,
      "pregunta": "Si \\(f(x)=3x-5\\), entonces el valor de \\(x\\) para el cual \\(f(x)=16\\) es:",
      "formula": "",
      "opciones": [
        "\\(5\\)",
        "\\(6\\)",
        "\\(7\\)",
        "\\(8\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-1"
    },
    {
      "id": 2,
      "pregunta": "La suma de los primeros \\(n\\) números impares positivos es 361. Entonces \\(n\\) vale:",
      "formula": "",
      "opciones": [
        "\\(17\\)",
        "\\(18\\)",
        "\\(19\\)",
        "\\(20\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-2"
    },
    {
      "id": 3,
      "pregunta": "Si \\(x+\\frac1x=5\\), calcula",
      "formula": "\\[x^2+\\frac1{x^2}\\]",
      "opciones": [
        "\\(21\\)",
        "\\(23\\)",
        "\\(25\\)",
        "\\(27\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-3"
    },
    {
      "id": 4,
      "pregunta": "En un triángulo rectángulo, los catetos miden 9 y 12. El radio de la circunferencia inscrita es:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(6\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-4"
    },
    {
      "id": 5,
      "pregunta": "Si \\(a\\) y \\(b\\) son positivos, \\(a+b=12\\) y \\(ab=27\\), entonces \\(a^2+b^2\\) es:",
      "formula": "",
      "opciones": [
        "\\(72\\)",
        "\\(84\\)",
        "\\(90\\)",
        "\\(108\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-5"
    },
    {
      "id": 6,
      "pregunta": "Si \\(\\cos\\theta=\\frac{4}{5}\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\sin\\theta\\) vale:",
      "formula": "",
      "opciones": [
        "\\(\\frac15\\)",
        "\\(\\frac35\\)",
        "\\(\\frac45\\)",
        "\\(\\frac53\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-6"
    },
    {
      "id": 7,
      "pregunta": "Si \\(f(x)=x^2-3x+1\\), entonces \\(f(3-t)-f(t)\\) vale:",
      "formula": "",
      "opciones": [
        "\\(0\\)",
        "\\(3\\)",
        "\\(6t-9\\)",
        "\\(9-6t\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-7"
    },
    {
      "id": 8,
      "pregunta": "El menor entero positivo \\(n\\) tal que \\(12n\\) es un cuadrado perfecto es:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(6\\)",
        "\\(12\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-8"
    },
    {
      "id": 9,
      "pregunta": "Si \\(2^a=8\\) y \\(3^b=81\\), entonces \\(a+b\\) es:",
      "formula": "",
      "opciones": [
        "\\(6\\)",
        "\\(7\\)",
        "\\(8\\)",
        "\\(9\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-9"
    },
    {
      "id": 10,
      "pregunta": "Tres números enteros consecutivos tienen suma 84. El producto del menor y el mayor es:",
      "formula": "",
      "opciones": [
        "\\(783\\)",
        "\\(784\\)",
        "\\(785\\)",
        "\\(786\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-10"
    }
  ],
  "nivel2": [
    {
      "id": 1,
      "pregunta": "Resuelve",
      "formula": "\\[x^2-6x+5<0\\]",
      "opciones": [
        "\\((1,5)\\)",
        "\\((-\\infty,1)\\cup(5,\\infty)\\)",
        "\\([1,5]\\)",
        "\\((5,\\infty)\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-1"
    },
    {
      "id": 2,
      "pregunta": "Si \\(\\frac{x-1}{x+1}=\\frac23\\), entonces \\(x\\) vale:",
      "formula": "",
      "opciones": [
        "\\(3\\)",
        "\\(4\\)",
        "\\(5\\)",
        "\\(6\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-2"
    },
    {
      "id": 3,
      "pregunta": "La parábola \\(y=x^2-6x+11\\) tiene vértice en:",
      "formula": "",
      "opciones": [
        "\\((3,2)\\)",
        "\\((3,-2)\\)",
        "\\((-3,2)\\)",
        "\\((6,11)\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-3"
    },
    {
      "id": 4,
      "pregunta": "Si \\(x^2+y^2=34\\) y \\(xy=15\\), entonces \\((x+y)^2\\) es:",
      "formula": "",
      "opciones": [
        "\\(49\\)",
        "\\(54\\)",
        "\\(64\\)",
        "\\(68\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-4"
    },
    {
      "id": 5,
      "pregunta": "Si \\(g(x)=-2x+9\\), entonces el punto donde la gráfica corta al eje \\(x\\) es:",
      "formula": "",
      "opciones": [
        "\\((0,9)\\)",
        "\\((\\frac92,0)\\)",
        "\\((2,5)\\)",
        "\\((9,0)\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-5"
    },
    {
      "id": 6,
      "pregunta": "Si \\(a\\neq0\\) y \\(a+\\frac1a=3\\), entonces \\(a^3+\\frac1{a^3}\\) vale:",
      "formula": "",
      "opciones": [
        "\\(9\\)",
        "\\(12\\)",
        "\\(18\\)",
        "\\(27\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-6"
    },
    {
      "id": 7,
      "pregunta": "¿Cuántos divisores positivos tiene \\(360\\)?",
      "formula": "",
      "opciones": [
        "\\(18\\)",
        "\\(20\\)",
        "\\(24\\)",
        "\\(30\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-7"
    },
    {
      "id": 8,
      "pregunta": "Si \\(f(x)=\\frac{2x-1}{x+3}\\), entonces \\(f^{-1}(1)\\) vale:",
      "formula": "",
      "opciones": [
        "\\(-4\\)",
        "\\(-2\\)",
        "\\(2\\)",
        "\\(4\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-8"
    },
    {
      "id": 9,
      "pregunta": "La suma de las raíces de \\(2x^2-7x+3=0\\) es:",
      "formula": "",
      "opciones": [
        "\\(\\frac32\\)",
        "\\(\\frac72\\)",
        "\\(\\frac73\\)",
        "\\(7\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-9"
    },
    {
      "id": 10,
      "pregunta": "Si \\(x,y\\) son enteros positivos y \\(xy=36\\), ¿cuántos pares ordenados \\((x,y)\\) existen?",
      "formula": "",
      "opciones": [
        "\\(6\\)",
        "\\(8\\)",
        "\\(9\\)",
        "\\(12\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-10"
    }
  ],
  "nivel3": [
    {
      "id": 1,
      "pregunta": "El conjunto solución de",
      "formula": "\\[\\frac{x-4}{x+2}\\geq 0\\]",
      "opciones": [
        "\\((-\\infty,-2)\\cup[4,\\infty)\\)",
        "\\((-2,4]\\)",
        "\\((-\\infty,-2]\\cup[4,\\infty)\\)",
        "\\([4,\\infty)\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-1"
    },
    {
      "id": 2,
      "pregunta": "Si \\(\\log_2 x+\\log_2(x-2)=3\\), entonces \\(x\\) es:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(6\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-2"
    },
    {
      "id": 3,
      "pregunta": "Si \\(\\sin\\theta+\\cos\\theta=\\frac75\\), entonces \\(\\sin\\theta\\cos\\theta\\) vale:",
      "formula": "",
      "opciones": [
        "\\(\\frac{6}{25}\\)",
        "\\(\\frac{12}{25}\\)",
        "\\(\\frac{24}{25}\\)",
        "\\(\\frac15\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-3"
    },
    {
      "id": 4,
      "pregunta": "El valor de",
      "formula": "\\[\\sqrt{20+8\\sqrt6}\\]",
      "opciones": [
        "\\(2+2\\sqrt6\\)",
        "\\(2\\sqrt2+2\\sqrt3\\)",
        "\\(4+\\sqrt6\\)",
        "\\(\\sqrt2+3\\sqrt3\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-4"
    },
    {
      "id": 5,
      "pregunta": "¿Cuántas formas hay de escoger 2 estudiantes de un grupo de 7?",
      "formula": "",
      "opciones": [
        "\\(14\\)",
        "\\(21\\)",
        "\\(28\\)",
        "\\(42\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-5"
    },
    {
      "id": 6,
      "pregunta": "Si \\(2^x+2^{x+1}+2^{x+2}=56\\), entonces \\(x\\) vale:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(5\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-6"
    },
    {
      "id": 7,
      "pregunta": "La recta que pasa por \\((1,5)\\) y es perpendicular a \\(2x-3y=6\\) tiene pendiente:",
      "formula": "",
      "opciones": [
        "\\(-\\frac32\\)",
        "\\(-\\frac23\\)",
        "\\(\\frac23\\)",
        "\\(\\frac32\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-7"
    },
    {
      "id": 8,
      "pregunta": "Si \\(x^2-4x+y^2+6y=12\\), el radio de la circunferencia es:",
      "formula": "",
      "opciones": [
        "\\(4\\)",
        "\\(5\\)",
        "\\(6\\)",
        "\\(7\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-8"
    },
    {
      "id": 9,
      "pregunta": "La suma de los coeficientes de \\((2x-1)^5\\) es:",
      "formula": "",
      "opciones": [
        "\\(-1\\)",
        "\\(0\\)",
        "\\(1\\)",
        "\\(32\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-9"
    },
    {
      "id": 10,
      "pregunta": "Si \\(a,b,c\\) son raíces de \\(x^3-6x^2+11x-6=0\\), entonces \\(ab+ac+bc\\) es:",
      "formula": "",
      "opciones": [
        "\\(6\\)",
        "\\(11\\)",
        "\\(17\\)",
        "\\(36\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-10"
    }
  ],
  "nivel4": [
    {
      "id": 1,
      "pregunta": "Si \\(x^4-1=0\\), ¿cuántas soluciones reales tiene la ecuación?",
      "formula": "",
      "opciones": [
        "\\(0\\)",
        "\\(1\\)",
        "\\(2\\)",
        "\\(4\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-1"
    },
    {
      "id": 2,
      "pregunta": "Si \\(f(x)=\\frac{x+1}{x-1}\\), entonces \\(f(f(2))\\) es:",
      "formula": "",
      "opciones": [
        "\\(-2\\)",
        "\\(-1\\)",
        "\\(0\\)",
        "\\(2\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-2"
    },
    {
      "id": 3,
      "pregunta": "El coeficiente de \\(x^3\\) en \\((x-2)^6\\) es:",
      "formula": "",
      "opciones": [
        "\\(-160\\)",
        "\\(-120\\)",
        "\\(120\\)",
        "\\(160\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-3"
    },
    {
      "id": 4,
      "pregunta": "La suma",
      "formula": "\\[1\\cdot2+2\\cdot3+\\cdots+10\\cdot11\\]",
      "opciones": [
        "\\(430\\)",
        "\\(440\\)",
        "\\(450\\)",
        "\\(460\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-4"
    },
    {
      "id": 5,
      "pregunta": "Si \\(z\\) satisface \\(z^2+z+1=0\\), entonces \\(z^{2026}\\) es:",
      "formula": "",
      "opciones": [
        "\\(1\\)",
        "\\(z\\)",
        "\\(z^2\\)",
        "\\(-1\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-5"
    },
    {
      "id": 6,
      "pregunta": "¿Cuántos caminos mínimos hay de \\((0,0)\\) a \\((4,3)\\) moviéndose solo derecha o arriba?",
      "formula": "",
      "opciones": [
        "\\(21\\)",
        "\\(28\\)",
        "\\(35\\)",
        "\\(42\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-6"
    },
    {
      "id": 7,
      "pregunta": "Si \\(\\log_3(x+6)-\\log_3 x=1\\), entonces \\(x\\) vale:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(6\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-7"
    },
    {
      "id": 8,
      "pregunta": "Si \\(\\tan\\theta+\\cot\\theta=\\frac{13}{6}\\), entonces \\(\\tan^2\\theta+\\cot^2\\theta\\) vale:",
      "formula": "",
      "opciones": [
        "\\(\\frac{25}{36}\\)",
        "\\(\\frac{97}{36}\\)",
        "\\(\\frac{133}{36}\\)",
        "\\(\\frac{169}{36}\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-8"
    },
    {
      "id": 9,
      "pregunta": "En un cuadrado de lado 10 se inscribe un círculo. El área de la región del cuadrado que queda fuera del círculo es:",
      "formula": "",
      "opciones": [
        "\\(100-25\\pi\\)",
        "\\(100-50\\pi\\)",
        "\\(25\\pi\\)",
        "\\(75\\pi\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-9"
    },
    {
      "id": 10,
      "pregunta": "Si \\(r+s=4\\) y \\(r^3+s^3=28\\), entonces \\(rs\\) vale:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(5\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-10"
    }
  ],
  "nivel5": [
    {
      "id": 1,
      "pregunta": "Si \\(x,y>0\\) y \\(x+y=1\\), el mínimo de",
      "formula": "\\[\\frac1x+\\frac1y\\]",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(5\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-1"
    },
    {
      "id": 2,
      "pregunta": "Si \\(\\tan\\theta=\\frac{3}{4}\\) y \\(\\theta\\) está en el primer cuadrante, entonces \\(\\sin\\theta+\\cos\\theta\\) vale:",
      "formula": "",
      "opciones": [
        "\\(\\frac75\\)",
        "\\(\\frac65\\)",
        "\\(\\frac54\\)",
        "\\(\\frac43\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-2"
    },
    {
      "id": 3,
      "pregunta": "Si \\(a,b,c\\) son positivos y \\(abc=1\\), entonces el mínimo de \\(a+b+c\\) es:",
      "formula": "",
      "opciones": [
        "\\(1\\)",
        "\\(2\\)",
        "\\(3\\)",
        "No tiene mínimo"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-3"
    },
    {
      "id": 4,
      "pregunta": "La suma de todos los enteros \\(n\\) tales que \\(n^2-10n+21<0\\) es:",
      "formula": "",
      "opciones": [
        "\\(12\\)",
        "\\(15\\)",
        "\\(18\\)",
        "\\(25\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-4"
    },
    {
      "id": 5,
      "pregunta": "Si \\(2^{x+1}+2^x=48\\), entonces \\(x\\) vale:",
      "formula": "",
      "opciones": [
        "\\(3\\)",
        "\\(4\\)",
        "\\(5\\)",
        "\\(6\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-5"
    },
    {
      "id": 6,
      "pregunta": "Si \\(\\sin\\theta=\\frac{5}{13}\\) y \\(\\theta\\) está en el segundo cuadrante, entonces \\(\\cos\\theta\\) vale:",
      "formula": "",
      "opciones": [
        "\\(\\frac{12}{13}\\)",
        "\\(-\\frac{12}{13}\\)",
        "\\(\\frac{5}{12}\\)",
        "\\(-\\frac{5}{12}\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-6"
    },
    {
      "id": 7,
      "pregunta": "¿Cuántos subconjuntos de \\(\\{1,2,3,4,5,6\\}\\) tienen suma par?",
      "formula": "",
      "opciones": [
        "\\(16\\)",
        "\\(24\\)",
        "\\(32\\)",
        "\\(36\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-7"
    },
    {
      "id": 8,
      "pregunta": "Si \\(x^2-3x+1=0\\), entonces \\(x^4+\\frac1{x^4}\\) vale:",
      "formula": "",
      "opciones": [
        "\\(47\\)",
        "\\(49\\)",
        "\\(51\\)",
        "\\(53\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-8"
    },
    {
      "id": 9,
      "pregunta": "Si \\(\\log_2(x-1)+\\log_2(x+1)=3\\), entonces \\(x\\) vale:",
      "formula": "",
      "opciones": [
        "\\(2\\)",
        "\\(3\\)",
        "\\(4\\)",
        "\\(5\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-9"
    },
    {
      "id": 10,
      "pregunta": "Si \\(\\alpha\\) y \\(\\beta\\) son raíces de \\(x^2-x-1=0\\), entonces \\(\\alpha^5+\\beta^5\\) vale:",
      "formula": "",
      "opciones": [
        "\\(5\\)",
        "\\(7\\)",
        "\\(11\\)",
        "\\(13\\)"
      ],
      "correcta": -1,
      "explicacion": "",
      "_questionSource": "base",
      "_questionId": "base-10"
    }
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
const DEFAULT_EXAM_SETTINGS = {
  diagnostico: { startAt: "", endAt: "", feedbackPublished: false },
  nivel1: { startAt: "", endAt: "", feedbackPublished: false },
  examen: { startAt: "", endAt: "", feedbackPublished: false }
};
let permisosGrupo = cargarPermisosGrupo();
let bancosGrupo = cargarBancosGrupo();
let examSettingsGrupo = {};
let examAccessStateCache = {};
let grupoActivo = localStorage.getItem(STORAGE_GRUPO) || "";
let modoAdmin = grupoActivo === "admin";
let adminGrupoActual = adminClaseActiva || "";
let nivelActual = "nivel1";
let nivelIniciado = false;
let nivelCompletadoVisible = false;
let timerNivelInterval = null;
let timerNivelActivo = false;
let segsNivel = duracionExamenSeg("nivel1");

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

function normalizarExamSettings(settings = {}) {
  const normalizados = {};
  Object.keys(DEFAULT_EXAM_SETTINGS).forEach(clave => {
    normalizados[clave] = { ...DEFAULT_EXAM_SETTINGS[clave], ...(settings?.[clave] || {}) };
  });
  return normalizados;
}

async function postBackendAutenticado(endpoint, payload = {}) {
  if (!usuarioActual) throw new Error("Debes iniciar sesión.");
  const response = await authedFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No fue posible completar la solicitud.");
  return data;
}

function nombreExamen(clave) {
  if (clave === "diagnostico") return "Diagnóstico";
  if (clave === "nivel1") return "Nivel Medio";
  if (clave === "examen") return "Examen Final";
  return "Examen";
}

function estadoExamenTexto(status = "") {
  if (status === "scheduled") return "Programado";
  if (status === "closed") return "Finalizado";
  if (status === "available") return "Disponible";
  return "Sin programación";
}

function normalizarTextoZona(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function timezoneConfigUsuario(perfil = perfilActual, fallback = {}) {
  const candidates = [
    perfil?.timeZone,
    fallback.timeZone,
    perfil?.countryCode,
    perfil?.countryId,
    perfil?.countryIso2,
    perfil?.countryName,
    perfil?.country,
    perfil?.pais,
    perfil?.institutionCountryCode,
    perfil?.institutionCountryId,
    perfil?.institutionCountryName,
    fallback.countryCode,
    fallback.countryId,
    fallback.countryName,
    fallback.country
  ].filter(Boolean);

  const explicitTimeZone = candidates.find(value => String(value).includes("/") && /^[A-Za-z_/-]+$/.test(String(value)));
  if (explicitTimeZone) {
    const known = Object.values(TIMEZONE_BY_COUNTRY).find(item => item.timeZone === explicitTimeZone);
    return known || {
      countryCode: "",
      countryNames: [],
      label: String(explicitTimeZone).replace(/_/g, " "),
      timeZone: String(explicitTimeZone),
      offsetMinutes: -300
    };
  }

  for (const raw of candidates) {
    const value = String(raw || "").trim();
    const upper = value.toUpperCase();
    if (TIMEZONE_BY_COUNTRY[upper]) return TIMEZONE_BY_COUNTRY[upper];
    const normalized = normalizarTextoZona(value);
    const match = Object.values(TIMEZONE_BY_COUNTRY).find(item =>
      item.countryNames.some(name => normalized === name || normalized.includes(name))
    );
    if (match) return match;
  }
  return TIMEZONE_BY_COUNTRY.CO;
}

function timezoneUsuario(perfil = perfilActual, fallback = {}) {
  return timezoneConfigUsuario(perfil, fallback).timeZone;
}

function timezoneUsuarioPayload(perfil = perfilActual) {
  const config = timezoneConfigUsuario(perfil);
  return {
    timeZone: config.timeZone,
    countryCode: config.countryCode,
    countryName: config.label
  };
}

function etiquetaZonaUsuario(perfil = perfilActual, fallback = {}) {
  const config = timezoneConfigUsuario(perfil, fallback);
  return `${config.label} (${config.timeZone.replace(/_/g, " ")})`;
}

function fechaHoraUsuarioLabel(value = "", perfil = perfilActual, fallback = {}) {
  if (!value) return "Sin definir";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sin definir";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: timezoneUsuario(perfil, fallback),
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true
  }).format(date);
}

function partsFromIsoUsuario(value = "", perfil = perfilActual, fallback = {}) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezoneUsuario(perfil, fallback),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    period: String(parts.dayPeriod || "AM").toUpperCase().startsWith("P") ? "PM" : "AM"
  };
}

function isoDesdeFechaHoraUsuario(dateValue, timeValue, period, perfil = perfilActual, fallback = {}) {
  if (!dateValue || !timeValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  let [hour, minute] = timeValue.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return "";
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const offsetMinutes = timezoneConfigUsuario(perfil, fallback).offsetMinutes;
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - (offsetMinutes * 60 * 1000);
  return new Date(utc).toISOString();
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

async function consultarEstadoExamenServidor(classId, level) {
  if (!classId || !level) return null;
  const data = await postBackendAutenticado(APP_CONFIG.examAccessEndpoint, {
    classId,
    level,
    ...timezoneUsuarioPayload()
  });
  examAccessStateCache[`${classId}::${level}`] = data;
  examSettingsGrupo[classId] = {
    ...normalizarExamSettings(examSettingsGrupo[classId] || {}),
    [level]: {
      startAt: data.startAt || "",
      endAt: data.endAt || "",
      feedbackPublished: data.feedbackPublished === true
    }
  };
  return data;
}

async function guardarConfiguracionExamenServidor(payload) {
  const data = await postBackendAutenticado(APP_CONFIG.examAccessUpdateEndpoint, {
    ...payload,
    ...timezoneUsuarioPayload()
  });
  const { classId, level } = payload;
  examAccessStateCache[`${classId}::${level}`] = data;
  examSettingsGrupo[classId] = {
    ...normalizarExamSettings(examSettingsGrupo[classId] || {}),
    [level]: {
      startAt: data.startAt || payload.startAt || "",
      endAt: data.endAt || payload.endAt || "",
      feedbackPublished: data.feedbackPublished === true
    }
  };
  return data;
}

async function cargarPermisosRemotos(aulas = []) {
  const permisos = {};
  const bancos = {};
  const examSettings = {};
  const ids = [...new Set((aulas.length ? aulas : [grupoActivo]).filter(id => id && id !== "admin"))];
  await Promise.all(ids.map(async grupo => {
    if (!modoAdmin) {
      permisos[grupo] = { ...DEFAULT_HABILITADOS };
      bancos[grupo] = { ...DEFAULT_BANCOS };
      examSettings[grupo] = normalizarExamSettings();
      await Promise.all(Object.keys(DEFAULT_EXAM_SETTINGS).map(async level => {
        try {
          const state = await consultarEstadoExamenServidor(grupo, level);
          permisos[grupo][level] = !!state?.available || level === "diagnostico";
          bancos[grupo][level] = state?.bank || DEFAULT_BANCOS[level] || "principal";
        } catch (err) {
          console.warn("No se pudo cargar estado seguro del examen.", level, err);
        }
      }));
    } else {
      const snap = await getDoc(refPermisosGrupo(grupo));
      const data = snap.exists() ? snap.data() : {};
      permisos[grupo] = { ...DEFAULT_HABILITADOS, ...(data.permisos || {}) };
      bancos[grupo] = { ...DEFAULT_BANCOS, ...(data.bancos || {}) };
      examSettings[grupo] = normalizarExamSettings(data.examSettings || {});
      if (!snap.exists()) {
        await setDoc(refPermisosGrupo(grupo), { permisos: permisos[grupo], bancos: bancos[grupo], examSettings: examSettings[grupo], updatedAt: serverTimestamp() }, { merge: true });
      }
    }
  }));
  permisosGrupo = permisos;
  bancosGrupo = bancos;
  examSettingsGrupo = examSettings;
  guardarPermisosGrupo();
  guardarBancosGrupo();
}

function escucharPermisosGrupo(grupo) {
  if (unsubscribePermisos) unsubscribePermisos();
  if (!modoAdmin) {
    unsubscribePermisos = null;
    return;
  }
  unsubscribePermisos = onSnapshot(refPermisosGrupo(grupo), snap => {
    const data = snap.exists() ? snap.data() : {};
    permisosGrupo[grupo] = { ...DEFAULT_HABILITADOS, ...(data.permisos || {}) };
    bancosGrupo[grupo] = { ...DEFAULT_BANCOS, ...(data.bancos || {}) };
    examSettingsGrupo[grupo] = normalizarExamSettings(data.examSettings || {});
    guardarPermisosGrupo();
    guardarBancosGrupo();
    actualizarEstadoDiagnostico();
    refrescarVisibilidadResultadosActuales();
    if (nivelActual) abrirNivel(nivelActual);
  });
}

function refrescarVisibilidadResultadosActuales() {
  aplicarVisibilidadResultadoIntento("diagnostico", "resultsSection", "btnRestart");
  aplicarVisibilidadResultadoIntento("nivel1", "resultsSectionNivel", "btnRestartNivel");
  aplicarVisibilidadResultadoIntento("examen", "resultsSectionExamen", "btnRestartExamen");
}

function refrescarPermisosGrupo() {
  permisosGrupo = cargarPermisosGrupo();
}

function permisoDirecto(clave) {
  refrescarPermisosGrupo();
  if (modoAdmin) return true;
  return !!grupoActivo && !!{ ...DEFAULT_HABILITADOS, ...(permisosGrupo[grupoActivo] || {}) }[clave];
}

async function validarDisponibilidadExamen(clave) {
  if (modoAdmin) return true;
  if (!grupoActivo || grupoActivo === "admin") {
    alert("Debes pertenecer a un aula para presentar este examen.");
    return false;
  }
  try {
    const state = await consultarEstadoExamenServidor(grupoActivo, clave);
    if (state.available) return true;
    const zona = state.timeZoneLabel || etiquetaZonaUsuario();
    const apertura = fechaHoraUsuarioLabel(state.startAt, perfilActual, state);
    const cierre = fechaHoraUsuarioLabel(state.endAt, perfilActual, state);
    const mensaje = state.status === "scheduled"
      ? `${nombreExamen(clave)} aún no está disponible.\n\nApertura: ${apertura}\nHora oficial ${zona}: ${state.serverNowLabel}`
      : `${nombreExamen(clave)} ya finalizó.\n\nCierre: ${cierre}\nHora oficial ${zona}: ${state.serverNowLabel}`;
    alert(mensaje);
    return false;
  } catch (err) {
    console.error("No se pudo validar disponibilidad del examen.", err);
    alert(err.message || "No fue posible validar la disponibilidad del examen.");
    return false;
  }
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
  if (!examenGratisIndependienteHabilitado(clave)) return false;
  if (tienePlanGratisIndependiente()) {
    if (clave === "diagnostico") return true;
    if (clave === "examen") return nivelesCompletados.nivel1;
    return requisitoCumplido(clave);
  }
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
  if (!continuar) segsNivel = duracionExamenSeg("nivel1");
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
  segsNivel = duracionExamenSeg("nivel1");
  document.getElementById("timerDisplay").textContent = formatTiempo(segsNivel);
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
      aplicarSnapshotIntento(nivelActual, resultadoNivel);
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

async function evaluarYMostrarNivel(respuestas, opciones = {}) {
  if (!opciones.restaurando) limpiarIntentoActivo();
  nivelIniciado = false;
  nivelCompletadoVisible = true;
  nivelesCompletados[nivelActual] = true;
  document.getElementById("submitBtnNivel").style.display = "none";

  const preguntas = PREGUNTAS_NIVELES[nivelActual];
  const tiempoEmpleado = duracionExamenSeg(clave) - segsNivel;
  const puedeMostrarClaves = tieneClavesRespuesta(preguntas);
  let correctas = 0;
  preguntas.forEach((q, i) => { if (respuestas[i] === q.correcta) correctas++; });
  let incorrectas = preguntas.length - correctas;
  let pct = Math.round((correctas / preguntas.length) * 100);
  let nota = calcNota(pct);
  let badge = calcBadge(pct);
  if (!opciones.restaurando) {
    const serverMetrics = puedeMostrarClaves
      ? null
      : await guardarResultadoSesionConServidor(nivelActual, respuestas, segsNivel);
    if (serverMetrics) {
      correctas = serverMetrics.correctas;
      incorrectas = serverMetrics.incorrectas;
      pct = serverMetrics.porcentaje;
      nota = serverMetrics.nota;
      badge = calcBadge(pct);
    } else if (puedeMostrarClaves) {
      guardarResultadoSesion(nivelActual, respuestas, segsNivel);
    } else {
      guardarResultadoSesion(nivelActual, respuestas, segsNivel);
    }
  }
  const sec = document.getElementById("resultsSectionNivel");
  sec.hidden = false;
  const preguntasResultado = await cargarPreguntasRetroalimentacionOficial(nivelActual, preguntas);
  const puedeMostrarFeedback = tieneClavesRespuesta(preguntasResultado);

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
  if (!puedeMostrarFeedback) {
    tbody.innerHTML = `<tr><td colspan="4">Resultado guardado oficialmente. La retroalimentación se mostrará cuando el profesor la publique.</td></tr>`;
  } else preguntasResultado.forEach((q, i) => {
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
  if (!puedeMostrarFeedback) {
    fbEl.innerHTML = `<div class="feedback-pending-card"><strong>Retroalimentación protegida</strong><p>Las respuestas correctas y explicaciones permanecen ocultas hasta que el profesor las publique.</p></div>`;
  } else preguntasResultado.forEach((q, i) => {
    const sinR = respuestas[i] === -1;
    const ok = !sinR && respuestas[i] === q.correcta;
    const item = document.createElement("div");
    item.className = `feedback-item ${ok ? "fb-correct" : "fb-wrong"}`;
    item.innerHTML = `
      <div class="fb-header"><span class="fb-icon">${ok ? "✔" : "✘"}</span> Pregunta ${q.id}${sinR ? " <em style='font-weight:400;font-size:.85rem'>(sin responder)</em>" : ""}</div>
      <p class="fb-resp"><strong>Tu respuesta:</strong> ${sinR ? "No respondida" : LETRAS[respuestas[i]] + ") " + q.opciones[respuestas[i]]}</p>
      ${!ok ? `<p class="fb-resp"><strong>Respuesta correcta:</strong> ${LETRAS[q.correcta]}) ${q.opciones[q.correcta]}</p>` : ""}
      <div class="fb-expl"><strong>Explicación:</strong><br>${q.explicacion}</div>
      ${feedbackVideoHtml(q)}
      ${feedbackVideoHtml(q)}
    `;
    fbEl.appendChild(item);
  });

  reRenderKatex(sec);
  resetTimerNivel();
  if (!opciones.restaurando) sec.scrollIntoView({ behavior: "smooth" });

  preguntas.forEach((q, i) => {
    const qResultado = preguntasResultado[i] || q;
    const card = document.getElementById(`nivel-card-${q.id}`);
    if (!card) return;
    const sinR = respuestas[i] === -1;
    const ok = !sinR && respuestas[i] === qResultado.correcta;
    if (puedeMostrarFeedback) card.classList.add(ok ? "result-correct" : "result-wrong");
    card.querySelectorAll("input[type='radio']").forEach(inp => inp.disabled = true);
    card.querySelectorAll(".option-label").forEach((lbl, idx) => {
      if (!puedeMostrarFeedback) return;
      if (idx === qResultado.correcta) lbl.classList.add("opt-correct");
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

document.getElementById("btnIniciarNivel").addEventListener("click", async () => {
  if (!puedeIniciarIntento(nivelActual)) {
    alert("Ya usaste los 2 intentos permitidos para este nivel.");
    return;
  }
  if (!(await validarDisponibilidadExamen(nivelActual))) return;
  await prepararPreguntasActivas("nivel1");
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

document.getElementById("btnVerResultadoNivel").addEventListener("click", async () => {
  document.getElementById("timeoutOverlayNivel").classList.add("hidden");
  const respuestas = PREGUNTAS_NIVELES[nivelActual].map(q => {
    const ch = document.querySelector(`input[name="nivel-q${q.id}"]:checked`);
    return ch ? parseInt(ch.value, 10) : -1;
  });
  await evaluarYMostrarNivel(respuestas);
});

document.getElementById("nivelForm").addEventListener("submit", async (e) => {
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
  await evaluarYMostrarNivel(respuestas);
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
    const item = document.querySelector(`#passwordRules [data-rule="${regla}"]`);
    item?.classList.toggle("valid", ok);
    item?.classList.toggle("invalid", !ok);
  });
  const valido = Object.values(detalle).every(Boolean);
  const btn = document.getElementById("btnEmailRegister");
  if (btn) btn.disabled = false;
  return valido;
}

function actualizarReglasPasswordInstitucion() {
  const password = document.getElementById("institutionPassword")?.value || "";
  return actualizarReglasPasswordEn("institutionPasswordRules", password);
}

function actualizarReglasPasswordEn(panelId, password) {
  const detalle = detallePassword(password || "");
  Object.entries(detalle).forEach(([regla, ok]) => {
    const item = document.querySelector(`#${panelId} [data-rule="${regla}"]`);
    item?.classList.toggle("valid", ok);
    item?.classList.toggle("invalid", !ok);
  });
  return Object.values(detalle).every(Boolean);
}

function tienePasswordActual() {
  return usuarioActual?.providerData?.some(provider => provider.providerId === "password");
}

function tieneGoogleVinculado() {
  return usuarioActual?.providerData?.some(provider => provider.providerId === "google.com");
}

function mensajePasswordFirebase(err) {
  const code = err?.code || "";
  if (code.includes("requires-recent-login")) return "Por seguridad debes cerrar sesión, volver a ingresar y repetir la operación.";
  if (code.includes("provider-already-linked") || code.includes("credential-already-in-use") || code.includes("email-already-in-use")) return "Ya tiene contraseña.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "La contraseña actual no es correcta.";
  if (code.includes("weak-password")) return "La nueva contraseña no cumple los requisitos de seguridad.";
  return "No se pudo completar la operación. Revisa los datos e intenta nuevamente.";
}

function mostrarAuthInicial(intent = "login") {
  authIntent = intent;
  limpiarLoginCredenciales();
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.getElementById("roleChoiceCard")?.classList.add("hidden");
  document.getElementById("loginTypeStep")?.classList.remove("hidden");
  document.querySelector(".auth-tabs")?.classList.add("hidden");
  document.querySelector(".auth-divider")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.add("hidden");
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("tabLogin")?.classList.add("active");
  document.getElementById("tabRegister")?.classList.remove("active");
  document.getElementById("tabInstitutionRegister")?.classList.remove("active");
  document.getElementById("btnGoogleLogin")?.closest(".auth-actions")?.classList.add("hidden");
  document.getElementById("groupEntry")?.classList.add("hidden");
  document.getElementById("btnAuthClose")?.classList.remove("hidden");
  const title = document.getElementById("authTitle");
  if (title) title.textContent = intent === "register" ? "Crear cuenta" : "Ingreso Matemáticas En Tu Bolsillo";
  const continueBtn = document.getElementById("btnContinueLoginType");
  if (continueBtn) continueBtn.textContent = intent === "register" ? "Continuar registro" : "Continuar";
  const accountType = document.getElementById("loginAccountType");
  if (accountType) accountType.value = "";
  setStatus("loginTypeStatus", "");
  actualizarLoginAccountType();
}

function passwordToggleSvg(visible = false) {
  return visible
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18"/><path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58"/><path d="M9.88 5.89A9.37 9.37 0 0 1 12 5.65c6.25 0 9.75 6.35 9.75 6.35a17.52 17.52 0 0 1-3.06 3.8"/><path d="M6.61 6.83A17.22 17.22 0 0 0 2.25 12S5.75 18.35 12 18.35a9.31 9.31 0 0 0 4.22-1"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z"/><circle cx="12" cy="12" r="2.75"/></svg>`;
}

function renderPasswordToggle(btn, visible = false) {
  if (!btn) return;
  btn.innerHTML = passwordToggleSvg(visible);
  btn.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Ver contraseña");
  btn.setAttribute("aria-pressed", visible ? "true" : "false");
}

function resetPasswordVisibility(scope = document) {
  scope.querySelectorAll?.("[data-toggle-password]").forEach(btn => {
    const input = document.getElementById(btn.dataset.togglePassword || "");
    if (input && input.type !== "password") input.type = "password";
    renderPasswordToggle(btn, false);
  });
}

function limpiarLoginCredenciales() {
  const campos = [
    "loginEmail",
    "loginPassword"
  ];
  campos.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  resetPasswordVisibility(document.getElementById("loginCard") || document);
  actualizarReglasPasswordEn("passwordRules", "");
  setStatus("loginStatus", "");
  setStatus("loginTypeStatus", "");
}

function modalPublicoAbierto() {
  return ["loginCard", "institutionInfoCard", "faqCard", "forgotPasswordCard", "forgotUserCard", "roleChoiceCard"]
    .some(id => !document.getElementById(id)?.classList.contains("hidden"));
}

function actualizarBloqueoScrollPublico() {
  document.body.classList.toggle("public-modal-open", modalPublicoAbierto());
}

function enfocarModalPublico(cardId) {
  const card = document.getElementById(cardId);
  const panel = card?.querySelector(".auth-gate");
  if (card) card.scrollTop = 0;
  if (panel) panel.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    card?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    panel?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    panel?.focus?.({ preventScroll: true });
  });
}

function limpiarCamposPublicos(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.querySelectorAll("input").forEach(input => {
    if (["checkbox", "radio"].includes(input.type)) input.checked = false;
    else input.value = "";
  });
  card.querySelectorAll("textarea").forEach(textarea => { textarea.value = ""; });
  card.querySelectorAll("select").forEach(select => { select.value = ""; });
  resetPasswordVisibility(card);
  card.querySelectorAll("details").forEach(detail => { detail.open = false; });
  card.querySelectorAll(".bank-status, .message-status, .status, [id$='Status']").forEach(status => {
    status.textContent = "";
    if (status.classList.contains("bank-status")) status.className = "bank-status";
    else status.classList.remove("ok", "error", "success", "info");
  });
}

function limpiarAuthPublico() {
  limpiarCamposPublicos("loginCard");
  clasePendienteIngreso = null;
  document.getElementById("classCodeStep")?.classList.add("hidden");
  document.getElementById("groupCodeStep")?.classList.add("hidden");
}

function mostrarLoginCard() {
  cerrarLandingMenu();
  limpiarAuthPublico();
  document.getElementById("loginCard")?.classList.remove("hidden");
  mostrarAuthInicial("login");
  document.getElementById("loginCard")?.classList.remove("hidden");
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("loginCard");
}

function mostrarLoginConError(message) {
  authIntent = "login";
  document.getElementById("loginCard")?.classList.remove("hidden");
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.getElementById("roleChoiceCard")?.classList.add("hidden");
  document.getElementById("institutionInfoCard")?.classList.add("hidden");
  document.getElementById("groupEntry")?.classList.add("hidden");
  document.getElementById("loginTypeStep")?.classList.add("hidden");
  document.querySelector(".auth-tabs")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.remove("hidden");
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("tabLogin")?.classList.add("active");
  document.getElementById("tabRegister")?.classList.remove("active");
  document.getElementById("tabInstitutionRegister")?.classList.remove("active");
  document.getElementById("btnAuthClose")?.classList.remove("hidden");
  const title = document.getElementById("authTitle");
  if (title) title.textContent = "Ingreso Matemáticas En Tu Bolsillo";
  actualizarLoginAccountType();
  setStatusTemporal("loginStatus", message || "Tipo de cuenta equivocado. Selecciona el tipo correcto e intenta nuevamente.", "error", 5000);
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("loginCard");
}

function mostrarRegisterCard() {
  cerrarLandingMenu();
  limpiarAuthPublico();
  document.getElementById("loginCard")?.classList.remove("hidden");
  mostrarAuthInicial("register");
  document.getElementById("loginCard")?.classList.remove("hidden");
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("loginCard");
}

function mostrarInstitutionInfo() {
  cerrarLandingMenu();
  limpiarCamposPublicos("institutionInfoCard");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("faqCard")?.classList.add("hidden");
  document.getElementById("tabLogin")?.classList.remove("active");
  document.getElementById("tabRegister")?.classList.remove("active");
  document.getElementById("tabInstitutionRegister")?.classList.add("active");
  document.getElementById("institutionInfoCard")?.classList.remove("hidden");
  inicializarFormularioInstitucional();
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("institutionInfoCard");
}

function cerrarInstitutionInfo() {
  document.getElementById("institutionInfoCard")?.classList.add("hidden");
  document.getElementById("tabInstitutionRegister")?.classList.remove("active");
  limpiarFormularioInstitucional();
  actualizarBloqueoScrollPublico();
}

function mostrarFaqCard() {
  cerrarLandingMenu();
  limpiarCamposPublicos("faqCard");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("institutionInfoCard")?.classList.add("hidden");
  document.getElementById("faqCard")?.classList.remove("hidden");
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("faqCard");
}

function cerrarFaqCard() {
  limpiarCamposPublicos("faqCard");
  document.getElementById("faqCard")?.classList.add("hidden");
  actualizarBloqueoScrollPublico();
}

function cerrarAuthCard() {
  limpiarAuthPublico();
  document.getElementById("loginCard")?.classList.add("hidden");
  actualizarBloqueoScrollPublico();
}

function cerrarFlujosAuth() {
  limpiarAuthPublico();
  limpiarCamposPublicos("faqCard");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.getElementById("roleChoiceCard")?.classList.add("hidden");
  document.getElementById("institutionInfoCard")?.classList.add("hidden");
  document.getElementById("groupEntry")?.classList.add("hidden");
  actualizarBloqueoScrollPublico();
}

function mostrarEntradaGrupo() {
  document.getElementById("groupEntry")?.classList.add("hidden");
  document.getElementById("classCodeStep")?.classList.add("hidden");
  actualizarBloqueoScrollPublico();
}

function configurarCamposProgramacionMovil() {
  const esMovil = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  ["examStartDate", "examEndDate", "examStartTime", "examEndTime"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    if (!input.dataset.originalType) input.dataset.originalType = input.type || "text";
    if (esMovil) {
      input.type = "text";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.placeholder = id.includes("Time") ? "HH:MM" : "AAAA-MM-DD";
    } else {
      input.type = input.dataset.originalType;
      input.placeholder = "";
    }
  });
}

function toggleLandingMenu() {
  const nav = document.querySelector(".landing-nav");
  const nextOpen = !nav?.classList.contains("open");
  nav?.classList.toggle("open", nextOpen);
  document.body.classList.toggle("landing-menu-open", nextOpen);
  document.getElementById("btnLandingMenu")?.setAttribute("aria-expanded", String(nextOpen));
}

function cerrarLandingMenu() {
  document.querySelector(".landing-nav")?.classList.remove("open");
  document.body.classList.remove("landing-menu-open");
  document.getElementById("btnLandingMenu")?.setAttribute("aria-expanded", "false");
}

function activarEscenaMatematica() {
  const stage = document.querySelector(".math-showcase");
  if (!stage) return;
  stage.addEventListener("pointermove", event => {
    if (event.pointerType === "touch") return;
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    stage.style.setProperty("--math-tilt-x", `${(-y * 3).toFixed(2)}deg`);
    stage.style.setProperty("--math-tilt-y", `${(x * 4).toFixed(2)}deg`);
  });
  stage.addEventListener("pointerleave", () => {
    stage.style.setProperty("--math-tilt-x", "0deg");
    stage.style.setProperty("--math-tilt-y", "0deg");
  });
  stage.querySelectorAll(".landing-equation").forEach(card => {
    card.addEventListener("click", () => {
      stage.querySelectorAll(".landing-equation").forEach(item => {
        if (item !== card) item.classList.remove("active");
      });
      card.classList.toggle("active");
    });
  });
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

function mostrarWarn(msg, tipo = "error", ms = 5000) {
  const warn = document.getElementById("grupoWarn");
  if (!warn) return;
  warn.textContent = msg;
  warn.hidden = false;
  warn.classList.toggle("error", tipo === "error");
  warn.classList.toggle("ok", tipo === "ok" || tipo === "success");
  clearTimeout(statusTimers.grupoWarn);
  statusTimers.grupoWarn = setTimeout(() => {
    warn.textContent = "";
    warn.hidden = true;
    warn.classList.remove("error", "ok");
  }, ms);
}

function mostrarErrorAuth(msg, ms = 5000) {
  mostrarWarn(msg, "error", ms);
}

function limpiarWarn() {
  const warn = document.getElementById("grupoWarn");
  if (!warn) return;
  warn.hidden = true;
  warn.textContent = "";
  warn.classList.remove("error", "ok");
  clearTimeout(statusTimers.grupoWarn);
}

const statusTimers = {};
function setStatus(id, msg, tipo = "ok") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `bank-status${tipo ? ` ${tipo}` : ""}`;
}

function setStatusTemporal(id, msg, tipo = "ok", ms = 5000) {
  setStatus(id, msg, tipo);
  clearTimeout(statusTimers[id]);
  statusTimers[id] = setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = "";
    el.className = "bank-status";
  }, ms);
}

function mostrarLoginErrorTemporal(id, msg, ms = 5000) {
  setStatusTemporal(id, msg, "error", ms);
}

function mostrarReloadSesion() {
  document.getElementById("reloadSplash")?.classList.remove("hidden");
}

function ocultarReloadSesion() {
  document.getElementById("reloadSplash")?.classList.add("hidden");
  sessionStorage.removeItem(STORAGE_RELOAD_SESION);
}

function setButtonLoading(button, loading, text = "Cargando...") {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent || "";
    button.textContent = text;
    button.disabled = true;
    button.classList.add("is-loading");
    return;
  }
  button.disabled = false;
  button.classList.remove("is-loading");
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

function poblarPhoneCodes(selectId, value = "+57") {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = PHONE_CODES.map(item => `<option value="${item.code}" data-flag="${item.flag}" data-country="${item.country}">${item.label}</option>`).join("");
  select.value = value;
}

function normalizarTextoBusqueda(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

async function cargarIndiceInstituciones() {
  if (institutionCatalogCache.index) return institutionCatalogCache.index;
  const response = await fetch("assets/instituciones/index.json");
  if (!response.ok) throw new Error("No se pudo cargar el catálogo de instituciones.");
  institutionCatalogCache.index = await response.json();
  return institutionCatalogCache.index;
}

async function cargarColegiosMunicipio(municipalityCode) {
  if (!municipalityCode) return [];
  if (institutionCatalogCache.schoolsByMunicipality[municipalityCode]) {
    return institutionCatalogCache.schoolsByMunicipality[municipalityCode];
  }
  const response = await fetch(`assets/instituciones/${encodeURIComponent(municipalityCode)}.json`);
  if (!response.ok) throw new Error("No se pudieron cargar los colegios del municipio.");
  const schools = await response.json();
  institutionCatalogCache.schoolsByMunicipality[municipalityCode] = schools;
  return schools;
}

async function inicializarFormularioInstitucional() {
  const dept = document.getElementById("institutionDepartment");
  const city = document.getElementById("institutionCity");
  const school = document.getElementById("institutionSchool");
  if (!dept || !city || !school) return;
  try {
    const index = await cargarIndiceInstituciones();
    dept.innerHTML = `<option value="">Departamento</option>` + index.map(item =>
      `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)}</option>`
    ).join("");
    city.innerHTML = `<option value="">Ciudad o municipio</option>`;
    school.innerHTML = `<option value="">Primero selecciona ciudad</option>`;
  } catch (err) {
    setStatus("institutionStatus", err.message || "No se pudo cargar el catálogo DANE.", "error");
  }
}

async function actualizarCiudadesInstitucion() {
  const dept = document.getElementById("institutionDepartment");
  const city = document.getElementById("institutionCity");
  const school = document.getElementById("institutionSchool");
  const selectedDept = dept?.value || "";
  const index = await cargarIndiceInstituciones();
  const info = index.find(item => item.code === selectedDept);
  city.innerHTML = `<option value="">Ciudad o municipio</option>` + (info?.municipalities || []).map(item =>
    `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)} · ${item.count} colegios</option>`
  ).join("");
  school.innerHTML = `<option value="">Primero selecciona ciudad</option>`;
  limpiarColegioInstitucional();
}

function limpiarColegioInstitucional() {
  const ids = ["institutionName", "institutionSector", "institutionDane"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function limpiarFormularioInstitucional() {
  const card = document.getElementById("institutionInfoCard");
  if (!card) return;
  card.querySelectorAll("input").forEach(input => {
    input.value = "";
    if (input.id === "institutionPassword") input.type = "password";
  });
  card.querySelectorAll("select").forEach(select => {
    select.selectedIndex = 0;
  });
  const city = document.getElementById("institutionCity");
  const school = document.getElementById("institutionSchool");
  if (city) city.innerHTML = `<option value="">Ciudad o municipio</option>`;
  if (school) school.innerHTML = `<option value="">Primero selecciona ciudad</option>`;
  setStatus("institutionStatus", "");
  actualizarReglasPasswordInstitucion();
}

async function actualizarColegiosInstitucion() {
  const city = document.getElementById("institutionCity");
  const school = document.getElementById("institutionSchool");
  if (!city || !school) return;
  limpiarColegioInstitucional();
  const municipalityCode = city.value;
  if (!municipalityCode) {
    school.innerHTML = `<option value="">Primero selecciona ciudad</option>`;
    return;
  }
  school.innerHTML = `<option value="">Cargando colegios...</option>`;
  try {
    const schools = await cargarColegiosMunicipio(municipalityCode);
    school.innerHTML = `<option value="">Selecciona el colegio</option>` + schools.map(item =>
      `<option value="${escapeHtml(item.dane)}" data-sector="${escapeHtml(item.sector)}" data-name="${escapeHtml(item.name)}" data-type="${escapeHtml(item.establishmentType || "")}" data-campus-count="${escapeHtml(String(item.campusCount || ""))}">${escapeHtml(item.name)} · ${escapeHtml(item.sector)} · DANE ${escapeHtml(item.dane)}</option>`
    ).join("");
  } catch (err) {
    school.innerHTML = `<option value="">No se pudieron cargar colegios</option>`;
    setStatus("institutionStatus", err.message || "No se pudieron cargar colegios.", "error");
  }
}

function sincronizarColegioInstitucional() {
  const school = document.getElementById("institutionSchool");
  const selected = school?.selectedOptions?.[0];
  const name = document.getElementById("institutionName");
  const sector = document.getElementById("institutionSector");
  const dane = document.getElementById("institutionDane");
  if (name) name.value = selected?.dataset.name || "";
  if (sector) sector.value = selected?.dataset.sector || "";
  if (dane) dane.value = school?.value || "";
}

async function crearCuentaInstitucional() {
  const statusId = "institutionStatus";
  const adminName = document.getElementById("institutionAdminName")?.value.trim() || "";
  const email = document.getElementById("institutionEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("institutionPassword")?.value || "";
  const institutionRole = document.getElementById("institutionRole")?.value || "";
  const institutionCountry = document.getElementById("institutionCountry")?.value || "CO";
  const dept = document.getElementById("institutionDepartment");
  const city = document.getElementById("institutionCity");
  const school = document.getElementById("institutionSchool");
  const daneTyped = school?.value || "";
  const gradeMode = document.getElementById("institutionGradeMode")?.value || "";
  const selectedSchool = school?.selectedOptions?.[0];
  const selectedDept = dept?.selectedOptions?.[0];
  const selectedCity = city?.selectedOptions?.[0];
  if (adminName.length < 3) return setStatus(statusId, "Escribe el nombre del responsable.", "error");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus(statusId, "Escribe un correo institucional válido.", "error");
  if (!["rector", "coordinator"].includes(institutionRole)) return setStatus(statusId, "Selecciona si el cargo es Rector(a) o Coordinador(a).", "error");
  if (institutionCountry !== "CO") return setStatus(statusId, "El registro institucional por ahora solo está disponible para colegios de Colombia.", "error");
  if (!actualizarReglasPasswordInstitucion() || !validarPassword(password)) return setStatus(statusId, "La contraseña debe cumplir mínimo 8 caracteres, una mayúscula, dos números y un símbolo.", "error");
  if (!dept?.value || !city?.value || !school?.value) return setStatus(statusId, "Selecciona departamento, ciudad y colegio.", "error");
  if (daneTyped !== school.value) return setStatus(statusId, "El código DANE no coincide con el colegio seleccionado.", "error");
  if (!gradeMode) return setStatus(statusId, "Selecciona si los grupos se nombran por letra o número.", "error");
  const gradeCounts = {
    "9": Number(document.getElementById("institutionGrade9Count")?.value || 0),
    "10": Number(document.getElementById("institutionGrade10Count")?.value || 0),
    "11": Number(document.getElementById("institutionGrade11Count")?.value || 0)
  };
  if (!gradeCounts["9"] && !gradeCounts["10"] && !gradeCounts["11"]) {
    return setStatus(statusId, "Indica cuántos grupos tiene al menos un grado.", "error");
  }
  setStatus(statusId, "Creando cuenta institucional...");
  try {
    registroEnCurso = true;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: adminName });
    const institutionData = {
      institutionDane: school.value,
      institutionName: selectedSchool?.dataset.name || "",
      institutionSector: selectedSchool?.dataset.sector || "",
      institutionType: selectedSchool?.dataset.type || "",
      institutionCampusCount: Number(selectedSchool?.dataset.campusCount || 0),
      institutionDepartmentCode: dept.value,
      institutionDepartmentName: selectedDept?.textContent || "",
      institutionMunicipalityCode: city.value,
      institutionMunicipalityName: (selectedCity?.textContent || "").replace(/\s·\s\d+\scolegios$/i, ""),
      institutionCountry: "Colombia",
      gradeMode,
      gradeCounts,
      ownerUid: cred.user.uid,
      ownerEmail: email,
      ownerName: adminName,
      ownerRole: institutionRole,
      status: "pending-subscription",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "institutions", school.value), institutionData, { merge: true });
    await setDoc(doc(db, "institutionAdmins", `${school.value}_${cred.user.uid}`), {
      institutionDane: school.value,
      uid: cred.user.uid,
      email,
      displayName: adminName,
      role: "owner",
      institutionRole,
      status: "active",
      createdAt: serverTimestamp()
    }, { merge: true });
    await guardarPerfilUsuario({
      uid: cred.user.uid,
      email,
      displayName: adminName,
      role: "institution",
      tipoCuenta: "institution",
      accountMode: "institution",
      isInstitutionAdmin: true,
      isAdmin: false,
      grupo: "",
      ...institutionData
    });
    await enviarVerificacionEmailPersonalizada(email);
    await signOut(auth);
    registroEnCurso = false;
    setStatus(statusId, "Cuenta institucional creada. Verifica el correo antes de iniciar sesión.", "ok");
    setTimeout(limpiarFormularioInstitucional, 1800);
  } catch (err) {
    registroEnCurso = false;
    console.error(err);
    setStatus(statusId, "No se pudo crear la cuenta institucional. Revisa el correo o intenta de nuevo.", "error");
  }
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
  const institucion = esInstitucion(profile);
  document.getElementById("profileNameTitle").textContent = institucion ? (profile.institutionName || displayName || "Institución") : (displayName || "Perfil");
  document.getElementById("profileEmailText").textContent = usuarioActual.email || "";
  const ageChip = document.getElementById("profileAgeChip");
  if (ageChip) {
    ageChip.textContent = institucion ? `DANE: ${profile.institutionDane || "—"}` : `Edad: ${calcularEdad(profile.birthDate)}`;
  }
  const groupChip = document.getElementById("profileGroupChip");
  if (groupChip) groupChip.remove();
  document.getElementById("profileClassChip").textContent = institucion
    ? `${profile.institutionDepartmentName || "Departamento"} · ${profile.institutionMunicipalityName || "Ciudad"}`
    : (modoAdmin ? `Aulas activas: ${activeClassCount}` : `Aula: ${profile.className || claseActualInfo?.name || "sin aula"}`);
  document.getElementById("profileCreatedChip").textContent = institucion
    ? `Sector: ${profile.institutionSector || "—"}`
    : `Registro: ${profile.createdLabel || "—"}`;
  document.getElementById("profilePhoneChip").textContent = profile.phoneVerified ? "Teléfono verificado" : "Teléfono sin verificar";
  document.getElementById("profilePhotoPreview").src = photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%23e8f0fb'/%3E%3Ctext x='60' y='68' text-anchor='middle' font-size='44' fill='%23003865'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
  document.getElementById("profileName").value = displayName;
  document.getElementById("profileBirth").value = profile.birthDate || "";
  document.getElementById("profileGender").value = profile.gender || "";
  poblarPhoneCodes("profilePhoneCode", profile.phoneCode || "+57");
  document.getElementById("profilePhone").value = profile.phoneVerified ? "" : (profile.phone || "");
  document.getElementById("profilePhoneCodeInput").value = "";
  poblarUbicacion("profile", profile);
  document.getElementById("profileBirth")?.closest("label")?.classList.toggle("hidden", institucion);
  document.getElementById("profileGender")?.closest("label")?.classList.toggle("hidden", institucion);
  document.getElementById("teacherDeletePanel")?.classList.toggle("hidden", !modoAdmin || institucion);
  actualizarPanelGooglePerfil();
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

async function crearClaseAdmin(options = {}) {
  const status = document.getElementById(options.statusId || "adminClassStatus");
  if (!exigirSuscripcion("Activa tu suscripción para crear aulas.")) return;
  const btn = document.getElementById(options.buttonId || "btnCreateClass");
  const nameInput = document.getElementById(options.nameId || "adminClassName");
  const gradeInput = options.gradeId ? document.getElementById(options.gradeId) : null;
  const grade = gradeInput?.value || "";
  const name = nameInput?.value.trim() || "";
  if (!name) {
    if (status) {
      status.textContent = "Escribe el nombre del aula.";
      status.className = "bank-status error";
    }
    return;
  }
  if (status) {
    status.textContent = "Creando aula...";
    status.className = "bank-status error";
  }
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
      if (status) {
        status.textContent = "No se pudo generar un código único. Intenta de nuevo.";
        status.className = "bank-status error";
      }
      return;
    }
    const ref = doc(collection(db, "classes"));
    const institutionalOwner = esInstitucion() || cuentaInstitucional();
    const payload = {
      name,
      code,
      codeKey: normalizarCodigoClase(code),
      ownerEmail: usuarioActual.email,
      ownerUid: usuarioActual.uid,
      institutionDane: institutionalOwner ? (perfilActual?.institutionDane || "") : "",
      institutionName: institutionalOwner ? (perfilActual?.institutionName || "") : "",
      grade: institutionalOwner ? grade : "",
      course: institutionalOwner ? grade : "",
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
    if (esInstitucion()) await renderInstitutionPanel().catch(error => console.warn("No se pudo refrescar el panel institucional.", error));
    if (nameInput) nameInput.value = "";
    if (status) setStatusTemporal(options.statusId || "adminClassStatus", `Aula creada. Código generado: ${code}`, "success", 5000);
  } catch (err) {
    console.error(err);
    if (status) {
      status.textContent = "No se pudo crear el aula. Revisa reglas de Firestore y conexión.";
      status.className = "bank-status error";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function cargarClasesAdmin() {
  if (!(modoAdmin || esInstitucion()) || !usuarioActual) return;
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
    if (modoAdmin) {
      escucharEstudiantesAdmin();
      renderAdminStudentsByClass().catch(err => console.warn("No se pudieron cargar estudiantes.", err));
    }
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
  const metricsClass = document.getElementById("adminMetricsClassSelect");
  const examAccessClass = document.getElementById("examAccessClassSelect");
  const reportClass = document.getElementById("reportClassSelect");
  const institutionMemberClass = document.getElementById("institutionMemberClass");
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
  if (metricsClass) {
    const current = metricsClass.value || "best";
    if (esInstitucion()) {
      const grades = gradosInstitucion();
      metricsClass.innerHTML = grades.length
        ? grades.map(grade => `<option value="${grade}">${grade}</option>`).join("")
        : `<option value="">Sin grados configurados</option>`;
      metricsClass.value = grades.includes(current) ? current : (grades[0] || "");
    } else {
      metricsClass.innerHTML = adminClases.length
        ? `<option value="best">Mejor aula</option>${adminClases.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("")}`
        : `<option value="">Sin aulas creadas</option>`;
      metricsClass.value = adminClases.some(c => c.id === current) || current === "best" ? current : "best";
    }
  }
  if (examAccessClass) {
    const current = examAccessClass.value || adminClaseActiva || "";
    examAccessClass.innerHTML = options;
    examAccessClass.value = adminClases.some(c => c.id === current) ? current : (adminClaseActiva || idsAulasAdmin()[0] || "");
  }
  if (reportClass) {
    const current = reportClass.value || adminClaseActiva || "";
    reportClass.innerHTML = options;
    reportClass.value = adminClases.some(c => c.id === current) ? current : (adminClaseActiva || idsAulasAdmin()[0] || "");
  }
  if (institutionMemberClass) {
    const current = institutionMemberClass.value || adminClaseActiva || "";
    institutionMemberClass.innerHTML = options;
    institutionMemberClass.value = adminClases.some(c => c.id === current) ? current : (adminClaseActiva || idsAulasAdmin()[0] || "");
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
  const bloqueado = est.status === "bloqueado";
  const opciones = adminClases.map(aula =>
    `<option value="${aula.id}" ${est.classId === aula.id || est.grupo === aula.id ? "selected" : ""}>${aula.name}</option>`
  ).join("");
  return `
    <div class="student-row ${bloqueado ? "student-blocked" : ""}" data-student-row data-search="${(est.name || "")} ${est.email}">
      <div>
        <strong>${est.name || "Nombre pendiente"}</strong>
        <span>${est.email}</span>
        <small>Registro: ${fecha} · Estado: ${bloqueado ? "Bloqueado" : (est.status || "pendiente")}</small>
      </div>
      <select class="admin-input" data-student-group="${est.id}" aria-label="Cambiar aula">${opciones}</select>
      <button class="btn ${bloqueado ? "btn-primary" : "btn-outline"}" data-toggle-student-block="${est.id}" data-blocked="${bloqueado}" type="button">${bloqueado ? "Desbloquear estudiante" : "Bloquear estudiante"}</button>
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
  clearPendingLoginType();
  cerrarFlujosAuth();
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
    if (suscripcionActiva()) {
      iniciarListenersComunicacion();
      cargarClasesAdmin().catch(err => console.warn("No se pudieron cargar clases admin.", err));
    }
    if (await aceptarInvitacionPendiente()) return;
    activarNav(suscripcionActiva() ? seccionRestaurable() : "suscripcion");
    guardarPerfilUsuario({ role: "teacher", isAdmin: true, grupo: "admin" }).catch(err => console.warn("No se pudo guardar perfil admin.", err));
    return;
  }

  if (esInstitucion()) {
    await mostrarSplashBienvenida();
    modoAdmin = false;
    grupoActivo = "institution";
    localStorage.setItem(STORAGE_GRUPO, grupoActivo);
    document.body.classList.remove("group-locked");
    aplicarModoUsuario();
    activarNav(suscripcionActiva() ? seccionRestaurable() : "suscripcion");
    return;
  }

  await cargarEstadoRemoto();
  await mostrarSplashBienvenida();
  if (esEstudianteIndependiente()) {
    const aulaOk = await asegurarAulaIndependienteAutomatica().catch(err => {
      console.warn("No se pudo asignar aula independiente automáticamente.", err);
      return false;
    });
    if (!aulaOk) {
      document.body.classList.remove("group-locked");
      aplicarModoUsuario();
      activarNav("inicio");
      return;
    }
  }
  if (!suscripcionActiva()) {
    document.body.classList.remove("group-locked");
    aplicarModoUsuario();
    activarNav(seccionRestaurable());
    return;
  }
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
    if (matriculaSnap.data().status === "bloqueado" || perfilActual?.classAccessBlocked === true) {
      classMembershipValid = false;
      detenerListenersComunicacion();
      document.body.classList.remove("group-locked");
      aplicarModoUsuario();
      activarNav("perfil");
      const status = document.getElementById("profileStatus");
      if (status) {
        status.textContent = "Tu acceso a esta aula está bloqueado por el profesor.";
        status.className = "bank-status error";
      }
      escucharMembresiaClase(aulaId);
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
    await restaurarIntentoActivo();
    return;
  }

  document.body.classList.remove("group-locked");
  aplicarModoUsuario();
  activarNav(esEstudianteInstitucional() ? "inicio" : "perfil");
}

async function entrarGrupo() {
  if (!usuarioActual) {
    mostrarWarn("Primero inicia sesión o regístrate.");
    return;
  }
  if (esEstudianteIndependiente()) {
    await asegurarAulaIndependienteAutomatica();
    document.body.classList.remove("group-locked");
    aplicarModoUsuario();
    activarNav("inicio");
    return;
  }
  if (esEstudianteInstitucional()) {
    mostrarWarn("Para ingresar a un aula institucional, solicita al profesor o a la institución que te agregue.");
    document.getElementById("grupoWarn")?.classList.add("error");
    return;
  }
  if (!exigirSuscripcion("Necesitas una suscripción activa antes de ingresar a un aula.")) return;
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
    const membershipId = `${clase.id}_${safeEmailId(usuarioActual?.email || "")}`;
    const membershipSnap = await getDoc(doc(db, "classStudents", membershipId));
    if (membershipSnap.exists() && membershipSnap.data().status === "bloqueado") {
      mostrarWarn("Tu acceso a esta aula está bloqueado por el profesor. Comunícate con él para solicitar el desbloqueo.");
      document.getElementById("grupoWarn")?.classList.add("error");
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
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().status === "bloqueado") {
    throw new Error("STUDENT_BLOCKED");
  }
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
    institutionDane: extra.institutionDane || claseActualInfo?.institutionDane || perfilActual?.institutionDane || "",
    institutionName: extra.institutionName || claseActualInfo?.institutionName || perfilActual?.institutionName || "",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function asegurarAulaIndependienteAutomatica() {
  if (!usuarioActual || !esEstudianteIndependiente()) return false;
  const clase = await buscarClasePorCodigo(INDEPENDENT_CLASS_CODE).catch(() => null);
  if (!clase) {
    console.warn(`No existe el aula independiente ${INDEPENDENT_CLASS_CODE}.`);
    return false;
  }
  claseActiva = clase.id;
  grupoActivo = clase.id;
  claseActualInfo = clase;
  classMembershipValid = true;
  localStorage.setItem(STORAGE_GRUPO, grupoActivo);
  localStorage.setItem(STORAGE_CLASE_ACTIVA, claseActiva);
  autoClassEnrollmentInProgress = true;
  try {
    await guardarPerfilUsuario({
      grupo: clase.id,
      classId: clase.id,
      className: clase.name || INDEPENDENT_CLASS_NAME,
      classCode: clase.code || INDEPENDENT_CLASS_CODE,
      classOwnerUid: clase.ownerUid || "",
      classOwnerEmail: clase.ownerEmail || ""
    });
    await sincronizarRegistroEstudianteClase(clase.id, clase.id, {
      ownerUid: clase.ownerUid || "",
      ownerEmail: clase.ownerEmail || "",
      name: perfilActual?.displayName || usuarioActual.displayName || ""
    });
  } finally {
    autoClassEnrollmentInProgress = false;
  }
  await guardarEstadoRemoto();
  await cargarPermisosRemotos([grupoActivo]);
  aplicarBancoNivelMedio();
  escucharPermisosGrupo(grupoActivo);
  escucharMembresiaClase(grupoActivo);
  return true;
}

async function estudianteYaInscritoEnAula(classId, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!classId || !normalized) return false;
  const direct = await getDoc(doc(db, "classStudents", `${classId}_${safeEmailId(normalized)}`)).catch(() => null);
  return !!direct?.exists?.();
}

async function crearInvitacionClase(clase, { email, name = "" }) {
  const inviteToken = generarTokenSeguro();
  const id = `${clase.id}_${safeEmailId(email)}`;
  const alreadyMember = await getDoc(doc(db, "classStudents", id)).catch(() => null);
  if (alreadyMember?.exists?.()) {
    const err = new Error("Estudiante ya inscrito en el aula.");
    err.code = "student-already-in-class";
    throw err;
  }
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
    institutionDane: clase.institutionDane || perfilActual?.institutionDane || "",
    institutionName: clase.institutionName || perfilActual?.institutionName || "",
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
  if (invite.institutionDane) {
    await setDoc(doc(db, "institutionMembers", memberDocId(invite.institutionDane, usuarioActual.email)), {
      userUid: usuarioActual.uid,
      displayName: perfilActual?.displayName || usuarioActual.displayName || invite.studentName || "",
      status: "active",
      registeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      classId: clase.id,
      className: clase.name,
      classCode: clase.code,
      classOwnerUid: clase.ownerUid || invite.ownerUid || invite.teacherUid || "",
      classOwnerEmail: clase.ownerEmail || invite.teacherEmail || ""
    }, { merge: true }).catch(() => {});
  }
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
  mostrarWarn(`Te uniste al aula ${clase.name}.`, "ok");
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
  unsubscribeClassMembership = onSnapshot(doc(db, "classStudents", id), async snap => {
    if (snap.exists()) {
      if (snap.data().status === "bloqueado") {
        classMembershipValid = false;
        limpiarIntentoActivo();
        detenerListenersComunicacion();
        aplicarModoUsuario();
        activarNav("perfil");
        const status = document.getElementById("profileStatus");
        if (status) {
          status.textContent = "Tu acceso a esta aula fue bloqueado por el profesor.";
          status.className = "bank-status error";
        }
        return;
      }
      const estabaBloqueado = !classMembershipValid;
      classMembershipValid = true;
      if (estabaBloqueado) {
        await cargarPerfilUsuario().catch(() => {});
        iniciarListenersComunicacion();
        aplicarModoUsuario();
        activarNav("inicio");
      }
      return;
    }
    if (grupoActivo === classId && !autoClassEnrollmentInProgress) {
      limpiarAulaLocalYRemota();
    }
  }, err => console.warn("No se pudo escuchar la matrícula del aula.", err));
}

async function loginEmail() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const expectedType = document.getElementById("loginAccountType")?.value || "";
  setStatus("loginStatus", "");
  if (!expectedType) {
    setStatusTemporal("loginStatus", "Selecciona primero el tipo de cuenta.", "error", 5000);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatusTemporal("loginStatus", "Usuario no encontrado. Debe primero crear una cuenta.", "error", 5000);
    return;
  }
  if (!password) {
    setStatusTemporal("loginStatus", "Correo o contraseña incorrecta.", "error", 5000);
    return;
  }
  try {
    setPendingLoginType(expectedType);
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const profile = snap.exists() ? snap.data() : {};
    if (!snap.exists()) {
      await signOut(auth);
      clearPendingLoginType();
      setStatusTemporal("loginStatus", "Usuario no encontrado. Debe primero crear una cuenta.", "error", 5000);
      return;
    }
    if (requiereVerificacionEmail(cred.user, profile) && cred.user.email?.toLowerCase() !== ADMIN_EMAIL) {
      let reenviado = false;
      try {
        await enviarVerificacionEmailPersonalizada(email);
        reenviado = true;
      } catch (mailErr) {
        console.warn("No se pudo reenviar verificación al iniciar sesión.", mailErr);
      }
      suppressAuthResetOnce = true;
      await signOut(auth);
      clearPendingLoginType();
      setStatusTemporal("loginStatus", reenviado
        ? "Debe verificar primero su cuenta. Por favor, revisa tu correo registrado."
        : "Debe verificar primero su cuenta. Por favor, revisa tu correo registrado.", "error", 5000);
      return;
    }
    if (!loginCoincideConTipo(profile, expectedType, cred.user.email)) {
      const message = "Tipo de cuenta equivocado. Selecciona el tipo de cuenta correcto e intenta nuevamente.";
      loginRejectMessagePending = message;
      await signOut(auth);
      clearPendingLoginType();
      setStatusTemporal("loginStatus", message, "error", 5000);
      return;
    }
  } catch (err) {
    clearPendingLoginType();
    const code = err?.code || "";
    const message = code.includes("user-not-found")
      ? "Usuario no encontrado. Debe primero crear una cuenta."
      : code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login-credentials")
        ? "Correo o contraseña incorrecta."
        : "Correo o contraseña incorrecta.";
    setStatusTemporal("loginStatus", message, "error", 5000);
  }
}

function loginCoincideConTipo(profile, expectedType, email = "") {
  const normalizedEmail = String(email || profile.email || "").toLowerCase();
  const role = profile.role || profile.tipoCuenta || "";
  const institutional = profile.accountMode === "institutional" || !!profile.institutionDane;
  if (normalizedEmail === ADMIN_EMAIL) {
    return expectedType === "teacher" || (expectedType === "institution" && role === "institution");
  }
  if (expectedType === "institution") return role === "institution";
  if (expectedType === "teacher") return role === "teacher";
  if (expectedType === "institutionalStudent") return role === "student" && institutional;
  return role === "student" && !institutional;
}

function actualizarLoginAccountType() {
  const type = document.getElementById("loginAccountType")?.value || "";
  const typeStep = document.getElementById("loginTypeStep");
  const typeStepVisible = !!typeStep && !typeStep.classList.contains("hidden");
  const googleActions = document.getElementById("btnGoogleLogin")?.closest(".auth-actions");
  const divider = document.querySelector(".auth-divider");
  const googleButton = document.getElementById("btnGoogleLogin");
  const showGoogle = !typeStepVisible && !!type && (
    (authIntent === "login" && type !== "institution") ||
    (authIntent === "register" && type === "independentStudent")
  );
  googleActions?.classList.toggle("hidden", !showGoogle);
  divider?.classList.toggle("hidden", !showGoogle);
  if (googleButton) {
    googleButton.textContent = authIntent === "register" ? "Registrarme con Google" : "Entrar con Google";
  }
}

function mensajeTipoCuentaNoAutorizado(expectedType) {
  if (expectedType === "teacher") return "No estás autorizado como profesor por ninguna institución.";
  if (expectedType === "institution") return "Este correo no corresponde a una institución educativa registrada.";
  if (expectedType === "institutionalStudent") return "Este correo no está autorizado como estudiante asociado a una institución.";
  return "Este correo no corresponde a un estudiante independiente registrado.";
}

async function registrarEmail() {
  const nombre = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const accountType = document.getElementById("registerAccountType")?.value || "independent";
  const role = accountType === "institutionalTeacher" ? "teacher" : "student";
  const accountMode = accountType === "independent" ? "independent" : "institutional";
  const institutionDane = normalizarDane(document.getElementById("registerInstitutionDane")?.value || "");
  const perfilRegistro = perfilBasicoDesdeFormulario("register");
  if (nombre.length < 3) {
    mostrarWarn("Escribe un nombre de usuario de mínimo 3 caracteres.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    mostrarWarn("Escribe un correo electrónico válido.");
    return;
  }
  if (email === ADMIN_EMAIL && role !== "teacher") {
    mostrarWarn("Este correo pertenece al dueño de la app. Debe registrarse o ingresar como profesor.");
    return;
  }
  if (accountMode === "independent" && !email.endsWith("@gmail.com")) {
    mostrarWarn("Para estudiante independiente solo se permiten correos @gmail.com.");
    return;
  }
  let institucionRegistro = null;
  let miembroInstitucional = null;
  if (accountMode === "institutional" && !institutionDane) {
    mostrarWarn("Escribe el código DANE de la institución.");
    return;
  }
  document.getElementById("registerRole").value = role;
  document.getElementById("registerAccountMode").value = accountMode;
  if (accountMode === "independent" && !email.endsWith("@gmail.com")) {
    mostrarWarn("Solo se permiten correos @gmail.com.");
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
  if (accountMode === "institutional") {
    miembroInstitucional = await buscarMiembroInstitucional(email, institutionDane).catch(() => null);
    if (!miembroInstitucional || miembroInstitucional.role !== role || miembroInstitucional.status === "removed" || miembroInstitucional.status === "blocked") {
      mostrarWarn(role === "teacher"
        ? "Tu correo no aparece autorizado como profesor activo de esta institución."
        : "Tu correo no aparece autorizado como estudiante activo de esta institución.");
      return;
    }
    const institutionState = await institucionTienePlanActivo(institutionDane);
    institucionRegistro = institutionState.data;
    if (!institutionState.active) {
      mostrarWarn("La institución aún no tiene una suscripción activa. Comunícate con rectoría o coordinación.");
      return;
    }
  }
  try {
    registroEnCurso = true;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });
    if (accountMode !== "institutional") {
      const miembroExistente = await buscarMiembroInstitucionalPorEmail(email);
      if (miembroExistente && miembroExistente.status !== "removed" && miembroExistente.status !== "blocked") {
        const institutionState = await institucionTienePlanActivo(miembroExistente.institutionDane);
        if (institutionState.active) {
          await deleteUser(cred.user).catch(() => {});
          registroEnCurso = false;
          mostrarWarn(`Este correo está registrado por medio de la institución ${miembroExistente.institutionName || institutionState.data?.institutionName || "asociada"}. Debes registrarte como estudiante por institución.`);
          return;
        }
      }
    }
    await guardarPerfilUsuario({
      uid: cred.user.uid,
      email,
      displayName: nombre,
      role,
      tipoCuenta: role,
      accountMode,
      billingMode: accountMode,
      institutionStatus: accountMode === "institutional" ? "active" : "",
      institutionMemberStatus: accountMode === "institutional" ? "active" : "",
      institutionDane: accountMode === "institutional" ? institutionDane : "",
      institutionName: accountMode === "institutional" ? (miembroInstitucional?.institutionName || institucionRegistro?.institutionName || "") : "",
      institutionOwnerUid: accountMode === "institutional" ? (miembroInstitucional?.ownerUid || institucionRegistro?.ownerUid || "") : "",
      classId: accountMode === "institutional" ? (miembroInstitucional?.classId || "") : "",
      className: accountMode === "institutional" ? (miembroInstitucional?.className || "") : "",
      classCode: accountMode === "institutional" ? (miembroInstitucional?.classCode || "") : "",
      classOwnerUid: accountMode === "institutional" ? (miembroInstitucional?.classOwnerUid || miembroInstitucional?.ownerUid || "") : "",
      classOwnerEmail: accountMode === "institutional" ? (miembroInstitucional?.classOwnerEmail || miembroInstitucional?.ownerEmail || "") : "",
      grupo: accountMode === "institutional" && role === "student" ? (miembroInstitucional?.classId || "") : (role === "teacher" ? "admin" : ""),
      institutionSubscriptionStatus: accountMode === "institutional" ? "active" : "",
      subscriptionInherited: accountMode === "institutional",
      isAdmin: email === ADMIN_EMAIL,
      phoneVerified: false,
      emailVerificationRequired: true,
      emailVerificationStatus: "pending",
      authProvider: "password",
      ...perfilRegistro
    });
    if (accountMode === "institutional" && miembroInstitucional) {
      await updateDoc(doc(db, "institutionMembers", miembroInstitucional.id), {
        userUid: cred.user.uid,
        displayName: nombre,
        status: "active",
        registeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        classId: miembroInstitucional?.classId || "",
        className: miembroInstitucional?.className || "",
        classCode: miembroInstitucional?.classCode || "",
        classOwnerUid: miembroInstitucional?.classOwnerUid || miembroInstitucional?.ownerUid || "",
        classOwnerEmail: miembroInstitucional?.classOwnerEmail || miembroInstitucional?.ownerEmail || ""
      });
      const inviteId = (miembroInstitucional.classId || "") + "_" + safeEmailId(email);
      if (miembroInstitucional.classId) {
        await setDoc(doc(db, "classInvites", inviteId), {
          status: "accepted",
          acceptedAt: serverTimestamp(),
          acceptedByUid: cred.user.uid,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    }
    await enviarVerificacionEmailPersonalizada(email);
    await signOut(auth);
    registroEnCurso = false;
    volverSelectorAuth("login");
    mostrarWarn("Cuenta creada. Te enviamos un correo de verificación; abre el enlace y luego inicia sesión.", "ok");
  } catch (err) {
    registroEnCurso = false;
    if (err?.code === "auth/email-already-in-use") {
      mostrarErrorAuth("Usuario ya registrado, por favor inicie sesión.");
      return;
    }
    mostrarErrorAuth("No se pudo registrar ese correo.");
  }
}

async function loginGoogle() {
  const expectedType = document.getElementById("loginAccountType")?.value || "";
  const googleButton = document.getElementById("btnGoogleLogin");
  if (!expectedType) {
    mostrarErrorAuth("Selecciona primero el tipo de cuenta.");
    return;
  }
  if (expectedType === "institution") {
    mostrarErrorAuth("Las instituciones educativas deben ingresar únicamente con correo y contraseña.");
    return;
  }
  if (authIntent === "register" && expectedType !== "independentStudent") {
    mostrarErrorAuth("Este tipo de cuenta debe registrarse manualmente con el código DANE institucional.");
    return;
  }
  try {
    googleAuthFlowInProgress = true;
    mostrarReloadSesion();
    setButtonLoading(googleButton, true, authIntent === "register" ? "Registrando..." : "Ingresando...");
    if (authIntent === "login") setPendingLoginType(expectedType);
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const profile = snap.exists() ? snap.data() : {};
    if (authIntent === "register" && expectedType === "independentStudent" && !snap.exists()) {
      clearPendingLoginType();
      await registrarIndependienteGoogle(cred.user);
      await prepararSesionAutenticada();
      ocultarReloadSesion();
      return;
    }
    if (authIntent === "register" && expectedType === "independentStudent" && snap.exists()) {
      suppressAuthResetOnce = true;
      await signOut(auth);
      clearPendingLoginType();
      ocultarReloadSesion();
      mostrarErrorAuth("Usuario ya registrado, por favor inicie sesión.");
      return;
    }
    if (!snap.exists()) {
      suppressAuthResetOnce = true;
      await signOut(auth);
      clearPendingLoginType();
      ocultarReloadSesion();
      mostrarLoginConError("Usuario no encontrado. Debe primero crear una cuenta.");
      return;
    }
    if (requiereVerificacionEmail(cred.user, profile) && cred.user.email?.toLowerCase() !== ADMIN_EMAIL) {
      let reenviado = false;
      try {
        await enviarVerificacionEmailPersonalizada(cred.user.email || "");
        reenviado = true;
      } catch (mailErr) {
        console.warn("No se pudo reenviar verificación al iniciar sesión.", mailErr);
      }
      suppressAuthResetOnce = true;
      await signOut(auth);
      clearPendingLoginType();
      setStatusTemporal("loginStatus", reenviado
        ? "Debe verificar primero su cuenta. Por favor, revisa tu correo registrado."
        : "Debe verificar primero su cuenta. Por favor, revisa tu correo registrado.", "error", 5000);
      return;
    }
    if (!loginCoincideConTipo(profile, expectedType, cred.user.email)) {
      suppressAuthResetOnce = true;
      await signOut(auth);
      clearPendingLoginType();
      ocultarReloadSesion();
      mostrarLoginConError(expectedType === "independentStudent"
        ? "Google solo puede usarse con un correo ya registrado como estudiante independiente."
        : mensajeTipoCuentaNoAutorizado(expectedType));
      return;
    }
    if (["institutionalStudent", "teacher"].includes(expectedType)) {
      const dane = normalizarDane(profile.institutionDane || "");
      const expectedRole = expectedType === "teacher" ? "teacher" : "student";
      const member = await buscarMiembroInstitucional((cred.user.email || "").toLowerCase(), dane).catch(() => null);
      const autorizado = dane && member && member.role === expectedRole && !["removed", "blocked"].includes(member.status || "");
      if (!autorizado) {
        suppressAuthResetOnce = true;
        await signOut(auth).catch(() => {});
        clearPendingLoginType();
        ocultarReloadSesion();
        mostrarLoginConError(expectedType === "teacher"
          ? "Tu correo no aparece autorizado como profesor activo de esta institución."
          : "Tu correo no aparece autorizado como estudiante activo de esta institución.");
        return;
      }
    }
    clearPendingLoginType();
    await guardarDatosGoogleIniciales(cred.user);
    await prepararSesionAutenticada();
    ocultarReloadSesion();
  } catch (err) {
    ocultarReloadSesion();
    clearPendingLoginType();
    const code = err?.code || "";
    const message = code.includes("account-exists-with-different-credential") || code.includes("credential-already-in-use")
      ? "Este correo ya está registrado con contraseña. Ingresa con correo y contraseña; después podrás vincular Google desde tu perfil."
      : "No se pudo ingresar con Google.";
    mostrarLoginErrorTemporal("loginStatus", message);
  } finally {
    googleAuthFlowInProgress = false;
    setButtonLoading(googleButton, false);
  }
}

async function registrarIndependienteGoogle(user) {
  const email = (user.email || "").toLowerCase();
  if (email === ADMIN_EMAIL) {
    await signOut(auth);
    mostrarErrorAuth("Este correo pertenece al dueño de la app. Debe ingresar como profesor.");
    return;
  }
  if (!email.endsWith("@gmail.com")) {
    await signOut(auth);
    mostrarErrorAuth("Para estudiante independiente con Google debes usar un correo @gmail.com.");
    return;
  }
  const miembroExistente = await buscarMiembroInstitucionalPorEmail(email);
  if (miembroExistente) {
    const institutionState = await institucionTienePlanActivo(miembroExistente.institutionDane);
    if (institutionState.active) {
      await signOut(auth);
      mostrarErrorAuth(`Este correo está registrado por medio de la institución ${miembroExistente.institutionName || institutionState.data?.institutionName || "asociada"}. Debes registrarte como estudiante por institución.`);
      return;
    }
  }
  await guardarPerfilUsuario({
    uid: user.uid,
    email,
    displayName: user.displayName || "",
    photoData: user.photoURL || "",
    photoFullURL: fotoPerfilAltaCalidad(user.photoURL || ""),
    role: "student",
    tipoCuenta: "student",
    accountMode: "independent",
    billingMode: "independent",
    authProvider: "google.com"
  });
  mostrarWarn("Cuenta independiente creada con Google. Completa tu perfil y suscripción para activar todos los beneficios.", "ok");
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
    photoFullURL: existente.photoFullURL || perfilActual?.photoFullURL || fotoPerfilAltaCalidad(googleProvider?.photoURL || user.photoURL || ""),
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus("forgotPasswordStatus", "Escribe tu correo registrado.", "error");
    return;
  }
  try {
    const response = await fetchConAppCheck(APP_CONFIG.passwordResetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error(await response.text());
    const input = document.getElementById("forgotPasswordEmail");
    if (input) input.value = "";
    setStatus("forgotPasswordStatus", "Te enviamos un correo para restablecer la contraseña desde Matemáticas En Tu Bolsillo.");
  } catch {
    setStatus("forgotPasswordStatus", "No se pudo enviar la recuperación. Revisa el correo.", "error");
  }
}

async function enviarVerificacionEmailPersonalizada(email) {
  const response = await fetchConAppCheck(APP_CONFIG.emailVerificationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (!response.ok) throw new Error(await response.text());
}

function abrirPanelRecuperarPassword() {
  limpiarCamposPublicos("loginCard");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.remove("hidden");
  document.getElementById("forgotPasswordPanel")?.classList.remove("hidden");
  document.getElementById("forgotPasswordEmail").value = "";
  setStatus("forgotPasswordStatus", "");
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("forgotPasswordCard");
}

function abrirPanelRecuperarUsuario() {
  limpiarCamposPublicos("loginCard");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.remove("hidden");
  document.getElementById("recoverEmailPanel")?.classList.remove("hidden");
  poblarPhoneCodes("recoverPhoneCode", document.getElementById("recoverPhoneCode")?.value || "+57");
  const backBtn = document.getElementById("btnRecoverBack");
  if (backBtn) backBtn.textContent = "Volver al inicio de sesión";
  setRecoverStep(1);
  setStatus("recoverStatus", "");
  mostrarSoporteRecuperacion(false);
  actualizarBloqueoScrollPublico();
  enfocarModalPublico("forgotUserCard");
}

function mostrarSeleccionRol() {
  document.body.classList.add("group-locked");
  document.getElementById("loginCard")?.classList.add("hidden");
  document.getElementById("forgotUserCard")?.classList.add("hidden");
  document.getElementById("forgotPasswordCard")?.classList.add("hidden");
  document.getElementById("roleChoiceCard")?.classList.remove("hidden");
  setStatus("roleChoiceStatus", "");
  actualizarBloqueoScrollPublico();
}

async function guardarRolUsuario(role) {
  if (role !== "student") return;
  setStatus("roleChoiceStatus", "Guardando tipo de cuenta...");
  await guardarPerfilUsuario({
    role: "student",
    tipoCuenta: "student",
    accountMode: "independent",
    billingMode: "independent",
    isAdmin: false,
    grupo: grupoActivo || ""
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
  actualizarBloqueoScrollPublico();
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
  if (!widget || !landingPublicaActiva()) return;
  ajustarWhatsappAlBorde();
  ajustarLadoWhatsapp();
  const abierto = !widget.classList.contains("open");
  widget.classList.toggle("open", abierto);
  btn?.setAttribute("aria-expanded", String(abierto));
  if (abierto) asegurarTarjetaWhatsappVisible();
}

function cerrarWhatsappWidget() {
  const widget = document.getElementById("whatsappWidget");
  widget?.classList.remove("open");
  document.getElementById("btnWhatsappInfo")?.setAttribute("aria-expanded", "false");
}

function ajustarLadoWhatsapp() {
  const widget = document.getElementById("whatsappWidget");
  if (!widget) return;
  const rect = widget.getBoundingClientRect();
  widget.classList.toggle("side-right", rect.left < window.innerWidth / 2);
}

function fijarWhatsappFlotante(widget, left, top) {
  if (!widget) return;
  widget.style.setProperty("--whatsapp-left", `${Math.round(left)}px`);
  widget.style.setProperty("--whatsapp-top", `${Math.round(top)}px`);
  widget.style.setProperty("--whatsapp-right", "auto");
  widget.style.setProperty("--whatsapp-bottom", "auto");
  widget.style.left = `${Math.round(left)}px`;
  widget.style.top = `${Math.round(top)}px`;
  widget.style.right = "auto";
  widget.style.bottom = "auto";
}

function asegurarTarjetaWhatsappVisible() {
  const widget = document.getElementById("whatsappWidget");
  if (!widget?.classList.contains("open")) return;
  requestAnimationFrame(() => {
    const card = document.getElementById("whatsappCard");
    if (!card) return;
    const widgetRect = widget.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const margen = 12;
    let nextTop = widgetRect.top;
    if (cardRect.top < margen) nextTop += margen - cardRect.top;
    if (cardRect.bottom > window.innerHeight - margen) nextTop -= cardRect.bottom - (window.innerHeight - margen);
    const maxTop = Math.max(margen, window.innerHeight - widgetRect.height - margen);
    nextTop = Math.min(Math.max(nextTop, margen), maxTop);
    if (Math.abs(nextTop - widgetRect.top) > 1) fijarWhatsappFlotante(widget, widgetRect.left, nextTop);
    ajustarLadoWhatsapp();
  });
}

function prepararWhatsappFlotante() {
  const widget = document.getElementById("whatsappWidget");
  if (!widget) return;
  if (widget.parentElement !== document.body) document.body.appendChild(widget);
  widget.style.position = "fixed";
  if (!widget.style.getPropertyValue("--whatsapp-right")) {
    widget.style.setProperty("--whatsapp-right", "max(1rem, env(safe-area-inset-right))");
    widget.style.setProperty("--whatsapp-bottom", "max(1rem, env(safe-area-inset-bottom))");
    widget.style.setProperty("--whatsapp-left", "auto");
    widget.style.setProperty("--whatsapp-top", "auto");
  }
  ajustarLadoWhatsapp();
}

function prepararBotonSubirFlotante() {
  const btn = document.getElementById("btnBackToTop");
  if (!btn) return;
  if (btn.parentElement !== document.body) document.body.appendChild(btn);
}

function ajustarWhatsappAlBorde() {
  const widget = document.getElementById("whatsappWidget");
  if (!widget) return;
  const rect = widget.getBoundingClientRect();
  const margen = 12;
  const x = rect.left + rect.width / 2 < window.innerWidth / 2
    ? margen
    : window.innerWidth - rect.width - margen;
  const y = Math.min(Math.max(rect.top, margen), Math.max(margen, window.innerHeight - rect.height - margen));
  fijarWhatsappFlotante(widget, Math.max(margen, x), y);
  evitarSolapamientoWhatsapp();
  ajustarLadoWhatsapp();
  asegurarTarjetaWhatsappVisible();
}

function evitarSolapamientoWhatsapp() {
  const widget = document.getElementById("whatsappWidget");
  const topButton = document.getElementById("btnBackToTop");
  if (!widget || !topButton || !topButton.classList.contains("visible")) return;
  const widgetRect = widget.getBoundingClientRect();
  const topRect = topButton.getBoundingClientRect();
  const overlaps = !(
    widgetRect.right < topRect.left - 10 ||
    widgetRect.left > topRect.right + 10 ||
    widgetRect.bottom < topRect.top - 10 ||
    widgetRect.top > topRect.bottom + 10
  );
  if (overlaps) {
    widget.style.top = `${Math.max(10, topRect.top - widgetRect.height - 14)}px`;
    widget.style.bottom = "auto";
  }
}

function activarArrastreWhatsapp() {
  const widget = document.getElementById("whatsappWidget");
  const btn = document.getElementById("btnWhatsappInfo");
  if (!widget || !btn) return;
  prepararWhatsappFlotante();

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
    const nextLeft = Math.min(Math.max(clientX - offsetX, margen), Math.max(margen, maxX));
    const nextTop = Math.min(Math.max(clientY - offsetY, margen), Math.max(margen, maxY));
    fijarWhatsappFlotante(widget, nextLeft, nextTop);
    ajustarLadoWhatsapp();
  };

  btn.addEventListener("pointerdown", e => {
    if (!landingPublicaActiva()) return;
    arrastrando = true;
    movido = false;
    const rect = widget.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    btn.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  btn.addEventListener("pointermove", e => {
    if (!arrastrando) return;
    movido = movido || Math.hypot(e.clientX - startX, e.clientY - startY) > 6;
    if (!movido) return;
    widget.classList.add("dragging");
    widget.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    ubicar(e.clientX, e.clientY);
    e.preventDefault();
  });
  const terminarArrastre = e => {
    if (!arrastrando) return;
    arrastrando = false;
    widget.classList.remove("dragging");
    btn.releasePointerCapture?.(e.pointerId);
    if (movido) ajustarWhatsappAlBorde();
    if (!movido) toggleWhatsappWidget();
  };
  btn.addEventListener("pointerup", terminarArrastre);
  btn.addEventListener("pointercancel", terminarArrastre);
  btn.addEventListener("lostpointercapture", terminarArrastre);
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
  const normalized = normalizeLatexText(text)
    .replace(/\\([0-9]+)\s*por\\text\{([^}]+)\}\^2/gi, "$1 por $2^2")
    .replace(/\\([0-9]+)\s*por/gi, "$1 por")
    .replace(/\byelmaterial\b/gi, "y el material")
    .replace(/\byla\b/gi, "y la")
    .replace(/\byel\b/gi, "y el");
  const html = escapeHtml(normalized)
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
  if (!exigirAccesoAsesor("Activa Premium para conversar con el Asesor IA.")) return;
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
  if (status) {
    status.textContent = "El Asesor IA está pensando...";
    status.classList.add("is-thinking");
  }
  try {
    const history = advisorMessages
      .filter(msg => msg.sender === "bot" || msg.sender === "user")
      .slice(-12)
      .map(msg => ({ role: msg.sender === "bot" ? "model" : "user", parts: [{ text: msg.text }] }));
    const response = await authedFetch(APP_CONFIG.asesorEndpoint, {
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
      text: err.message || "No pude conectar con el Asesor IA en este momento. Intenta nuevamente en unos minutos."
    });
  } finally {
    advisorLoading = false;
    if (status) {
      status.textContent = "";
      status.classList.remove("is-thinking");
    }
    renderAsesorMessages();
  }
}

function abrirAsesorIA() {
  if (!exigirAccesoAsesor("Activa Premium para conversar con el Asesor IA.")) return;
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
  document.getElementById("loginTypeStep")?.classList.add("hidden");
  document.querySelector(".auth-tabs")?.classList.add("hidden");
  document.getElementById("loginPanel").classList.toggle("hidden", !login);
  document.getElementById("registerPanel").classList.toggle("hidden", login);
  document.getElementById("recoverEmailPanel")?.classList.add("hidden");
  document.getElementById("tabLogin").classList.toggle("active", login);
  document.getElementById("tabRegister").classList.toggle("active", !login);
  document.getElementById("tabInstitutionRegister")?.classList.remove("active");
  if (!login) inicializarRegistroPerfil();
  actualizarLoginAccountType();
  limpiarWarn();
}

function continuarLoginType() {
  const type = document.getElementById("loginAccountType")?.value || "";
  if (!type) {
    setStatus("loginTypeStatus", "Selecciona primero el tipo de cuenta.", "error");
    return;
  }
  setStatus("loginTypeStatus", "");
  if (authIntent === "register") {
    if (type === "institution") {
      mostrarInstitutionInfo();
      return;
    }
    sincronizarRegistroConTipoLogin(type);
    cambiarAuthMode("register");
    actualizarLoginAccountType();
    return;
  }
  document.getElementById("loginTypeStep")?.classList.add("hidden");
  document.querySelector(".auth-tabs")?.classList.remove("hidden");
  cambiarAuthMode("login");
  actualizarLoginAccountType();
}

function sincronizarRegistroConTipoLogin(type) {
  const registerType = document.getElementById("registerAccountType");
  const dane = document.getElementById("registerInstitutionDane");
  const hint = document.getElementById("registerInstitutionHint");
  const email = document.getElementById("registerEmail");
  const role = document.getElementById("registerRole");
  const mode = document.getElementById("registerAccountMode");
  const label = document.getElementById("registerSelectedTypeLabel");
  const institutional = type === "institutionalStudent" || type === "teacher";
  const registerValue = type === "teacher" ? "institutionalTeacher" : (institutional ? "institutional" : "independent");
  if (registerType) registerType.value = registerValue;
  if (role) role.value = type === "teacher" ? "teacher" : "student";
  if (mode) mode.value = institutional ? "institutional" : "independent";
  dane?.classList.toggle("hidden", !institutional);
  hint?.classList.toggle("hidden", !institutional);
  if (email) email.placeholder = institutional ? "Correo autorizado por la institución" : "Correo @gmail.com";
  if (label) {
    label.textContent = type === "teacher"
      ? "Registro de profesor autorizado por una institución. Usa el correo registrado por el colegio."
      : institutional
        ? "Registro de estudiante asociado a una institución. Usa el correo y el código DANE autorizados por el colegio."
        : "Registro de estudiante independiente. Este acceso requiere suscripción individual.";
  }
}

function volverSelectorAuth(intent = authIntent) {
  document.getElementById("loginCard")?.classList.remove("hidden");
  limpiarLoginCredenciales();
  mostrarAuthInicial(intent);
  document.getElementById("loginCard")?.classList.remove("hidden");
  actualizarBloqueoScrollPublico();
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
  const status = document.getElementById("profileStatus");
  const nombre = document.getElementById("profileName")?.value.trim() || "";
  const datos = {
    ...perfilBasicoDesdeFormulario("profile"),
    displayName: nombre
  };
  if (esInstitucion()) {
    delete datos.birthDate;
    delete datos.gender;
  }
  const requiredFields = esInstitucion()
    ? ["displayName", "country", "region", "city"]
    : ["displayName", "birthDate", "gender", "country", "region", "city"];
  const missingRequired = requiredFields.some(key => !String(datos[key] || "").trim());
  if (nombre.length < 3 || missingRequired) {
    setStatusTemporal("profileStatus", "Completa todos los campos obligatorios del perfil.", "error");
    return;
  }
  await updateProfile(usuarioActual, { displayName: nombre });
  await guardarPerfilUsuario(datos);
  renderProfile();
  actualizarBienvenida();
  setStatusTemporal("profileStatus", "Perfil actualizado.", "ok");
}

function actualizarPanelGooglePerfil() {
  const panel = document.getElementById("googleLinkPanel");
  const btn = document.getElementById("btnLinkGoogleProvider");
  const help = document.getElementById("googleLinkHelp");
  if (!panel) return;
  const hidden = !usuarioActual || esInstitucion(perfilActual);
  panel.classList.toggle("hidden", hidden);
  if (hidden) return;
  const linked = tieneGoogleVinculado();
  if (btn) {
    btn.disabled = linked;
    btn.textContent = linked ? "Google vinculado" : "Vincular Google";
  }
  if (help) {
    help.textContent = linked
      ? "Ya puedes usar el botón de Google para iniciar sesión con este mismo correo."
      : "Vincula tu correo con Google para poder usar el botón de Google en próximos ingresos.";
  }
}

async function vincularGoogleDesdePerfil() {
  const btn = document.getElementById("btnLinkGoogleProvider");
  if (!usuarioActual) return;
  if (esInstitucion(perfilActual)) {
    setStatusTemporal("googleLinkStatus", "Las instituciones ingresan únicamente con correo y contraseña.", "error");
    return;
  }
  if (tieneGoogleVinculado()) {
    setStatusTemporal("googleLinkStatus", "Google ya está vinculado a esta cuenta.", "ok");
    return;
  }
  try {
    setButtonLoading(btn, true, "Vinculando...");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: usuarioActual.email || "" });
    const result = await linkWithPopup(usuarioActual, provider);
    await guardarDatosGoogleIniciales(result.user);
    await cargarPerfilUsuario();
    renderProfile();
    setStatusTemporal("googleLinkStatus", "Google quedó vinculado correctamente.", "ok");
  } catch (err) {
    console.error("No se pudo vincular Google.", err);
    const code = err?.code || "";
    let msg = "No se pudo vincular Google. Intenta nuevamente.";
    if (code.includes("popup-closed")) msg = "No se completó la vinculación con Google.";
    if (code.includes("credential-already-in-use")) msg = "Ese correo de Google ya está vinculado a otra cuenta.";
    if (code.includes("provider-already-linked")) msg = "Google ya está vinculado a esta cuenta.";
    if (code.includes("requires-recent-login")) msg = "Por seguridad debes cerrar sesión, volver a ingresar y vincular Google nuevamente.";
    setStatusTemporal("googleLinkStatus", msg, "error");
  } finally {
    setButtonLoading(btn, false);
    actualizarPanelGooglePerfil();
  }
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

function procesarFotoPerfil(file, maxSide, quality, output = "dataUrl") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (output === "blob") {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("No se pudo convertir la imagen."));
          }, "image/jpeg", quality);
          return;
        }
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function comprimirFotoPerfil(file) {
  return procesarFotoPerfil(file, PROFILE_PHOTO_MAX_SIDE, PROFILE_PHOTO_QUALITY);
}

function comprimirFotoPerfilAlta(file) {
  return procesarFotoPerfil(file, PROFILE_PHOTO_FULL_MAX_SIDE, PROFILE_PHOTO_FULL_QUALITY, "blob");
}

async function subirFotoPerfilAlta(file) {
  if (!usuarioActual?.uid) return {};
  const blob = await comprimirFotoPerfilAlta(file);
  const path = `profilePhotos/${usuarioActual.uid}/profile.jpg`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, {
    contentType: "image/jpeg",
    customMetadata: { ownerUid: usuarioActual.uid }
  });
  return {
    photoFullURL: await getDownloadURL(ref),
    photoStoragePath: path
  };
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
    const fotoAlta = await subirFotoPerfilAlta(file).catch(err => {
      console.warn("No se pudo subir la foto en alta calidad.", err);
      return {};
    });
    await guardarPerfilUsuario({ photoData, ...fotoAlta });
    renderProfile();
    status.textContent = fotoAlta.photoFullURL
      ? "Foto actualizada."
      : "Foto actualizada. La vista ampliada usará la versión optimizada local.";
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
    setTimeout(() => {
      const status = document.getElementById("phoneStatus");
      if (status?.textContent === "Teléfono verificado correctamente.") {
        status.textContent = "";
        status.className = "bank-status";
      }
    }, 5000);
  } catch {
    setPhoneStatus("Código inválido o verificación no aceptada por Firebase.", "error");
  }
}

async function estudianteCambiarClase() {
  const status = document.getElementById("settingsClassStatus");
  if (!modoAdmin) {
    if (status) {
      status.textContent = esEstudianteIndependiente()
        ? `Tu aula independiente se asigna automáticamente: ${INDEPENDENT_CLASS_NAME}.`
        : "Los estudiantes asociados a una institución deben solicitar al profesor o a la institución el ingreso al aula.";
      status.className = "bank-status error";
    }
    return;
  }
  if (!exigirSuscripcion("Necesitas una suscripción activa para ingresar o cambiar de aula.")) return;
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
  try {
    await crearInvitacionClase(aula, { email });
    status.textContent = `Invitación enviada a ${email} para unirse a ${aula.name}.`;
    status.className = "bank-status success";
  } catch (err) {
    status.textContent = err?.code === "student-already-in-class" ? "Estudiante ya inscrito en el aula." : "No fue posible crear la invitación.";
    status.className = "bank-status error";
  }
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
    if (status) {
      status.textContent = "Agrega correos Gmail válidos y selecciona aula.";
      status.className = "bank-status error";
    }
    return;
  }
  const duplicatedAccepted = [];
  for (const student of unique) {
    if (await estudianteYaInscritoEnAula(claseId, student.email)) duplicatedAccepted.push(student.email);
  }
  if (duplicatedAccepted.length) {
    if (status) {
      status.textContent = "Estudiante ya inscrito en el aula.";
      status.className = "bank-status error";
    }
    return;
  }
  if (status) status.textContent = "Creando invitaciones...";
  if (esProfesorInstitucional()) {
    await crearSolicitudInstitucional("add-students", {
      classId: clase.id,
      className: clase.name,
      classCode: clase.code || "",
      classOwnerUid: clase.ownerUid || usuarioActual.uid,
      classOwnerEmail: clase.ownerEmail || usuarioActual.email || "",
      students: unique
    });
    if (status) setStatusTemporal("adminStudentsStatus", `${unique.length} solicitud(es) enviada(s) a la institución para aprobación.`, "success", 5000);
    return;
  }
  try {
    await Promise.all(unique.map(student => crearInvitacionClase(clase, student)));
  } catch (err) {
    if (status) {
      status.textContent = err?.code === "student-already-in-class" ? "Estudiante ya inscrito en el aula." : "No fue posible crear las invitaciones.";
      status.className = "bank-status error";
    }
    return;
  }
  if (status) {
    status.textContent = `${unique.length} invitación(es) enviada(s) para ${clase.name}.`;
    status.className = "bank-status success";
  }
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
  if (esProfesorInstitucional()) {
    const response = await authedFetch(APP_CONFIG.removeInstitutionStudentEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      mostrarErrorAuth(result.error || "No fue posible eliminar el estudiante institucional.");
      return;
    }
    mostrarWarn(result.message || "Estudiante eliminado del aula.", "ok");
    await renderAdminStudentsByClass();
    return;
  }
  await aplicarEliminacionEstudianteRegistrado(id);
}
async function aplicarEliminacionEstudianteRegistrado(id) {
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

async function alternarBloqueoEstudiante(id, bloqueadoActual) {
  const ref = doc(db, "classStudents", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const estudiante = snap.data();
  const bloquear = !bloqueadoActual;
  const accion = bloquear ? "bloquear" : "desbloquear";
  if (!confirm(`¿Deseas ${accion} a ${estudiante.name || estudiante.email} en esta aula?`)) return;
  if (estudiante.userUid) {
    await updateDoc(doc(db, "users", estudiante.userUid), {
      classAccessBlocked: bloquear,
      blockedClassId: bloquear ? estudiante.classId : "",
      updatedAt: serverTimestamp()
    }).catch(error => console.warn("No se pudo sincronizar el bloqueo en el perfil.", error));
  }
  await updateDoc(ref, {
    status: bloquear ? "bloqueado" : "activo",
    blockedAt: bloquear ? serverTimestamp() : null,
    blockedByUid: bloquear ? usuarioActual.uid : "",
    updatedAt: serverTimestamp()
  });
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

function requiereVerificacionEmail(user, profile = null) {
  if (!user?.providerData?.some(provider => provider.providerId === "password") || user.emailVerified) return false;
  return profile?.emailVerificationRequired === true;
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
  if (!confirmarCambioSeccion("salir")) return;
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
document.getElementById("loginAccountType")?.addEventListener("change", actualizarLoginAccountType);
document.getElementById("btnContinueLoginType")?.addEventListener("click", continuarLoginType);
document.getElementById("btnBackToLoginType")?.addEventListener("click", () => volverSelectorAuth("login"));
document.getElementById("btnRegisterBackToType")?.addEventListener("click", () => volverSelectorAuth("register"));
document.getElementById("btnRegisterGoLogin")?.addEventListener("click", () => volverSelectorAuth("login"));
document.getElementById("btnForgotPassword")?.addEventListener("click", abrirPanelRecuperarPassword);
document.getElementById("btnSendPasswordRecovery")?.addEventListener("click", recuperarPassword);
document.getElementById("btnForgotPasswordBack")?.addEventListener("click", volverLoginDesdeRecuperacion);
document.getElementById("btnRecoverPasswordClose")?.addEventListener("click", volverLoginDesdeRecuperacion);
configurarCamposProgramacionMovil();
window.addEventListener("resize", configurarCamposProgramacionMovil);
document.getElementById("btnShowLogin")?.addEventListener("click", mostrarLoginCard);
document.getElementById("btnShowLoginNav")?.addEventListener("click", mostrarLoginCard);
document.getElementById("btnShowLoginMenu")?.addEventListener("click", () => {
  cerrarLandingMenu();
  mostrarLoginCard();
});
document.getElementById("btnShowLoginBottom")?.addEventListener("click", mostrarLoginCard);
document.getElementById("btnShowRegister")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("btnShowRegisterTop")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("btnShowRegisterNav")?.addEventListener("click", () => {
  cerrarLandingMenu();
  mostrarRegisterCard();
});
document.getElementById("btnShowRegisterBottom")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("btnStudentPlanLanding")?.addEventListener("click", mostrarRegisterCard);
document.getElementById("tabInstitutionRegister")?.addEventListener("click", mostrarInstitutionInfo);
document.getElementById("btnInstitutionInfoHero")?.addEventListener("click", mostrarInstitutionInfo);
document.getElementById("btnInstitutionPlanLanding")?.addEventListener("click", mostrarInstitutionInfo);
document.getElementById("btnInstitutionFromRegister")?.addEventListener("click", mostrarInstitutionInfo);
document.getElementById("btnInstitutionFromRole")?.addEventListener("click", mostrarInstitutionInfo);
document.getElementById("btnInstitutionInfoClose")?.addEventListener("click", cerrarInstitutionInfo);
document.getElementById("btnInstitutionBack")?.addEventListener("click", () => {
  cerrarInstitutionInfo();
  volverSelectorAuth("register");
});
document.getElementById("institutionDepartment")?.addEventListener("change", actualizarCiudadesInstitucion);
document.getElementById("institutionCity")?.addEventListener("change", actualizarColegiosInstitucion);
document.getElementById("institutionSchool")?.addEventListener("change", sincronizarColegioInstitucional);
document.getElementById("btnCreateInstitutionAccount")?.addEventListener("click", crearCuentaInstitucional);
document.getElementById("institutionPassword")?.addEventListener("input", actualizarReglasPasswordInstitucion);
document.querySelectorAll("#institutionInfoCard input, #institutionInfoCard select").forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      crearCuentaInstitucional();
    }
  });
});
document.getElementById("btnOpenFaqMenu")?.addEventListener("click", mostrarFaqCard);
document.getElementById("btnOpenFaqBottom")?.addEventListener("click", mostrarFaqCard);
document.getElementById("btnOpenFaqFooter")?.addEventListener("click", mostrarFaqCard);
document.getElementById("btnFaqClose")?.addEventListener("click", cerrarFaqCard);
document.getElementById("registerRole")?.addEventListener("change", event => {
  const mode = document.getElementById("registerAccountMode");
  if (!mode) return;
  if (event.target.value === "teacher") mode.value = "institutional";
  if (event.target.value === "student" && !mode.value) mode.value = "independent";
});
document.getElementById("registerAccountType")?.addEventListener("change", event => {
  const institutional = event.target.value === "institutional" || event.target.value === "institutionalTeacher";
  const mode = document.getElementById("registerAccountMode");
  const role = document.getElementById("registerRole");
  const dane = document.getElementById("registerInstitutionDane");
  const hint = document.getElementById("registerInstitutionHint");
  const email = document.getElementById("registerEmail");
  if (mode) mode.value = institutional ? "institutional" : "independent";
  if (role) role.value = event.target.value === "institutionalTeacher" ? "teacher" : "student";
  dane?.classList.toggle("hidden", !institutional);
  hint?.classList.toggle("hidden", !institutional);
  if (email) email.placeholder = institutional ? "Correo autorizado por la institución" : "Correo @gmail.com";
});
document.getElementById("btnAuthClose")?.addEventListener("click", cerrarAuthCard);
["loginCard", "institutionInfoCard", "faqCard", "forgotPasswordCard", "forgotUserCard"].forEach(id => {
  document.getElementById(id)?.addEventListener("click", event => {
    if (event.target.id !== id) return;
    if (id === "loginCard") cerrarAuthCard();
    else if (id === "institutionInfoCard") cerrarInstitutionInfo();
    else if (id === "faqCard") cerrarFaqCard();
    else event.currentTarget.classList.add("hidden");
    actualizarBloqueoScrollPublico();
  });
});
document.getElementById("btnLandingMenu")?.addEventListener("click", toggleLandingMenu);
document.getElementById("btnLandingMenuClose")?.addEventListener("click", cerrarLandingMenu);
document.getElementById("landingMenuBackdrop")?.addEventListener("click", cerrarLandingMenu);
document.getElementById("btnAndroidPromoClose")?.addEventListener("click", () => {
  document.getElementById("androidPromo")?.classList.add("hidden");
  sessionStorage.setItem("androidPromoDismissed", "1");
});
if (sessionStorage.getItem("androidPromoDismissed") === "1") {
  document.getElementById("androidPromo")?.classList.add("hidden");
}
if (new URLSearchParams(window.location.search).get("verifyExpired") === "1") {
  abrirAuth("register");
  mostrarErrorAuth("El enlace de verificación caducó. Regístrate nuevamente para recibir un link nuevo.");
  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  actualizarBloqueoScrollPublico();
}
if (new URLSearchParams(window.location.search).get("resetExpired") === "1") {
  document.getElementById("forgotPasswordCard")?.classList.remove("hidden");
  document.getElementById("forgotPasswordPanel")?.classList.remove("hidden");
  setStatus("forgotPasswordStatus", "El enlace de cambio de contraseña caducó. Genera otro link nuevo desde la app.", "error");
  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  actualizarBloqueoScrollPublico();
}
activarEscenaMatematica();
document.querySelectorAll(".landing-nav a").forEach(link => {
  link.addEventListener("click", cerrarLandingMenu);
});
document.querySelectorAll(".footer-social a").forEach(link => {
  link.addEventListener("click", event => event.preventDefault());
});
const btnBackToTop = document.getElementById("btnBackToTop");
prepararBotonSubirFlotante();

function landingPublicaActiva() {
  return document.body.classList.contains("group-locked") && !usuarioActual && !modalPublicoAbierto();
}

function sincronizarControlesLanding() {
  const enLanding = landingPublicaActiva();
  const whatsapp = document.getElementById("whatsappWidget");
  const topButton = document.getElementById("btnBackToTop");
  whatsapp?.classList.toggle("landing-only-visible", enLanding);
  topButton?.classList.toggle("landing-only-visible", enLanding);
  if (!enLanding) {
    cerrarWhatsappWidget();
    whatsapp?.classList.remove("dragging");
    topButton?.classList.remove("visible");
    return;
  }
  prepararWhatsappFlotante();
  actualizarBotonSubirLanding();
}

function actualizarBotonSubirLanding() {
  const topButton = document.getElementById("btnBackToTop");
  const visible = landingPublicaActiva() && window.scrollY > Math.min(180, window.innerHeight * .22);
  topButton?.classList.toggle("visible", visible);
  if (visible) evitarSolapamientoWhatsapp();
}
window.addEventListener("scroll", sincronizarControlesLanding, { passive: true });
window.addEventListener("resize", () => {
  if (landingPublicaActiva()) ajustarWhatsappAlBorde();
  sincronizarControlesLanding();
}, { passive: true });
sincronizarControlesLanding();
btnBackToTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
function manejarClickPublicoDelegado(event) {
  const target = event.target.closest("button, a");
  if (!target) return;
  const id = target.id;
  const publicActions = new Map([
    ["btnShowLogin", mostrarLoginCard],
    ["btnShowLoginNav", mostrarLoginCard],
    ["btnShowLoginMenu", mostrarLoginCard],
    ["btnShowLoginBottom", mostrarLoginCard],
    ["btnShowRegister", mostrarRegisterCard],
    ["btnShowRegisterTop", mostrarRegisterCard],
    ["btnShowRegisterNav", mostrarRegisterCard],
    ["btnShowRegisterBottom", mostrarRegisterCard],
    ["btnStudentPlanLanding", mostrarRegisterCard],
    ["btnInstitutionInfoHero", mostrarInstitutionInfo],
    ["btnInstitutionPlanLanding", mostrarInstitutionInfo],
    ["btnOpenFaqMenu", mostrarFaqCard],
    ["btnOpenFaqBottom", mostrarFaqCard],
    ["btnOpenFaqFooter", mostrarFaqCard]
  ]);
  if (publicActions.has(id)) {
    event.preventDefault();
    event.stopPropagation();
    if (id.endsWith("Menu")) cerrarLandingMenu();
    publicActions.get(id)();
    return;
  }
  if (id === "btnLandingMenu") {
    event.preventDefault();
    event.stopPropagation();
    toggleLandingMenu();
    return;
  }
  if (id === "btnLandingMenuClose" || id === "landingMenuBackdrop") {
    event.preventDefault();
    event.stopPropagation();
    cerrarLandingMenu();
    return;
  }
  if (id === "btnBackToTop") {
    event.preventDefault();
    event.stopPropagation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

document.addEventListener("click", manejarClickPublicoDelegado, true);
document.getElementById("btnWhatsappClose")?.addEventListener("click", cerrarWhatsappWidget);
prepararWhatsappFlotante();
document.addEventListener("pointerdown", event => {
  const widget = document.getElementById("whatsappWidget");
  if (widget?.classList.contains("open") && !widget.contains(event.target)) {
    cerrarWhatsappWidget();
  }
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
document.getElementById("messageBody")?.addEventListener("beforeinput", saveRichSelection);
["input", "keyup", "mouseup", "focus", "touchend"].forEach(eventName => {
  document.getElementById("messageBody")?.addEventListener(eventName, () => setTimeout(() => {
    saveRichSelection();
    updateRichToolbarState();
  }, 0));
});
document.getElementById("messageBody")?.addEventListener("click", e => {
  if (e.target.closest?.("[data-rich-control]")) return;
  colocarCursorSiEditorVacio(e.currentTarget);
  setTimeout(() => {
    saveRichSelection();
    updateRichToolbarState();
  }, 0);
});
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
  });
});
document.querySelectorAll("[data-rich-color]").forEach(input => {
  input.addEventListener("input", e => execRich(e.target.dataset.richColor, e.target.value));
});
document.getElementById("messageAttachments")?.addEventListener("change", () => {
  renderPreviewAdjuntos("messageAttachments", "messageAttachmentPreview");
});
document.getElementById("messageReplyAttachments")?.addEventListener("change", () => {
  renderPreviewAdjuntos("messageReplyAttachments", "messageReplyAttachmentPreview");
});
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-remove-attachment]");
  if (!btn) return;
  quitarAdjuntoSeleccionado(btn.dataset.inputId, btn.dataset.previewId, btn.dataset.removeAttachment);
});
document.querySelectorAll("[data-rich-insert]").forEach(btn => {
  btn.addEventListener("click", () => ejecutarInsercionRica(btn.dataset.richInsert));
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
document.getElementById("btnCloseEquationEditor")?.addEventListener("click", () => {
  document.getElementById("equationOverlay")?.classList.add("hidden");
  equationInsertTarget = "message";
});
document.getElementById("equationOverlay")?.addEventListener("pointerdown", e => {
  if (e.target.id === "equationOverlay") {
    e.currentTarget.classList.add("hidden");
    equationInsertTarget = "message";
  }
});
document.getElementById("equationInput")?.addEventListener("input", renderEquationPreview);
document.getElementById("equationPalette")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-eq-template]");
  const input = document.getElementById("equationInput");
  if (!btn || !input) return;
  const template = normalizarLatexPlantilla(btn.dataset.eqTemplate);
  insertIntoTextField(input, template, true);
  renderEquationPreview();
});
document.getElementById("btnInsertInlineEquation")?.addEventListener("click", () => insertarEcuacion(false));
document.getElementById("btnInsertBlockEquation")?.addEventListener("click", () => insertarEcuacion(true));
document.getElementById("btnBuildQuestionEquation")?.addEventListener("click", () => abrirEditorEcuacion("teacher-question"));
document.getElementById("btnBuildExplanationEquation")?.addEventListener("click", () => abrirEditorEcuacion("teacher-explanation"));
document.querySelectorAll("[data-inline-equation-target]").forEach(button => {
  button.addEventListener("click", () => {
    abrirEditorEcuacion(`inline-field:${button.dataset.inlineEquationTarget}`);
  });
});
[
  "teacherQuestionText",
  "teacherOptionA",
  "teacherOptionB",
  "teacherOptionC",
  "teacherOptionD",
  "teacherQuestionExplanation"
].forEach(fieldId => {
  document.getElementById(fieldId)?.addEventListener("input", () => renderTeacherInlinePreview(fieldId));
});
document.getElementById("teacherQuestionLatex")?.addEventListener("input", () => {
  renderQuestionLatexPreview("teacherQuestionLatex", "teacherQuestionEquationPreview");
});
document.getElementById("teacherExplanationLatex")?.addEventListener("input", () => {
  renderQuestionLatexPreview("teacherExplanationLatex", "teacherExplanationEquationPreview");
});
document.getElementById("teacherQuestionImage")?.addEventListener("change", event => {
  const file = event.target.files?.[0] || null;
  const status = document.getElementById("teacherQuestionStatus");
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (file && (!allowedImageTypes.includes(file.type) || file.size > 6 * 1024 * 1024)) {
    teacherQuestionImageFile = null;
    event.target.value = "";
    status.textContent = "Selecciona una imagen JPG, PNG, WebP o GIF de máximo 6 MB.";
    status.className = "bank-status error";
    return;
  }
  teacherQuestionImageFile = file;
  const preview = document.getElementById("teacherQuestionImagePreview");
  const image = preview?.querySelector("img");
  if (file && preview && image) {
    image.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
  } else {
    preview?.classList.add("hidden");
  }
});
document.getElementById("btnRemoveTeacherQuestionImage")?.addEventListener("click", () => {
  teacherQuestionImageFile = null;
  const input = document.getElementById("teacherQuestionImage");
  if (input) input.value = "";
  document.getElementById("teacherQuestionImagePreview")?.classList.add("hidden");
});
document.getElementById("btnPreviewTeacherQuestion")?.addEventListener("click", renderTeacherQuestionPreview);
document.getElementById("btnSaveTeacherQuestion")?.addEventListener("click", saveTeacherQuestion);
document.getElementById("teacherCreatedQuestions")?.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-teacher-question]");
  if (button) deleteTeacherQuestion(button.dataset.deleteTeacherQuestion);
});
document.addEventListener("click", event => {
  const avatar = event.target.closest("[data-avatar-src]");
  if (avatar) {
    event.preventDefault();
    event.stopPropagation();
    const overlay = document.getElementById("photoOverlay");
    const image = document.getElementById("photoFullImage");
    if (!overlay || !image) return;
    image.src = avatar.dataset.avatarSrc;
    image.alt = avatar.dataset.avatarName ? `Foto de ${avatar.dataset.avatarName}` : "Foto de perfil ampliada";
    overlay.classList.remove("question-image-mode");
    overlay.classList.remove("hidden");
    return;
  }
  const button = event.target.closest("[data-question-image]");
  if (!button) return;
  const overlay = document.getElementById("photoOverlay");
  const image = document.getElementById("photoFullImage");
  if (!overlay || !image) return;
  image.src = button.dataset.questionImage;
  overlay.classList.add("question-image-mode");
  overlay.classList.remove("hidden");
});
document.getElementById("messageBody")?.addEventListener("input", () => {
  const status = document.getElementById("messageComposeStatus");
  if (status && status.textContent === "Mensaje enviado.") status.textContent = "";
});
document.getElementById("messageThreadList")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-open-message]");
  if (btn) abrirDetalleMensaje(btn.dataset.openMessage);
});
document.getElementById("messageHistoryClassSelect")?.addEventListener("change", event => {
  messageHistoryClassId = event.target.value;
  renderMessagesPanel();
});
document.querySelectorAll("[data-payment-method]").forEach(button => {
  button.addEventListener("click", () => {
    selectedPaymentMethod = button.dataset.paymentMethod;
    document.querySelectorAll("[data-payment-method]").forEach(item => {
      item.classList.toggle("active", item === button);
    });
    renderSubscriptionPanel();
  });
});
document.querySelector(".checkout-plan-grid")?.addEventListener("click", event => {
  const button = event.target.closest("[data-checkout-plan]");
  if (!button) return;
  selectedCheckoutPlanId = button.dataset.checkoutPlan || "";
  renderSubscriptionPanel();
});
document.getElementById("btnPaymentPrevious")?.addEventListener("click", () => {
  paymentStep = Math.max(0, paymentStep - 1);
  renderPasoPago();
});
document.getElementById("btnPaymentNext")?.addEventListener("click", () => {
  paymentStep = Math.min(2, paymentStep + 1);
  renderPasoPago();
});
document.getElementById("btnStartSecureCheckout")?.addEventListener("click", async () => {
  const status = document.getElementById("paymentStatus");
  const acceptTerms = document.getElementById("paymentAcceptTerms")?.checked;
  const saveMethod = document.getElementById("paymentSaveMethod")?.checked;
  if (!acceptTerms) {
    if (status) {
      status.textContent = "Debes aceptar las condiciones del servicio y la política de privacidad antes de continuar.";
      status.className = "bank-status error";
    }
    return;
  }
  if (status) {
    status.textContent = "Preparando pago seguro...";
    status.className = "bank-status";
  }
  try {
    const selectedPlan = asegurarPlanPagoSeleccionado();
    if (!selectedPlan) {
      if (status) {
        status.textContent = "Este tipo de cuenta no tiene un plan de pago directo disponible.";
        status.className = "bank-status error";
      }
      return;
    }
    if (!APP_CONFIG.payments.checkoutReady || !Number(precioSuscripcion())) {
      await registrarSolicitudFacturacion("payment-intent", {
        planId: selectedPlan.id,
        paymentMethod: selectedPaymentMethod,
        providerPaymentMethod: tipoMetodoWompi(),
        savePaymentMethod: !!saveMethod,
        acceptRecurring: !!saveMethod,
        source: "subscription-carousel"
      });
      if (status) {
        status.textContent = "El módulo de pagos quedó preparado. Falta configurar precios y credenciales Sandbox de Wompi para habilitar cobros reales.";
        status.className = "bank-status error";
      }
      return;
    }
    const result = await solicitarIntencionPago({
      planId: selectedPlan.id,
      role: rolUsuario(),
      paymentMethod: selectedPaymentMethod,
      providerPaymentMethod: tipoMetodoWompi(),
      savePaymentMethod: !!saveMethod,
      acceptRecurring: !!saveMethod,
      acceptTerms: true,
      source: "subscription-carousel"
    });
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    if (status) {
      status.textContent = result.message || "El flujo de pago quedó preparado. Falta configurar las credenciales Sandbox y precios para cobrar en Wompi.";
      status.className = result.ready === false ? "bank-status error" : "bank-status success";
    }
  } catch (error) {
    console.error(error);
    if (status) {
      status.textContent = error.message || "No fue posible iniciar el pago.";
      status.className = "bank-status error";
    }
  }
});
document.getElementById("btnUpgradePlan")?.addEventListener("click", () => {
  abrirSelectorCambioPlan();
});
document.getElementById("btnAddPaymentMethod")?.addEventListener("click", () => {
  planChangeInProgress = false;
  paymentStep = 1;
  activarNav("suscripcion");
});
document.getElementById("btnPayFromBilling")?.addEventListener("click", () => {
  planChangeInProgress = false;
  paymentStep = 0;
  activarNav("suscripcion");
});
document.querySelectorAll("[data-billing-tab]").forEach(button => {
  button.addEventListener("click", () => {
    activeBillingTab = button.dataset.billingTab || "subscription";
    renderBillingPanel();
  });
});
document.getElementById("billingHistory")?.addEventListener("click", event => {
  const button = event.target.closest("[data-download-receipt]");
  if (!button) return;
  descargarComprobantePago(button.dataset.downloadReceipt || "");
});
document.getElementById("billingPauseToggle")?.addEventListener("change", async event => {
  const status = document.getElementById("billingActionStatus");
  const pause = event.target.checked;
  const wasPaused = perfilActual?.subscriptionPaymentPaused === true || perfilActual?.subscriptionAutoRenew === false;
  if (!suscripcionActiva()) {
    event.target.checked = false;
    if (status) setStatusTemporal("billingActionStatus", "No tienes una suscripción activa para administrar.", "error");
    return;
  }
  try {
    await registrarSolicitudFacturacion(pause ? "pause-renewal" : "resume-renewal");
    await guardarPerfilUsuario({ subscriptionPaymentPaused: pause, subscriptionAutoRenew: !pause });
    if (status) {
      setStatusTemporal("billingActionStatus", pause
          ? "Suspensión registrada."
          : "Reactivación registrada.",
        "success");
    }
  } catch (error) {
    console.error(error);
    event.target.checked = !pause && wasPaused
      ? true
      : (perfilActual?.subscriptionPaymentPaused === true || perfilActual?.subscriptionAutoRenew === false);
    if (status) setStatusTemporal("billingActionStatus", "No fue posible registrar la solicitud. Intenta nuevamente.", "error");
  }
});
document.getElementById("billingPaymentMethods")?.addEventListener("click", async event => {
  const defaultButton = event.target.closest("[data-default-payment-method]");
  const button = event.target.closest("[data-remove-payment-method]");
  if (defaultButton) {
    const status = document.getElementById("billingActionStatus");
    try {
      await registrarSolicitudFacturacion("set-default-payment-method", { paymentMethodId: defaultButton.dataset.defaultPaymentMethod });
      if (status) {
        status.textContent = "Solicitud registrada. El método principal se actualizará cuando la pasarela confirme el cambio.";
        status.className = "bank-status success";
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = "No fue posible registrar la solicitud.";
        status.className = "bank-status error";
      }
    }
    return;
  }
  if (!button) return;
  const methods = metodosPagoPerfil();
  const status = document.getElementById("billingActionStatus");
  if (methods.length < 2) {
    if (status) {
      status.textContent = "Agrega otra forma de pago antes de eliminar la única disponible.";
      status.className = "bank-status error";
    }
    return;
  }
  if (!confirm("¿Deseas solicitar la eliminación de esta forma de pago?")) return;
  try {
    await registrarSolicitudFacturacion("remove-payment-method", { paymentMethodId: button.dataset.removePaymentMethod });
    if (status) {
      status.textContent = "Solicitud registrada. El método se eliminará cuando la pasarela confirme el cambio.";
      status.className = "bank-status success";
    }
  } catch (error) {
    console.error(error);
    if (status) {
      status.textContent = "No fue posible registrar la solicitud.";
      status.className = "bank-status error";
    }
  }
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
document.getElementById("tabLogin")?.addEventListener("click", () => volverSelectorAuth("login"));
document.getElementById("tabRegister")?.addEventListener("click", () => volverSelectorAuth("register"));
document.getElementById("registerPassword")?.addEventListener("input", actualizarReglasPassword);
document.getElementById("btnSaveProfile")?.addEventListener("click", guardarPerfilDesdeFormulario);
document.getElementById("btnLinkGoogleProvider")?.addEventListener("click", vincularGoogleDesdePerfil);
document.getElementById("btnChoosePhoto")?.addEventListener("click", () => document.getElementById("profilePhotoInput")?.click());
document.getElementById("btnTakePhoto")?.addEventListener("click", () => document.getElementById("profileCameraInput")?.click());
document.getElementById("profilePhotoInput")?.addEventListener("change", e => cargarFotoPerfil(e.target.files?.[0]));
document.getElementById("profileCameraInput")?.addEventListener("change", e => cargarFotoPerfil(e.target.files?.[0]));
document.getElementById("btnRemovePhoto")?.addEventListener("click", async () => {
  if (perfilActual?.photoStoragePath) {
    await deleteObject(storageRef(storage, perfilActual.photoStoragePath)).catch(err => {
      console.warn("No se pudo eliminar la foto de Storage.", err);
    });
  }
  await guardarPerfilUsuario({ photoData: "", photoFullURL: "", photoStoragePath: "" });
  renderProfile();
  document.getElementById("profileStatus").textContent = "Foto eliminada.";
});
document.getElementById("profilePhotoPreview")?.addEventListener("click", () => {
  document.getElementById("photoOverlay")?.classList.remove("question-image-mode");
  document.getElementById("photoFullImage").src = fotoPerfilAltaCalidad(perfilActual?.photoFullURL || perfilActual?.googlePhotoURL || perfilActual?.photoURL || usuarioActual?.photoURL || perfilActual?.photoData || document.getElementById("profilePhotoPreview").src);
  document.getElementById("photoOverlay").classList.remove("hidden");
});
document.getElementById("btnClosePhotoOverlay")?.addEventListener("click", () => {
  document.getElementById("photoOverlay")?.classList.add("hidden");
  document.getElementById("photoOverlay")?.classList.remove("question-image-mode");
});
document.getElementById("btnRefreshOwnerAppMetrics")?.addEventListener("click", () => renderOwnerAppMetrics({ showStatus: true }));
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
document.getElementById("btnCreateInstitutionClass")?.addEventListener("click", () => crearClaseAdmin({ nameId: "institutionClassName", gradeId: "institutionClassGrade", statusId: "institutionClassStatus", buttonId: "btnCreateInstitutionClass" }));
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
document.getElementById("btnInstitutionAddMembers")?.addEventListener("click", agregarMiembrosInstitucion);
document.getElementById("institutionMembersList")?.addEventListener("click", e => {
  const approve = e.target.closest("[data-approve-institution-request]");
  if (approve) {
    aprobarSolicitudInstitucional(approve.dataset.approveInstitutionRequest).catch(err => {
      console.error(err);
      setStatus("institutionMembersStatus", err.message || "No fue posible aprobar la solicitud.", "error");
    });
    return;
  }
  const reject = e.target.closest("[data-reject-institution-request]");
  if (reject) {
    rechazarSolicitudInstitucional(reject.dataset.rejectInstitutionRequest).catch(err => {
      console.error(err);
      setStatus("institutionMembersStatus", err.message || "No fue posible rechazar la solicitud.", "error");
    });
    return;
  }
  const btn = e.target.closest("[data-delete-institution-member]");
  if (btn) eliminarMiembroInstitucion(btn.dataset.deleteInstitutionMember);
});
document.getElementById("ownerInstitutionsList")?.addEventListener("click", async e => {
  const blockBtn = e.target.closest("[data-owner-block-institution]");
  if (blockBtn) {
    try {
      await bloquearInstitucionPremium(blockBtn.dataset.ownerBlockInstitution);
      await renderOwnerInstitutions();
    } catch (err) {
      console.error(err);
      mostrarError(err.message || "No fue posible bloquear la institución.");
    }
    return;
  }
  const btn = e.target.closest("[data-owner-delete-institution]");
  if (!btn) return;
  await eliminarInstitucionCompleta(btn.dataset.ownerDeleteInstitution);
  await renderOwnerInstitutions();
});
document.getElementById("btnDeleteInstitutionAccount")?.addEventListener("click", async () => {
  const status = document.getElementById("institutionDeleteStatus");
  const pass = document.getElementById("institutionDeletePassword")?.value || "";
  const confirmBox = document.getElementById("institutionDeleteConfirm");
  if (!pass || !confirmBox?.checked) {
    if (status) {
      status.textContent = "Escribe tu contraseña y confirma que entiendes la eliminación permanente.";
      status.className = "bank-status error";
    }
    return;
  }
  try {
    await eliminarInstitucionCompleta(perfilActual?.institutionDane, pass);
  } catch {
    if (status) {
      status.textContent = "No se pudo eliminar la cuenta institucional. Revisa la contraseña o intenta de nuevo.";
      status.className = "bank-status error";
    }
  }
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
  const blockBtn = e.target.closest("[data-toggle-student-block]");
  if (blockBtn) {
    alternarBloqueoEstudiante(
      blockBtn.dataset.toggleStudentBlock,
      blockBtn.dataset.blocked === "true"
    );
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
document.getElementById("btnSectionBack")?.addEventListener("click", volverSeccionAnterior);
document.getElementById("btnSectionForward")?.addEventListener("click", avanzarSeccionSiguiente);
document.getElementById("btnDrawerClose")?.addEventListener("click", cerrarDrawer);
document.getElementById("drawerBackdrop")?.addEventListener("click", cerrarDrawer);
document.getElementById("btnDrawerHome")?.addEventListener("click", () => {
  if (activarNav(modoAdmin ? "admin" : "inicio")) cerrarDrawer();
});
document.querySelectorAll(".drawer-link[data-section]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!suscripcionActiva() && seccionRequiereSuscripcion(btn.dataset.section)) {
      exigirSuscripcion("Activa tu suscripción para desbloquear esta sección.");
      cerrarDrawer();
      return;
    }
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
  renderPasswordToggle(btn, false);
  btn.addEventListener("click", () => alternarPassword(btn.dataset.togglePassword));
});
document.querySelectorAll("[data-notification-toggle]").forEach(toggle => {
  toggle.addEventListener("change", cambiarNotificaciones);
});

window.addEventListener("beforeunload", e => {
  if (usuarioActual) {
    if (seccionActual) localStorage.setItem(STORAGE_SECCION_ACTIVA, seccionActual);
    sessionStorage.setItem(STORAGE_RELOAD_SESION, "1");
  }
  if (!hayBorradorMensajeProfesor() && !hayBorradorPreguntaProfesor()) return;
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
    registerInstitutionDane: "btnEmailRegister",
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

if (sessionStorage.getItem(STORAGE_RELOAD_SESION) === "1") {
  mostrarReloadSesion();
}

onAuthStateChanged(auth, async user => {
  usuarioActual = user;
  if (user && googleAuthFlowInProgress) {
    mostrarReloadSesion();
    return;
  }
  if (!user) {
    ocultarReloadSesion();
    if (suppressAuthResetOnce) {
      suppressAuthResetOnce = false;
      return;
    }
    historialSecciones = [];
    historialAdelante = [];
    seccionActual = "inicio";
    actualizarBotonVolver();
    if (unsubscribeAdminStudents) unsubscribeAdminStudents();
    unsubscribeAdminStudents = null;
    if (unsubscribeClassMembership) unsubscribeClassMembership();
    unsubscribeClassMembership = null;
    if (unsubscribeBillingHistory) unsubscribeBillingHistory();
    unsubscribeBillingHistory = null;
    billingHistoryItems = [];
    detenerListenersComunicacion();
    classMembershipValid = true;
    document.getElementById("advisorWidget")?.classList.add("hidden");
    cerrarAsesorIA();
    document.body.classList.add("group-locked");
    if (loginRejectMessagePending) {
      const message = loginRejectMessagePending;
      loginRejectMessagePending = "";
      mostrarLoginConError(message);
    } else {
      mostrarAuthInicial();
    }
    return;
  }
  if (registroEnCurso) {
    ocultarReloadSesion();
    return;
  }
  limpiarWarn();
  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    await signOut(auth);
    ocultarReloadSesion();
    document.body.classList.add("group-locked");
    mostrarAuthInicial("login");
    setStatusTemporal("loginStatus", "Usuario no encontrado. Debe primero crear una cuenta.", "error", 5000);
    return;
  }
  const perfilLogin = userSnap.data();
  if (requiereVerificacionEmail(user, perfilLogin) && user.email?.toLowerCase() !== ADMIN_EMAIL) {
    suppressAuthResetOnce = true;
    await signOut(auth);
    ocultarReloadSesion();
    document.body.classList.add("group-locked");
    mostrarLoginConError("Debe verificar primero su cuenta. Por favor, revisa tu correo registrado.");
    return;
  }
  const rolLogin = rolUsuario(perfilLogin);
  const expectedLoginType = getPendingLoginType();
  if (expectedLoginType && !loginCoincideConTipo(perfilLogin, expectedLoginType, user.email)) {
    loginRejectMessagePending = "Tipo de cuenta equivocado. Selecciona el tipo de cuenta correcto e intenta nuevamente.";
    await signOut(auth);
    clearPendingLoginType();
    ocultarReloadSesion();
    document.body.classList.add("group-locked");
    return;
  }
  if (!rolLogin) {
    await signOut(auth);
    ocultarReloadSesion();
    document.body.classList.add("group-locked");
    mostrarAuthInicial("login");
    setStatusTemporal("loginStatus", "Usuario no encontrado. Debe primero crear una cuenta.", "error", 5000);
    return;
  }
  if (user.providerData?.some(provider => provider.providerId === "google.com")) {
    await guardarDatosGoogleIniciales(user);
  }
  escucharHistorialFacturacion();
  try {
    await prepararSesionAutenticada();
  } finally {
    ocultarReloadSesion();
  }
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
  renderExamAccessPanel();
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

function aplicarFechaHoraFormulario(prefix, iso = "") {
  const parts = partsFromIsoUsuario(iso);
  document.getElementById(`${prefix}Date`).value = parts?.date || "";
  document.getElementById(`${prefix}Time`).value = parts?.time || "";
  const period = document.getElementById(`${prefix}Period`);
  if (period) period.value = parts?.period || "AM";
}

function cancelarLimpiezaDisponibilidadExamen() {
  if (!examAccessCleanupTimer) return;
  clearTimeout(examAccessCleanupTimer);
  examAccessCleanupTimer = null;
}

function limpiarMensajeDisponibilidadExamen() {
  const status = document.getElementById("examAccessStatus");
  if (!status) return;
  status.textContent = "";
  status.className = "bank-status";
}

function limpiarFormularioDisponibilidadExamen() {
  ["examStartDate", "examStartTime", "examEndDate", "examEndTime"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  ["examStartPeriod", "examEndPeriod"].forEach(id => {
    const select = document.getElementById(id);
    if (select) select.value = "AM";
  });
  const feedback = document.getElementById("examFeedbackPublished");
  if (feedback) feedback.checked = false;
  const summary = document.getElementById("examAccessSummary");
  if (summary) summary.innerHTML = "";
  limpiarMensajeDisponibilidadExamen();
}

function programarLimpiezaDisponibilidadExamen() {
  cancelarLimpiezaDisponibilidadExamen();
  examAccessCleanupTimer = setTimeout(() => {
    limpiarFormularioDisponibilidadExamen();
    examAccessCleanupTimer = null;
  }, 5000);
}

async function renderExamAccessPanel({ fetchServer = false, showSummary = false, fillForm = false } = {}) {
  const classSelect = document.getElementById("examAccessClassSelect");
  const levelSelect = document.getElementById("examAccessLevelSelect");
  const summary = document.getElementById("examAccessSummary");
  const statusEl = document.getElementById("examAccessStatus");
  if (!classSelect || !levelSelect || !summary) return;
  renderClassSelectors();
  const classId = classSelect.value || adminClaseActiva || idsAulasAdmin()[0] || "";
  const level = levelSelect.value || "diagnostico";
  if (!classId) {
    summary.innerHTML = `<p class="muted">Crea o selecciona un aula para programar exámenes.</p>`;
    return;
  }
  let config = normalizarExamSettings(examSettingsGrupo[classId] || {})[level];
  if (fetchServer) {
    try {
      const remote = await consultarEstadoExamenServidor(classId, level);
      config = {
        startAt: remote.startAt || "",
        endAt: remote.endAt || "",
        feedbackPublished: remote.feedbackPublished === true
      };
    } catch (err) {
      console.warn("No se pudo consultar estado de examen.", err);
      if (statusEl) {
        statusEl.textContent = err.message || "No se pudo consultar el estado.";
        statusEl.className = "bank-status error";
      }
    }
  }
  if (fillForm) {
    aplicarFechaHoraFormulario("examStart", config.startAt);
    aplicarFechaHoraFormulario("examEnd", config.endAt);
    const feedback = document.getElementById("examFeedbackPublished");
    if (feedback) feedback.checked = config.feedbackPublished === true;
  }
  const cached = examAccessStateCache[`${classId}::${level}`];
  const state = cached || {
    status: estadoExamenDesdeConfig(config),
    serverNowLabel: "Hora oficial pendiente de sincronizar"
  };
  if (!showSummary) {
    summary.innerHTML = "";
    return;
  }
  summary.innerHTML = `
    <article class="exam-access-card ${escapeHtml(state.status || "pending")}">
      <strong>${escapeHtml(nombreExamen(level))}</strong>
      <span>Estado: ${escapeHtml(estadoExamenTexto(state.status))}</span>
      <span>Apertura: ${escapeHtml(fechaHoraUsuarioLabel(config.startAt, perfilActual, state))}</span>
      <span>Cierre: ${escapeHtml(fechaHoraUsuarioLabel(config.endAt, perfilActual, state))}</span>
      <span>Retroalimentación: ${config.feedbackPublished ? "Publicada" : "Oculta"}</span>
      <small>Hora oficial ${escapeHtml(state.timeZoneLabel || etiquetaZonaUsuario())}: ${escapeHtml(state.serverNowLabel || "Sin sincronizar")}</small>
    </article>
  `;
}

function estadoExamenDesdeConfig(config = {}) {
  const now = Date.now();
  const start = config.startAt ? new Date(config.startAt).getTime() : null;
  const end = config.endAt ? new Date(config.endAt).getTime() : null;
  if (start && now < start) return "scheduled";
  if (end && now > end) return "closed";
  return "available";
}

function actualizarTextosPanelMetricas() {
  const institution = esInstitucion();
  const title = document.getElementById("adminMetricsTitle");
  const subtitle = document.getElementById("adminMetricsSubtitle");
  const panelTitle = document.getElementById("adminMetricsPanelTitle");
  const selectLabel = document.getElementById("adminMetricsSelectLabel");
  if (title) title.textContent = institution ? "Métricas por grado" : "Métricas del profesor";
  if (subtitle) {
    subtitle.textContent = institution
      ? "Consulta estadísticas generales por curso según los grados configurados por la institución."
      : "Métricas por aula, estadísticas por aula, ranking de aulas y comparativas entre aulas.";
  }
  if (panelTitle) panelTitle.textContent = institution ? "Panel comparativo por grado" : "Panel comparativo por aula";
  if (selectLabel) selectLabel.textContent = institution ? "Selecciona el grado que deseas revisar" : "Selecciona qué deseas revisar";
}

async function estadosPorUids(uids = []) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return [];
  const batches = [];
  for (let i = 0; i < unique.length; i += 10) {
    batches.push(unique.slice(i, i + 10));
  }
  const snaps = await Promise.all(batches.map(batch =>
    getDocs(query(collection(db, "studentState"), where(documentId(), "in", batch)))
  ));
  return snaps.flatMap(snap => snap.docs.map(item => ({ id: item.id, ...item.data() })));
}

async function renderInstitutionGradeStats() {
  const cont = document.getElementById("adminStats");
  if (!cont) return;
  cont.innerHTML = `<div class="stats-card"><h3>Métricas por grado</h3><p>Cargando datos institucionales...</p></div>`;
  renderClassSelectors();
  const selectedGrade = document.getElementById("adminMetricsClassSelect")?.value || "";
  const grades = gradosInstitucion();
  if (!grades.length) {
    cont.innerHTML = `<div class="stats-card"><h3>Sin grados configurados</h3><p>La institución aún no tiene cursos creados desde su registro.</p></div>`;
    return;
  }
  const members = await miembrosInstitucionActual().catch(() => []);
  const students = members.filter(item => item.role === "student" && item.status !== "removed");
  const teachers = members.filter(item => item.role === "teacher" && item.status !== "removed");
  const gradeStudents = students.filter(item => item.grade === selectedGrade);
  const gradeTeachers = teachers.filter(item => !item.grade || item.grade === selectedGrade);
  const states = await estadosPorUids(gradeStudents.map(item => item.userUid));
  const activeStudents = new Set();
  const totals = { intentos: 0, correctas: 0, incorrectas: 0, nota: 0, tiempo: 0 };
  states.forEach(data => {
    activeStudents.add(data.id);
    Object.entries(data.resultados || {}).forEach(([clave, value]) => {
      if (!String(clave).includes("::") && data.resultados?.[`principal::${clave}`]) return;
      (value.intentos || []).forEach(intento => {
        const m = metricasIntento(clave, intento);
        totals.intentos++;
        totals.correctas += m.correctas;
        totals.incorrectas += m.incorrectas;
        totals.nota += Number(m.nota);
        totals.tiempo += m.tiempoEmpleado;
      });
    });
  });
  const n = totals.intentos || 1;
  cont.innerHTML = `
    <article class="stats-card">
      <h3>Grado ${escapeHtml(selectedGrade || "sin seleccionar")}</h3>
      <p><strong>Estudiantes autorizados:</strong> ${gradeStudents.length}</p>
      <p><strong>Estudiantes activos:</strong> ${activeStudents.size}</p>
      <p><strong>Profesores asociados:</strong> ${gradeTeachers.length}</p>
      <p><strong>Intentos registrados:</strong> ${totals.intentos}</p>
      <p><strong>Promedio nota:</strong> ${(totals.nota / n).toFixed(1)}</p>
      <p><strong>Promedio correctas:</strong> ${(totals.correctas / n).toFixed(1)}</p>
      <p><strong>Promedio incorrectas:</strong> ${(totals.incorrectas / n).toFixed(1)}</p>
      <p><strong>Promedio tiempo:</strong> ${formatTiempo(Math.round(totals.tiempo / n))}</p>
    </article>
  `;
}

async function renderAdminStats() {
  const cont = document.getElementById("adminStats");
  if (!cont || (!modoAdmin && !esInstitucion())) return;
  actualizarTextosPanelMetricas();
  if (esInstitucion()) {
    await renderInstitutionGradeStats();
    return;
  }
  cont.innerHTML = `<div class="stats-card"><h3>Métricas</h3><p>Cargando datos...</p></div>`;
  renderClassSelectors();
  const metricsSelection = document.getElementById("adminMetricsClassSelect")?.value || "best";
  const snaps = await getDocs(collection(db, "studentState"));
  const acumulado = {};
  adminClases.forEach(aula => acumulado[aula.id] = { aula, estudiantes: new Set(), intentos: 0, correctas: 0, incorrectas: 0, nota: 0, tiempo: 0 });
  snaps.forEach(snap => {
    const data = snap.data();
    const grupo = data.aulaId || data.claseId || data.grupo;
    if (!acumulado[grupo]) return;
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
  if (!adminClases.length) {
    cont.innerHTML = `<div class="stats-card"><h3>Sin aulas</h3><p>Crea un aula para consultar métricas.</p></div>`;
    return;
  }
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

  if (metricsSelection === "best") {
    if (!ranking.length) {
      cont.innerHTML = `<div class="stats-card"><h3>Mejor aula</h3><p>Aún no hay intentos registrados para calcular el ranking.</p></div>`;
      return;
    }
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
    return;
  }

  const data = acumulado[metricsSelection];
  if (!data) {
    cont.innerHTML = `<div class="stats-card"><h3>Aula no disponible</h3><p>Selecciona un aula creada.</p></div>`;
    return;
  }
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
}

function setReportStatus(message = "", type = "") {
  const status = document.getElementById("reportStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `bank-status${type ? ` ${type}` : ""}`;
}

function valorReporteComparable(row, key) {
  const value = row?.[key];
  if (typeof value === "number") return value;
  return String(value || "").toLowerCase();
}

function renderTeacherReportsPanel() {
  renderClassSelectors();
  renderReportTable();
}

function filtrarOrdenarReporte() {
  const search = (document.getElementById("reportSearchInput")?.value || "").trim().toLowerCase();
  teacherReportFiltered = teacherReportRows.filter(row => {
    if (!search) return true;
    return [
      row.studentName,
      row.email,
      row.className,
      row.classCode,
      row.examName
    ].some(value => String(value || "").toLowerCase().includes(search));
  }).sort((a, b) => {
    const av = valorReporteComparable(a, teacherReportSort.key);
    const bv = valorReporteComparable(b, teacherReportSort.key);
    if (av < bv) return teacherReportSort.dir === "asc" ? -1 : 1;
    if (av > bv) return teacherReportSort.dir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderReportTable() {
  const body = document.getElementById("reportTableBody");
  const pageInfo = document.getElementById("reportPageInfo");
  const prev = document.getElementById("btnReportPrev");
  const next = document.getElementById("btnReportNext");
  const download = document.getElementById("btnDownloadReport");
  if (!body) return;
  filtrarOrdenarReporte();
  const totalPages = Math.max(1, Math.ceil(teacherReportFiltered.length / REPORT_PAGE_SIZE));
  teacherReportPage = Math.min(Math.max(1, teacherReportPage), totalPages);
  const start = (teacherReportPage - 1) * REPORT_PAGE_SIZE;
  const rows = teacherReportFiltered.slice(start, start + REPORT_PAGE_SIZE);
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="10">No hay resultados para mostrar.</td></tr>`;
  } else {
    body.innerHTML = rows.map(row => `
      <tr>
        <td>${escapeHtml(row.studentName || "Sin nombre")}</td>
        <td>${escapeHtml(row.email || "")}</td>
        <td>${escapeHtml(row.className || "")}<br><small>${escapeHtml(row.classCode || "")}</small></td>
        <td>${escapeHtml(row.examName || "")}</td>
        <td>${Number(row.correctas || 0)}</td>
        <td>${Number(row.incorrectas || 0)}</td>
        <td>${Number(row.segundosPorPregunta || 0).toFixed(1)}</td>
        <td>${escapeHtml(row.tiempoTotalLabel || formatTiempo(Number(row.tiempoTotalSegundos || 0)))}</td>
        <td>${Number(row.nota || 0).toFixed(1)}</td>
        <td>${escapeHtml(row.presentedDate || "")}<br><small>${escapeHtml(row.presentedTime || "")}</small></td>
      </tr>
    `).join("");
  }
  if (pageInfo) pageInfo.textContent = `Página ${teacherReportPage} de ${totalPages} · ${teacherReportFiltered.length} registro(s)`;
  if (prev) prev.disabled = teacherReportPage <= 1;
  if (next) next.disabled = teacherReportPage >= totalPages;
  if (download) download.disabled = !teacherReportRows.length;
}

async function cargarReporteAcademico() {
  const classId = document.getElementById("reportClassSelect")?.value || adminClaseActiva || "";
  const level = document.getElementById("reportExamSelect")?.value || "diagnostico";
  if (!classId) {
    setReportStatus("Primero crea o selecciona un aula.", "error");
    return;
  }
  setReportStatus("Consultando reporte oficial...", "");
  teacherReportRows = [];
  teacherReportFiltered = [];
  teacherReportPage = 1;
  renderReportTable();
  try {
    const data = await postBackendAutenticado(APP_CONFIG.academicReportEndpoint, {
      classId,
      level,
      ...timezoneUsuarioPayload()
    });
    teacherReportRows = Array.isArray(data.rows) ? data.rows : [];
    teacherReportPage = 1;
    renderReportTable();
    setReportStatus(teacherReportRows.length
      ? `Reporte cargado: ${teacherReportRows.length} registro(s).`
      : "No hay intentos registrados para esta aula y examen.", teacherReportRows.length ? "success" : "");
  } catch (err) {
    console.error(err);
    setReportStatus(err.message || "No se pudo cargar el reporte.", "error");
  }
}

function nombreArchivoSeguro(text = "") {
  return String(text || "Reporte")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Reporte";
}

let xlsxLoadPromise = null;

function ensureXlsxLoaded() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLoadPromise) return xlsxLoadPromise;
  xlsxLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("No se pudo inicializar el exportador Excel."));
    script.onerror = () => reject(new Error("No se pudo cargar el exportador Excel. Revisa la conexión e intenta de nuevo."));
    document.head.appendChild(script);
  });
  return xlsxLoadPromise;
}

async function exportTeacherReportXlsx() {
  if (!teacherReportRows.length) {
    setReportStatus("Primero consulta un reporte con datos.", "error");
    return;
  }
  try {
    await ensureXlsxLoaded();
  } catch (err) {
    setReportStatus(err.message || "No se pudo cargar el exportador Excel. Revisa la conexión e intenta de nuevo.", "error");
    return;
  }
  const rows = teacherReportRows.map(row => ({
    "Nombre del estudiante": row.studentName || "",
    "Correo electrónico": row.email || "",
    "Aula": row.className || "",
    "Código del aula": row.classCode || "",
    "Tipo de examen": row.examName || "",
    "Fecha de presentación": row.presentedDate || "",
    "Hora de presentación": row.presentedTime || "",
    "Número de preguntas": Number(row.totalQuestions || 0),
    "Preguntas correctas": Number(row.correctas || 0),
    "Preguntas incorrectas": Number(row.incorrectas || 0),
    "Tiempo por pregunta (segundos)": Number(row.segundosPorPregunta || 0),
    "Tiempo total del examen": row.tiempoTotalLabel || formatTiempo(Number(row.tiempoTotalSegundos || 0)),
    "Nota definitiva": Number(row.nota || 0)
  }));
  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 28 }, { wch: 34 }, { wch: 24 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
    { wch: 28 }, { wch: 22 }, { wch: 16 }
  ];
  const book = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(book, worksheet, "Reporte");
  const first = teacherReportRows[0] || {};
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `Reporte_${nombreArchivoSeguro(first.className)}_${nombreArchivoSeguro(first.examName)}_${today}.xlsx`;
  window.XLSX.writeFile(book, fileName);
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

document.getElementById("adminMetricsClassSelect")?.addEventListener("change", () => {
  renderAdminStats().catch(err => console.warn("No se pudieron actualizar métricas.", err));
});

document.getElementById("btnLoadReport")?.addEventListener("click", () => {
  cargarReporteAcademico();
});

document.getElementById("btnDownloadReport")?.addEventListener("click", exportTeacherReportXlsx);

document.getElementById("reportSearchInput")?.addEventListener("input", () => {
  teacherReportPage = 1;
  renderReportTable();
});

["reportClassSelect", "reportExamSelect"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => {
    teacherReportRows = [];
    teacherReportFiltered = [];
    teacherReportPage = 1;
    setReportStatus("");
    renderReportTable();
  });
});

document.getElementById("btnReportPrev")?.addEventListener("click", () => {
  teacherReportPage -= 1;
  renderReportTable();
});

document.getElementById("btnReportNext")?.addEventListener("click", () => {
  teacherReportPage += 1;
  renderReportTable();
});

document.querySelectorAll("[data-report-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.reportSort;
    if (!key) return;
    if (teacherReportSort.key === key) {
      teacherReportSort.dir = teacherReportSort.dir === "asc" ? "desc" : "asc";
    } else {
      teacherReportSort = { key, dir: "asc" };
    }
    renderReportTable();
  });
});

document.getElementById("bankNivelSelect")?.addEventListener("change", renderBankPanel);

["examAccessClassSelect", "examAccessLevelSelect"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => {
    cancelarLimpiezaDisponibilidadExamen();
    limpiarFormularioDisponibilidadExamen();
    renderExamAccessPanel();
  });
});

document.getElementById("btnSaveExamAccess")?.addEventListener("click", async () => {
  const classId = document.getElementById("examAccessClassSelect")?.value || adminClaseActiva || adminGrupoActual;
  const level = document.getElementById("examAccessLevelSelect")?.value || "diagnostico";
  const status = document.getElementById("examAccessStatus");
  const startAt = isoDesdeFechaHoraUsuario(
    document.getElementById("examStartDate")?.value,
    document.getElementById("examStartTime")?.value,
    document.getElementById("examStartPeriod")?.value
  );
  const endAt = isoDesdeFechaHoraUsuario(
    document.getElementById("examEndDate")?.value,
    document.getElementById("examEndTime")?.value,
    document.getElementById("examEndPeriod")?.value
  );
  const feedbackPublished = document.getElementById("examFeedbackPublished")?.checked === true;
  if (!classId) {
    if (status) {
      status.textContent = "Primero crea o selecciona un aula.";
      status.className = "bank-status error";
    }
    return;
  }
  if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    if (status) {
      status.textContent = "La fecha de cierre debe ser posterior a la fecha de inicio.";
      status.className = "bank-status error";
    }
    return;
  }
  const confirmado = confirm("¿Está seguro de guardar estos cambios? Si ya existía una programación para esta misma aula y este mismo examen, será reemplazada por esta última configuración.");
  if (!confirmado) return;
  cancelarLimpiezaDisponibilidadExamen();
  if (status) {
    status.textContent = "Guardando disponibilidad...";
    status.className = "bank-status";
  }
  try {
    const result = await guardarConfiguracionExamenServidor({ classId, level, startAt, endAt, feedbackPublished });
    if (status) {
      status.textContent = `Configuración guardada. Estado: ${estadoExamenTexto(result.status)}. Retroalimentación: ${result.feedbackPublished ? "publicada" : "oculta"}.`;
      status.className = "bank-status success";
    }
    await renderExamAccessPanel({ showSummary: true });
    programarLimpiezaDisponibilidadExamen();
  } catch (err) {
    console.error(err);
    if (status) {
      status.textContent = err.message || "No se pudo guardar la configuración.";
      status.className = "bank-status error";
    }
  }
});

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
let segsExamen          = duracionExamenSeg("examen");

function iniciarTimerExamen(continuar = false) {
  if (timerExamenActivo) return;
  timerExamenActivo = true;
  setExamHeaderActivo(true);
  if (!continuar) segsExamen = duracionExamenSeg("examen");
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
  segsExamen = duracionExamenSeg("examen");
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
document.getElementById("btnIniciarExamen").addEventListener("click", async () => {
  if (!puedeIniciarIntento("examen")) {
    alert("Ya usaste los 2 intentos permitidos para el examen final.");
    return;
  }
  if (!(await validarDisponibilidadExamen("examen"))) return;
  await prepararPreguntasActivas("examen");
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
document.getElementById("btnVerResultadoExamen").addEventListener("click", async () => {
  document.getElementById("timeoutOverlayExamen").classList.add("hidden");
  const resp = PREGUNTAS_EXAMEN.map(q => {
    const ch = document.querySelector(`input[name="examen-q${q.id}"]:checked`);
    return ch ? parseInt(ch.value, 10) : -1;
  });
  await evaluarYMostrarExamen(resp);
});
document.getElementById("examenForm").addEventListener("submit", async (e) => {
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
  await evaluarYMostrarExamen(resp);
});

/** Submit manual examen */
async function evaluarYMostrarExamen(respuestas, opciones = {}) {
  if (!opciones.restaurando) limpiarIntentoActivo();
  examenIniciado = false;
  examenCompletado = true;
  document.getElementById("submitBtnExamen").style.display = "none";
  const tiempoEmpleado = duracionExamenSeg("examen") - segsExamen;
  const puedeMostrarClaves = tieneClavesRespuesta(PREGUNTAS_EXAMEN);
  let correctas = 0;
  PREGUNTAS_EXAMEN.forEach((q, i) => { if (respuestas[i] === q.correcta) correctas++; });
  let incorrectas = PREGUNTAS_EXAMEN.length - correctas;
  let pct  = Math.round((correctas / PREGUNTAS_EXAMEN.length) * 100);
  let nota = calcNota(pct);
  let badge = calcBadge(pct);
  if (!opciones.restaurando) {
    const serverMetrics = puedeMostrarClaves
      ? null
      : await guardarResultadoSesionConServidor("examen", respuestas, segsExamen);
    if (serverMetrics) {
      correctas = serverMetrics.correctas;
      incorrectas = serverMetrics.incorrectas;
      pct = serverMetrics.porcentaje;
      nota = serverMetrics.nota;
      badge = calcBadge(pct);
    } else if (puedeMostrarClaves) {
      guardarResultadoSesion("examen", respuestas, segsExamen);
    } else {
      guardarResultadoSesion("examen", respuestas, segsExamen);
    }
  }

  const sec = document.getElementById("resultsSectionExamen");
  sec.hidden = false;
  const preguntasResultado = await cargarPreguntasRetroalimentacionOficial("examen", PREGUNTAS_EXAMEN);
  const puedeMostrarFeedback = tieneClavesRespuesta(preguntasResultado);

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
  if (!puedeMostrarFeedback) {
    tbody.innerHTML = `<tr><td colspan="4">Resultado guardado oficialmente. La retroalimentación se mostrará cuando el profesor la publique.</td></tr>`;
  } else preguntasResultado.forEach((q, i) => {
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
  if (!puedeMostrarFeedback) {
    fbEl.innerHTML = `<div class="feedback-pending-card"><strong>Retroalimentación protegida</strong><p>Las respuestas correctas y explicaciones permanecen ocultas hasta que el profesor las publique.</p></div>`;
  } else preguntasResultado.forEach((q, i) => {
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
    const qResultado = preguntasResultado[i] || q;
    const card = document.getElementById(`examen-card-${q.id}`);
    if (!card) return;
    const sinR = respuestas[i] === -1;
    const ok   = !sinR && respuestas[i] === qResultado.correcta;
    if (puedeMostrarFeedback) card.classList.add(ok ? "result-correct" : "result-wrong");
    card.querySelectorAll("input[type='radio']").forEach(inp => inp.disabled = true);
    card.querySelectorAll(".option-label").forEach((lbl, idx) => {
      if (!puedeMostrarFeedback) return;
      if (idx === qResultado.correcta) lbl.classList.add("opt-correct");
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

async function restaurarIntentoActivo() {
  if (!intentoActivo) return;
  if (Date.now() - intentoActivo.ultimaActividad > INACTIVIDAD_MS) {
    limpiarIntentoActivo();
    return;
  }

  const restante = Math.max(0, Math.ceil((intentoActivo.vence - Date.now()) / 1000));

  if (intentoActivo.tipo === "diag") {
    await prepararPreguntasActivas("diagnostico");
    activarNav("diagnostico");
    renderizarPreguntas();
    aplicarRespuestasGuardadas("diag", "diagnostico", PREGUNTAS);
    document.getElementById("startScreen").hidden = true;
    document.getElementById("diagFormWrap").hidden = false;
    actualizarProgreso();
    segundosRestantes = restante;
    if (restante <= 0) await evaluarYMostrar(respuestasDesdeIntento(PREGUNTAS, "diag"));
    else iniciarTimer(true);
    return;
  }

  if (intentoActivo.tipo === "nivel" && PREGUNTAS_NIVELES[intentoActivo.clave]) {
    await prepararPreguntasActivas("nivel1");
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
    if (restante <= 0) await evaluarYMostrarNivel(respuestasDesdeIntento(PREGUNTAS_NIVELES[nivelActual], "nivel"));
    else iniciarTimerNivel(true);
    return;
  }

  if (intentoActivo.tipo === "examen") {
    await prepararPreguntasActivas("examen");
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
    if (restante <= 0) await evaluarYMostrarExamen(respuestasDesdeIntento(PREGUNTAS_EXAMEN, "examen"));
    else iniciarTimerExamen(true);
  }
}
