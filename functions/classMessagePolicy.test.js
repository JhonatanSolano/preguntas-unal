const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classMessageNotificationPayload,
  classReplyNotificationPayload,
  hasAnyActiveClassMessageRecipient,
  normalizeClassMessageRecipient,
  sanitizeClassMessagePayload,
  sanitizeMessageHtml
} = require("./classMessagePolicy");

test("sanitizes class message payload and trims attachments", () => {
  const payload = sanitizeClassMessagePayload({
    classId: " aula-1 ",
    subject: "  Nuevo   tema  ",
    body: " Hola clase ",
    bodyHtml: "<p>Hola</p>",
    messageId: "message_12345",
    attachments: [
      { name: " Guía ", type: "application/pdf", size: 999, url: "https://example.com/a.pdf", path: "classMessages/a/file.pdf" },
      { name: "sin url" }
    ]
  });

  assert.equal(payload.valid, true);
  assert.equal(payload.classId, "aula-1");
  assert.equal(payload.subject, "Nuevo tema");
  assert.equal(payload.messageId, "message_12345");
  assert.equal(payload.attachments.length, 1);
});

test("rejects inactive or email-less class message recipients", () => {
  assert.deepEqual(normalizeClassMessageRecipient({ email: "ALUMNO@MAIL.COM", status: "activo", userUid: "u1" }), {
    email: "alumno@mail.com",
    uid: "u1"
  });
  assert.equal(normalizeClassMessageRecipient({ email: "bloqueado@mail.com", status: "bloqueado" }), null);
  assert.equal(normalizeClassMessageRecipient({ status: "activo" }), null);
});

test("detects when a reply has at least one active class recipient", () => {
  assert.equal(hasAnyActiveClassMessageRecipient([
    { email: "bloqueado@mail.com", status: "bloqueado" },
    { email: "activo@mail.com", status: "activo", userUid: "u2" }
  ]), true);
  assert.equal(hasAnyActiveClassMessageRecipient([
    { email: "sin-activo@mail.com", status: "retirado" },
    { status: "activo" }
  ]), false);
});

test("strips executable html from class messages", () => {
  const html = sanitizeMessageHtml('<p onclick="bad()">Hola</p><script>alert(1)</script><a href="javascript:bad()">x</a>');
  assert.equal(html.includes("script"), false);
  assert.equal(html.includes("onclick"), false);
  assert.equal(html.includes("javascript:"), false);
  assert.equal(html.includes("<p"), true);
});

test("builds notification payload without trusting client fields", () => {
  const payload = classMessageNotificationPayload({
    recipient: { email: "a@mail.com", uid: "u1" },
    message: {
      id: "m1",
      classId: "c1",
      subject: "Clase",
      fromName: "Profe",
      className: "Aula",
      ownerUid: "t1",
      teacherEmail: "t@mail.com"
    },
    now: "SERVER_TIME"
  });

  assert.equal(payload.targetEmail, "a@mail.com");
  assert.equal(payload.body, "Nuevo mensaje de Profe en Aula.");
  assert.equal(payload.fromUid, "t1");
  assert.equal(payload.createdAt, "SERVER_TIME");
});

test("builds class reply notification payload for bulk backend delivery", () => {
  const payload = classReplyNotificationPayload({
    recipient: { email: "a@mail.com", uid: "u1" },
    message: { id: "m1", classId: "c1", subject: "Tarea", ownerUid: "t1" },
    reply: { fromName: "Profe", fromUid: "t1", fromEmail: "t@mail.com" },
    now: "SERVER_TIME"
  });

  assert.equal(payload.type, "message-reply");
  assert.equal(payload.title, "Respuesta a: Tarea");
  assert.equal(payload.bulkEmailManaged, true);
  assert.equal(payload.targetUid, "u1");
});
