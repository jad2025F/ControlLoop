import { buildBaselineDemoState, runPrimaryDriftDemo } from "../../src/demo/demo-controller";
import {
  AttackPathStatus,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskStatus,
} from "../../src/engine/types";
import { NOVASTACK_IDS, novastackBaseline } from "../../src/fixtures/novastack-baseline";
import { novastackS3PublicEvent } from "../../src/fixtures/novastack-s3-public-event";

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

function graphNode(state: ReturnType<typeof buildBaselineDemoState> | ReturnType<typeof runPrimaryDriftDemo>, id: string) {
  const node = state.graph.nodes.find((candidate) => candidate.id === id);
  assert(node, `Missing graph DTO node ${id}`);
  return node;
}

test("1. Baseline presentation Health is 84", () => {
  assertEqual(buildBaselineDemoState().overview.currentHealth, 84, "Baseline Health mismatch");
});

test("2. Baseline reports no security drift", () => {
  assertEqual(buildBaselineDemoState().overview.securityDriftPresent, false, "Baseline drift flag mismatch");
});

test("3. Baseline graph reflects S3 private state", () => {
  assertEqual(graphNode(buildBaselineDemoState(), NOVASTACK_IDS.s3PublicAccessConfiguration).state, false, "Baseline S3 state mismatch");
});

test("4. Running the primary drift demo uses the real event", () => {
  const state = runPrimaryDriftDemo();
  assertEqual(state.eventId, novastackS3PublicEvent.id, "Drift event ID mismatch");
  assert(state.changeImpact, "Expected Change Impact DTO");
  assertEqual(state.changeImpact.event.id, novastackS3PublicEvent.id, "Change Impact event mismatch");
});

test("5. Drift presentation Health is 68", () => {
  assertEqual(runPrimaryDriftDemo().overview.currentHealth, 68, "Degraded Health mismatch");
});

test("6. Drift presentation reports security drift", () => {
  assertEqual(runPrimaryDriftDemo().overview.securityDriftPresent, true, "Degraded drift flag mismatch");
});

test("7. Drift Change Impact reports false to true", () => {
  const impact = runPrimaryDriftDemo().changeImpact;
  assert(impact, "Expected Change Impact DTO");
  assertEqual(impact.configurationChange.beforeValue, false, "Configuration before mismatch");
  assertEqual(impact.configurationChange.afterValue, true, "Configuration after mismatch");
});

test("8. Drift Change Impact reports 84 to 68", () => {
  const impact = runPrimaryDriftDemo().changeImpact;
  assert(impact, "Expected Change Impact DTO");
  assertDeepEqual(impact.health, { before: 84, after: 68, delta: -16 }, "Change Impact Health mismatch");
});

test("9. Drift graph reports active attack path", () => {
  assertEqual(graphNode(runPrimaryDriftDemo(), NOVASTACK_IDS.primaryS3AttackPath).state, AttackPathStatus.ACTIVE, "Attack path mismatch");
});

test("10. Drift graph reports ACTIVE HIGH risk", () => {
  const risk = graphNode(runPrimaryDriftDemo(), NOVASTACK_IDS.customerDataExposureRisk);
  assertEqual(risk.state, RiskStatus.ACTIVE, "Risk status mismatch");
  assertEqual(risk.severity, "HIGH", "Risk severity mismatch");
});

test("11. Drift graph reports DEGRADED control", () => {
  assertEqual(graphNode(runPrimaryDriftDemo(), NOVASTACK_IDS.blockPublicS3Control).state, ControlStatus.DEGRADED, "Control mismatch");
});

test("12. Drift graph reports INVALID evidence", () => {
  assertEqual(graphNode(runPrimaryDriftDemo(), NOVASTACK_IDS.s3PrivateEvidence).state, EvidenceStatus.INVALID, "Evidence mismatch");
});

test("13. Drift graph contains all three affected framework nodes", () => {
  for (const id of [NOVASTACK_IDS.nistRequirement, NOVASTACK_IDS.cisRequirement, NOVASTACK_IDS.soc2Requirement]) {
    assertEqual(graphNode(runPrimaryDriftDemo(), id).state, FrameworkRequirementStatus.AFFECTED, `Framework ${id} mismatch`);
  }
});

test("14. Running the demo does not mutate novastackBaseline", () => {
  const before = JSON.stringify(novastackBaseline);
  runPrimaryDriftDemo();
  assertEqual(JSON.stringify(novastackBaseline), before, "Baseline mutated by demo controller");
});

test("15. Repeated demo construction is deterministic", () => {
  assertDeepEqual(runPrimaryDriftDemo(), runPrimaryDriftDemo(), "Repeated drift demo output mismatch");
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
