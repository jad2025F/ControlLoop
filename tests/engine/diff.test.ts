import { diffGraphStates } from "../../src/engine/diff";
import { calculateSecurityHealth } from "../../src/engine/health";
import { applyEvent } from "../../src/engine/propagate";
import { simulateAction } from "../../src/engine/simulation";
import {
  ActionStatus,
  AttackPathStatus,
  AttackStepStatus,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskStatus,
  ThreatConditionStatus,
  type GraphDiff,
  type GraphNodeChange,
  type GraphState,
  type SimulationContext,
} from "../../src/engine/types";
import { NOVASTACK_IDS, novastackBaseline } from "../../src/fixtures/novastack-baseline";
import { novastackS3PublicEvent } from "../../src/fixtures/novastack-s3-public-event";

type Test = { name: string; run: () => void };
const tests: Test[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, received ${actualJson}`);
  }
}

const context: SimulationContext = {
  simulationId: "simulation:novastack-s3-remediation-demo",
  timestamp: "2026-09-19T17:45:00-04:00",
};

function buildScenario(): {
  current: GraphState;
  target: GraphState;
  diff: GraphDiff;
} {
  const current = applyEvent(novastackBaseline, novastackS3PublicEvent);
  const simulation = simulateAction(current, NOVASTACK_IDS.restrictPublicS3Action, context);
  const target = simulation.simulatedGraph;
  return { current, target, diff: diffGraphStates(current, target) };
}

function nodeChange(diff: GraphDiff, nodeId: string): GraphNodeChange {
  const change = diff.nodeChanges.find((candidate) => candidate.nodeId === nodeId);
  if (!change) throw new Error(`Expected node change for ${nodeId}`);
  return change;
}

function fieldChange(diff: GraphDiff, nodeId: string, path: string) {
  const change = nodeChange(diff, nodeId).changedFields.find((field) => field.path === path);
  if (!change) throw new Error(`Expected field change ${nodeId}.${path}`);
  return change;
}

test("1. Task 4 scenario produces current Health 68 and projected Health 84", () => {
  const { current, target } = buildScenario();
  assertEqual(calculateSecurityHealth(current).score, 68, "Current Health must be 68");
  assertEqual(calculateSecurityHealth(target).score, 84, "Projected Health must be 84");
});

test("2. Diff Health before is 68", () => {
  assertEqual(buildScenario().diff.healthBefore, 68, "Health before mismatch");
});

test("3. Diff Health after is 84", () => {
  assertEqual(buildScenario().diff.healthAfter, 84, "Health after mismatch");
});

test("4. Diff Health delta is +16", () => {
  assertEqual(buildScenario().diff.healthDelta, 16, "Health delta mismatch");
});

test("5. S3 configuration true to false is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.s3PublicAccessConfiguration, "value");
  assertEqual(change.beforeValue, true, "Configuration before value must be true");
  assertEqual(change.afterValue, false, "Configuration after value must be false");
});

test("6. Threat ACTIVE to INACTIVE is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.publicExposureThreat, "status");
  assertEqual(change.beforeValue, ThreatConditionStatus.ACTIVE, "Threat before status mismatch");
  assertEqual(change.afterValue, ThreatConditionStatus.INACTIVE, "Threat after status mismatch");
});

test("7. Public S3 step ACTIVE to BLOCKED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.publicS3BucketStep, "status");
  assertEqual(change.beforeValue, AttackStepStatus.ACTIVE, "Public S3 step before mismatch");
  assertEqual(change.afterValue, AttackStepStatus.BLOCKED, "Public S3 step after mismatch");
});

test("8. Customer Data step ACTIVE to BLOCKED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.customerDataStep, "status");
  assertEqual(change.beforeValue, AttackStepStatus.ACTIVE, "Customer Data step before mismatch");
  assertEqual(change.afterValue, AttackStepStatus.BLOCKED, "Customer Data step after mismatch");
});

test("9. Attack path ACTIVE to INACTIVE is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.primaryS3AttackPath, "status");
  assertEqual(change.beforeValue, AttackPathStatus.ACTIVE, "Attack path before mismatch");
  assertEqual(change.afterValue, AttackPathStatus.INACTIVE, "Attack path after mismatch");
});

test("10. HIGH risk ACTIVE to MITIGATED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.customerDataExposureRisk, "status");
  assertEqual(change.beforeValue, RiskStatus.ACTIVE, "Risk before mismatch");
  assertEqual(change.afterValue, RiskStatus.MITIGATED, "Risk after mismatch");
});

test("11. Control DEGRADED to VERIFIED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.blockPublicS3Control, "status");
  assertEqual(change.beforeValue, ControlStatus.DEGRADED, "Control before mismatch");
  assertEqual(change.afterValue, ControlStatus.VERIFIED, "Control after mismatch");
});

test("12. Evidence INVALID to VALID is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.s3PrivateEvidence, "status");
  assertEqual(change.beforeValue, EvidenceStatus.INVALID, "Evidence before mismatch");
  assertEqual(change.afterValue, EvidenceStatus.VALID, "Evidence after mismatch");
});

test("13. Evidence observed value true to false is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.s3PrivateEvidence, "observedValue");
  assertEqual(change.beforeValue, true, "Evidence observed before mismatch");
  assertEqual(change.afterValue, false, "Evidence observed after mismatch");
});

test("14. NIST AFFECTED to SUPPORTED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.nistRequirement, "status");
  assertEqual(change.beforeValue, FrameworkRequirementStatus.AFFECTED, "NIST before mismatch");
  assertEqual(change.afterValue, FrameworkRequirementStatus.SUPPORTED, "NIST after mismatch");
});

test("15. CIS AFFECTED to SUPPORTED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.cisRequirement, "status");
  assertEqual(change.beforeValue, FrameworkRequirementStatus.AFFECTED, "CIS before mismatch");
  assertEqual(change.afterValue, FrameworkRequirementStatus.SUPPORTED, "CIS after mismatch");
});

test("16. SOC2 AFFECTED to SUPPORTED is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.soc2Requirement, "status");
  assertEqual(change.beforeValue, FrameworkRequirementStatus.AFFECTED, "SOC2 before mismatch");
  assertEqual(change.afterValue, FrameworkRequirementStatus.SUPPORTED, "SOC2 after mismatch");
});

test("17. Action RECOMMENDED to AVAILABLE is detected", () => {
  const change = fieldChange(buildScenario().diff, NOVASTACK_IDS.restrictPublicS3Action, "status");
  assertEqual(change.beforeValue, ActionStatus.RECOMMENDED, "Action before mismatch");
  assertEqual(change.afterValue, ActionStatus.AVAILABLE, "Action after mismatch");
});

test("18. Summary reports exactly one attack path deactivated", () => {
  assertEqual(buildScenario().diff.semanticSummary.attackPathsDeactivated, 1, "Attack-path count mismatch");
});

test("19. Summary reports exactly one HIGH risk mitigated", () => {
  assertEqual(buildScenario().diff.semanticSummary.highRisksMitigated, 1, "HIGH-risk count mismatch");
});

test("20. Summary reports exactly one critical control restored", () => {
  assertEqual(buildScenario().diff.semanticSummary.criticalControlsRestored, 1, "Control count mismatch");
});

test("21. Summary reports exactly one evidence item restored", () => {
  assertEqual(buildScenario().diff.semanticSummary.evidenceRestored, 1, "Evidence count mismatch");
});

test("22. Summary reports exactly three framework mappings improved", () => {
  assertEqual(buildScenario().diff.semanticSummary.frameworkRequirementsImproved, 3, "Framework count mismatch");
});

test("23. Summary reports exactly one recommendation resolved", () => {
  assertEqual(buildScenario().diff.semanticSummary.recommendationsResolved, 1, "Recommendation count mismatch");
});

test("24. Primary diff reports zero added edges", () => {
  assertEqual(buildScenario().diff.edgeChanges.added.length, 0, "No edges should be added");
});

test("25. Primary diff reports zero removed edges", () => {
  assertEqual(buildScenario().diff.edgeChanges.removed.length, 0, "No edges should be removed");
});

test("26. Identical graph compared to itself has no semantic changes and Health delta 0", () => {
  const current = applyEvent(novastackBaseline, novastackS3PublicEvent);
  const diff = diffGraphStates(current, current);
  assertEqual(diff.nodeChanges.length, 0, "Identical graph must have no node changes");
  assertEqual(diff.edgeChanges.added.length, 0, "Identical graph must have no added edges");
  assertEqual(diff.edgeChanges.removed.length, 0, "Identical graph must have no removed edges");
  assertEqual(diff.healthDelta, 0, "Identical graph Health delta must be 0");
});

test("27. Diff does not mutate source graph", () => {
  const { current, target } = buildScenario();
  const before = JSON.stringify(current);
  diffGraphStates(current, target);
  assertEqual(JSON.stringify(current), before, "Source graph must remain unchanged");
});

test("28. Diff does not mutate target graph", () => {
  const { current, target } = buildScenario();
  const before = JSON.stringify(target);
  diffGraphStates(current, target);
  assertEqual(JSON.stringify(target), before, "Target graph must remain unchanged");
});

test("29. Output is JSON-serializable", () => {
  const diff = buildScenario().diff;
  const serialized = JSON.stringify(diff);
  assert(serialized.length > 0, "Serialized GraphDiff must not be empty");
  assertDeepEqual(JSON.parse(serialized), diff, "GraphDiff must round-trip through JSON");
});

test("30. Repeated diffing is deterministic", () => {
  const { current, target } = buildScenario();
  const first = diffGraphStates(current, target);
  const second = diffGraphStates(current, target);
  assertDeepEqual(first, second, "Repeated diffing must produce equivalent output");
});

let passed = 0;
const failures: string[] = [];
for (const { name, run } of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}: ${message}`);
  }
}

console.log(`\nTest summary: ${passed} passed, ${failures.length} failed, ${tests.length} total`);
if (failures.length > 0) {
  throw new Error(`Diff test failures:\n${failures.join("\n")}`);
}
