function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function cleanText(value = "", max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeClassMessageId(value = "") {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,120}$/.test(id) ? id : "";
}

function sanitizeAttachment(item = {}) {
  const url = String(item.url || "").trim();
  const path = String(item.path || "").trim();
  if (!url || !path) return null;
  return {
    name: cleanText(item.name || "Adjunto", 120),
    type: cleanText(item.type || "application/octet-stream", 120),
    size: Math.max(0, Math.min(Number(item.size || 0) || 0, 25 * 1024 * 1024)),
    url: url.slice(0, 1200),
    path: path.slice(0, 500)
  };
}

function sanitizeMessageHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "")
    .trim()
    .slice(0, 40000);
}

function sanitizeClassMessagePayload(body = {}) {
  const classId = cleanText(body.classId, 120);
  const subject = cleanText(body.subject, 140);
  const text = String(body.body || "").trim().slice(0, 12000);
  const bodyHtml = sanitizeMessageHtml(body.bodyHtml);
  const messageId = sanitizeClassMessageId(body.messageId);
  const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
    .map(sanitizeAttachment)
    .filter(Boolean)
    .slice(0, 10);
  return {
    classId,
    subject,
    body: text,
    bodyHtml,
    messageId,
    attachments,
    valid: Boolean(classId && subject && (text || bodyHtml))
  };
}

function normalizeClassMessageRecipient(data = {}) {
  const email = normalizeEmail(data.email || data.studentEmail);
  const status = String(data.status || "activo").trim().toLowerCase();
  if (!email || status !== "activo") return null;
  return {
    email,
    uid: String(data.userUid || data.uid || "").trim()
  };
}

function hasAnyActiveClassMessageRecipient(records = []) {
  return (Array.isArray(records) ? records : []).some(item => !!normalizeClassMessageRecipient(item));
}

function classMessageNotificationPayload({ recipient = {}, message = {}, now }) {
  return {
    targetEmail: recipient.email,
    targetUid: recipient.uid || "",
    type: "class-message",
    title: message.subject || "Nuevo mensaje",
    body: `Nuevo mensaje de ${message.fromName || "Tu profesor"} en ${message.className || "tu aula"}.`,
    messageId: message.id || "",
    classId: message.classId || "",
    fromUid: message.ownerUid || "",
    fromEmail: message.teacherEmail || "",
    read: false,
    createdAt: now
  };
}

function classReplyNotificationPayload({ recipient = {}, message = {}, reply = {}, now }) {
  return {
    targetEmail: recipient.email,
    targetUid: recipient.uid || "",
    type: "message-reply",
    title: `Respuesta a: ${message.subject || "mensaje"}`,
    body: `${reply.fromName || "Tu profesor"} respondió en el hilo del aula.`,
    messageId: message.id || "",
    classId: message.classId || "",
    fromUid: reply.fromUid || message.ownerUid || "",
    fromEmail: reply.fromEmail || message.teacherEmail || "",
    read: false,
    bulkEmailManaged: true,
    createdAt: now
  };
}

module.exports = {
  classMessageNotificationPayload,
  classReplyNotificationPayload,
  hasAnyActiveClassMessageRecipient,
  normalizeClassMessageRecipient,
  sanitizeClassMessageId,
  sanitizeClassMessagePayload,
  sanitizeMessageHtml
};
