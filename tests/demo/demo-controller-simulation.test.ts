import {
  runPrimaryDriftDemo,
  runPrimarySimulationDemo,
  type DemoPresentationState,
} from "../../src/demo/demo-controller";
import {
  AttackPathStatus,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskStatus,
} from "../../src/engine/types";
import { calculateSecurityHealth } from "../../src/engine/health";
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

function simulatedState(): DemoPresentationState {
  return runPrimarySimulationDemo(runPrimaryDriftDemo());
}

function projectedNode(state: DemoPresentationState, id: string) {
  assert(state.simulation, "Expected simulation presentation");
  const node = state.simulation.projectedGraph.nodes.find((candidate) => candidate.id === id);
  assert(node, `Missing projected graph node ${id}`);
  return node;
}

test("1. Drift state is Health 68 before simulation", () => {
  assertEqual(runPrimaryDriftDemo().overview.currentHealth, 68, "Degraded Health mismatch");
});

test("2. Simulation uses the existing remediation action", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.action.id, NOVASTACK_IDS.restrictPublicS3Action, "Simulation Action mismatch");
  assertEqual(state.simulation.dto.action.title, "Restrict Public S3 Access", "Simulation Action title mismatch");
});

test("3. Current state remains Health 68 after simulation", () => {
  const state = simulatedState();
  assertEqual(state.overview.currentHealth, 68, "Current presentation Health changed");
  assertEqual(calculateSecurityHealth(state.currentGraph).score, 68, "Current engine graph Health changed");
});

test("4. Projected state is Health 84", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.health.projected, 84, "Projected Health mismatch");
});

test("5. Simulation reports plus 16", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.health.delta, 16, "Health improvement mismatch");
});

test("6. Simulated S3 configuration is false", () => {
  assertEqual(projectedNode(simulatedState(), NOVASTACK_IDS.s3PublicAccessConfiguration).state, false, "Projected S3 state mismatch");
});

test("7. Simulated attack path is INACTIVE", () => {
  assertEqual(projectedNode(simulatedState(), NOVASTACK_IDS.primaryS3AttackPath).state, AttackPathStatus.INACTIVE, "Projected attack path mismatch");
});

test("8. Simulated HIGH risk is MITIGATED", () => {
  const risk = projectedNode(simulatedState(), NOVASTACK_IDS.customerDataExposureRisk);
  assertEqual(risk.state, RiskStatus.MITIGATED, "Projected risk status mismatch");
  assertEqual(risk.severity, "HIGH", "Projected risk severity mismatch");
});

test("9. Simulated control is VERIFIED", () => {
  assertEqual(projectedNode(simulatedState(), NOVASTACK_IDS.blockPublicS3Control).state, ControlStatus.VERIFIED, "Projected control mismatch");
});

test("10. Simulated evidence is VALID", () => {
  assertEqual(projectedNode(simulatedState(), NOVASTACK_IDS.s3PrivateEvidence).state, EvidenceStatus.VALID, "Projected evidence mismatch");
});

test("11. All three simulated framework mappings are SUPPORTED", () => {
  for (const id of [NOVASTACK_IDS.nistRequirement, NOVASTACK_IDS.cisRequirement, NOVASTACK_IDS.soc2Requirement]) {
    assertEqual(projectedNode(simulatedState(), id).state, FrameworkRequirementStatus.SUPPORTED, `Projected framework ${id} mismatch`);
  }
});

test("12. Simulation reports one attack path deactivated", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.expectedEffects.attackPathsDeactivated, 1, "Attack path effect mismatch");
});

test("13. Simulation reports one HIGH risk mitigated", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.expectedEffects.highRisksMitigated, 1, "Risk effect mismatch");
});

test("14. Simulation reports one critical control restored", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.expectedEffects.criticalControlsRestored, 1, "Control effect mismatch");
});

test("15. Simulation reports one evidence item restored", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.expectedEffects.evidenceRestored, 1, "Evidence effect mismatch");
});

test("16. Simulation reports three framework mappings improved", () => {
  const state = simulatedState();
  assert(state.simulation, "Expected simulation presentation");
  assertEqual(state.simulation.dto.expectedEffects.frameworkMappingsImproved, 3, "Framework effect mismatch");
});

test("17. Original degraded graph remains structurally unchanged", () => {
  const degraded = runPrimaryDriftDemo();
  const before = JSON.stringify(degraded.currentGraph);
  const simulated = runPrimarySimulationDemo(degraded);
  assertEqual(JSON.stringify(degraded.currentGraph), before, "Degraded graph mutated by simulation");
  assertEqual(JSON.stringify(simulated.currentGraph), before, "Simulation presentation replaced current graph");
});

test("18. Repeated demo simulation is deterministic", () => {
  assertDeepEqual(simulatedState(), simulatedState(), "Repeated simulation demo output mismatch");
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
