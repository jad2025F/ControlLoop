import {
  buildBaselineDemoState,
  runPrimaryDriftDemo,
  runPrimarySimulationDemo,
} from "../../src/demo/demo-controller";

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

function completeRun() {
  const baseline = buildBaselineDemoState();
  const degraded = runPrimaryDriftDemo();
  const simulated = runPrimarySimulationDemo(degraded);
  const reset = buildBaselineDemoState();
  return { baseline, degraded, simulated, reset };
}

test("1. Full demo preserves the approved 84 to 68 to projected 84 path", () => {
  const { baseline, degraded, simulated } = completeRun();
  assertEqual(baseline.overview.currentHealth, 84, "Baseline Health mismatch");
  assertEqual(degraded.overview.currentHealth, 68, "Degraded Health mismatch");
  assert(simulated.simulation, "Expected simulation result");
  assertEqual(simulated.simulation.dto.health.current, 68, "Simulation current Health mismatch");
  assertEqual(simulated.simulation.dto.health.projected, 84, "Simulation projected Health mismatch");
});

test("2. Simulation preserves the current degraded production graph", () => {
  const degraded = runPrimaryDriftDemo();
  const before = JSON.stringify(degraded.currentGraph);
  const simulated = runPrimarySimulationDemo(degraded);
  assertEqual(JSON.stringify(simulated.currentGraph), before, "Simulation changed current production graph");
});

test("3. Reset clears timeline drift, recommendation, and simulation state", () => {
  const { reset } = completeRun();
  assertEqual(reset.mode, "healthy", "Reset mode mismatch");
  assertEqual(reset.timeline.snapshots.length, 1, "Reset timeline should contain only baseline snapshot");
  assertEqual(reset.timeline.transitions.length, 0, "Reset timeline should contain no transition");
  assertEqual(reset.actionCenter.actions.length, 0, "Reset Action Center should have no recommendation");
  assertEqual(reset.simulation, null, "Reset should clear simulation result");
  assertEqual(reset.changeImpact, null, "Reset should clear Change Impact");
});

test("4. Reset graph returns to the same baseline graph DTO", () => {
  const initial = buildBaselineDemoState();
  const { reset } = completeRun();
  assertDeepEqual(reset.graph, initial.graph, "Reset graph differs from fresh baseline graph");
});

test("5. Two complete demo runs are deterministic", () => {
  assertDeepEqual(completeRun(), completeRun(), "Repeated full demo runs differ");
});

test("6. Action Center projection remains aligned with What-If after polish", () => {
  const degraded = runPrimaryDriftDemo();
  const action = degraded.actionCenter.actions[0];
  const simulated = runPrimarySimulationDemo(degraded);
  assert(action, "Expected degraded recommendation");
  assert(simulated.simulation, "Expected What-If simulation");
  assertEqual(action.currentHealth, simulated.simulation.dto.health.current, "Current Health mismatch");
  assertEqual(action.projectedHealth, simulated.simulation.dto.health.projected, "Projected Health mismatch");
  assertDeepEqual(action.expectedEffects, simulated.simulation.dto.expectedEffects, "Expected effects mismatch");
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
