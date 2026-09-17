const test = require("node:test");
const assert = require("node:assert/strict");

const { learningProgressIdForBranch } = require("./learningProgressPolicy");

test("learningProgressIdForBranch gates exams by completed branch", () => {
  assert.equal(
    learningProgressIdForBranch({ branchId: "aritmetica" }),
    "aritmetica__branch-complete"
  );
});

test("learningProgressIdForBranch normalizes unsafe route fragments", () => {
  assert.equal(
    learningProgressIdForBranch({ branchId: "álgebra básica/uno" }),
    "_lgebra_b_sica_uno__branch-complete"
  );
  assert.equal(learningProgressIdForBranch({ branchId: "" }), "");
});
