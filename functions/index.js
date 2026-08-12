const admin = require("firebase-admin");
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");
const wompiPublicKey = defineSecret("WOMPI_PUBLIC_KEY");
const wompiPrivateKey = defineSecret("WOMPI_PRIVATE_KEY");
const wompiIntegritySecret = defineSecret("WOMPI_INTEGRITY_SECRET");
const wompiEventsSecret = defineSecret("WOMPI_EVENTS_SECRET");

const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";
const APP_URL = "https://matematicasentubolsillo.com/";

const BILLING_PLANS = {
  "student-monthly": {
    role: "student",
    name: "Plan Estudiante mensual",
    amountCOP: 10000,
    benefits: ["Exámenes", "Estadísticas", "Mensajería académica", "Asesor IA"]
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
    name: "Plan Profesor mensual",
    amountCOP: null,
    benefits: ["Aulas", "Bancos de preguntas", "Mensajería", "Métricas", "Asesor IA"]
  }
};

const SYSTEM_PROMPT = String.raw`
Eres "Asesor IA", un tutor experto de Matemáticas En Tu Bolsillo para estudiantes que preparan matemáticas, admisión UNAL e ICFES Saber 11. Explica con rigor, claridad y pasos verificables.

Puedes resolver preguntas, crear ejercicios tipo examen, proponer práctica por tema, revisar errores y crear planes de estudio. Responde en español claro, con tono profesional y cercano. Usa Markdown y LaTeX cuando haya fórmulas. No inventes datos oficiales si no son necesarios. Si falta información, haz una sola pregunta concreta.
`;

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function requireAuth(req) {
  const header = String(req.get("Authorization") || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("AUTH_REQUIRED");
  return admin.auth().verifyIdToken(match[1]);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function addMonths(date, months = 1) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
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

  const apiKey = geminiApiKey.value();
  const { history = [], currentUserInput = "", currentData = {} } = req.body || {};
  if (!apiKey) return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY." });
  if (!String(currentUserInput).trim()) return res.status(400).json({ error: "Mensaje vacío." });

  try {
    const prompt = [
      `Datos actuales del usuario: ${JSON.stringify(currentData)}`,
      `Mensaje actual del usuario: ${currentUserInput}`,
      "Responde directamente al usuario en Markdown claro y con LaTeX cuando corresponda."
    ].join("\n\n");
    const contents = [
      ...history.slice(-12),
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
    return res.status(500).json({ error: "No se pudo generar la respuesta con Gemini." });
  }
});

exports.sendPasswordResetEmailCustom = onRequest({ region: "us-central1", secrets: [resendApiKey] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
    return res.status(400).json({ error: "Correo inválido." });
  }

  try {
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

exports.sendEmailVerificationCustom = onRequest({ region: "us-central1", secrets: [resendApiKey] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
    return res.status(400).json({ error: "Correo inválido." });
  }

  try {
    const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
      url: "https://matematicasentubolsillo.com/verificado.html",
      handleCodeInApp: false
    });
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
        <h1 style="color:#06345f">Verifica tu correo</h1>
        <p>Gracias por crear tu cuenta en <strong>Matemáticas En Tu Bolsillo</strong>.</p>
        <p>Para activar tu acceso, confirma que este correo te pertenece.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(verificationLink)}" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Verificar correo</a>
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
    console.warn("No se pudo enviar verificación personalizada.", err);
  }

  return res.status(200).json({ ok: true });
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
    console.warn("RESEND_API_KEY no está configurada; no se envió correo.");
    return;
  }
  const studentEmail = invite.email || invite.studentEmail;
  const className = invite.className || "Aula";
  const teacherName = invite.teacherName || "Tu profesor";
  const teacherEmail = invite.teacherEmail || "";
  const acceptUrl = invite.acceptUrl;
  if (!studentEmail || !acceptUrl) return;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
      <h1 style="color:#06345f">Invitación a clase</h1>
      <p><strong>${escapeHtml(teacherName)}</strong> te invitó a unirte al aula <strong>${escapeHtml(className)}</strong> en Matemáticas En Tu Bolsillo.</p>
      <p>Correo del profesor: ${escapeHtml(teacherEmail)}</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(acceptUrl)}" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Unirme a la clase</a>
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
      to: [studentEmail],
      subject: `${teacherName} te invitó a ${className}`,
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
    console.warn("RESEND_API_KEY no está configurada; no se envió correo.");
    return;
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
  for (const email of emails) {
    const users = await db.collection("users").where("email", "==", email).limit(1).get();
    const user = users.docs[0]?.data();
    if (user?.notificationsEnabled) enabledEmails.push(email);
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
  await sendEmail({
    to: enabledEmails,
    subject: after.subject || "Nuevo mensaje interno",
    html
  });
  await event.data.after.ref.set({
    emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    emailStatus: "sent"
  }, { merge: true });
});

exports.sendInternalNotificationEmail = onDocumentWritten({
  region: "us-central1",
  document: "notifications/{notificationId}",
  secrets: [resendApiKey]
}, async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || before || after.emailSentAt || ["class-message", "billing-reminder"].includes(after.type)) return;
  const targetEmail = after.targetEmail;
  if (!targetEmail) return;
  const users = await admin.firestore().collection("users").where("email", "==", targetEmail).limit(1).get();
  const user = users.docs[0]?.data();
  if (!user?.notificationsEnabled) return;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
      <h1 style="color:#06345f">${escapeHtml(after.title || "Nueva notificación")}</h1>
      <p>${escapeHtml(after.body || "Tienes una nueva notificación interna en Matemáticas En Tu Bolsillo.")}</p>
      <p>Este correo es solo informativo. Para revisar detalles o responder, entra a la app.</p>
      <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
    </div>`;
  await sendEmail({
    to: targetEmail,
    subject: after.title || "Nueva notificación",
    html
  });
  await event.data.after.ref.set({
    emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    emailStatus: "sent"
  }, { merge: true });
});

exports.sendSubscriptionRenewalReminders = onSchedule({
  region: "us-central1",
  schedule: "0 8 * * *",
  timeZone: "America/Bogota",
  secrets: [resendApiKey],
  retryCount: 2
}, async () => {
  const db = admin.firestore();
  const now = Date.now();
  const windowStart = admin.firestore.Timestamp.fromMillis(now + (60 * 60 * 1000 * 60));
  const windowEnd = admin.firestore.Timestamp.fromMillis(now + (60 * 60 * 1000 * 84));
  const usersSnap = await db.collection("users")
    .where("subscriptionNextBillingAt", ">=", windowStart)
    .where("subscriptionNextBillingAt", "<", windowEnd)
    .get();

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    if (
      user.subscriptionStatus !== "active" ||
      user.subscriptionAutoRenew === false ||
      user.subscriptionPaymentPaused === true ||
      !user.email
    ) continue;

    const billingDate = user.subscriptionNextBillingAt?.toDate?.();
    if (!billingDate) continue;
    const billingKey = billingDate.toISOString().slice(0, 10);
    const logRef = db.collection("billingReminderLog").doc(`${userDoc.id}_${billingKey}`);
    if ((await logRef.get()).exists) continue;

    const formattedDate = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(billingDate);
    const amount = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(Number(user.subscriptionAmountCOP || 0));
    const plan = user.subscriptionPlan || "tu plan actual";
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
        <h1 style="color:#06345f">Tu suscripción se renovará pronto</h1>
        <p>Hola ${escapeHtml(user.displayName || "")},</p>
        <p>Este es un aviso informativo: el <strong>${escapeHtml(formattedDate)}</strong> se realizará el cobro automático de <strong>${escapeHtml(amount)}</strong> correspondiente a <strong>${escapeHtml(plan)}</strong>.</p>
        <p>El cobro se realizará mediante tu forma de pago principal registrada.</p>
        <div style="padding:16px;background:#fff6e5;border-left:4px solid #d99a20;margin:22px 0">
          <strong>¿No deseas continuar?</strong>
          <p style="margin-bottom:0">Entra a Matemáticas En Tu Bolsillo antes del día de cobro, abre <strong>Facturación</strong> y suspende o cancela la renovación de tu suscripción.</p>
        </div>
        <p style="margin:28px 0">
          <a href="https://matematicasentubolsillo.com/" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Entrar a la app</a>
        </p>
        <p>Si ya suspendiste o cancelaste la renovación, puedes ignorar este mensaje.</p>
        <p style="font-size:12px;color:#66788a">© Todos los derechos reservados. Matemáticas En Tu Bolsillo.</p>
      </div>`;

    await sendEmail({
      to: user.email,
      subject: `Aviso de renovación: cobro programado para el ${formattedDate}`,
      html
    });
    await logRef.set({
      uid: userDoc.id,
      email: user.email,
      billingDate: user.subscriptionNextBillingAt,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      channel: "email",
      status: "sent"
    });
    await db.collection("notifications").add({
      targetUid: userDoc.id,
      targetEmail: user.email,
      type: "billing-reminder",
      title: "Tu suscripción se renovará pronto",
      body: `El ${formattedDate} se cobrará ${amount}. Si no deseas continuar, cancela la renovación desde Facturación antes del cobro.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});

exports.createPaymentIntent = onRequest({
  region: "us-central1",
  secrets: [wompiPublicKey, wompiPrivateKey, wompiIntegritySecret]
}, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(401).json({ error: "Debes iniciar sesión para pagar." });
  }

  const body = req.body || {};
  const planId = String(body.planId || "").trim();
  const plan = BILLING_PLANS[planId];
  const paymentMethod = String(body.paymentMethod || "pse").trim();
  const providerPaymentMethod = String(body.providerPaymentMethod || "").trim() || (paymentMethod === "pse" ? "PSE" : "CARD");
  const savePaymentMethod = body.savePaymentMethod === true;
  const acceptRecurring = body.acceptRecurring === true;
  const acceptTerms = body.acceptTerms === true;

  if (!plan) return res.status(400).json({ error: "Plan inválido." });
  if (!acceptTerms) return res.status(400).json({ error: "Debes aceptar las condiciones del servicio." });
  if (savePaymentMethod && !acceptRecurring) {
    return res.status(400).json({ error: "Para guardar un método debes autorizar la renovación automática." });
  }

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

  const transactionPayload = {
    uid: intent.uid,
    email: intent.email || "",
    provider: "Wompi",
    transactionId,
    reference,
    planId: intent.planId,
    planName: intent.planName,
    paymentMethod: intent.paymentMethod,
    paymentMethodLabel: intent.paymentMethod === "pse" ? "PSE" : (intent.paymentMethod === "nequi" ? "Nequi" : "Tarjeta"),
    institutionDane: intent.institutionDane || "",
    institutionName: intent.institutionName || "",
    amountInCents: transaction.amount_in_cents || intent.amountInCents,
    amountCOP: (transaction.amount_in_cents || intent.amountInCents || 0) / 100,
    currency: transaction.currency || "COP",
    status,
    receiptUrl: transaction.receipt_url || transaction.redirect_url || "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: status === "APPROVED" ? admin.firestore.FieldValue.serverTimestamp() : null
  };
  await db.collection("billingTransactions").doc(String(transactionId || reference)).set(transactionPayload, { merge: true });
  await db.collection("paymentIntents").doc(reference).set({
    status,
    transactionId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if (status === "APPROVED") {
    const now = new Date();
    const expiresAt = addMonths(now, 1);
    const userUpdate = {
      subscriptionStatus: "active",
      subscriptionPlan: intent.planName,
      subscriptionStartedAt: admin.firestore.Timestamp.fromDate(now),
      subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      subscriptionAmountCOP: transactionPayload.amountCOP,
      subscriptionAutoRenew: intent.savePaymentMethod === true,
      subscriptionPaymentPaused: intent.savePaymentMethod !== true,
      subscriptionNextBillingAt: intent.savePaymentMethod === true ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      paymentProvider: "Wompi",
      lastPaymentId: String(transactionId || reference),
      maxInstitutionUsers: intent.maxInstitutionUsers || null,
      maxTeachers: intent.maxTeachers || null,
      maxStudents: intent.maxStudents || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const sourceId = transaction.payment_source_id || transaction.payment_source?.id;
    if (sourceId && intent.savePaymentMethod === true) {
      userUpdate.paymentSourceId = String(sourceId);
      userUpdate.paymentMethods = admin.firestore.FieldValue.arrayUnion({
        id: String(sourceId),
        provider: "Wompi",
        type: "card",
        brand: transaction.payment_method?.extra?.brand || transaction.payment_method_type || "Tarjeta",
        last4: transaction.payment_method?.extra?.last_four || transaction.payment_method?.extra?.last4 || "••••",
        isDefault: true,
        createdAt: admin.firestore.Timestamp.fromDate(now)
      });
    }
    await db.collection("users").doc(intent.uid).set(userUpdate, { merge: true });
    if (intent.role === "institution" && intent.institutionDane) {
      await db.collection("institutions").doc(String(intent.institutionDane)).set({
        subscriptionStatus: "active",
        subscriptionPlan: intent.planName,
        subscriptionPlanId: intent.planId,
        subscriptionStartedAt: admin.firestore.Timestamp.fromDate(now),
        subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        subscriptionAmountCOP: transactionPayload.amountCOP,
        subscriptionAutoRenew: intent.savePaymentMethod === true,
        subscriptionPaymentPaused: intent.savePaymentMethod !== true,
        subscriptionNextBillingAt: intent.savePaymentMethod === true ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
        paymentProvider: "Wompi",
        lastPaymentId: String(transactionId || reference),
        maxInstitutionUsers: intent.maxInstitutionUsers || null,
        maxTeachers: intent.maxTeachers || null,
        maxStudents: intent.maxStudents || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
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
      await sendPaymentReceiptEmail(transactionPayload, { paidDate: now, displayName: intent.institutionName || "" });
      await db.collection("billingTransactions").doc(String(transactionId || reference)).set({
        receiptEmailStatus: "sent",
        receiptEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (emailError) {
      console.warn("No se pudo enviar comprobante de pago.", emailError);
      await db.collection("billingTransactions").doc(String(transactionId || reference)).set({
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
    const methods = Array.isArray(user.paymentMethods) ? user.paymentMethods : [];
    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let message = "";

    if (after.type === "pause-renewal") {
      update.subscriptionPaymentPaused = true;
      update.subscriptionAutoRenew = false;
      message = "Renovación automática suspendida.";
    } else if (after.type === "resume-renewal") {
      if (!methods.length && !user.paymentSourceId) {
        throw new Error("No hay método tokenizado para reactivar la renovación.");
      }
      update.subscriptionPaymentPaused = false;
      update.subscriptionAutoRenew = true;
      message = "Renovación automática reactivada.";
    } else if (after.type === "remove-payment-method") {
      if (methods.length < 2) throw new Error("No se puede eliminar el único método de pago.");
      const nextMethods = methods.filter(method => method.id !== after.paymentMethodId);
      if (nextMethods.length === methods.length) throw new Error("Método de pago no encontrado.");
      if (!nextMethods.some(method => method.isDefault)) nextMethods[0].isDefault = true;
      update.paymentMethods = nextMethods;
      if (user.paymentSourceId === after.paymentMethodId) update.paymentSourceId = nextMethods.find(method => method.isDefault)?.id || "";
      message = "Método de pago eliminado.";
    } else if (after.type === "set-default-payment-method") {
      const nextMethods = methods.map(method => ({
        ...method,
        isDefault: method.id === after.paymentMethodId
      }));
      if (!nextMethods.some(method => method.isDefault)) throw new Error("Método de pago no encontrado.");
      update.paymentMethods = nextMethods;
      update.paymentSourceId = after.paymentMethodId;
      message = "Método principal actualizado.";
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

exports.manageInstitutionMembers = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

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
      const members = Array.isArray(req.body?.members) ? req.body.members : [];
      if (!["student", "teacher"].includes(role)) return res.status(400).json({ error: "Tipo de integrante no válido." });
      if (!members.length) return res.status(400).json({ error: "Agrega al menos un correo válido." });
      if (institution.subscriptionStatus !== "active") {
        return res.status(403).json({ error: "La institución necesita una suscripción activa para agregar integrantes." });
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
        querySnap.docs.forEach(docSnap => {
          const data = docSnap.data() || {};
          if (data.status !== "removed") activeEmails.add(normalizeEmail(data.email));
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
            status: "active",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(alreadyActive ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() })
          }, { merge: true });
        });
        return { added: cleanedMembers.length, newCount: incomingNew.length, max };
      });

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
  const isStudentInClass = userData.classId === classId || userData.claseId === classId || userData.aulaId === classId;
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

exports.updateExamAccessConfig = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

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

exports.getAcademicReport = onRequest({ region: "us-central1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

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
  const [membersSnap, aulaStatesSnap, classStatesSnap] = await Promise.all([
    db.collection("classStudents").where("classId", "==", classId).get(),
    db.collection("studentState").where("aulaId", "==", classId).get(),
    db.collection("studentState").where("claseId", "==", classId).get()
  ]);

  const states = new Map();
  [...aulaStatesSnap.docs, ...classStatesSnap.docs].forEach(docSnap => {
    states.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
  });

  const members = new Map();
  membersSnap.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const key = data.userUid || data.uid || data.email || docSnap.id;
    members.set(String(key), { id: docSnap.id, ...data });
  });
  states.forEach(state => {
    const key = state.uid || state.userUid || state.email || state.id;
    if (!members.has(String(key))) {
      members.set(String(key), {
        id: state.id,
        userUid: state.uid || state.userUid || state.id,
        email: state.email || "",
        name: state.name || state.displayName || state.username || ""
      });
    }
  });

  const rows = [];
  for (const member of members.values()) {
    const memberUid = member.userUid || member.uid || member.id;
    const state = states.get(memberUid) ||
      [...states.values()].find(item => item.email && member.email && String(item.email).toLowerCase() === String(member.email).toLowerCase()) ||
      {};
    const resultados = state.resultados || {};
    Object.entries(resultados).forEach(([key, value]) => {
      if (!shouldUseResultKey(resultados, key, level)) return;
      const attempts = Array.isArray(value?.intentos) ? value.intentos : [];
      attempts.forEach((attempt, index) => {
        const metrics = attemptMetrics(level, attempt);
        const presentedAtMs = attemptPresentedMillis(attempt);
        const parts = formatReportDateParts(presentedAtMs, timezoneConfig);
        rows.push({
          studentUid: memberUid || state.uid || state.userUid || "",
          studentName: member.name || state.name || state.displayName || state.username || "Sin nombre",
          email: member.email || state.email || "",
          classId,
          className: classData.name || classData.className || "Aula",
          classCode: classData.code || "",
          examType: level,
          examName: examLevelName(level),
          attemptNumber: index + 1,
          presentedAt: presentedAtMs ? new Date(presentedAtMs).toISOString() : "",
          presentedAtMs: presentedAtMs || 0,
          presentedDate: parts.date,
          presentedTime: parts.time,
          ...metrics
        });
      });
    });
  }

  rows.sort((a, b) => String(a.studentName).localeCompare(String(b.studentName), "es") || a.presentedAtMs - b.presentedAtMs);
  return res.status(200).json({
    ok: true,
    classId,
    className: classData.name || "",
    classCode: classData.code || "",
    level,
    examName: examLevelName(level),
    generatedAt: new Date().toISOString(),
    rows
  });
});
