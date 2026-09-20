import { applyEvent } from "../../src/engine/propagate";
import {
  ActionStatus,
  AttackPathStatus,
  AttackStepStatus,
  ControlStatus,
  EvidenceStatus,
  Framework,
  FrameworkRequirementStatus,
  RiskSeverity,
  RiskStatus,
  ThreatConditionStatus,
  type ConfigurationChangedEvent,
  type GraphNode,
} from "../../src/engine/types";
import {
  NOVASTACK_IDS,
  novastackBaseline,
} from "../../src/fixtures/novastack-baseline";
import {
  NOVASTACK_S3_PUBLIC_EVENT_TIME,
  novastackS3PublicEvent,
} from "../../src/fixtures/novastack-s3-public-event";

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

function assertThrows(run: () => void, pattern: RegExp, message: string): void {
  try {
    run();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!pattern.test(text)) {
      throw new Error(`${message}. Error did not match ${pattern}: ${text}`);
    }
    return;
  }
  throw new Error(`${message}. Expected function to throw.`);
}

function node(id: string): GraphNode {
  const value = degraded.nodes[id];
  assert(value, `Missing node ${id}`);
  return value;
}

function baselineNode(id: string): GraphNode {
  const value = novastackBaseline.nodes[id];
  assert(value, `Missing baseline node ${id}`);
  return value;
}

const degraded = applyEvent(novastackBaseline, novastackS3PublicEvent);

test("1. S3 event fixture targets the correct configuration", () => {
  assertEqual(
    novastackS3PublicEvent.targetConfigurationId,
    NOVASTACK_IDS.s3PublicAccessConfiguration,
    "Event must target S3 public-access configuration",
  );
  const forbiddenKeys = [
    "threatStatus",
    "attackSteps",
    "attackPathStatus",
    "riskStatus",
    "controlStatus",
    "evidenceStatus",
    "frameworkStatus",
    "actionStatus",
  ];
  assert(
    forbiddenKeys.every((key) => !(key in novastackS3PublicEvent)),
    "Event fixture must not contain downstream security state",
  );
});

test("2. Event before value is false and after value is true", () => {
  assertEqual(novastackS3PublicEvent.beforeValue, false, "Before value must be false");
  assertEqual(novastackS3PublicEvent.afterValue, true, "After value must be true");
});

test("3. Applying event changes configuration to true", () => {
  const configuration = node(NOVASTACK_IDS.s3PublicAccessConfiguration);
  assert(configuration.type === "Configuration", "Expected Configuration node");
  assertEqual(configuration.value, true, "Resulting S3 public access must be true");
  assertEqual(degraded.version, novastackBaseline.version + 1, "Graph version must increment once");
  assertEqual(degraded.evaluatedAt, NOVASTACK_S3_PUBLIC_EVENT_TIME, "Graph evaluation time must use event timestamp");
});

test("4. Original NovaStack baseline remains false", () => {
  const configuration = baselineNode(NOVASTACK_IDS.s3PublicAccessConfiguration);
  assert(configuration.type === "Configuration", "Expected baseline Configuration node");
  assertEqual(configuration.value, false, "Baseline S3 public access must remain false");
});

test("5. Threat becomes ACTIVE", () => {
  const threat = node(NOVASTACK_IDS.publicExposureThreat);
  assert(threat.type === "ThreatCondition", "Expected ThreatCondition node");
  assertEqual(threat.status, ThreatConditionStatus.ACTIVE, "Threat must be ACTIVE");
});

test("6. Public S3 Bucket attack step becomes ACTIVE", () => {
  const step = node(NOVASTACK_IDS.publicS3BucketStep);
  assert(step.type === "AttackStep", "Expected public S3 AttackStep");
  assertEqual(step.status, AttackStepStatus.ACTIVE, "Public S3 step must be ACTIVE");
});

test("7. Customer Data attack step becomes ACTIVE", () => {
  const step = node(NOVASTACK_IDS.customerDataStep);
  assert(step.type === "AttackStep", "Expected customer data AttackStep");
  assertEqual(step.status, AttackStepStatus.ACTIVE, "Customer Data step must be ACTIVE");
});

test("8. Internet attack step remains ACTIVE", () => {
  const step = node(NOVASTACK_IDS.internetStep);
  const baselineStep = baselineNode(NOVASTACK_IDS.internetStep);
  assert(step.type === "AttackStep" && baselineStep.type === "AttackStep", "Expected Internet AttackStep");
  assertEqual(step.status, AttackStepStatus.ACTIVE, "Internet step must remain ACTIVE");
  assertEqual(step.lastChanged, baselineStep.lastChanged, "Unchanged Internet step timestamp must not be rewritten");
  assertEqual(step.source, baselineStep.source, "Unchanged Internet step source must not be rewritten");
});

test("9. Primary attack path becomes ACTIVE", () => {
  const path = node(NOVASTACK_IDS.primaryS3AttackPath);
  assert(path.type === "AttackPath", "Expected AttackPath node");
  assertEqual(path.status, AttackPathStatus.ACTIVE, "Primary S3 attack path must be ACTIVE");
});

test("10. HIGH risk becomes ACTIVE", () => {
  const risk = node(NOVASTACK_IDS.customerDataExposureRisk);
  assert(risk.type === "Risk", "Expected Risk node");
  assertEqual(risk.severity, RiskSeverity.HIGH, "Risk severity must remain HIGH");
  assertEqual(risk.status, RiskStatus.ACTIVE, "Risk must be ACTIVE");
});

test("11. Critical control becomes DEGRADED", () => {
  const control = node(NOVASTACK_IDS.blockPublicS3Control);
  assert(control.type === "Control", "Expected Control node");
  assertEqual(control.status, ControlStatus.DEGRADED, "Control must be DEGRADED");
});

test("12. Evidence becomes INVALID", () => {
  const evidence = node(NOVASTACK_IDS.s3PrivateEvidence);
  assert(evidence.type === "Evidence", "Expected Evidence node");
  assertEqual(evidence.status, EvidenceStatus.INVALID, "Evidence must be INVALID");
});

test("13. Evidence observed value becomes true while required value remains false", () => {
  const evidence = node(NOVASTACK_IDS.s3PrivateEvidence);
  assert(evidence.type === "Evidence", "Expected Evidence node");
  assertEqual(evidence.observedValue, true, "Evidence observed value must become true");
  assertEqual(evidence.requiredValue, false, "Evidence required value must remain false");
});

function assertFrameworkAffected(id: string, framework: Framework): void {
  const requirement = node(id);
  assert(requirement.type === "FrameworkRequirement", `Expected ${framework} FrameworkRequirement`);
  assertEqual(requirement.framework, framework, `Unexpected framework for ${id}`);
  assertEqual(
    requirement.status,
    FrameworkRequirementStatus.AFFECTED,
    `${framework} requirement must be AFFECTED`,
  );
}

test("14. NIST mapping becomes AFFECTED", () => {
  assertFrameworkAffected(NOVASTACK_IDS.nistRequirement, Framework.NIST);
});

test("15. CIS mapping becomes AFFECTED", () => {
  assertFrameworkAffected(NOVASTACK_IDS.cisRequirement, Framework.CIS);
});

test("16. SOC2 mapping becomes AFFECTED", () => {
  assertFrameworkAffected(NOVASTACK_IDS.soc2Requirement, Framework.SOC2);
});

test("17. Restrict Public S3 Access becomes RECOMMENDED", () => {
  const action = node(NOVASTACK_IDS.restrictPublicS3Action);
  assert(action.type === "Action", "Expected Action node");
  assertEqual(action.status, ActionStatus.RECOMMENDED, "Remediation action must be RECOMMENDED");
});

test("18. Changed nodes have the event timestamp as lastChanged", () => {
  const changedIds = [
    NOVASTACK_IDS.s3PublicAccessConfiguration,
    NOVASTACK_IDS.publicExposureThreat,
    NOVASTACK_IDS.publicS3BucketStep,
    NOVASTACK_IDS.customerDataStep,
    NOVASTACK_IDS.primaryS3AttackPath,
    NOVASTACK_IDS.customerDataExposureRisk,
    NOVASTACK_IDS.blockPublicS3Control,
    NOVASTACK_IDS.s3PrivateEvidence,
    NOVASTACK_IDS.nistRequirement,
    NOVASTACK_IDS.cisRequirement,
    NOVASTACK_IDS.soc2Requirement,
    NOVASTACK_IDS.restrictPublicS3Action,
  ];

  for (const id of changedIds) {
    const changed = node(id);
    assertEqual(changed.lastChanged, NOVASTACK_S3_PUBLIC_EVENT_TIME, `${id} timestamp must use event time`);
    if (id === NOVASTACK_IDS.s3PublicAccessConfiguration) {
      assertEqual(changed.source, `event:${novastackS3PublicEvent.id}`, "Configuration source must identify event origin");
    } else {
      assertEqual(
        changed.source,
        `propagation:${novastackS3PublicEvent.id}`,
        `${id} source must identify deterministic propagation`,
      );
    }
  }
});

test("19. Baseline downstream states remain unchanged", () => {
  const threat = baselineNode(NOVASTACK_IDS.publicExposureThreat);
  const publicS3 = baselineNode(NOVASTACK_IDS.publicS3BucketStep);
  const customerData = baselineNode(NOVASTACK_IDS.customerDataStep);
  const path = baselineNode(NOVASTACK_IDS.primaryS3AttackPath);
  const risk = baselineNode(NOVASTACK_IDS.customerDataExposureRisk);
  const control = baselineNode(NOVASTACK_IDS.blockPublicS3Control);
  const evidence = baselineNode(NOVASTACK_IDS.s3PrivateEvidence);
  const action = baselineNode(NOVASTACK_IDS.restrictPublicS3Action);

  assert(threat.type === "ThreatCondition" && threat.status === ThreatConditionStatus.INACTIVE, "Baseline threat changed");
  assert(publicS3.type === "AttackStep" && publicS3.status === AttackStepStatus.BLOCKED, "Baseline public S3 step changed");
  assert(customerData.type === "AttackStep" && customerData.status === AttackStepStatus.BLOCKED, "Baseline customer data step changed");
  assert(path.type === "AttackPath" && path.status === AttackPathStatus.INACTIVE, "Baseline attack path changed");
  assert(risk.type === "Risk" && risk.status === RiskStatus.MITIGATED, "Baseline risk changed");
  assert(control.type === "Control" && control.status === ControlStatus.VERIFIED, "Baseline control changed");
  assert(evidence.type === "Evidence" && evidence.status === EvidenceStatus.VALID, "Baseline evidence changed");
  assert(action.type === "Action" && action.status === ActionStatus.AVAILABLE, "Baseline action changed");

  for (const id of [NOVASTACK_IDS.nistRequirement, NOVASTACK_IDS.cisRequirement, NOVASTACK_IDS.soc2Requirement]) {
    const requirement = baselineNode(id);
    assert(
      requirement.type === "FrameworkRequirement" && requirement.status === FrameworkRequirementStatus.SUPPORTED,
      `Baseline framework requirement changed: ${id}`,
    );
  }
});

test("20. Applying the same baseline/event twice produces equivalent output", () => {
  const first = applyEvent(novastackBaseline, novastackS3PublicEvent);
  const second = applyEvent(novastackBaseline, novastackS3PublicEvent);
  assertDeepEqual(first, second, "Repeated execution must be structurally deterministic");
});

test("21. Event with incorrect expected before value is rejected", () => {
  const invalid: ConfigurationChangedEvent = {
    ...novastackS3PublicEvent,
    id: "event:invalid-before",
    beforeValue: true,
  };
  assertThrows(
    () => applyEvent(novastackBaseline, invalid),
    /expected before value true.*received false/,
    "Incorrect expected before value must be rejected",
  );
});

test("22. Event targeting nonexistent configuration is rejected", () => {
  const invalid: ConfigurationChangedEvent = {
    ...novastackS3PublicEvent,
    id: "event:missing-target",
    targetConfigurationId: "config:does-not-exist",
  };
  assertThrows(
    () => applyEvent(novastackBaseline, invalid),
    /target does not exist or is not a Configuration/,
    "Missing configuration target must be rejected",
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
  throw new Error(`Propagation test failures:\n${failures.join("\n")}`);
}
