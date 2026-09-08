const CLASS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLASS_CODE_LENGTH = 6;
const MAX_CLASS_NAME_LENGTH = 90;
const MAX_CLASS_GRADE_LENGTH = 40;

function normalizeClassCode(code = "") {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
}

function generateClassCode(random = Math.random) {
  return Array.from({ length: CLASS_CODE_LENGTH }, () => {
    const index = Math.floor(random() * CLASS_CODE_CHARS.length);
    return CLASS_CODE_CHARS[Math.max(0, Math.min(CLASS_CODE_CHARS.length - 1, index))];
  }).join("");
}

function sanitizeClassText(value = "", maxLength = MAX_CLASS_NAME_LENGTH) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeClassName(value = "") {
  return sanitizeClassText(value, MAX_CLASS_NAME_LENGTH);
}

function sanitizeClassGrade(value = "") {
  return sanitizeClassText(value, MAX_CLASS_GRADE_LENGTH);
}

module.exports = {
  CLASS_CODE_CHARS,
  CLASS_CODE_LENGTH,
  generateClassCode,
  normalizeClassCode,
  sanitizeClassGrade,
  sanitizeClassName
};
