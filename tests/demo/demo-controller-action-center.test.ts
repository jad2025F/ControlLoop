import {
  buildBaselineDemoState,
  runPrimaryDriftDemo,
  runPrimarySimulationDemo,
} from "../../src/demo/demo-controller";
import { ActionStatus } from "../../src/engine/types";
import { NOVASTACK_IDS } from "../../src/fixtures/novastack-baseline";

type Test = { name: string; run: () => void };
const tests: Test[] = [];
function test(name: string, run: () => void): void { tests.push({ name, run }); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
}
function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}. Expected ${e}, received ${a}`);
}

function driftAction() {
  const state = runPrimaryDriftDemo();
  assertEqual(state.actionCenter.actions.length, 1, "Expected exactly one Action Center recommendation");
  return state.actionCenter.actions[0];
}

test("1. Baseline Action Center has zero recommended actions", () => {
  assertEqual(buildBaselineDemoState().actionCenter.actions.length, 0, "Baseline Action Center should be empty");
});

test("2. After drift, Action Center has exactly one recommended action", () => {
  assertEqual(runPrimaryDriftDemo().actionCenter.actions.length, 1, "Degraded Action Center count mismatch");
});

test("3. Recommended action is Restrict Public S3 Access", () => {
  const action = driftAction();
  assertEqual(action.actionId, NOVASTACK_IDS.restrictPublicS3Action, "Recommended action ID mismatch");
  assertEqual(action.title, "Restrict Public S3 Access", "Recommended action title mismatch");
  assertEqual(action.status, ActionStatus.RECOMMENDED, "Recommended action status mismatch");
});

test("4. Priority is HIGH", () => {
  assertEqual(driftAction().priority, "HIGH", "Action priority mismatch");
});

test("5. Current configuration value is true", () => {
  assertEqual(driftAction().currentValue, true, "Current configuration value mismatch");
});

test("6. Proposed value is false", () => {
  assertEqual(driftAction().proposedValue, false, "Proposed configuration value mismatch");
});

test("7. Current Health is 68", () => {
  assertEqual(driftAction().currentHealth, 68, "Action Center current Health mismatch");
});

test("8. Projected Health is 84", () => {
  assertEqual(driftAction().projectedHealth, 84, "Action Center projected Health mismatch");
});

test("9. Health improvement is plus 16", () => {
  assertEqual(driftAction().healthImprovement, 16, "Action Center Health improvement mismatch");
});

test("10. Expected effect reports one attack path deactivated", () => {
  assertEqual(driftAction().expectedEffects.attackPathsDeactivated, 1, "Attack path expected effect mismatch");
});

test("11. Expected effect reports one HIGH risk mitigated", () => {
  assertEqual(driftAction().expectedEffects.highRisksMitigated, 1, "HIGH risk expected effect mismatch");
});

test("12. Expected effect reports one critical control restored", () => {
  assertEqual(driftAction().expectedEffects.criticalControlsRestored, 1, "Control expected effect mismatch");
});

test("13. Expected effect reports one evidence item restored", () => {
  assertEqual(driftAction().expectedEffects.evidenceRestored, 1, "Evidence expected effect mismatch");
});

test("14. Expected effect reports three framework mappings improved", () => {
  assertEqual(driftAction().expectedEffects.frameworkMappingsImproved, 3, "Framework expected effect mismatch");
});

test("15. Action Center uses the same simulation outcome as What-If Simulator", () => {
  const degraded = runPrimaryDriftDemo();
  const action = degraded.actionCenter.actions[0];
  const simulated = runPrimarySimulationDemo(degraded);
  assert(simulated.simulation, "Expected What-If simulation presentation");

  assertEqual(action.actionId, simulated.simulation.dto.action.id, "Action Center/What-If action mismatch");
  assertEqual(action.currentHealth, simulated.simulation.dto.health.current, "Current Health mismatch");
  assertEqual(action.projectedHealth, simulated.simulation.dto.health.projected, "Projected Health mismatch");
  assertEqual(action.healthImprovement, simulated.simulation.dto.health.delta, "Health delta mismatch");
  assertDeepEqual(action.expectedEffects, simulated.simulation.dto.expectedEffects, "Expected effects mismatch");
});

test("16. Simulation does not mutate current graph", () => {
  const degraded = runPrimaryDriftDemo();
  const before = JSON.stringify(degraded.currentGraph);
  const simulated = runPrimarySimulationDemo(degraded);
  assertEqual(JSON.stringify(degraded.currentGraph), before, "Simulation mutated source degraded graph");
  assertEqual(JSON.stringify(simulated.currentGraph), before, "Simulation replaced current graph");
});

test("17. Reset returns Action Center to zero recommendations", () => {
  const reset = buildBaselineDemoState();
  assertEqual(reset.mode, "healthy", "Reset mode mismatch");
  assertEqual(reset.actionCenter.actions.length, 0, "Reset Action Center should be empty");
});

test("18. Repeated construction remains deterministic", () => {
  assertDeepEqual(buildBaselineDemoState().actionCenter, buildBaselineDemoState().actionCenter, "Baseline Action Center differs across runs");
  assertDeepEqual(runPrimaryDriftDemo().actionCenter, runPrimaryDriftDemo().actionCenter, "Degraded Action Center differs across runs");
});

let passed = 0;
for (const { name, run } of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Test summary: ${passed} passed, ${tests.length - passed} failed, ${tests.length} total`);
