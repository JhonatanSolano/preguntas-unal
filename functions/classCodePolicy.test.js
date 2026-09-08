const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CLASS_CODE_CHARS,
  CLASS_CODE_LENGTH,
  generateClassCode,
  normalizeClassCode,
  sanitizeClassGrade,
  sanitizeClassName
} = require("./classCodePolicy");

test("generates class codes with the expected length and alphabet", () => {
  const code = generateClassCode(() => 0.999999);

  assert.equal(code.length, CLASS_CODE_LENGTH);
  assert.match(code, new RegExp(`^[${CLASS_CODE_CHARS}]+$`));
});

test("normalizes class codes before reservation lookup", () => {
  assert.equal(normalizeClassCode(" j5 aedj "), "J5AEDJ");
});

test("sanitizes class name and grade without keeping excessive input", () => {
  assert.equal(sanitizeClassName("  Aula   Principal  "), "Aula Principal");
  assert.equal(sanitizeClassGrade("  11   A  "), "11 A");
  assert.equal(sanitizeClassName("x".repeat(120)).length, 90);
  assert.equal(sanitizeClassGrade("x".repeat(120)).length, 40);
});
