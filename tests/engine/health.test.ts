import { cloneGraph } from "../../src/engine/graph";
import { calculateSecurityHealth } from "../../src/engine/health";
import { applyEvent } from "../../src/engine/propagate";
import {
  ActionStatus,
  AttackPathStatus,
  AttackStepStatus,
  ControlCriticality,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskSeverity,
  RiskStatus,
  ThreatConditionStatus,
  type GraphState,
  type HealthPenalty,
} from "../../src/engine/types";
import {
  NOVASTACK_IDS,
  novastackBaseline,
} from "../../src/fixtures/novastack-baseline";
import { novastackS3PublicEvent } from "../../src/fixtures/novastack-s3-public-event";

type TestCase = { name: string; run: () => void };
const tests: TestCase[] = [];

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

function onlyPenalty(graph: GraphState): HealthPenalty {
  const result = calculateSecurityHealth(graph);
  assertEqual(result.penaltyBreakdown.length, 1, "Expected exactly one penalty");
  return result.penaltyBreakdown[0];
}

function riskGraph(severity: RiskSeverity): GraphState {
  const graph = cloneGraph(novastackBaseline);
  const risk = graph.nodes[NOVASTACK_IDS.customerDataExposureRisk];
  assert(risk.type === "Risk", "Expected Risk node");
  risk.status = RiskStatus.ACTIVE;
  risk.severity = severity;
  return graph;
}

const degraded = applyEvent(novastackBaseline, novastackS3PublicEvent);

test("1. Baseline NovaStack Health is 84", () => {
  const result = calculateSecurityHealth(novastackBaseline);
  assertEqual(result.score, 84, "Baseline Health must be 84");
  assertEqual(result.baseScore, 84, "Base score must be 84");
});

test("2. Baseline total penalty is 0", () => {
  const result = calculateSecurityHealth(novastackBaseline);
  assertEqual(result.totalPenalty, 0, "Baseline penalty must be zero");
  assertEqual(result.penaltyBreakdown.length, 0, "Baseline breakdown must be empty");
});

test("3. S3 degraded state Health is 68", () => {
  assertEqual(calculateSecurityHealth(degraded).score, 68, "Degraded Health must be 68");
});

test("4. S3 degraded total penalty is 16", () => {
  const result = calculateSecurityHealth(degraded);
  assertEqual(result.totalPenalty, 16, "Degraded total penalty must be 16");
  assertEqual(result.penaltyBreakdown.length, 4, "Degraded state must have exactly four penalties");
  assertDeepEqual(
    result.penaltyBreakdown.map(({ reason, amount }) => ({ reason, amount })),
    [
      { reason: "Active attack path", amount: -6 },
      { reason: "Active HIGH risk", amount: -4 },
      { reason: "Degraded CRITICAL control", amount: -4 },
      { reason: "Invalid evidence", amount: -2 },
    ],
    "Degraded breakdown must contain only the expected MVP penalties",
  );
});

test("5. ACTIVE attack path contributes -6", () => {
  const graph = cloneGraph(novastackBaseline);
  const path = graph.nodes[NOVASTACK_IDS.primaryS3AttackPath];
  assert(path.type === "AttackPath", "Expected AttackPath node");
  path.status = AttackPathStatus.ACTIVE;
  const entry = onlyPenalty(graph);
  assertEqual(entry.amount, -6, "ACTIVE attack path penalty must be -6");
  assertEqual(entry.reason, "Active attack path", "Attack path reason mismatch");
});

test("6. ACTIVE HIGH risk contributes -4", () => {
  const entry = onlyPenalty(riskGraph(RiskSeverity.HIGH));
  assertEqual(entry.amount, -4, "ACTIVE HIGH risk penalty must be -4");
});

test("7. ACTIVE MEDIUM risk contributes -2", () => {
  const entry = onlyPenalty(riskGraph(RiskSeverity.MEDIUM));
  assertEqual(entry.amount, -2, "ACTIVE MEDIUM risk penalty must be -2");
});

test("8. ACTIVE LOW risk contributes -1", () => {
  const entry = onlyPenalty(riskGraph(RiskSeverity.LOW));
  assertEqual(entry.amount, -1, "ACTIVE LOW risk penalty must be -1");
});

test("9. DEGRADED CRITICAL control contributes -4", () => {
  const graph = cloneGraph(novastackBaseline);
  const control = graph.nodes[NOVASTACK_IDS.blockPublicS3Control];
  assert(control.type === "Control", "Expected Control node");
  control.criticality = ControlCriticality.CRITICAL;
  control.status = ControlStatus.DEGRADED;
  assertEqual(onlyPenalty(graph).amount, -4, "DEGRADED CRITICAL control penalty must be -4");
});

test("10. NEEDS_REVIEW CRITICAL control contributes -2", () => {
  const graph = cloneGraph(novastackBaseline);
  const control = graph.nodes[NOVASTACK_IDS.blockPublicS3Control];
  assert(control.type === "Control", "Expected Control node");
  control.criticality = ControlCriticality.CRITICAL;
  control.status = ControlStatus.NEEDS_REVIEW;
  assertEqual(onlyPenalty(graph).amount, -2, "NEEDS_REVIEW CRITICAL control penalty must be -2");
});

test("11. INVALID evidence contributes -2", () => {
  const graph = cloneGraph(novastackBaseline);
  const evidence = graph.nodes[NOVASTACK_IDS.s3PrivateEvidence];
  assert(evidence.type === "Evidence", "Expected Evidence node");
  evidence.status = EvidenceStatus.INVALID;
  assertEqual(onlyPenalty(graph).amount, -2, "INVALID evidence penalty must be -2");
});

test("12. EXPIRED evidence contributes -1", () => {
  const graph = cloneGraph(novastackBaseline);
  const evidence = graph.nodes[NOVASTACK_IDS.s3PrivateEvidence];
  assert(evidence.type === "Evidence", "Expected Evidence node");
  evidence.status = EvidenceStatus.EXPIRED;
  assertEqual(onlyPenalty(graph).amount, -1, "EXPIRED evidence penalty must be -1");
});

test("13. FrameworkRequirement AFFECTED does not directly reduce Health", () => {
  const graph = cloneGraph(novastackBaseline);
  for (const id of [NOVASTACK_IDS.nistRequirement, NOVASTACK_IDS.cisRequirement, NOVASTACK_IDS.soc2Requirement]) {
    const requirement = graph.nodes[id];
    assert(requirement.type === "FrameworkRequirement", "Expected FrameworkRequirement node");
    requirement.status = FrameworkRequirementStatus.AFFECTED;
  }
  assertEqual(calculateSecurityHealth(graph).totalPenalty, 0, "Framework status must add no penalty");
});

test("14. Action RECOMMENDED does not directly reduce Health", () => {
  const graph = cloneGraph(novastackBaseline);
  const action = graph.nodes[NOVASTACK_IDS.restrictPublicS3Action];
  assert(action.type === "Action", "Expected Action node");
  action.status = ActionStatus.RECOMMENDED;
  assertEqual(calculateSecurityHealth(graph).totalPenalty, 0, "Action status must add no penalty");
});

test("15. ThreatCondition ACTIVE does not directly reduce Health", () => {
  const graph = cloneGraph(novastackBaseline);
  const threat = graph.nodes[NOVASTACK_IDS.publicExposureThreat];
  assert(threat.type === "ThreatCondition", "Expected ThreatCondition node");
  threat.status = ThreatConditionStatus.ACTIVE;
  assertEqual(calculateSecurityHealth(graph).totalPenalty, 0, "Threat status must add no penalty");
});

test("16. AttackStep ACTIVE does not directly reduce Health", () => {
  const graph = cloneGraph(novastackBaseline);
  const step = graph.nodes[NOVASTACK_IDS.publicS3BucketStep];
  assert(step.type === "AttackStep", "Expected AttackStep node");
  step.status = AttackStepStatus.ACTIVE;
  assertEqual(calculateSecurityHealth(graph).totalPenalty, 0, "Attack-step status must add no penalty");
});

test("17. Health calculation does not mutate GraphState", () => {
  const graph = cloneGraph(degraded);
  const before = JSON.stringify(graph);
  calculateSecurityHealth(graph);
  assertEqual(JSON.stringify(graph), before, "Health calculation must not mutate graph state");
});

test("18. Running calculation twice gives equivalent results", () => {
  const first = calculateSecurityHealth(degraded);
  const second = calculateSecurityHealth(degraded);
  assertDeepEqual(first, second, "Repeated Health calculation must be deterministic");
});

test("19. Health result can be JSON serialized", () => {
  const result = calculateSecurityHealth(degraded);
  const serialized = JSON.stringify(result);
  assert(serialized.length > 0, "Serialized result must not be empty");
  assertDeepEqual(JSON.parse(serialized), result, "Health result must round-trip through JSON");
});

test("20. Score never falls below 0", () => {
  const graph = cloneGraph(novastackBaseline);
  const template = graph.nodes[NOVASTACK_IDS.primaryS3AttackPath];
  assert(template.type === "AttackPath", "Expected AttackPath template");
  for (let index = 0; index < 20; index += 1) {
    const id = `attack-path:health-clamp-${index}`;
    graph.nodes[id] = {
      ...template,
      id,
      label: `Health clamp path ${index}`,
      pathKey: `health-clamp-${index}`,
      status: AttackPathStatus.ACTIVE,
    };
  }
  const result = calculateSecurityHealth(graph);
  assertEqual(result.score, 0, "Health score must clamp at 0");
});

test("21. Breakdown identifies the penalized node and reason", () => {
  const result = calculateSecurityHealth(degraded);
  const riskPenalty = result.penaltyBreakdown.find(
    (entry) => entry.nodeId === NOVASTACK_IDS.customerDataExposureRisk,
  );
  assert(riskPenalty, "Expected risk penalty in breakdown");
  assertEqual(riskPenalty.nodeType, "Risk", "Penalty must identify node type");
  assertEqual(riskPenalty.label, "Customer-Data Public Exposure", "Penalty must identify node label");
  assertEqual(riskPenalty.reason, "Active HIGH risk", "Penalty must identify reason");
  assertEqual(riskPenalty.amount, -4, "Penalty must identify amount");
});

test("22. Score respects the 100-point upper bound", () => {
  const result = calculateSecurityHealth(novastackBaseline);
  assert(result.score <= 100, "Health score must never exceed 100");
  assertEqual(result.score, 84, "Penalty-free graph uses the fixed 84 base score");
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
  throw new Error(`Security Health test failures:\n${failures.join("\n")}`);
}
