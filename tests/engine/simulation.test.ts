import { cloneGraph } from "../../src/engine/graph";
import { calculateSecurityHealth } from "../../src/engine/health";
import { applyEvent } from "../../src/engine/propagate";
import { simulateAction, SimulationError } from "../../src/engine/simulation";
import {
  ActionStatus,
  AttackPathStatus,
  AttackStepStatus,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskStatus,
  ThreatConditionStatus,
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

function assertThrows(fn: () => void, includes: string, message: string): void {
  try {
    fn();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!text.includes(includes)) {
      throw new Error(`${message}. Error did not include ${JSON.stringify(includes)}: ${text}`);
    }
    return;
  }
  throw new Error(`${message}. Expected function to throw`);
}

const context: SimulationContext = {
  simulationId: "simulation:novastack-s3-remediation-demo",
  timestamp: "2026-09-19T17:45:00-04:00",
};

function degradedState(): GraphState {
  return applyEvent(novastackBaseline, novastackS3PublicEvent);
}

function simulated() {
  const current = degradedState();
  return {
    current,
    result: simulateAction(current, NOVASTACK_IDS.restrictPublicS3Action, context),
  };
}

test("1. degraded current state is Health 68 before simulation", () => {
  assertEqual(calculateSecurityHealth(degradedState()).score, 68, "Current Health must be 68");
});

test("2. valid action can be simulated", () => {
  const { result } = simulated();
  assertEqual(result.simulationId, context.simulationId, "Simulation ID mismatch");
  assertEqual(result.actionId, NOVASTACK_IDS.restrictPublicS3Action, "Action ID mismatch");
  assertEqual(result.simulationTimestamp, context.timestamp, "Simulation timestamp mismatch");
});

test("3. action targets the expected configuration through its own configurationId", () => {
  const current = degradedState();
  const action = current.nodes[NOVASTACK_IDS.restrictPublicS3Action];
  assert(action.type === "Action", "Expected remediation Action");
  assertEqual(
    action.configurationId,
    NOVASTACK_IDS.s3PublicAccessConfiguration,
    "Action must own the target configuration reference",
  );
  const result = simulateAction(current, action.id, context);
  const configuration = result.simulatedGraph.nodes[action.configurationId];
  assert(configuration.type === "Configuration", "Action target must be Configuration");
  assertEqual(configuration.value, action.proposedValue, "Simulation must apply action proposed value");
});

test("4. simulated S3 public access becomes false", () => {
  const configuration = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(configuration.type === "Configuration", "Expected Configuration");
  assertEqual(configuration.value, false, "Simulated S3 public access must be false");
});

test("5. threat becomes INACTIVE", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.publicExposureThreat];
  assert(node.type === "ThreatCondition", "Expected ThreatCondition");
  assertEqual(node.status, ThreatConditionStatus.INACTIVE, "Threat must be INACTIVE");
});

test("6. Public S3 Bucket becomes BLOCKED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.publicS3BucketStep];
  assert(node.type === "AttackStep", "Expected AttackStep");
  assertEqual(node.status, AttackStepStatus.BLOCKED, "Public S3 step must be BLOCKED");
});

test("7. Customer Data becomes BLOCKED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.customerDataStep];
  assert(node.type === "AttackStep", "Expected AttackStep");
  assertEqual(node.status, AttackStepStatus.BLOCKED, "Customer Data step must be BLOCKED");
});

test("8. Internet remains ACTIVE", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.internetStep];
  assert(node.type === "AttackStep", "Expected AttackStep");
  assertEqual(node.status, AttackStepStatus.ACTIVE, "Internet step must remain ACTIVE");
});

test("9. attack path becomes INACTIVE", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.primaryS3AttackPath];
  assert(node.type === "AttackPath", "Expected AttackPath");
  assertEqual(node.status, AttackPathStatus.INACTIVE, "Attack path must be INACTIVE");
});

test("10. HIGH risk becomes MITIGATED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.customerDataExposureRisk];
  assert(node.type === "Risk", "Expected Risk");
  assertEqual(node.status, RiskStatus.MITIGATED, "Risk must be MITIGATED");
});

test("11. control becomes VERIFIED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.blockPublicS3Control];
  assert(node.type === "Control", "Expected Control");
  assertEqual(node.status, ControlStatus.VERIFIED, "Control must be VERIFIED");
});

test("12. evidence becomes VALID", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.s3PrivateEvidence];
  assert(node.type === "Evidence", "Expected Evidence");
  assertEqual(node.status, EvidenceStatus.VALID, "Evidence must be VALID");
});

test("13. evidence observed value becomes false", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.s3PrivateEvidence];
  assert(node.type === "Evidence", "Expected Evidence");
  assertEqual(node.observedValue, false, "Observed evidence value must be false");
});

test("14. required evidence value remains false", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.s3PrivateEvidence];
  assert(node.type === "Evidence", "Expected Evidence");
  assertEqual(node.requiredValue, false, "Required evidence value must remain false");
});

test("15. NIST becomes SUPPORTED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.nistRequirement];
  assert(node.type === "FrameworkRequirement", "Expected FrameworkRequirement");
  assertEqual(node.status, FrameworkRequirementStatus.SUPPORTED, "NIST must be SUPPORTED");
});

test("16. CIS becomes SUPPORTED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.cisRequirement];
  assert(node.type === "FrameworkRequirement", "Expected FrameworkRequirement");
  assertEqual(node.status, FrameworkRequirementStatus.SUPPORTED, "CIS must be SUPPORTED");
});

test("17. SOC2 becomes SUPPORTED", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.soc2Requirement];
  assert(node.type === "FrameworkRequirement", "Expected FrameworkRequirement");
  assertEqual(node.status, FrameworkRequirementStatus.SUPPORTED, "SOC2 must be SUPPORTED");
});

test("18. remediation action becomes AVAILABLE", () => {
  const node = simulated().result.simulatedGraph.nodes[NOVASTACK_IDS.restrictPublicS3Action];
  assert(node.type === "Action", "Expected Action");
  assertEqual(node.status, ActionStatus.AVAILABLE, "Action must become AVAILABLE");
});

test("19. projected Health is exactly 84", () => {
  const { result } = simulated();
  assertEqual(result.projectedHealth.score, 84, "Projected Health must be 84");
  assertEqual(result.projectedHealth.totalPenalty, 0, "Projected graph must have zero Health penalty");
});

test("20. original current graph remains Health 68", () => {
  const { current } = simulated();
  assertEqual(calculateSecurityHealth(current).score, 68, "Current Health must remain 68");
});

test("21. original graph is structurally unchanged", () => {
  const current = degradedState();
  const before = JSON.stringify(current);
  simulateAction(current, NOVASTACK_IDS.restrictPublicS3Action, context);
  assertEqual(JSON.stringify(current), before, "Simulation must not structurally mutate current graph");
});

test("22. result is JSON-serializable", () => {
  const { result } = simulated();
  const serialized = JSON.stringify(result);
  assert(serialized.length > 0, "Serialized SimulationResult must not be empty");
  assertDeepEqual(JSON.parse(serialized), result, "SimulationResult must round-trip through JSON");
});

test("23. repeated simulation is deterministic", () => {
  const current = degradedState();
  const first = simulateAction(current, NOVASTACK_IDS.restrictPublicS3Action, context);
  const second = simulateAction(current, NOVASTACK_IDS.restrictPublicS3Action, context);
  assertDeepEqual(first, second, "Repeated simulation must produce equivalent output");
});

test("24. nonexistent action is rejected", () => {
  const current = degradedState();
  assertThrows(
    () => simulateAction(current, "action:does-not-exist", context),
    "does not exist",
    "Missing action must be rejected",
  );
});

test("25. non-Action target is rejected", () => {
  const current = degradedState();
  assertThrows(
    () => simulateAction(current, NOVASTACK_IDS.s3PublicAccessConfiguration, context),
    "not an Action",
    "Non-Action simulation target must be rejected",
  );
});

test("26. simulation where configuration already equals proposed value is rejected", () => {
  assertThrows(
    () => simulateAction(novastackBaseline, NOVASTACK_IDS.restrictPublicS3Action, context),
    "nothing to remediate",
    "No-op remediation must be rejected",
  );
});

test("27. action referencing a nonexistent Configuration is rejected", () => {
  const current = cloneGraph(degradedState());
  const action = current.nodes[NOVASTACK_IDS.restrictPublicS3Action];
  assert(action.type === "Action", "Expected Action");
  action.configurationId = "config:missing";
  assertThrows(
    () => simulateAction(current, action.id, context),
    "references nonexistent Configuration",
    "Missing action configuration must be rejected",
  );
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
  throw new Error(`Simulation test failures:\n${failures.join("\n")}`);
}
