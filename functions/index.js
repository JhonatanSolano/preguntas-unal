const admin = require("firebase-admin");
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();
const db = admin.firestore();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");
const wompiPublicKey = defineSecret("WOMPI_PUBLIC_KEY");
const wompiPrivateKey = defineSecret("WOMPI_PRIVATE_KEY");
const wompiIntegritySecret = defineSecret("WOMPI_INTEGRITY_SECRET");
const wompiEventsSecret = defineSecret("WOMPI_EVENTS_SECRET");

const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";
const APP_URL = "https://matematicasentubolsillo.com/";
const APP_ORIGIN = "https://matematicasentubolsillo.com";
const INSTITUTIONAL_COMMERCE_FROZEN = true;

const BILLING_PLANS = {
  "student-annual": {
    role: "student",
    name: "Plan Premium Estudiante anual",
    amountCOP: 20000,
    durationYears: 1,
    benefits: ["Acceso total anual", "Exámenes", "Estadísticas", "Mensajería académica", "Asesor IA"]
  },
  "institution-0010": {
    role: "institution",
    name: "Plan Institución 1 a 10 estudiantes",
    amountCOP: 50000,
    maxInstitutionUsers: 1,
    maxTeachers: 1,
    maxStudents: 10,
    benefits: ["1 usuario de institución", "1 profesor", "10 estudiantes"]
  },
  "institution-1125": {
    role: "institution",
    name: "Plan Institución 11 a 25 estudiantes",
    amountCOP: 100000,
    maxInstitutionUsers: 1,
    maxTeachers: 1,
    maxStudents: 25,
    benefits: ["1 usuario de institución", "1 profesor", "25 estudiantes"]
  },
  "institution-2660": {
    role: "institution",
    name: "Plan Institución 26 a 60 estudiantes",
    amountCOP: 150000,
    maxInstitutionUsers: 2,
    maxTeachers: 2,
    maxStudents: 60,
    benefits: ["2 usuarios de institución", "2 profesores", "60 estudiantes"]
  },
  "institution-61100": {
    role: "institution",
    name: "Plan Institución 61 a 100 estudiantes",
    amountCOP: 200000,
    maxInstitutionUsers: 2,
    maxTeachers: 3,
    maxStudents: 100,
    benefits: ["2 usuarios de institución", "3 profesores", "100 estudiantes"]
  },
  "institution-101200": {
    role: "institution",
    name: "Plan Institución 101 a 200 estudiantes",
    amountCOP: 250000,
    maxInstitutionUsers: 3,
    maxTeachers: 4,
    maxStudents: 200,
    benefits: ["3 usuarios de institución", "4 profesores", "200 estudiantes"]
  },
  "institution-200plus": {
    role: "institution",
    name: "Plan Institución más de 200 estudiantes",
    amountCOP: 350000,
    maxInstitutionUsers: 4,
    maxTeachers: 5,
    maxStudents: 999999,
    benefits: ["4 usuarios de institución", "5 profesores", "Más de 200 estudiantes"]
  },
  "teacher-monthly": {
    role: "teacher",
    name: "Plan Profesor institucional",
    amountCOP: null,
    benefits: ["Aulas", "Bancos de preguntas", "Mensajería", "Métricas", "Asesor IA"]
  }
};

const SYSTEM_PROMPT = String.raw`
Eres "Asesor IA", un tutor experto de Matemáticas En Tu Bolsillo para estudiantes que preparan matemáticas, admisión UNAL e ICFES Saber 11. Explica con rigor, claridad y pasos verificables.

Puedes resolver preguntas, crear ejercicios tipo examen, proponer práctica por tema, revisar errores y crear planes de estudio. Responde en español claro, con tono profesional y cercano. Usa Markdown y LaTeX cuando haya fórmulas. No inventes datos oficiales si no son necesarios. Si falta información, haz una sola pregunta concreta.

Reglas estrictas de formato matemático:
- Escribe toda fórmula en LaTeX válido delimitado con \( ... \) o \[ ... \].
- No pegues texto normal dentro de fórmulas. Escribe unidades y frases fuera del delimitador o usa \text{...} correctamente.
- No escribas secuencias inválidas como \3por, yelmaterial, $2por o comandos sin llaves.
- Si una expresión mezcla dinero, unidades y texto, sepárala en lenguaje natural: "3 pesos por cm^2" o "\(3\ \text{pesos}/\text{cm}^2\)".
`;

const AI_RATE_LIMIT = {
  perMinute: 6,
  perDay: 120,
  maxInputChars: 4000,
  maxHistoryItems: 12
};

const EMAIL_RATE_LIMIT = {
  perEmailPerHour: 3,
  perIpPerHour: 20
};

const EMAIL_QUEUE = {
  batchSize: 100,
  maxAttempts: 5
};

const QUESTION_CACHE = {
  ttlMs: 2 * 60 * 1000,
  maxEntries: 200
};
const baseQuestionCache = new Map();
const teacherQuestionCache = new Map();

function setCors(res) {
  res.set("Access-Control-Allow-Origin", APP_ORIGIN);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function safeAppUrl(value, fallback = APP_URL) {
  try {
    const url = new URL(String(value || ""), APP_URL);
    if (url.origin !== APP_ORIGIN) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

async function requireAuth(req) {
  const header = String(req.get("Authorization") || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("AUTH_REQUIRED");
  return admin.auth().verifyIdToken(match[1]);
}

async function requireAppCheck(req) {
  const token = String(req.get("X-Firebase-AppCheck") || "").trim();
  if (!token) throw new Error("APP_CHECK_REQUIRED");
  try {
    return await admin.appCheck().verifyToken(token);
  } catch (err) {
    console.warn("App Check inválido", err);
    throw new Error("APP_CHECK_REQUIRED");
  }
}

async function enforceAppCheck(req, res) {
  try {
    await requireAppCheck(req);
    return true;
  } catch {
    res.status(401).json({ error: "No se pudo verificar la seguridad de la app. Recarga e intenta nuevamente." });
    return false;
  }
}

function firestoreDateMillis(value) {
  if (!value) return NaN;
  if (typeof value.toMillis === "function") return value.toMillis();
  return new Date(value).getTime();
}

async function hasServerActiveSubscription(decoded = {}) {
  if (normalizeEmail(decoded.email) === "solanojhonatan2000@gmail.com") return true;
  if (!decoded.uid) return false;
  const snap = await db.collection("users").doc(decoded.uid).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  if (data.institutionAccessRevoked === true || data.institutionMemberStatus === "removed" || data.institutionMemberStatus === "blocked") return false;
  if (data.subscriptionInherited === true && data.institutionSubscriptionStatus === "active") return true;
  if (data.subscriptionStatus !== "active") return false;
  const expiryMs = firestoreDateMillis(data.subscriptionExpiresAt);
  return !Number.isFinite(expiryMs) || expiryMs > Date.now();
}

function roleForAiAccess(data = {}) {
  const role = String(data.role || data.tipoCuenta || "").trim().toLowerCase();
  if (role === "student" || role === "teacher" || role === "institution") return role;
  return "";
}

function subscriptionStillActiveFromData(data = {}) {
  if (data.subscriptionStatus !== "active") return false;
  const expiryMs = firestoreDateMillis(data.subscriptionExpiresAt);
  return !Number.isFinite(expiryMs) || expiryMs > Date.now();
}

async function institutionSubscriptionActive(data = {}) {
  if (data.institutionAccessRevoked === true || data.institutionMemberStatus === "removed" || data.institutionMemberStatus === "blocked") return false;
  if (data.subscriptionInherited === true && data.institutionSubscriptionStatus === "active") return true;
  const dane = normalizeDane(data.institutionDane || data.institutionCode || data.dane || "");
  if (!dane) return false;
  const snap = await db.collection("institutions").doc(dane).get();
  if (!snap.exists) return false;
  return subscriptionStillActiveFromData(snap.data() || {});
}

async function hasServerAiAccess(decoded = {}) {
  if (normalizeEmail(decoded.email) === "solanojhonatan2000@gmail.com") return true;
  if (!decoded.uid) return false;
  const snap = await db.collection("users").doc(decoded.uid).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const role = roleForAiAccess(data);
  if (role !== "student" && role !== "teacher") return false;
  if (data.institutionAccessRevoked === true || data.institutionMemberStatus === "removed" || data.institutionMemberStatus === "blocked") return false;
  if (subscriptionStillActiveFromData(data)) return true;
  return institutionSubscriptionActive(data);
}

async function assertAiRateLimit(uid) {
  const now = new Date();
  const minuteKey = Math.floor(now.getTime() / 60000);
  const dayKey = now.toISOString().slice(0, 10);
  const ref = db.collection("aiRateLimits").doc(uid);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const currentMinuteCount = data.minuteKey === minuteKey ? Number(data.minuteCount || 0) : 0;
    const currentDayCount = data.dayKey === dayKey ? Number(data.dayCount || 0) : 0;
    if (currentMinuteCount >= AI_RATE_LIMIT.perMinute) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    if (currentDayCount >= AI_RATE_LIMIT.perDay) {
      return { allowed: false, retryAfterSeconds: 60 * 60 };
    }
    tx.set(ref, {
      minuteKey,
      minuteCount: currentMinuteCount + 1,
      dayKey,
      dayCount: currentDayCount + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { allowed: true };
  });
}

function clientRateLimitIp(req) {
  return String(req.get("x-forwarded-for") || req.ip || "unknown").split(",")[0].trim() || "unknown";
}

async function assertEmailRateLimit(req, email, purpose) {
  const now = new Date();
  const hourKey = Math.floor(now.getTime() / 3600000);
  const ipHash = sha256(clientRateLimitIp(req)).slice(0, 24);
  const emailHash = sha256(normalizeEmail(email)).slice(0, 24);
  const purposeKey = String(purpose || "email").replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "email";
  const emailRef = db.collection("emailRateLimits").doc(`${purposeKey}_email_${emailHash}`);
  const ipRef = db.collection("emailRateLimits").doc(`${purposeKey}_ip_${ipHash}`);
  return db.runTransaction(async tx => {
    const [emailSnap, ipSnap] = await Promise.all([tx.get(emailRef), tx.get(ipRef)]);
    const emailData = emailSnap.exists ? emailSnap.data() || {} : {};
    const ipData = ipSnap.exists ? ipSnap.data() || {} : {};
    const emailCount = emailData.hourKey === hourKey ? Number(emailData.count || 0) : 0;
    const ipCount = ipData.hourKey === hourKey ? Number(ipData.count || 0) : 0;
    if (emailCount >= EMAIL_RATE_LIMIT.perEmailPerHour || ipCount >= EMAIL_RATE_LIMIT.perIpPerHour) {
      return { allowed: false, retryAfterSeconds: 3600 };
    }
    const payload = { hourKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    tx.set(emailRef, { ...payload, count: emailCount + 1 }, { merge: true });
    tx.set(ipRef, { ...payload, count: ipCount + 1 }, { merge: true });
    return { allowed: true };
  });
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function addYears(date, years = 1) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function priceToCents(amountCOP) {
  const amount = Number(amountCOP);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function safeEmailId(email = "") {
  return normalizeEmail(email).replace(/[^a-z0-9_-]+/g, "_");
}

function normalizeDane(value) {
  return String(value || "").replace(/\D/g, "");
}

function institutionMemberDocId(institutionDane, email) {
  return `${normalizeDane(institutionDane)}_${normalizeEmail(email).replace(/[^\w.-]/g, "_")}`;
}

function planFromInstitutionData(data = {}) {
  const planById = BILLING_PLANS[data.subscriptionPlanId] || BILLING_PLANS[data.planId];
  if (planById) return planById;
  const amount = Number(data.subscriptionAmountCOP || data.amountCOP || 0);
  return Object.values(BILLING_PLANS).find(plan => plan.role === "institution" && Number(plan.amountCOP) === amount) || null;
}

function institutionPlanLimits(data = {}) {
  const plan = planFromInstitutionData(data) || {};
  return {
    maxInstitutionUsers: Number(plan.maxInstitutionUsers || data.maxInstitutionUsers || 0),
    maxTeachers: Number(plan.maxTeachers || data.maxTeachers || 0),
    maxStudents: Number(plan.maxStudents || data.maxStudents || 0)
  };
}

function getByPath(obj, path) {
  return String(path || "").split(".").reduce((acc, key) => acc?.[key], obj);
}

function verifyWompiEventSignature(body, secret) {
  const checksum = body?.signature?.checksum;
  const properties = Array.isArray(body?.signature?.properties) ? body.signature.properties : [];
  if (!checksum || !properties.length || !secret) return false;
  const concatenated = properties.map(prop => {
    const value = getByPath(body.data, prop);
    return value === undefined || value === null ? "" : String(value);
  }).join("") + String(body.timestamp || "") + secret;
  return sha256(concatenated).toLowerCase() === String(checksum).toLowerCase();
}

function buildWompiCheckoutUrl({ publicKey, integritySecret, reference, amountInCents, customerEmail }) {
  const currency = "COP";
  const signature = sha256(`${reference}${amountInCents}${currency}${integritySecret}`);
  const url = new URL(WOMPI_CHECKOUT_URL);
  url.searchParams.set("public-key", publicKey);
  url.searchParams.set("currency", currency);
  url.searchParams.set("amount-in-cents", String(amountInCents));
  url.searchParams.set("reference", reference);
  url.searchParams.set("signature:integrity", signature);
  url.searchParams.set("redirect-url", `${APP_URL}?payment_reference=${encodeURIComponent(reference)}`);
  if (customerEmail) url.searchParams.set("customer-email", customerEmail);
  return url.toString();
}

function normalizeLatex(text) {
  return String(text || "")
    .replace(/\\\[((?:.|\n)*?)\\\]/g, "\n$$$$\n$1\n$$$$\n")
    .replace(/\\\((.*?)\\\)/g, "$$$1$$")
    .replace(/\bTruco PREICFES\b/gi, "Consejo para examen")
    .replace(/\bTruco ICFES\b/gi, "Consejo para examen")
    .replace(/\bTruco UNAL\b/gi, "Consejo para examen");
}

async function generateWithGemini(apiKey, modelName, contents) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(raw || `Gemini API error ${response.status}`);
  const data = JSON.parse(raw);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response did not include text.");
  return normalizeLatex(text.trim());
}

exports.generateAiResponse = onRequest({ region: "us-central1", secrets: [geminiApiKey] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  const apiKey = geminiApiKey.value();
  const { history = [], currentUserInput = "", currentData = {} } = req.body || {};
  if (!apiKey) return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY." });
  const input = String(currentUserInput).trim();
  if (!input) return res.status(400).json({ error: "Mensaje vacío." });
  if (input.length > AI_RATE_LIMIT.maxInputChars) {
    return res.status(400).json({ error: `Mensaje demasiado largo. Máximo ${AI_RATE_LIMIT.maxInputChars} caracteres.` });
  }

  try {
    const decoded = await requireAuth(req);
    const hasAccess = await hasServerAiAccess(decoded);
    if (!hasAccess) {
      return res.status(403).json({ error: "Activa tu suscripción para usar el Asesor IA." });
    }
    const rateLimit = await assertAiRateLimit(decoded.uid);
    if (!rateLimit.allowed) {
      res.set("Retry-After", String(rateLimit.retryAfterSeconds || 60));
      return res.status(429).json({ error: "Has alcanzado el límite temporal del Asesor IA. Intenta nuevamente en unos minutos." });
    }
    const prompt = [
      `Datos actuales del usuario: ${JSON.stringify(currentData)}`,
      `Mensaje actual del usuario: ${input}`,
      "Responde directamente al usuario en Markdown claro y con LaTeX cuando corresponda."
    ].join("\n\n");
    const contents = [
      ...history.slice(-AI_RATE_LIMIT.maxHistoryItems),
      { role: "user", parts: [{ text: prompt }] }
    ];
    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"];
    let lastError;
    for (const model of models) {
      try {
        const responseText = await generateWithGemini(apiKey, model, contents);
        return res.status(200).json({ responseText, action: "RESPOND" });
      } catch (err) {
        lastError = err;
        if (!/429|503|quota|Service Unavailable|Too Many Requests|high demand/i.test(String(err.message))) {
          throw err;
        }
      }
    }
    throw lastError;
  } catch (err) {
    console.error("Gemini error", err);
    if (String(err.message) === "AUTH_REQUIRED") {
      return res.status(401).json({ error: "Debes iniciar sesión para usar el Asesor IA." });
    }
    return res.status(500).json({ error: "No se pudo generar la respuesta con Gemini." });
  }
});

exports.sendPasswordResetEmailCustom = onRequest({ region: "us-central1", secrets: [resendApiKey] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
    return res.status(400).json({ error: "Correo inválido." });
  }

  try {
    const rateLimit = await assertEmailRateLimit(req, email, "password-reset");
    if (!rateLimit.allowed) {
      res.set("Retry-After", String(rateLimit.retryAfterSeconds || 3600));
      return res.status(429).json({ error: "Demasiados intentos. Intenta nuevamente más tarde." });
    }
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: "https://matematicasentubolsillo.com/",
      handleCodeInApp: false
    });
    const token = crypto.randomUUID();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
    await admin.firestore().collection("passwordResetLinks").doc(token).set({
      email,
      resetLink,
      expiresAt,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const protectedLink = `https://us-central1-preguntas-tipo-examen.cloudfunctions.net/consumePasswordResetLink?token=${encodeURIComponent(token)}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
        <h1 style="color:#06345f">Restablece tu contraseña</h1>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Matemáticas En Tu Bolsillo</strong>.</p>
        <p>Por seguridad, este enlace estará disponible durante <strong>10 minutos</strong>.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(protectedLink)}" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Cambiar contraseña</a>
        </p>
        <p>Si el enlace caduca, genera uno nuevo desde la app. Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
      </div>`;
    await sendEmail({
      to: email,
      subject: "Restablece tu contraseña de Matemáticas En Tu Bolsillo",
      html
    });
  } catch (err) {
    console.warn("No se pudo enviar recuperación personalizada.", err);
  }

  return res.status(200).json({ ok: true });
});

exports.consumePasswordResetLink = onRequest({ region: "us-central1" }, async (req, res) => {
  const token = String(req.query?.token || "").trim();
  const expiredUrl = `${APP_URL}?resetExpired=1`;
  if (!token) return res.redirect(302, expiredUrl);
  try {
    const ref = admin.firestore().collection("passwordResetLinks").doc(token);
    const snap = await ref.get();
    if (!snap.exists) return res.redirect(302, expiredUrl);
    const data = snap.data() || {};
    const expiresMs = data.expiresAt?.toMillis?.() || 0;
    if (data.used === true || !expiresMs || expiresMs < Date.now() || !data.resetLink) {
      return res.redirect(302, expiredUrl);
    }
    await ref.set({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return res.redirect(302, data.resetLink);
  } catch (err) {
    console.error("Password reset consume error", err);
    return res.redirect(302, expiredUrl);
  }
});

async function deleteUnverifiedRegistration(email, uid = "") {
  const normalizedEmail = normalizeEmail(email);
  let targetUid = uid;
  try {
    const userRecord = targetUid
      ? await admin.auth().getUser(targetUid)
      : await admin.auth().getUserByEmail(normalizedEmail);
    targetUid = userRecord.uid;
    if (userRecord.emailVerified) return false;
    await admin.auth().deleteUser(targetUid);
  } catch (err) {
    if (err?.code !== "auth/user-not-found") {
      console.warn("No se pudo eliminar Auth no verificado.", normalizedEmail, err);
    }
  }

  const batch = admin.firestore().batch();
  if (targetUid) batch.delete(admin.firestore().collection("users").doc(targetUid));
  const membersSnap = await admin.firestore().collection("institutionMembers")
    .where("email", "==", normalizedEmail)
    .limit(10)
    .get()
    .catch(() => null);
  membersSnap?.docs?.forEach(docSnap => {
    batch.set(docSnap.ref, {
      userUid: admin.firestore.FieldValue.delete(),
      displayName: admin.firestore.FieldValue.delete(),
      registeredAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit().catch(err => console.warn("No se pudo limpiar registro no verificado.", normalizedEmail, err));
  return true;
}

exports.sendEmailVerificationCustom = onRequest({ region: "us-central1", secrets: [resendApiKey] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  const email = normalizeEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
    return res.status(400).json({ error: "Correo inválido." });
  }

  try {
    const rateLimit = await assertEmailRateLimit(req, email, "email-verification");
    if (!rateLimit.allowed) {
      res.set("Retry-After", String(rateLimit.retryAfterSeconds || 3600));
      return res.status(429).json({ error: "Demasiados intentos. Intenta nuevamente más tarde." });
    }
    const userRecord = await admin.auth().getUserByEmail(email);
    if (userRecord.emailVerified) return res.status(200).json({ ok: true });
    const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
      url: "https://matematicasentubolsillo.com/verificado.html",
      handleCodeInApp: false
    });
    const token = crypto.randomUUID();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));
    await admin.firestore().collection("emailVerificationLinks").doc(token).set({
      email,
      uid: userRecord.uid,
      verificationLink,
      expiresAt,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const protectedLink = `https://us-central1-preguntas-tipo-examen.cloudfunctions.net/consumeEmailVerificationLink?token=${encodeURIComponent(token)}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
        <h1 style="color:#06345f">Verifica tu correo</h1>
        <p>Gracias por crear tu cuenta en <strong>Matemáticas En Tu Bolsillo</strong>.</p>
        <p>Para activar tu acceso, confirma que este correo te pertenece.</p>
        <p>Por seguridad, este enlace estará disponible durante <strong>30 minutos</strong>. Si caduca, deberás registrarte nuevamente.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(protectedLink)}" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Verificar correo</a>
        </p>
        <p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
        <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
      </div>`;
    await sendEmail({
      to: email,
      subject: "Verifica tu correo de Matemáticas En Tu Bolsillo",
      html
    });
  } catch (err) {
    console.error("No se pudo enviar verificación personalizada.", err);
    return res.status(500).json({ error: "No se pudo enviar el correo de verificación. Intenta nuevamente o comunícate con soporte." });
  }

  return res.status(200).json({ ok: true });
});

exports.consumeEmailVerificationLink = onRequest({ region: "us-central1" }, async (req, res) => {
  const token = String(req.query?.token || "").trim();
  const expiredUrl = `${APP_URL}?verifyExpired=1`;
  if (!token) return res.redirect(302, expiredUrl);
  try {
    const ref = admin.firestore().collection("emailVerificationLinks").doc(token);
    const snap = await ref.get();
    if (!snap.exists) return res.redirect(302, expiredUrl);
    const data = snap.data() || {};
    const expiresMs = data.expiresAt?.toMillis?.() || 0;
    if (data.used === true || !expiresMs || expiresMs < Date.now() || !data.verificationLink) {
      await deleteUnverifiedRegistration(data.email, data.uid || "");
      await ref.set({ expired: true, expiredAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      return res.redirect(302, expiredUrl);
    }
    await ref.set({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return res.redirect(302, data.verificationLink);
  } catch (err) {
    console.error("Email verification consume error", err);
    return res.redirect(302, expiredUrl);
  }
});

exports.cleanupExpiredEmailVerifications = onSchedule({
  region: "us-central1",
  schedule: "every 15 minutes",
  timeZone: "America/Bogota",
  timeoutSeconds: 300,
  maxInstances: 1,
  retryCount: 1
}, async () => {
  const now = admin.firestore.Timestamp.now();
  const snap = await admin.firestore().collection("emailVerificationLinks")
    .where("expiresAt", "<=", now)
    .limit(50)
    .get();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (data.used === true || data.expired === true) continue;
    await deleteUnverifiedRegistration(data.email, data.uid || "");
    await docSnap.ref.set({
      expired: true,
      expiredAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
});

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

async function sendInviteEmail(invite) {
  const apiKey = resendApiKey.value();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada; no se envió correo.");
  }
  const recipientEmail = invite.email || invite.studentEmail;
  const className = invite.className || "Aula";
  const invitedByInstitution = invite.invitedByType === "institution";
  const invitedRole = invite.invitedRole || "student";
  const senderName = invite.teacherName || invite.institutionName || (invitedByInstitution ? "Tu institución" : "Tu profesor");
  const senderEmail = invite.teacherEmail || invite.institutionEmail || "";
  const acceptUrl = safeAppUrl(invite.acceptUrl);
  if (!recipientEmail || !acceptUrl) return;

  const roleLabel = invitedRole === "teacher" ? "profesor" : "estudiante";
  const title = invitedByInstitution
    ? `Invitación institucional a ${className}`
    : "Invitación a clase";
  const intro = invitedByInstitution
    ? `<strong>${escapeHtml(senderName)}</strong> te inscribió como <strong>${escapeHtml(roleLabel)}</strong> en el aula <strong>${escapeHtml(className)}</strong> de Matemáticas En Tu Bolsillo.`
    : `<strong>${escapeHtml(senderName)}</strong> te invitó a unirte al aula <strong>${escapeHtml(className)}</strong> en Matemáticas En Tu Bolsillo.`;
  const senderLabel = invitedByInstitution ? "Correo de la institución" : "Correo del profesor";
  const buttonText = invitedRole === "teacher" ? "Aceptar invitación" : "Unirme al aula";
  const subject = invitedByInstitution
    ? `${senderName} te invitó a ${className}`
    : `${senderName} te invitó a ${className}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
      <h1 style="color:#06345f">${escapeHtml(title)}</h1>
      <p>${intro}</p>
      ${senderEmail ? `<p>${escapeHtml(senderLabel)}: ${escapeHtml(senderEmail)}</p>` : ""}
      <p style="margin:28px 0">
        <a href="${escapeHtml(acceptUrl)}" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(buttonText)}</a>
      </p>
      <p>Si no esperabas esta invitación, puedes ignorar este correo.</p>
      <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Matemáticas En Tu Bolsillo <noreply@matematicasentubolsillo.com>",
      to: [recipientEmail],
      subject,
      html
    })
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
async function sendEmail({ to, subject, html }) {
  const apiKey = resendApiKey.value();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada; no se envió correo.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Matemáticas En Tu Bolsillo <noreply@matematicasentubolsillo.com>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })
  });
  if (!response.ok) throw new Error(await response.text());
}
async function enqueueEmail({ to, subject, html, type = "generic", sourcePath = "", metadata = {} }) {
  const recipients = (Array.isArray(to) ? to : [to]).map(normalizeEmail).filter(Boolean);
  if (!recipients.length || !subject || !html) return null;
  const ref = db.collection("emailQueue").doc();
  await ref.set({
    to: recipients,
    subject: String(subject).slice(0, 240),
    html,
    type: String(type || "generic").slice(0, 60),
    sourcePath: String(sourcePath || "").slice(0, 300),
    metadata,
    status: "pending",
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function enqueuePaymentReceiptEmail(transaction, options = {}) {
  if (!transaction.email) return null;
  return enqueueEmail({
    to: transaction.email,
    subject: `Comprobante de pago - ${transaction.planName || "Matemáticas En Tu Bolsillo"}`,
    html: buildPaymentReceiptHtml(transaction, options),
    type: "payment-receipt",
    sourcePath: options.sourcePath || "",
    metadata: {
      uid: transaction.uid || "",
      reference: transaction.reference || "",
      transactionId: transaction.transactionId || ""
    }
  });
}

async function updateEmailSource(sourcePath, payload) {
  if (!sourcePath) return;
  try {
    await db.doc(sourcePath).set(payload, { merge: true });
  } catch (err) {
    console.warn("No se pudo actualizar el origen del correo", sourcePath, err);
  }
}

function buildUserClaims(data = {}, email = "") {
  const role = String(data.role || data.tipoCuenta || "").trim().toLowerCase();
  const expiryMs = firestoreDateMillis(data.subscriptionExpiresAt);
  const directActive = data.subscriptionStatus === "active" && (!Number.isFinite(expiryMs) || expiryMs > Date.now());
  const inheritedActive = data.subscriptionInherited === true && data.institutionSubscriptionStatus === "active";
  const blocked = data.institutionAccessRevoked === true || data.institutionAccessBlocked === true || data.institutionPremiumBlocked === true || data.subscriptionPremiumBlocked === true || data.institutionMemberStatus === "removed" || data.institutionMemberStatus === "blocked";
  const platformOwner = normalizeEmail(email || data.email) === "solanojhonatan2000@gmail.com";
  return {
    role: role || null,
    accountMode: String(data.accountMode || data.billingMode || "").slice(0, 32) || null,
    institutionDane: normalizeDane(data.institutionDane || data.institutionCode || data.dane || "") || null,
    subscriptionActive: platformOwner || (!blocked && (directActive || inheritedActive)),
    subscriptionInherited: inheritedActive && !blocked,
    platformOwner
  };
}

async function syncAuthClaimsForUser(uid, data = null) {
  if (!uid) return;
  try {
    const userData = data || ((await db.collection("users").doc(uid).get()).data() || {});
    const authUser = await admin.auth().getUser(uid).catch(() => null);
    const claims = buildUserClaims(userData, authUser?.email || userData.email || "");
    await admin.auth().setCustomUserClaims(uid, claims);
  } catch (err) {
    console.warn("No se pudieron sincronizar custom claims", uid, err);
  }
}

exports.syncUserCustomClaims = onDocumentWritten({
  region: "us-central1",
  document: "users/{uid}",
  maxInstances: 20
}, async event => {
  const uid = event.params.uid;
  if (!event.data.after.exists) {
    await admin.auth().setCustomUserClaims(uid, {}).catch(() => {});
    return;
  }
  await syncAuthClaimsForUser(uid, event.data.after.data() || {});
});

exports.processEmailQueue = onSchedule({
  region: "us-central1",
  schedule: "every 1 minutes",
  timeZone: "America/Bogota",
  secrets: [resendApiKey],
  timeoutSeconds: 300,
  maxInstances: 1,
  retryCount: 1
}, async () => {
  const snap = await db.collection("emailQueue")
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(EMAIL_QUEUE.batchSize)
    .get();
  for (const docSnap of snap.docs) {
    const ref = docSnap.ref;
    const data = docSnap.data() || {};
    const attempts = Number(data.attempts || 0);
    await ref.set({
      status: "sending",
      attempts: attempts + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    try {
      await sendEmail({ to: data.to || [], subject: data.subject || "Notificación", html: data.html || "" });
      await ref.set({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await updateEmailSource(data.sourcePath, {
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        emailStatus: "sent"
      });
    } catch (err) {
      const nextStatus = attempts + 1 >= EMAIL_QUEUE.maxAttempts ? "failed" : "pending";
      await ref.set({
        status: nextStatus,
        lastError: String(err?.message || err).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await updateEmailSource(data.sourcePath, {
        emailStatus: nextStatus === "failed" ? "error" : "pending",
        emailError: String(err?.message || err).slice(0, 500),
        emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
});

function formatCOP(value = 0) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatBogotaDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short"
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}

function buildPaymentReceiptHtml(transaction, options = {}) {
  const paidDate = options.paidDate || new Date();
  const title = "Comprobante de pago";
  const amount = formatCOP(transaction.amountCOP);
  const planName = transaction.planName || transaction.planId || "Plan";
  const reference = transaction.reference || transaction.transactionId || "";
  const method = transaction.paymentMethodLabel || transaction.paymentMethod || "Wompi";
  const buyer = options.displayName || transaction.institutionName || transaction.email || "Usuario";
  const institution = transaction.institutionName
    ? `<tr><td>Institución</td><td>${escapeHtml(transaction.institutionName)}</td></tr>`
    : "";
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#162838;max-width:720px;margin:auto;padding:28px;background:#f6fbfc">
      <div style="background:#ffffff;border:1px solid #d9e8ee;border-radius:18px;padding:28px">
        <p style="margin:0 0 8px;color:#0d9488;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Matemáticas En Tu Bolsillo</p>
        <h1 style="margin:0 0 16px;color:#06345f">${title}</h1>
        <p>Hola ${escapeHtml(buyer)}, recibimos y aprobamos tu pago. Tu suscripción quedó activa en la plataforma.</p>
        <table style="width:100%;border-collapse:collapse;margin:22px 0;background:#fbfdff;border-radius:12px;overflow:hidden">
          <tbody>
            <tr><td style="padding:12px;border-bottom:1px solid #e4edf2;color:#66788a">Plan adquirido</td><td style="padding:12px;border-bottom:1px solid #e4edf2;font-weight:700">${escapeHtml(planName)}</td></tr>
            ${institution}
            <tr><td style="padding:12px;border-bottom:1px solid #e4edf2;color:#66788a">Valor pagado</td><td style="padding:12px;border-bottom:1px solid #e4edf2;font-weight:700">${escapeHtml(amount)}</td></tr>
            <tr><td style="padding:12px;border-bottom:1px solid #e4edf2;color:#66788a">Estado</td><td style="padding:12px;border-bottom:1px solid #e4edf2;font-weight:700;color:#0d9488">Aprobado</td></tr>
            <tr><td style="padding:12px;border-bottom:1px solid #e4edf2;color:#66788a">Medio de pago</td><td style="padding:12px;border-bottom:1px solid #e4edf2">${escapeHtml(method)}</td></tr>
            <tr><td style="padding:12px;border-bottom:1px solid #e4edf2;color:#66788a">Referencia</td><td style="padding:12px;border-bottom:1px solid #e4edf2">${escapeHtml(reference)}</td></tr>
            <tr><td style="padding:12px;color:#66788a">Fecha de aprobación</td><td style="padding:12px">${escapeHtml(formatBogotaDate(paidDate))}</td></tr>
          </tbody>
        </table>
        <p style="font-size:13px;color:#66788a">Este comprobante es emitido por Matemáticas En Tu Bolsillo como soporte interno del pago confirmado por Wompi. No reemplaza factura electrónica si la normatividad aplicable exige un documento adicional.</p>
        <p style="font-size:12px;color:#66788a">Soporte: soporte@matematicasentubolsillo.com</p>
      </div>
    </div>`;
}

async function sendPaymentReceiptEmail(transaction, options = {}) {
  if (!transaction.email) return;
  await sendEmail({
    to: transaction.email,
    subject: `Comprobante de pago - ${transaction.planName || "Matemáticas En Tu Bolsillo"}`,
    html: buildPaymentReceiptHtml(transaction, options)
  });
}

exports.sendClassInviteEmail = onDocumentWritten({
  region: "us-central1",
  document: "classInvites/{inviteId}",
  secrets: [resendApiKey]
}, async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || after.status !== "pending") return;
  if (before && before.inviteToken === after.inviteToken && before.emailSentAt) return;
  await sendInviteEmail(after);
  await event.data.after.ref.set({
    emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    emailStatus: "sent"
  }, { merge: true });
});

exports.sendClassMessageEmail = onDocumentWritten({
  region: "us-central1",
  document: "classMessages/{messageId}",
  secrets: [resendApiKey]
}, async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || before) return;
  const emails = Array.isArray(after.toEmails) ? after.toEmails : [];
  if (!emails.length) return;
  const db = admin.firestore();
  const enabledEmails = [];
  const uniqueEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  for (let i = 0; i < uniqueEmails.length; i += 30) {
    const batch = uniqueEmails.slice(i, i + 30);
    const usersSnap = await db.collection("users").where("email", "in", batch).get();
    const enabledSet = new Set(
      usersSnap.docs
        .map(docSnap => docSnap.data() || {})
        .filter(user => user.notificationsEnabled)
        .map(user => normalizeEmail(user.email))
    );
    enabledEmails.push(...batch.filter(email => enabledSet.has(email)));
  }
  if (!enabledEmails.length) return;
  const messageContent = after.bodyHtml || escapeHtml(after.body || "").replace(/\n/g, "<br>");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
      <h1 style="color:#06345f">${escapeHtml(after.subject || "Nuevo mensaje")}</h1>
      <p><strong>${escapeHtml(after.fromName || "Tu profesor")}</strong> envió un mensaje interno en <strong>${escapeHtml(after.className || "tu aula")}</strong>.</p>
      <div>${messageContent}</div>
      <p>Este correo es solo informativo. Para responder, entra a la app y abre la campana de notificaciones.</p>
      <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
    </div>`;
  await enqueueEmail({
    to: enabledEmails,
    subject: after.subject || "Nuevo mensaje interno",
    html,
    type: "class-message",
    sourcePath: event.data.after.ref.path,
    metadata: { messageId: event.params.messageId || "", className: after.className || "" }
  });
  await event.data.after.ref.set({
    emailQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
    emailStatus: "queued"
  }, { merge: true });
});

exports.sendInternalNotificationEmail = onDocumentWritten({
  region: "us-central1",
  document: "notifications/{notificationId}",
  secrets: [resendApiKey]
}, async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || before || after.emailSentAt || [
    "class-message",
    "billing-reminder",
    "exam-finished",
    "student-exam-finished"
  ].includes(after.type)) return;
  const targetEmail = normalizeEmail(after.targetEmail);
  const targetUid = String(after.targetUid || "");
  if (!targetEmail || !targetUid) return;
  const userSnap = await admin.firestore().collection("users").doc(targetUid).get();
  const user = userSnap.exists ? userSnap.data() : null;
  if (normalizeEmail(user?.email) !== targetEmail) return;
  if (!user?.notificationsEnabled) return;
  const notificationType = String(after.type || "");
  const titleByType = {
    "exam-finished": "Examen terminado",
    "student-exam-finished": "Examen terminado por estudiante",
    "institution-request": "Solicitud institucional",
    "institution-request-status": "Estado de solicitud institucional",
    "message-reply": "Nueva respuesta interna"
  };
  const safeTitle = titleByType[notificationType] || "Nueva notificación";
  const safeBody = notificationType === "exam-finished"
    ? "Terminaste un intento de examen. Revisa la app para ver los detalles disponibles."
    : notificationType === "student-exam-finished"
      ? "Un estudiante completó un intento de examen. Entra a la app para revisar el reporte."
      : notificationType === "institution-request"
        ? "Tienes una solicitud pendiente de revisión en la app."
        : notificationType === "institution-request-status"
          ? "El estado de tu solicitud institucional cambió. Revisa la app para ver el detalle."
          : notificationType === "message-reply"
            ? "Tienes una nueva respuesta interna. Entra a la app para leerla y responder."
            : "Tienes una nueva notificación interna en Matemáticas En Tu Bolsillo.";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
      <h1 style="color:#06345f">${escapeHtml(safeTitle)}</h1>
      <p>${escapeHtml(safeBody)}</p>
      <p>Este correo es solo informativo. Para revisar detalles o responder, entra a la app.</p>
      <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
    </div>`;
  await enqueueEmail({
    to: targetEmail,
    subject: safeTitle,
    html,
    type: "internal-notification",
    sourcePath: event.data.after.ref.path,
    metadata: { notificationId: event.params.notificationId || "", notificationType }
  });
  await event.data.after.ref.set({
    emailQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
    emailStatus: "queued"
  }, { merge: true });
});

exports.sendSubscriptionRenewalReminders = onSchedule({
  region: "us-central1",
  schedule: "0 8 * * *",
  timeZone: "America/Bogota",
  retryCount: 2
}, async () => {
  console.log("Renovaciones automaticas desactivadas: los planes Premium se renuevan manualmente desde Wompi.");
});

exports.createPaymentIntent = onRequest({
  region: "us-central1",
  secrets: [wompiPublicKey, wompiPrivateKey, wompiIntegritySecret]
}, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(401).json({ error: "Debes iniciar sesión para pagar." });
  }

  const body = req.body || {};
  const planId = String(body.planId || "").trim();
  const plan = BILLING_PLANS[planId];
  const paymentMethod = String(body.paymentMethod || "wompi").trim();
  const providerPaymentMethod = String(body.providerPaymentMethod || "").trim() || "WOMPI_CHECKOUT";
  const savePaymentMethod = false;
  const acceptRecurring = false;
  const acceptTerms = body.acceptTerms === true;

  if (!plan) return res.status(400).json({ error: "Plan inválido." });
  if (INSTITUTIONAL_COMMERCE_FROZEN && plan.role === "institution") {
    return res.status(403).json({ error: "Los planes institucionales están congelados temporalmente y no se pueden comprar." });
  }
  if (!acceptTerms) return res.status(400).json({ error: "Debes aceptar las condiciones del servicio." });
  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) return res.status(403).json({ error: "Tu perfil no está registrado para facturación." });
  const userProfile = userSnap.data() || {};
  const userRole = String(userProfile.role || userProfile.tipoCuenta || "").trim();
  const accountMode = String(userProfile.accountMode || userProfile.billingMode || "").trim();
  const institutionDane = String(userProfile.institutionDane || "").replace(/\D/g, "");
  if (plan.role === "student" && (userRole !== "student" || accountMode === "institutional" || institutionDane)) {
    return res.status(403).json({ error: "Este plan es exclusivo para estudiantes independientes." });
  }
  if (plan.role === "institution" && userRole !== "institution") {
    return res.status(403).json({ error: "Este plan es exclusivo para instituciones educativas." });
  }
  if (plan.role === "institution" && !institutionDane) {
    return res.status(400).json({ error: "La institución no tiene código DANE asociado." });
  }
  if (plan.role === "teacher") {
    return res.status(403).json({ error: "Los profesores institucionales no pagan plan propio. La facturación corresponde a la institución." });
  }
  const reference = `MB-${decoded.uid.slice(0, 8).toUpperCase()}-${Date.now()}`;
  const amountInCents = priceToCents(plan.amountCOP);
  const intentRef = db.collection("paymentIntents").doc(reference);
  const baseIntent = {
    uid: decoded.uid,
    email: decoded.email || "",
    planId,
    planName: plan.name,
    role: userRole,
    provider: "Wompi",
    paymentMethod,
    providerPaymentMethod,
    savePaymentMethod,
    acceptRecurring,
    durationYears: plan.durationYears || 1,
    acceptTerms,
    amountCOP: plan.amountCOP,
    amountInCents,
    currency: "COP",
    institutionDane: plan.role === "institution" ? institutionDane : "",
    institutionName: plan.role === "institution" ? (userProfile.institutionName || "") : "",
    maxInstitutionUsers: plan.maxInstitutionUsers || null,
    maxTeachers: plan.maxTeachers || null,
    maxStudents: plan.maxStudents || null,
    reference,
    status: "configuration_pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const publicKey = wompiPublicKey.value();
  const privateKey = wompiPrivateKey.value();
  const integritySecret = wompiIntegritySecret.value();
  const configured = !!(publicKey && privateKey && integritySecret && amountInCents);
  if (!configured) {
    await intentRef.set(baseIntent, { merge: true });
    await db.collection("billingRequests").add({
      uid: decoded.uid,
      email: decoded.email || "",
      type: "payment-intent",
      status: "configuration_pending",
      planId,
      paymentMethod,
      savePaymentMethod,
      reference,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return res.status(200).json({
      ready: false,
      reference,
      message: "El módulo de pagos está listo, pero falta configurar las credenciales de Wompi en Firebase Secrets para habilitar cobros reales."
    });
  }

  const checkoutUrl = buildWompiCheckoutUrl({
    publicKey,
    integritySecret,
    reference,
    amountInCents,
    customerEmail: decoded.email || ""
  });
  await intentRef.set({
    ...baseIntent,
    status: "pending",
    checkoutUrl
  }, { merge: true });
  await db.collection("billingEvents").add({
    type: "payment-intent-created",
    uid: decoded.uid,
    email: decoded.email || "",
    reference,
    planId,
    paymentMethod,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return res.status(200).json({ ready: true, reference, checkoutUrl });
});

exports.wompiWebhook = onRequest({
  region: "us-central1",
  secrets: [wompiEventsSecret, resendApiKey]
}, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const secret = wompiEventsSecret.value();
  if (!verifyWompiEventSignature(req.body || {}, secret)) {
    return res.status(401).json({ error: "Firma inválida." });
  }

  const db = admin.firestore();
  const event = req.body || {};
  const transaction = event?.data?.transaction || event?.data || {};
  const reference = transaction.reference || transaction.payment_link_id || event.reference;
  const transactionId = transaction.id || event.id || reference;
  const status = String(transaction.status || "").toUpperCase();
  const intentSnap = reference ? await db.collection("paymentIntents").doc(reference).get() : null;
  const intent = intentSnap?.exists ? intentSnap.data() : null;

  await db.collection("billingEvents").add({
    provider: "Wompi",
    eventType: event.event || event.type || "unknown",
    transactionId,
    reference: reference || "",
    status,
    raw: event,
    receivedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (!intent) {
    return res.status(200).json({ ok: true, ignored: "intent-not-found" });
  }

  const expectedAmountInCents = Number(intent.amountInCents || 0);
  const receivedAmountInCents = Number(transaction.amount_in_cents || 0);
  const receivedCurrency = String(transaction.currency || "COP").toUpperCase();
  const amountMatches = status !== "APPROVED" || (
    expectedAmountInCents > 0 &&
    receivedAmountInCents === expectedAmountInCents &&
    receivedCurrency === "COP"
  );
  const statusForStorage = status === "APPROVED" && !amountMatches ? "AMOUNT_MISMATCH" : status;
  const transactionDocId = String(transactionId || reference);
  const duplicateApproved = status === "APPROVED" && String(intent.status || "").toUpperCase() === "APPROVED";

  const transactionPayload = {
    uid: intent.uid,
    email: intent.email || "",
    provider: "Wompi",
    transactionId,
    reference,
    planId: intent.planId,
    planName: intent.planName,
    paymentMethod: intent.paymentMethod,
    paymentMethodLabel: intent.paymentMethod === "pse" ? "PSE" : (intent.paymentMethod === "nequi" ? "Nequi" : "Wompi"),
    institutionDane: intent.institutionDane || "",
    institutionName: intent.institutionName || "",
    amountInCents: receivedAmountInCents || expectedAmountInCents,
    amountCOP: (receivedAmountInCents || expectedAmountInCents || 0) / 100,
    currency: receivedCurrency,
    status: statusForStorage,
    amountValidationStatus: amountMatches ? "ok" : "mismatch",
    expectedAmountInCents,
    receivedAmountInCents,
    receiptUrl: transaction.receipt_url || transaction.redirect_url || "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: status === "APPROVED" && amountMatches ? admin.firestore.FieldValue.serverTimestamp() : null
  };
  await db.collection("billingTransactions").doc(transactionDocId).set(transactionPayload, { merge: true });

  if (status === "APPROVED" && !amountMatches) {
    await db.collection("paymentIntents").doc(reference).set({
      status: "AMOUNT_MISMATCH",
      amountValidationStatus: "mismatch",
      expectedAmountInCents,
      receivedAmountInCents,
      receivedCurrency,
      transactionId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("billingEvents").add({
      type: "payment-amount-mismatch",
      reference,
      transactionId,
      expectedAmountInCents,
      receivedAmountInCents,
      receivedCurrency,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return res.status(200).json({ ok: true, ignored: "amount-mismatch" });
  }

  if (duplicateApproved) {
    await db.collection("billingTransactions").doc(transactionDocId).set({
      duplicateIgnored: true,
      duplicateIgnoredAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return res.status(200).json({ ok: true, ignored: "duplicate-approved" });
  }

  await db.collection("paymentIntents").doc(reference).set({
    status: statusForStorage,
    transactionId,
    amountValidationStatus: "ok",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if (status === "APPROVED") {
    const now = new Date();
    const expiresAt = addYears(now, Number(intent.durationYears || 1));
    const userUpdate = {
      subscriptionStatus: "active",
      subscriptionPlan: intent.planName,
      subscriptionStartedAt: admin.firestore.Timestamp.fromDate(now),
      subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      subscriptionAmountCOP: transactionPayload.amountCOP,
      subscriptionAutoRenew: false,
      subscriptionPaymentPaused: true,
      subscriptionNextBillingAt: null,
      paymentProvider: "Wompi",
      lastPaymentId: String(transactionId || reference),
      maxInstitutionUsers: intent.maxInstitutionUsers || null,
      maxTeachers: intent.maxTeachers || null,
      maxStudents: intent.maxStudents || null,
      subscriptionPremiumBlocked: false,
      institutionPremiumBlocked: false,
      institutionAccessBlocked: false,
      institutionAccessRevoked: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("users").doc(intent.uid).set(userUpdate, { merge: true });
    if (intent.role === "institution" && intent.institutionDane) {
      await db.collection("institutions").doc(String(intent.institutionDane)).set({
        subscriptionStatus: "active",
        subscriptionPlan: intent.planName,
        subscriptionPlanId: intent.planId,
        subscriptionStartedAt: admin.firestore.Timestamp.fromDate(now),
        subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        subscriptionAmountCOP: transactionPayload.amountCOP,
        subscriptionAutoRenew: false,
        subscriptionPaymentPaused: true,
        subscriptionNextBillingAt: null,
        paymentProvider: "Wompi",
        lastPaymentId: String(transactionId || reference),
        maxInstitutionUsers: intent.maxInstitutionUsers || null,
        maxTeachers: intent.maxTeachers || null,
        maxStudents: intent.maxStudents || null,
        subscriptionPremiumBlocked: false,
        subscriptionBlockedAt: admin.firestore.FieldValue.delete(),
        subscriptionBlockedByUid: admin.firestore.FieldValue.delete(),
        subscriptionBlockedByEmail: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const institutionUsersSnap = await db.collection("users").where("institutionDane", "==", String(intent.institutionDane)).get();
      let accessBatch = db.batch();
      let accessCount = 0;
      for (const userDoc of institutionUsersSnap.docs) {
        const user = userDoc.data() || {};
        if (["removed", "blocked"].includes(String(user.institutionMemberStatus || ""))) continue;
        const role = String(user.role || user.tipoCuenta || "").toLowerCase();
        const payload = role === "institution"
          ? {
              subscriptionStatus: "active",
              subscriptionPremiumBlocked: false,
              institutionPremiumBlocked: false,
              institutionAccessBlocked: false,
              institutionAccessRevoked: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
          : {
              institutionSubscriptionStatus: "active",
              subscriptionInherited: true,
              institutionPremiumBlocked: false,
              institutionAccessBlocked: false,
              institutionAccessRevoked: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
        accessBatch.set(userDoc.ref, payload, { merge: true });
        accessCount += 1;
        if (accessCount % 450 === 0) {
          await accessBatch.commit();
          accessBatch = db.batch();
        }
      }
      if (accessCount % 450 !== 0) await accessBatch.commit();
    }
    await db.collection("notifications").add({
      targetUid: intent.uid,
      targetEmail: intent.email || "",
      type: "billing",
      title: "Pago aprobado",
      body: `Tu pago de ${intent.planName} fue aprobado. Tu suscripción está activa.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    try {
      await enqueuePaymentReceiptEmail(transactionPayload, {
        paidDate: now,
        displayName: intent.institutionName || "",
        sourcePath: `billingTransactions/${transactionDocId}`
      });
      await db.collection("billingTransactions").doc(transactionDocId).set({
        receiptEmailStatus: "queued",
        receiptEmailQueuedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (emailError) {
      console.warn("No se pudo enviar comprobante de pago.", emailError);
      await db.collection("billingTransactions").doc(transactionDocId).set({
        receiptEmailStatus: "error",
        receiptEmailError: String(emailError?.message || emailError).slice(0, 500),
        receiptEmailUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  if (["DECLINED", "ERROR", "VOIDED"].includes(status)) {
    await db.collection("notifications").add({
      targetUid: intent.uid,
      targetEmail: intent.email || "",
      type: "billing",
      title: "Pago no aprobado",
      body: "La pasarela no aprobó tu pago. Revisa el método de pago e intenta nuevamente.",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return res.status(200).json({ ok: true });
});

exports.processBillingRequest = onDocumentWritten({
  region: "us-central1",
  document: "billingRequests/{requestId}"
}, async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || after.status !== "pending" || before?.status === after.status) return;
  const uid = after.uid;
  if (!uid) return;
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await event.data.after.ref.set({
      status: "failed",
      error: "Usuario no encontrado",
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }
  const user = userSnap.data();
  try {
    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let message = "";

    if (["pause-renewal", "resume-renewal", "remove-payment-method", "set-default-payment-method"].includes(after.type)) {
      throw new Error("La renovación automática y los métodos guardados ya no están disponibles. Renueva manualmente desde Suscripción.");
    } else if (after.type === "upgrade-plan") {
      message = "Solicitud de cambio de plan registrada.";
    } else if (after.type === "payment-intent") {
      message = "Intención de pago registrada. Pendiente de configuración de pasarela.";
    } else {
      throw new Error("Tipo de solicitud no soportado.");
    }

    if (Object.keys(update).length > 1) await userRef.set(update, { merge: true });
    await event.data.after.ref.set({
      status: after.type === "payment-intent" ? "configuration_pending" : "processed",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      message
    }, { merge: true });
    if (message && after.type !== "payment-intent") {
      await db.collection("billingEvents").add({
        uid,
        email: after.email || user.email || "",
        type: after.type,
        message,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) {
    await event.data.after.ref.set({
      status: "failed",
      error: err.message || "No se pudo procesar la solicitud.",
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
});

async function deleteQueryInChunks(querySnapshot, authUids = new Set()) {
  const db = admin.firestore();
  let batch = db.batch();
  let count = 0;
  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data() || {};
    if (data.userUid) authUids.add(String(data.userUid));
    if (data.uid) authUids.add(String(data.uid));
    batch.delete(docSnap.ref);
    count += 1;
    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 450 !== 0) await batch.commit();
  return count;
}

async function deleteByField(collectionName, field, value, authUids) {
  const snap = await admin.firestore().collection(collectionName).where(field, "==", value).get();
  return deleteQueryInChunks(snap, authUids);
}

async function deleteUserProfileAndAuth(uid) {
  if (!uid) return;
  const db = admin.firestore();
  await Promise.all([
    db.collection("users").doc(uid).delete().catch(() => {}),
    db.collection("studentState").doc(uid).delete().catch(() => {})
  ]);
  await admin.auth().deleteUser(uid).catch(err => {
    if (err?.code !== "auth/user-not-found") throw err;
  });
}

exports.deleteInstitutionDeep = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const institutionDane = String(req.body?.institutionDane || "").replace(/\D/g, "");
  const deleteOwnInstitutionAccount = req.body?.deleteOwnInstitutionAccount === true;
  if (!institutionDane) return res.status(400).json({ error: "Falta el código DANE de la institución." });

  const db = admin.firestore();
  const institutionRef = db.collection("institutions").doc(institutionDane);
  const institutionSnap = await institutionRef.get();
  if (!institutionSnap.exists) return res.status(404).json({ error: "Institución no encontrada." });
  const institution = institutionSnap.data();
  const callerEmail = String(decoded.email || "").toLowerCase();
  const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
  const ownsInstitution = institution.ownerUid === decoded.uid;
  if (!isPlatformOwner && !ownsInstitution) {
    return res.status(403).json({ error: "No tienes permiso para eliminar esta institución." });
  }

  const authUids = new Set();
  const usersSnap = await db.collection("users").where("institutionDane", "==", institutionDane).get();
  usersSnap.docs.forEach(docSnap => authUids.add(docSnap.id));

  const deleted = {};
  const relatedCollections = [
    ["institutionMembers", "institutionDane"],
    ["institutionAdmins", "institutionDane"],
    ["classStudents", "institutionDane"],
    ["classInvites", "institutionDane"],
    ["classes", "institutionDane"],
    ["classPermissions", "institutionDane"],
    ["teacherQuestions", "institutionDane"],
    ["classMessages", "institutionDane"],
    ["messageReplies", "institutionDane"],
    ["notifications", "institutionDane"],
    ["billingRequests", "institutionDane"],
    ["billingTransactions", "institutionDane"],
    ["paymentIntents", "institutionDane"],
    ["billingEvents", "institutionDane"]
  ];

  for (const [collectionName, field] of relatedCollections) {
    deleted[collectionName] = await deleteByField(collectionName, field, institutionDane, authUids).catch(err => {
      console.warn(`No se pudo limpiar ${collectionName}`, err);
      return 0;
    });
  }

  await deleteQueryInChunks(usersSnap, authUids);
  await institutionRef.delete();

  for (const uid of authUids) {
    if (!uid) continue;
    if (!isPlatformOwner && uid === decoded.uid && !deleteOwnInstitutionAccount) continue;
    await deleteUserProfileAndAuth(uid).catch(err => console.warn("No se pudo eliminar usuario Auth", uid, err));
  }

  await db.collection("billingEvents").add({
    type: "institution-deep-delete",
    institutionDane,
    institutionName: institution.institutionName || "",
    requestedByUid: decoded.uid,
    requestedByEmail: callerEmail,
    isPlatformOwner,
    deleted,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});

  return res.status(200).json({ ok: true, deleted, authUsersQueued: authUids.size });
});

exports.blockInstitutionPremium = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!(await enforceAppCheck(req, res))) return;

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const callerEmail = normalizeEmail(decoded.email);
  if (callerEmail !== "solanojhonatan2000@gmail.com") {
    return res.status(403).json({ error: "Solo el dueño de la app puede bloquear instituciones." });
  }

  const institutionDane = normalizeDane(req.body?.institutionDane || "");
  if (!institutionDane) return res.status(400).json({ error: "Falta el código DANE de la institución." });

  const institutionRef = db.collection("institutions").doc(institutionDane);
  const institutionSnap = await institutionRef.get();
  if (!institutionSnap.exists) return res.status(404).json({ error: "Institución no encontrada." });

  await institutionRef.set({
    subscriptionStatus: "blocked",
    subscriptionPremiumBlocked: true,
    subscriptionBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
    subscriptionBlockedByUid: decoded.uid,
    subscriptionBlockedByEmail: callerEmail,
    subscriptionInherited: false,
    subscriptionAutoRenew: false,
    subscriptionPaymentPaused: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const usersSnap = await db.collection("users").where("institutionDane", "==", institutionDane).get();
  let batch = db.batch();
  let count = 0;
  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data() || {};
    const role = String(user.role || user.tipoCuenta || "").toLowerCase();
    const payload = role === "institution"
      ? {
          subscriptionStatus: "blocked",
          subscriptionPremiumBlocked: true,
          subscriptionAutoRenew: false,
          subscriptionPaymentPaused: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      : {
          institutionSubscriptionStatus: "blocked",
          institutionAccessBlocked: true,
          institutionPremiumBlocked: true,
          subscriptionInherited: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
    batch.set(userDoc.ref, payload, { merge: true });
    count += 1;
    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 450 !== 0) await batch.commit();

  await db.collection("billingEvents").add({
    type: "institution-premium-block",
    institutionDane,
    requestedByUid: decoded.uid,
    requestedByEmail: callerEmail,
    affectedUsers: count,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});

  return res.status(200).json({ ok: true, affectedUsers: count, message: "Institución bloqueada. Se reactivará automáticamente con un nuevo pago aprobado." });
});
exports.manageInstitutionMembers = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const db = admin.firestore();
  const action = String(req.body?.action || "").trim();
  const institutionDane = normalizeDane(req.body?.institutionDane);
  if (!institutionDane) return res.status(400).json({ error: "Falta el código DANE de la institución." });

  try {
    const institutionRef = db.collection("institutions").doc(institutionDane);
    const institutionSnap = await institutionRef.get();
    if (!institutionSnap.exists) return res.status(404).json({ error: "Institución no encontrada." });
    const institution = institutionSnap.data() || {};
    const callerEmail = normalizeEmail(decoded.email);
    const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
    const ownsInstitution = institution.ownerUid === decoded.uid || normalizeEmail(institution.ownerEmail) === callerEmail;
    if (!isPlatformOwner && !ownsInstitution) {
      return res.status(403).json({ error: "No tienes permiso para administrar integrantes de esta institución." });
    }

    if (action === "add") {
      const role = String(req.body?.role || "").trim();
      const grade = String(req.body?.grade || "").trim();
      const classId = String(req.body?.classId || "").trim();
      const members = Array.isArray(req.body?.members) ? req.body.members : [];
      if (!["student", "teacher"].includes(role)) return res.status(400).json({ error: "Tipo de integrante no válido." });
      if (!members.length) return res.status(400).json({ error: "Agrega al menos un correo válido." });
      if (institution.subscriptionStatus !== "active") {
        return res.status(403).json({ error: "La institución necesita una suscripción activa para agregar integrantes." });
      }


      if (!classId) return res.status(400).json({ error: "Primero selecciona el aula para los integrantes." });
      const classRef = db.collection("classes").doc(classId);
      const classSnap = await classRef.get();
      if (!classSnap.exists) return res.status(404).json({ error: "Aula no encontrada." });
      const classData = classSnap.data() || {};
      if (normalizeDane(classData.institutionDane) !== institutionDane) {
        return res.status(403).json({ error: "El aula seleccionada no pertenece a esta institución." });
      }
      if (!isPlatformOwner && classData.ownerUid !== decoded.uid && classData.ownerUid !== institution.ownerUid) {
        return res.status(403).json({ error: "No tienes permiso para agregar integrantes a esta aula." });
      }
      const cleanedMembers = [];
      const seen = new Set();
      members.forEach(member => {
        const email = normalizeEmail(member?.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) return;
        seen.add(email);
        cleanedMembers.push({
          email,
          name: String(member?.name || "").trim()
        });
      });
      if (!cleanedMembers.length) return res.status(400).json({ error: "Agrega correos válidos." });

      if (role === "student") {
        const existingClassStudentRefs = cleanedMembers.map(member =>
          db.collection("classStudents").doc(`${classId}_${safeEmailId(member.email)}`)
        );
        const existingClassStudents = await db.getAll(...existingClassStudentRefs);
        if (existingClassStudents.some(docSnap => docSnap.exists)) {
          return res.status(409).json({ error: "Estudiante ya inscrito en el aula." });
        }
      }

      const limits = institutionPlanLimits(institution);
      const max = role === "teacher" ? limits.maxTeachers : limits.maxStudents;
      if (!max) return res.status(403).json({ error: "Tu plan actual no permite agregar este tipo de integrante." });

      const result = await db.runTransaction(async transaction => {
        const querySnap = await transaction.get(
          db.collection("institutionMembers")
            .where("institutionDane", "==", institutionDane)
            .where("role", "==", role)
        );
        const activeEmails = new Set();
        const existingStatusByEmail = new Map();
        querySnap.docs.forEach(docSnap => {
          const data = docSnap.data() || {};
          if (data.status !== "removed") {
            const email = normalizeEmail(data.email);
            activeEmails.add(email);
            existingStatusByEmail.set(email, data.status || "pending");
          }
        });
        const incomingNew = cleanedMembers.filter(member => !activeEmails.has(member.email));
        if (activeEmails.size + incomingNew.length > max) {
          const label = role === "teacher" ? "profesor" : "estudiante";
          throw new Error(`Tu plan actual permite máximo ${max} ${label}${max === 1 ? "" : "es"}. Ya tienes ${activeEmails.size} registrado(s). Para agregar más, debes mejorar el plan.`);
        }
        cleanedMembers.forEach(member => {
          const memberRef = db.collection("institutionMembers").doc(institutionMemberDocId(institutionDane, member.email));
          const alreadyActive = activeEmails.has(member.email);
          transaction.set(memberRef, {
            institutionDane,
            institutionName: institution.institutionName || "",
            ownerUid: institution.ownerUid || "",
            ownerEmail: institution.ownerEmail || "",
            name: member.name,
            email: member.email,
            role,
            grade,
            classId,
            className: classData.name || "",
            classCode: classData.code || "",
            classOwnerUid: classData.ownerUid || institution.ownerUid || "",
            classOwnerEmail: classData.ownerEmail || institution.ownerEmail || "",
            status: existingStatusByEmail.get(member.email) === "active" ? "active" : "pending",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(alreadyActive ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() })
          }, { merge: true });
        });
        return { added: cleanedMembers.length, newCount: incomingNew.length, max };
      });

      const inviteBatch = db.batch();
      cleanedMembers.forEach(member => {
        const inviteToken = crypto.randomBytes(24).toString("hex");
        const inviteRef = db.collection("classInvites").doc(`${classId}_${safeEmailId(member.email)}`);
        inviteBatch.set(inviteRef, {
          classId,
          className: classData.name || "",
          classCode: classData.code || "",
          email: member.email,
          studentEmail: member.email,
          studentName: member.name || "",
          invitedRole: role,
          teacherUid: classData.ownerUid || institution.ownerUid || "",
          ownerUid: classData.ownerUid || institution.ownerUid || "",
          teacherEmail: classData.ownerEmail || institution.ownerEmail || "",
          teacherName: institution.institutionName || classData.name || "Tu institución",
          institutionEmail: institution.ownerEmail || "",
          institutionDane,
          institutionName: institution.institutionName || "",
          invitedByUid: decoded.uid,
          invitedByEmail: callerEmail,
          invitedByType: "institution",
          status: "pending",
          inviteToken,
          acceptUrl: `${APP_URL}?classInvite=${encodeURIComponent(inviteToken)}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      await inviteBatch.commit();

      await db.collection("billingEvents").add({
        type: "institution-member-add",
        institutionDane,
        role,
        grade,
        added: result.added,
        newCount: result.newCount,
        max: result.max,
        requestedByUid: decoded.uid,
        requestedByEmail: callerEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});

      return res.status(200).json({
        ok: true,
        ...result,
        message: `${result.added} integrante(s) agregado(s) a la institución.`
      });
    }

    if (action === "remove") {
      const memberId = String(req.body?.memberId || "").trim();
      if (!memberId) return res.status(400).json({ error: "Falta el integrante a eliminar." });
      const memberRef = db.collection("institutionMembers").doc(memberId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) return res.status(404).json({ error: "Integrante no encontrado." });
      const member = memberSnap.data() || {};
      if (normalizeDane(member.institutionDane) !== institutionDane) {
        return res.status(403).json({ error: "El integrante no pertenece a esta institución." });
      }

      await memberRef.update({
        status: "removed",
        removedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const usersSnap = await db.collection("users").where("email", "==", normalizeEmail(member.email)).get();
      const batch = db.batch();
      usersSnap.docs.forEach(userDoc => {
        batch.update(userDoc.ref, {
          institutionAccessRevoked: true,
          institutionMemberStatus: "removed",
          subscriptionInherited: false,
          institutionSubscriptionStatus: "removed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      if (!usersSnap.empty) await batch.commit();

      await db.collection("billingEvents").add({
        type: "institution-member-remove",
        institutionDane,
        memberId,
        memberEmail: normalizeEmail(member.email),
        requestedByUid: decoded.uid,
        requestedByEmail: callerEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});

      return res.status(200).json({ ok: true, message: "Integrante eliminado de la institución." });
    }

    return res.status(400).json({ error: "Acción institucional no válida." });
  } catch (err) {
    console.error("manageInstitutionMembers error", err);
    return res.status(400).json({ error: err?.message || "No fue posible administrar integrantes." });
  }
});

exports.removeInstitutionClassStudent = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }
  const studentId = String(req.body?.studentId || "").trim();
  if (!studentId) return res.status(400).json({ error: "Falta el estudiante a eliminar." });
  try {
    const callerEmail = normalizeEmail(decoded.email);
    const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
    const studentRef = db.collection("classStudents").doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) return res.status(404).json({ error: "Estudiante no encontrado en el aula." });
    const student = studentSnap.data() || {};
    const classId = String(student.classId || student.aulaId || student.grupo || "").trim();
    if (!classId) return res.status(400).json({ error: "El estudiante no tiene aula asociada." });
    const classSnap = await db.collection("classes").doc(classId).get();
    if (!classSnap.exists) return res.status(404).json({ error: "El aula asociada ya no existe." });
    const classData = classSnap.data() || {};
    const institutionDane = normalizeDane(student.institutionDane || classData.institutionDane);
    if (!institutionDane) return res.status(400).json({ error: "El aula no pertenece a una institución." });
    const teacherSnap = await db.collection("institutionMembers").doc(institutionMemberDocId(institutionDane, callerEmail)).get();
    const teacher = teacherSnap.exists ? teacherSnap.data() || {} : {};
    const teacherCanRemove = teacher.role === "teacher" && teacher.status === "active" && String(teacher.classId || "") === classId;
    if (!isPlatformOwner && !teacherCanRemove) {
      return res.status(403).json({ error: "No tienes permiso para eliminar estudiantes de esta aula institucional." });
    }
    const studentEmail = normalizeEmail(student.email);
    const studentUid = String(student.userUid || "");
    await studentRef.delete();
    const remainingSnap = studentEmail
      ? await db.collection("classStudents").where("email", "==", studentEmail).get()
      : { docs: [] };
    const remaining = remainingSnap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .find(item => item.id !== studentId && normalizeDane(item.institutionDane) === institutionDane && String(item.status || "activo") !== "bloqueado");
    const userRefs = [];
    if (studentUid) userRefs.push(db.collection("users").doc(studentUid));
    if (!studentUid && studentEmail) {
      const usersSnap = await db.collection("users").where("email", "==", studentEmail).get();
      usersSnap.docs.forEach(userDoc => userRefs.push(userDoc.ref));
    }
    const batch = db.batch();
    userRefs.forEach(userRef => {
      batch.set(userRef, remaining ? {
        grupo: remaining.classId || remaining.aulaId || "",
        classId: remaining.classId || remaining.aulaId || "",
        className: remaining.className || remaining.groupName || "",
        classCode: remaining.classCode || "",
        classOwnerUid: remaining.ownerUid || remaining.classOwnerUid || "",
        classOwnerEmail: remaining.ownerEmail || remaining.classOwnerEmail || "",
        institutionMemberStatus: "active",
        subscriptionInherited: true,
        institutionSubscriptionStatus: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      } : {
        grupo: "",
        classId: "",
        className: "",
        classCode: "",
        classOwnerUid: "",
        classOwnerEmail: "",
        institutionMemberStatus: "removed",
        subscriptionInherited: false,
        institutionSubscriptionStatus: "removed",
        institutionAccessRevoked: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    if (studentEmail) {
      batch.set(db.collection("institutionMembers").doc(institutionMemberDocId(institutionDane, studentEmail)), remaining ? {
        classId: remaining.classId || remaining.aulaId || "",
        className: remaining.className || remaining.groupName || "",
        classCode: remaining.classCode || "",
        status: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      } : {
        status: "removed",
        removedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
    await db.collection("billingEvents").add({
      type: "institution-teacher-student-remove",
      institutionDane,
      classId,
      studentId,
      studentEmail,
      requestedByUid: decoded.uid,
      requestedByEmail: callerEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
    return res.status(200).json({ ok: true, message: "Estudiante eliminado del aula." });
  } catch (err) {
    console.error("removeInstitutionClassStudent error", err);
    return res.status(400).json({ error: err?.message || "No fue posible eliminar el estudiante institucional." });
  }
});

const COUNTRY_TIMEZONES = {
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

function normalizeTimezoneText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function timezoneConfigFromProfile(profile = {}, fallback = {}) {
  const candidates = [
    profile.timeZone,
    fallback.timeZone,
    profile.countryCode,
    profile.countryId,
    profile.countryIso2,
    profile.countryName,
    profile.country,
    profile.pais,
    profile.institutionCountryCode,
    profile.institutionCountryId,
    profile.institutionCountryName,
    fallback.countryCode,
    fallback.countryId,
    fallback.countryName,
    fallback.country
  ].filter(Boolean);

  const explicitTimeZone = candidates.find(value => String(value).includes("/") && /^[A-Za-z_/-]+$/.test(String(value)));
  if (explicitTimeZone) {
    const known = Object.values(COUNTRY_TIMEZONES).find(item => item.timeZone === explicitTimeZone);
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
    if (COUNTRY_TIMEZONES[upper]) return COUNTRY_TIMEZONES[upper];
    const normalized = normalizeTimezoneText(value);
    const match = Object.values(COUNTRY_TIMEZONES).find(item =>
      item.countryNames.some(name => normalized === name || normalized.includes(name))
    );
    if (match) return match;
  }
  return COUNTRY_TIMEZONES.CO;
}

function zonedNow(timezoneConfig = COUNTRY_TIMEZONES.CO) {
  const now = new Date();
  return {
    date: now,
    iso: now.toISOString(),
    label: new Intl.DateTimeFormat("es-CO", {
      timeZone: timezoneConfig.timeZone,
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    }).format(now)
  };
}

function normalizeExamLevel(level) {
  const value = String(level || "").trim();
  return ["diagnostico", "nivel1", "examen"].includes(value) ? value : "";
}

function toMillisDate(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
}

function examAccessStatus(config = {}, nowMs = Date.now()) {
  const startMs = toMillisDate(config.startAt);
  const endMs = toMillisDate(config.endAt);
  if (startMs && nowMs < startMs) return "scheduled";
  if (endMs && nowMs > endMs) return "closed";
  return "available";
}

function publicExamState(config = {}, nowInfo = zonedNow(), timezoneConfig = COUNTRY_TIMEZONES.CO) {
  const nowMs = nowInfo.date.getTime();
  const status = examAccessStatus(config, nowMs);
  return {
    status,
    available: status === "available",
    feedbackPublished: config.feedbackPublished === true,
    startAt: config.startAt || "",
    endAt: config.endAt || "",
    updatedAt: config.updatedAt || "",
    serverNow: nowInfo.iso,
    serverNowLabel: nowInfo.label,
    timeZone: timezoneConfig.timeZone,
    timeZoneLabel: `${timezoneConfig.label} (${timezoneConfig.timeZone.replace(/_/g, " ")})`,
    countryCode: timezoneConfig.countryCode || ""
  };
}

exports.getExamAccessState = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const classId = String(req.body?.classId || "").trim();
  const level = normalizeExamLevel(req.body?.level);
  if (!classId || !level) return res.status(400).json({ error: "Faltan aula o examen." });

  const db = admin.firestore();
  const [permissionSnap, classSnap, userSnap] = await Promise.all([
    db.collection("classPermissions").doc(classId).get(),
    db.collection("classes").doc(classId).get(),
    db.collection("users").doc(decoded.uid).get()
  ]);

  if (!classSnap.exists) return res.status(404).json({ error: "Aula no encontrada." });
  const classData = classSnap.data() || {};
  const userData = userSnap.exists ? userSnap.data() : {};
  const isTeacherOwner = classData.ownerUid === decoded.uid;
  const isStudentInClass = await isActiveClassMember(classId, decoded, userData);
  const isPlatformOwner = String(decoded.email || "").toLowerCase() === "solanojhonatan2000@gmail.com";
  if (!isPlatformOwner && !isTeacherOwner && !isStudentInClass) {
    return res.status(403).json({ error: "No tienes acceso a esta aula." });
  }

  const permissions = permissionSnap.exists ? permissionSnap.data() : {};
  const config = permissions.examSettings?.[level] || {};
  const timezoneConfig = timezoneConfigFromProfile(userData, req.body || {});
  const nowInfo = zonedNow(timezoneConfig);
  return res.status(200).json({
    ok: true,
    classId,
    level,
    ...publicExamState(config, nowInfo, timezoneConfig)
  });
});

exports.getTeacherExamQuestions = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const classId = String(req.body?.classId || "").trim();
  const ownerUid = String(req.body?.ownerUid || "").trim();
  const level = normalizeExamLevel(req.body?.level);
  const bank = normalizeExamBank(req.body?.bank);
  if (!classId || !ownerUid || !level) return res.status(400).json({ error: "Faltan aula, profesor o examen." });

  const db = admin.firestore();
  const [classSnap, userSnap, permissionSnap] = await Promise.all([
    db.collection("classes").doc(classId).get(),
    db.collection("users").doc(decoded.uid).get(),
    db.collection("classPermissions").doc(classId).get()
  ]);
  if (!classSnap.exists) return res.status(404).json({ error: "Aula no encontrada." });
  const classData = classSnap.data() || {};
  const userData = userSnap.exists ? userSnap.data() : {};
  const callerEmail = normalizeEmail(decoded.email);
  const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
  const isTeacherOwner = classData.ownerUid === decoded.uid && ownerUid === decoded.uid;
  const isStudentInClass = await isActiveClassMember(classId, decoded, userData);
  if (!isPlatformOwner && !isTeacherOwner && !isStudentInClass) {
    return res.status(403).json({ error: "No tienes acceso a estas preguntas." });
  }
  if (classData.ownerUid !== ownerUid && !isPlatformOwner) {
    return res.status(403).json({ error: "El profesor no corresponde a esta aula." });
  }

  const feedbackPublished = permissionSnap.exists &&
    permissionSnap.data()?.examSettings?.[level]?.feedbackPublished === true;
  const questionsSnap = await getTeacherQuestionsFor(ownerUid, level, bank);
  const questions = questionsSnap.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .filter(question =>
      question.active !== false &&
      question.level === level &&
      (question.bank || "principal") === bank &&
      (!question.classId || question.classId === classId)
    )
    .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0))
    .map(question => {
      const base = {
        id: question.id,
        classId: question.classId || "",
        className: question.className || "",
        level: question.level || "",
        bank: question.bank || "",
        questionText: question.questionText || question.pregunta || "",
        questionLatex: question.questionLatex || "",
        imageUrl: question.imageUrl || "",
        imageAlt: question.imageAlt || "Imagen de apoyo para la pregunta",
        options: Array.isArray(question.options) ? question.options : (question.opciones || []),
        active: question.active !== false,
        createdAtMs: Number(question.createdAtMs || 0),
        _questionSource: "teacher",
        _questionId: question.id
      };
      if (isTeacherOwner || isPlatformOwner || feedbackPublished) {
        return {
          ...base,
          correctOption: Number(question.correctOption ?? question.correcta ?? 0),
          explanationText: question.explanationText || question.explicacion || "",
          explanationLatex: question.explanationLatex || ""
        };
      }
      return base;
    });

  return res.status(200).json({ ok: true, classId, ownerUid, level, bank, questions });
});

exports.getExamAttemptFeedback = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const attemptId = String(req.body?.attemptId || "").trim();
  if (!attemptId) return res.status(400).json({ error: "Falta el intento." });

  const db = admin.firestore();
  const attemptSnap = await db.collection("examAttempts").doc(attemptId).get();
  if (!attemptSnap.exists) return res.status(404).json({ error: "Intento no encontrado." });
  const attempt = attemptSnap.data() || {};
  const callerEmail = normalizeEmail(decoded.email);
  const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
  const ownsAttempt = attempt.studentUid === decoded.uid;
  const ownsClassAttempt = attempt.ownerUid === decoded.uid;
  if (!isPlatformOwner && !ownsAttempt && !ownsClassAttempt) {
    return res.status(403).json({ error: "No tienes acceso a este intento." });
  }

  const permissionSnap = await db.collection("classPermissions").doc(attempt.classId || "").get();
  const feedbackPublished = permissionSnap.exists &&
    permissionSnap.data()?.examSettings?.[attempt.level]?.feedbackPublished === true;
  if (!feedbackPublished && !isPlatformOwner && !ownsClassAttempt) {
    return res.status(403).json({ error: "La retroalimentación aún no ha sido publicada." });
  }

  return res.status(200).json({
    ok: true,
    attemptId,
    feedbackPublished,
    gradedSnapshot: Array.isArray(attempt.gradedSnapshot) ? attempt.gradedSnapshot : []
  });
});

exports.updateExamAccessConfig = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const classId = String(req.body?.classId || "").trim();
  const level = normalizeExamLevel(req.body?.level);
  if (!classId || !level) return res.status(400).json({ error: "Faltan aula o examen." });

  const startAt = String(req.body?.startAt || "").trim();
  const endAt = String(req.body?.endAt || "").trim();
  const feedbackPublished = req.body?.feedbackPublished === true;
  const startMs = startAt ? new Date(startAt).getTime() : null;
  const endMs = endAt ? new Date(endAt).getTime() : null;
  if (startAt && !Number.isFinite(startMs)) return res.status(400).json({ error: "Fecha de inicio inválida." });
  if (endAt && !Number.isFinite(endMs)) return res.status(400).json({ error: "Fecha de cierre inválida." });
  if (startMs && endMs && endMs <= startMs) {
    return res.status(400).json({ error: "La fecha de cierre debe ser posterior a la fecha de inicio." });
  }

  const db = admin.firestore();
  const [classSnap, userSnap] = await Promise.all([
    db.collection("classes").doc(classId).get(),
    db.collection("users").doc(decoded.uid).get()
  ]);
  if (!classSnap.exists) return res.status(404).json({ error: "Aula no encontrada." });
  const classData = classSnap.data() || {};
  const userData = userSnap.exists ? userSnap.data() : {};
  const callerEmail = String(decoded.email || "").toLowerCase();
  const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
  if (!isPlatformOwner && classData.ownerUid !== decoded.uid) {
    return res.status(403).json({ error: "Solo el profesor dueño del aula puede configurar el examen." });
  }

  const permissionRef = db.collection("classPermissions").doc(classId);
  const nextConfig = {
    startAt: startAt || "",
    endAt: endAt || "",
    feedbackPublished,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByUid: decoded.uid,
    updatedByEmail: callerEmail
  };
  await permissionRef.set({
    classId,
    ownerUid: classData.ownerUid || decoded.uid,
    className: classData.name || "",
    institutionDane: classData.institutionDane || "",
    examSettings: {
      [level]: nextConfig
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const savedSnap = await permissionRef.get();
  const saved = savedSnap.data()?.examSettings?.[level] || nextConfig;
  const timezoneConfig = timezoneConfigFromProfile(userData, req.body || {});
  const nowInfo = zonedNow(timezoneConfig);
  return res.status(200).json({
    ok: true,
    classId,
    level,
    ...publicExamState(saved, nowInfo, timezoneConfig)
  });
});

function examLevelName(level = "") {
  if (level === "diagnostico") return "Diagnóstico";
  if (level === "nivel1") return "Nivel Medio";
  if (level === "examen") return "Examen Final";
  return String(level || "Examen");
}

function normalizeExamBank(bank = "") {
  return String(bank || "principal").trim() || "principal";
}

function mediumGroupForBank(bank = "principal", classId = "aula") {
  const seed = `${classId || "aula"}-${normalizeExamBank(bank)}`;
  const idx = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5 + 1;
  return `nivel${idx}`;
}

function baseQuestionSetId(level = "", bank = "principal", classId = "aula") {
  if (level === "diagnostico") return "diagnostico";
  if (level === "examen") return "examen";
  return `nivel1_${mediumGroupForBank(bank, classId)}`;
}

function rememberCacheEntry(cache, key, value) {
  if (cache.size >= QUESTION_CACHE.maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + QUESTION_CACHE.ttlMs });
  return value;
}

function readCacheEntry(cache, key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

async function getBaseQuestionsFor(level = "", bank = "principal", classId = "aula") {
  const setId = baseQuestionSetId(level, bank, classId);
  const cacheKey = `base:${setId}`;
  const cached = readCacheEntry(baseQuestionCache, cacheKey);
  if (cached) return cached.map(question => ({
    ...question,
    opciones: Array.isArray(question.opciones) ? [...question.opciones] : []
  }));
  const snap = await db.collection("baseQuestionSets").doc(setId).get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const normalized = questions.map(question => ({
    ...question,
    opciones: Array.isArray(question.opciones) ? [...question.opciones] : []
  }));
  return rememberCacheEntry(baseQuestionCache, cacheKey, normalized).map(question => ({
    ...question,
    opciones: Array.isArray(question.opciones) ? [...question.opciones] : []
  }));
}
async function getTeacherQuestionsFor(ownerUid = "", level = "", bank = "principal") {
  const normalizedBank = normalizeExamBank(bank);
  const cacheKey = `teacher:${ownerUid}:${level}:${normalizedBank}`;
  const cached = readCacheEntry(teacherQuestionCache, cacheKey);
  if (cached) return cached;
  try {
    const snap = await db.collection("teacherQuestions")
      .where("ownerUid", "==", ownerUid)
      .where("level", "==", level)
      .where("bank", "==", normalizedBank)
      .get();
    return rememberCacheEntry(teacherQuestionCache, cacheKey, snap);
  } catch (error) {
    console.warn("teacherQuestions filtered query failed, using owner fallback", error);
    const snap = await db.collection("teacherQuestions")
      .where("ownerUid", "==", ownerUid)
      .get();
    return rememberCacheEntry(teacherQuestionCache, cacheKey, snap);
  }
}

async function isActiveClassMember(classId = "", decoded = {}, userData = {}) {
  const email = normalizeEmail(decoded.email || userData.email);
  const uid = decoded.uid || userData.uid || userData.userUid || "";
  if (!classId || (!email && !uid)) return false;
  const directId = email ? `${classId}_${safeEmailId(email)}` : "";
  const checks = [];
  if (directId) checks.push(db.collection("classStudents").doc(directId).get());
  if (uid) checks.push(db.collection("classStudents").where("classId", "==", classId).where("userUid", "==", uid).limit(1).get());
  if (email) checks.push(db.collection("classStudents").where("classId", "==", classId).where("email", "==", email).limit(1).get());
  const results = await Promise.all(checks);
  const docs = results.flatMap(result => result.docs ? result.docs : (result.exists ? [result] : []));
  return docs.some(docSnap => {
    const data = docSnap.data() || {};
    const status = String(data.status || "activo").toLowerCase();
    return status !== "bloqueado" && status !== "blocked" && status !== "removed" && status !== "eliminado";
  });
}

function safeDocPart(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "item";
}

function calcNotaFromPercent(pct = 0) {
  return Math.round((Math.max(0, Math.min(100, Number(pct) || 0)) / 100 * 5) * 10) / 10;
}

function baseResultKey(key = "") {
  const value = String(key || "");
  return value.includes("::") ? value.split("::").pop() : value;
}

function shouldUseResultKey(resultados = {}, key = "", level = "") {
  if (baseResultKey(key) !== level) return false;
  if (!String(key).includes("::") && resultados[`principal::${level}`]) return false;
  return true;
}

function formatSeconds(totalSeconds = 0) {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function attemptMetrics(level = "", attempt = {}) {
  const answerKey = Array.isArray(attempt.answerKey) ? attempt.answerKey : [];
  const snapshot = Array.isArray(attempt.questionSnapshot) ? attempt.questionSnapshot : [];
  const total = Number(attempt.total || answerKey.length || snapshot.length || (level === "diagnostico" ? 15 : 10));
  const respuestas = Array.isArray(attempt.respuestas) ? attempt.respuestas : [];
  const correctas = answerKey.length
    ? answerKey.reduce((acc, correct, index) => acc + (respuestas[index] === correct ? 1 : 0), 0)
    : 0;
  const incorrectas = Math.max(0, total - correctas);
  const tiempoRestante = Math.max(0, Number(attempt.restante || 0));
  const tiempoTotalSegundos = Math.max(0, 15 * 60 - tiempoRestante);
  const pct = total ? Math.round((correctas / total) * 100) : 0;
  const nota = Math.round((pct / 100 * 5) * 10) / 10;
  return {
    totalQuestions: total,
    correctas,
    incorrectas,
    tiempoTotalSegundos,
    tiempoTotalLabel: formatSeconds(tiempoTotalSegundos),
    segundosPorPregunta: total ? tiempoTotalSegundos / total : 0,
    nota
  };
}

function attemptMetricsFromOfficialAttempt(attempt = {}) {
  const total = Number(attempt.totalQuestions || attempt.total || 0);
  const correctas = Number(attempt.correctas || 0);
  const incorrectas = Number(attempt.incorrectas || Math.max(0, total - correctas));
  const tiempoTotalSegundos = Math.max(0, Number(attempt.tiempoTotalSegundos || 0));
  const nota = Number(attempt.nota || 0);
  return {
    totalQuestions: total,
    correctas,
    incorrectas,
    tiempoTotalSegundos,
    tiempoTotalLabel: formatSeconds(tiempoTotalSegundos),
    segundosPorPregunta: total ? tiempoTotalSegundos / total : 0,
    nota
  };
}

function attemptPresentedMillis(attempt = {}) {
  return toMillisDate(attempt.guardado) ||
    toMillisDate(attempt.presentedAt) ||
    toMillisDate(attempt.createdAt) ||
    toMillisDate(attempt.updatedAt) ||
    null;
}

function formatReportDateParts(ms, timezoneConfig = COUNTRY_TIMEZONES.CO) {
  if (!ms) return { date: "", time: "" };
  const date = new Date(ms);
  return {
    date: new Intl.DateTimeFormat("es-CO", {
      timeZone: timezoneConfig.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date),
    time: new Intl.DateTimeFormat("es-CO", {
      timeZone: timezoneConfig.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date)
  };
}

exports.submitExamAttempt = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const classId = String(req.body?.classId || "").trim();
  const level = normalizeExamLevel(req.body?.level);
  const bank = normalizeExamBank(req.body?.bank);
  const respuestas = Array.isArray(req.body?.respuestas) ? req.body.respuestas.map(value => Number(value)) : [];
  const questionSnapshot = Array.isArray(req.body?.questionSnapshot) ? req.body.questionSnapshot : [];
  const restante = Math.max(0, Number(req.body?.restante || 0));
  if (!classId || !level) return res.status(400).json({ error: "Faltan aula o examen." });
  if (!questionSnapshot.length || respuestas.length !== questionSnapshot.length) {
    return res.status(400).json({ error: "El intento no contiene preguntas y respuestas válidas." });
  }

  const db = admin.firestore();
  const [classSnap, userSnap, permissionSnap] = await Promise.all([
    db.collection("classes").doc(classId).get(),
    db.collection("users").doc(decoded.uid).get(),
    db.collection("classPermissions").doc(classId).get()
  ]);
  if (!classSnap.exists) return res.status(404).json({ error: "Aula no encontrada." });
  const classData = classSnap.data() || {};
  const userData = userSnap.exists ? userSnap.data() : {};
  const userEmail = normalizeEmail(decoded.email);
  const isStudentInClass = await isActiveClassMember(classId, decoded, userData);
  const isPlatformOwner = userEmail === "solanojhonatan2000@gmail.com";
  if (!isPlatformOwner && !isStudentInClass) {
    return res.status(403).json({ error: "No tienes acceso a esta aula." });
  }

  const config = permissionSnap.exists ? (permissionSnap.data()?.examSettings?.[level] || {}) : {};
  const nowMs = Date.now();
  if (examAccessStatus(config, nowMs) !== "available") {
    return res.status(403).json({ error: "El examen no está disponible en este momento." });
  }

  const attemptBaseParts = [decoded.uid, classId, bank, level].map(safeDocPart);

  const teacherSnap = await getTeacherQuestionsFor(classData.ownerUid || "", level, bank);
  const teacherQuestionsById = new Map();
  teacherSnap.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    if (data.active === false) return;
    if (data.level !== level || (data.bank || "principal") !== bank) return;
    if (data.classId && data.classId !== classId) return;
    teacherQuestionsById.set(docSnap.id, { id: docSnap.id, ...data });
  });
  const baseQuestionsById = new Map(
    (await getBaseQuestionsFor(level, bank, classId)).map(question => [
      String(question._questionId || `base-${question.id}`),
      question
    ])
  );
  const requiresBaseBank = questionSnapshot.some(question =>
    String(question?._questionSource || question?.source || "") === "base"
  );
  if (requiresBaseBank && !baseQuestionsById.size) {
    return res.status(503).json({
      error: "El banco base seguro aún no está disponible. Intenta nuevamente en unos minutos."
    });
  }

  let correctas = 0;
  let verifiedQuestions = 0;
  const gradedSnapshot = questionSnapshot.map((question, index) => {
    const source = String(question?._questionSource || question?.source || "legacy");
    const questionId = String(question?._questionId || question?.questionId || question?.id || "");
    const teacherQuestion = source === "teacher" ? teacherQuestionsById.get(questionId) : null;
    const baseQuestion = source === "base" ? baseQuestionsById.get(questionId) : null;
    const officialQuestion = teacherQuestion || baseQuestion || null;
    const trustedCorrect = teacherQuestion
      ? Number(teacherQuestion.correctOption)
      : baseQuestion
        ? Number(baseQuestion.correcta)
        : Number(question?.correcta ?? question?.correctOption);
    const hasTrustedCorrect = Number.isInteger(trustedCorrect) && trustedCorrect >= 0 && trustedCorrect <= 3;
    if (teacherQuestion || baseQuestion) verifiedQuestions++;
    const answer = Number(respuestas[index]);
    const ok = hasTrustedCorrect && answer === trustedCorrect;
    if (ok) correctas++;
    return {
      id: Number(question?.id || index + 1),
      questionId,
      source,
      pregunta: officialQuestion?.questionText || officialQuestion?.pregunta || question?.pregunta || "",
      formula: officialQuestion?.questionLatex
        ? `\\[${officialQuestion.questionLatex}\\]`
        : (officialQuestion?.formula || question?.formula || ""),
      opciones: Array.isArray(officialQuestion?.options)
        ? officialQuestion.options
        : (officialQuestion?.opciones || question?.opciones || question?.options || []),
      imageUrl: officialQuestion?.imageUrl || question?.imageUrl || "",
      imageAlt: officialQuestion?.imageAlt || question?.imageAlt || "",
      respuesta: Number.isInteger(answer) ? answer : -1,
      correcta: hasTrustedCorrect ? trustedCorrect : -1,
      explicacion: [
        officialQuestion?.explanationText || officialQuestion?.explicacion || question?.explicacion || "",
        officialQuestion?.explanationLatex ? `\\[${officialQuestion.explanationLatex}\\]` : ""
      ].filter(Boolean).join("<br>"),
      verifiedByServer: Boolean(teacherQuestion || baseQuestion),
      ok
    };
  });

  const total = gradedSnapshot.length;
  if (total && verifiedQuestions !== total) {
    return res.status(400).json({
      error: "El examen contiene preguntas no verificadas por el servidor. Actualiza la app e intenta nuevamente."
    });
  }
  const incorrectas = Math.max(0, total - correctas);
  const porcentaje = total ? Math.round((correctas / total) * 100) : 0;
  const nota = calcNotaFromPercent(porcentaje);
  const tiempoTotalSegundos = Math.max(0, 15 * 60 - restante);

  const payload = {
    studentUid: decoded.uid,
    studentEmail: userEmail,
    studentName: userData.displayName || userData.name || decoded.name || userEmail,
    classId,
    className: classData.name || classData.className || "",
    classCode: classData.code || "",
    ownerUid: classData.ownerUid || "",
    ownerEmail: normalizeEmail(classData.ownerEmail),
    institutionDane: classData.institutionDane || userData.institutionDane || "",
    level,
    bank,
    examName: examLevelName(level),
    respuestas,
    gradedSnapshot,
    totalQuestions: total,
    correctas,
    incorrectas,
    porcentaje,
    nota,
    restante,
    tiempoTotalSegundos,
    segundosPorPregunta: total ? tiempoTotalSegundos / total : 0,
    serverGraded: true,
    verifiedQuestions,
    allQuestionsVerified: verifiedQuestions === total,
    presentedAt: admin.firestore.FieldValue.serverTimestamp(),
    presentedAtMs: nowMs,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const attemptRefs = [1, 2].map(number =>
    db.collection("examAttempts").doc([...attemptBaseParts, String(number)].join("__"))
  );
  let savedAttemptId = "";
  let savedAttemptNumber = 0;
  try {
    await db.runTransaction(async transaction => {
      const [attemptOneSnap, attemptTwoSnap] = await Promise.all(
        attemptRefs.map(ref => transaction.get(ref))
      );
      if (attemptOneSnap.exists && attemptTwoSnap.exists) {
        throw new Error("MAX_ATTEMPTS_REACHED");
      }
      savedAttemptNumber = attemptOneSnap.exists ? 2 : 1;
      const attemptRef = attemptRefs[savedAttemptNumber - 1];
      savedAttemptId = attemptRef.id;
      transaction.set(attemptRef, {
        ...payload,
        attemptNumber: savedAttemptNumber
      }, { merge: false });
    });
  } catch (error) {
    if (error?.message === "MAX_ATTEMPTS_REACHED") {
      return res.status(403).json({ error: "Ya usaste los 2 intentos permitidos para este examen." });
    }
    throw error;
  }

  return res.status(200).json({
    ok: true,
    attemptId: savedAttemptId,
    attemptNumber: savedAttemptNumber,
    totalQuestions: total,
    correctas,
    incorrectas,
    porcentaje,
    nota,
    tiempoTotalSegundos,
    segundosPorPregunta: payload.segundosPorPregunta,
    serverGraded: true,
    verifiedQuestions,
    allQuestionsVerified: verifiedQuestions === total
  });
});

exports.getAcademicReport = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!(await enforceAppCheck(req, res))) return;
  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const classId = String(req.body?.classId || "").trim();
  const level = normalizeExamLevel(req.body?.level);
  if (!classId || !level) return res.status(400).json({ error: "Faltan aula o examen." });

  const db = admin.firestore();
  const [classSnap, userSnap] = await Promise.all([
    db.collection("classes").doc(classId).get(),
    db.collection("users").doc(decoded.uid).get()
  ]);
  if (!classSnap.exists) return res.status(404).json({ error: "Aula no encontrada." });

  const classData = classSnap.data() || {};
  const callerEmail = String(decoded.email || "").toLowerCase();
  const isPlatformOwner = callerEmail === "solanojhonatan2000@gmail.com";
  if (!isPlatformOwner && classData.ownerUid !== decoded.uid) {
    return res.status(403).json({ error: "Solo el profesor propietario del aula puede consultar este reporte." });
  }

  const userData = userSnap.exists ? userSnap.data() : {};
  const timezoneConfig = timezoneConfigFromProfile(userData, req.body || {});
  const requestedLimit = Number(req.body?.limit || 500);
  const reportLimit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 500, 1), 1000);
  const [membersSnap, officialAttemptsSnap] = await Promise.all([
    db.collection("classStudents").where("classId", "==", classId).get(),
    db.collection("examAttempts")
      .where("classId", "==", classId)
      .where("level", "==", level)
      .orderBy("presentedAtMs", "desc")
      .limit(reportLimit + 1)
      .get()
  ]);

  const members = new Map();
  membersSnap.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const key = data.userUid || data.uid || data.email || docSnap.id;
    members.set(String(key), { id: docSnap.id, ...data });
  });

  const rows = [];
  const attemptDocs = officialAttemptsSnap.docs.slice(0, reportLimit);
  const hasMore = officialAttemptsSnap.docs.length > reportLimit;
  attemptDocs.forEach(docSnap => {
    const attempt = docSnap.data() || {};
    const studentUid = attempt.studentUid || "";
    const studentEmail = attempt.studentEmail || "";
    const member = members.get(studentUid) ||
      [...members.values()].find(item => item.email && studentEmail && normalizeEmail(item.email) === normalizeEmail(studentEmail)) ||
      {};
    const presentedAtMs = Number(attempt.presentedAtMs || attemptPresentedMillis(attempt) || 0);
    const parts = formatReportDateParts(presentedAtMs, timezoneConfig);
    rows.push({
      studentUid,
      studentName: member.name || attempt.studentName || "Sin nombre",
      email: member.email || studentEmail,
      classId,
      className: classData.name || classData.className || attempt.className || "Aula",
      classCode: classData.code || attempt.classCode || "",
      examType: level,
      examName: attempt.examName || examLevelName(level),
      attemptNumber: Number(attempt.attemptNumber || 1),
      presentedAt: presentedAtMs ? new Date(presentedAtMs).toISOString() : "",
      presentedAtMs,
      presentedDate: parts.date,
      presentedTime: parts.time,
      source: "server",
      ...attemptMetricsFromOfficialAttempt(attempt)
    });
  });

  rows.sort((a, b) => String(a.studentName).localeCompare(String(b.studentName), "es") || a.presentedAtMs - b.presentedAtMs);
  return res.status(200).json({
    ok: true,
    classId,
    className: classData.name || "",
    classCode: classData.code || "",
    level,
    examName: examLevelName(level),
    generatedAt: new Date().toISOString(),
    page: {
      limit: reportLimit,
      returned: rows.length,
      hasMore
    },
    rows
  });
});
