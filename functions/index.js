const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");

const SYSTEM_PROMPT = String.raw`
Eres "Asesor IA", un tutor experto de Matemáticas En Tu Bolsillo para estudiantes que preparan matemáticas, admisión UNAL e ICFES Saber 11. Explica con rigor, claridad y pasos verificables.

Puedes resolver preguntas, crear ejercicios tipo examen, proponer práctica por tema, revisar errores y crear planes de estudio. Responde en español claro, con tono profesional y cercano. Usa Markdown y LaTeX cuando haya fórmulas. No inventes datos oficiales si no son necesarios. Si falta información, haz una sola pregunta concreta.
`;

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
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
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
    return res.status(400).json({ error: "Correo inválido." });
  }

  try {
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: "https://matematicasentubolsillo.com/",
      handleCodeInApp: false
    });
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162838;max-width:640px;margin:auto;padding:24px">
        <h1 style="color:#06345f">Restablece tu contraseña</h1>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Matemáticas En Tu Bolsillo</strong>.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(resetLink)}" style="background:#0d9488;color:white;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Cambiar contraseña</a>
        </p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
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

exports.sendEmailVerificationCustom = onRequest({ region: "us-central1", secrets: [resendApiKey] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
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
