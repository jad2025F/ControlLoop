import {
  createHistory,
  createSnapshot,
  getChangeRecordByEventId,
  getSnapshotById,
  getSnapshotsChronologically,
  recordTransition,
} from "../../src/engine/history";
import { applyEvent } from "../../src/engine/propagate";
import { calculateSecurityHealth } from "../../src/engine/health";
import {
  type ChangeRecord,
  type ConfigurationChangedEvent,
  type GraphHistory,
  type GraphSnapshot,
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

const BASELINE_SNAPSHOT_ID = "snapshot:novastack:monday-baseline";
const DEGRADED_SNAPSHOT_ID = "snapshot:novastack:tuesday-s3-public";
const MONDAY_CAPTURED_AT = "2026-09-21T09:00:00-04:00";
const TUESDAY_EVENT_AT = "2026-09-22T14:14:00-04:00";

const demoEvent: ConfigurationChangedEvent = {
  ...novastackS3PublicEvent,
  timestamp: TUESDAY_EVENT_AT,
};

function buildHistory(): {
  baselineSnapshot: GraphSnapshot;
  degradedSnapshot: GraphSnapshot;
  transition: ChangeRecord;
  history: GraphHistory;
} {
  const baselineSnapshot = createSnapshot(
    BASELINE_SNAPSHOT_ID,
    novastackBaseline,
    MONDAY_CAPTURED_AT,
  );
  const degradedGraph = applyEvent(novastackBaseline, demoEvent);
  const degradedSnapshot = createSnapshot(
    DEGRADED_SNAPSHOT_ID,
    degradedGraph,
    TUESDAY_EVENT_AT,
    demoEvent.id,
  );
  const transition = recordTransition(baselineSnapshot, demoEvent, degradedSnapshot);
  const history = createHistory([degradedSnapshot, baselineSnapshot], [transition]);
  return { baselineSnapshot, degradedSnapshot, transition, history };
}

test("1. Baseline snapshot is created successfully", () => {
  const { baselineSnapshot } = buildHistory();
  assertEqual(baselineSnapshot.snapshotId, BASELINE_SNAPSHOT_ID, "Baseline snapshot ID mismatch");
  assertEqual(baselineSnapshot.capturedAt, MONDAY_CAPTURED_AT, "Baseline timestamp mismatch");
});

test("2. Baseline snapshot Health is exactly 84", () => {
  assertEqual(buildHistory().baselineSnapshot.health.score, 84, "Baseline Health mismatch");
});

test("3. Baseline snapshot trigger event is null", () => {
  assertEqual(buildHistory().baselineSnapshot.triggeringEventId, null, "Baseline trigger must be null");
});

test("4. Baseline snapshot contains S3 public access false", () => {
  const node = buildHistory().baselineSnapshot.graphState.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(node?.type === "Configuration", "Expected baseline S3 Configuration");
  assertEqual(node.value, false, "Baseline S3 public access must be false");
});

test("5. Degraded snapshot is created from real S3 event output", () => {
  const { degradedSnapshot } = buildHistory();
  const node = degradedSnapshot.graphState.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(node?.type === "Configuration", "Expected degraded S3 Configuration");
  assertEqual(node.value, true, "Degraded S3 public access must be true");
});

test("6. Degraded snapshot Health is exactly 68", () => {
  assertEqual(buildHistory().degradedSnapshot.health.score, 68, "Degraded Health mismatch");
});

test("7. Degraded snapshot references the S3 event ID", () => {
  assertEqual(
    buildHistory().degradedSnapshot.triggeringEventId,
    demoEvent.id,
    "Degraded snapshot trigger event mismatch",
  );
});

test("8. ChangeRecord has correct before snapshot ID", () => {
  assertEqual(buildHistory().transition.beforeSnapshotId, BASELINE_SNAPSHOT_ID, "Before snapshot mismatch");
});

test("9. ChangeRecord has correct after snapshot ID", () => {
  assertEqual(buildHistory().transition.afterSnapshotId, DEGRADED_SNAPSHOT_ID, "After snapshot mismatch");
});

test("10. ChangeRecord has Health before 84", () => {
  assertEqual(buildHistory().transition.healthBefore, 84, "Health before mismatch");
});

test("11. ChangeRecord has Health after 68", () => {
  assertEqual(buildHistory().transition.healthAfter, 68, "Health after mismatch");
});

test("12. ChangeRecord Health delta is -16", () => {
  assertEqual(buildHistory().transition.healthDelta, -16, "Health delta mismatch");
});

function assertChangedNode(nodeId: string, message: string): void {
  assert(buildHistory().transition.changedNodeIds.includes(nodeId), message);
}

test("13. Changed node IDs include the S3 configuration", () => {
  assertChangedNode(NOVASTACK_IDS.s3PublicAccessConfiguration, "S3 configuration missing from change record");
});

test("14. Changed node IDs include the threat", () => {
  assertChangedNode(NOVASTACK_IDS.publicExposureThreat, "Threat missing from change record");
});

test("15. Changed node IDs include the attack path", () => {
  assertChangedNode(NOVASTACK_IDS.primaryS3AttackPath, "Attack path missing from change record");
});

test("16. Changed node IDs include the risk", () => {
  assertChangedNode(NOVASTACK_IDS.customerDataExposureRisk, "Risk missing from change record");
});

test("17. Changed node IDs include the control", () => {
  assertChangedNode(NOVASTACK_IDS.blockPublicS3Control, "Control missing from change record");
});

test("18. Changed node IDs include the evidence", () => {
  assertChangedNode(NOVASTACK_IDS.s3PrivateEvidence, "Evidence missing from change record");
});

test("19. Changed node IDs include all three framework requirements", () => {
  const changed = buildHistory().transition.changedNodeIds;
  for (const id of [NOVASTACK_IDS.nistRequirement, NOVASTACK_IDS.cisRequirement, NOVASTACK_IDS.soc2Requirement]) {
    assert(changed.includes(id), `Framework requirement missing from change record: ${id}`);
  }
});

test("20. Changed node IDs include the remediation action", () => {
  assertChangedNode(NOVASTACK_IDS.restrictPublicS3Action, "Action missing from change record");
});

test("21. Unchanged Internet attack step is not included", () => {
  assert(
    !buildHistory().transition.changedNodeIds.includes(NOVASTACK_IDS.internetStep),
    "Unchanged Internet attack step must not be included",
  );
});

test("22. Snapshot creation does not mutate source graph", () => {
  const before = JSON.stringify(novastackBaseline);
  createSnapshot(BASELINE_SNAPSHOT_ID, novastackBaseline, MONDAY_CAPTURED_AT);
  assertEqual(JSON.stringify(novastackBaseline), before, "Snapshot creation mutated source graph");
});

test("23. Mutating an external clone cannot mutate an existing snapshot", () => {
  const snapshot = createSnapshot(BASELINE_SNAPSHOT_ID, novastackBaseline, MONDAY_CAPTURED_AT);
  const external = JSON.parse(JSON.stringify(novastackBaseline)) as typeof novastackBaseline;
  const config = external.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(config.type === "Configuration", "Expected external configuration");
  config.value = true;

  const snapConfig = snapshot.graphState.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(snapConfig.type === "Configuration", "Expected snapshot configuration");
  assertEqual(snapConfig.value, false, "External mutation leaked into snapshot");
});

test("24. Transition creation does not mutate either snapshot", () => {
  const { baselineSnapshot, degradedSnapshot } = buildHistory();
  const beforeBaseline = JSON.stringify(baselineSnapshot);
  const beforeDegraded = JSON.stringify(degradedSnapshot);
  recordTransition(baselineSnapshot, demoEvent, degradedSnapshot);
  assertEqual(JSON.stringify(baselineSnapshot), beforeBaseline, "Baseline snapshot mutated");
  assertEqual(JSON.stringify(degradedSnapshot), beforeDegraded, "Degraded snapshot mutated");
});

test("25. History output is JSON-serializable", () => {
  const json = JSON.stringify(buildHistory().history);
  const parsed = JSON.parse(json) as GraphHistory;
  assertEqual(parsed.snapshots.length, 2, "Serialized history snapshot count mismatch");
  assertEqual(parsed.changeRecords.length, 1, "Serialized history record count mismatch");
});

test("26. Repeating history construction with identical IDs/timestamps gives equivalent results", () => {
  assertDeepEqual(buildHistory(), buildHistory(), "Repeated history construction must be deterministic");
});

test("27. Lookup by snapshot ID works", () => {
  const { history } = buildHistory();
  assertEqual(
    getSnapshotById(history, DEGRADED_SNAPSHOT_ID)?.snapshotId,
    DEGRADED_SNAPSHOT_ID,
    "Snapshot lookup failed",
  );
});

test("28. Lookup by event ID works", () => {
  const { history } = buildHistory();
  assertEqual(
    getChangeRecordByEventId(history, demoEvent.id)?.event.id,
    demoEvent.id,
    "Event lookup failed",
  );
});

test("29. Snapshot ordering is deterministic", () => {
  const ordered = getSnapshotsChronologically(buildHistory().history);
  assertDeepEqual(
    ordered.map((snapshot) => snapshot.snapshotId),
    [BASELINE_SNAPSHOT_ID, DEGRADED_SNAPSHOT_ID],
    "Snapshot chronological ordering mismatch",
  );
});

test("30. Invalid event/after-snapshot relationship is rejected", () => {
  const baselineSnapshot = createSnapshot(BASELINE_SNAPSHOT_ID, novastackBaseline, MONDAY_CAPTURED_AT);
  const degradedGraph = applyEvent(novastackBaseline, demoEvent);
  const invalidAfter = createSnapshot(
    DEGRADED_SNAPSHOT_ID,
    degradedGraph,
    TUESDAY_EVENT_AT,
    "event:wrong",
  );
  assertThrows(
    () => recordTransition(baselineSnapshot, demoEvent, invalidAfter),
    /triggering event .* does not match/,
    "Mismatched trigger event must be rejected",
  );
});

// Small integration guard: snapshot Health must still equal the shared calculator.
test("31. Snapshot Health is derived by the existing Health calculator", () => {
  const { baselineSnapshot, degradedSnapshot } = buildHistory();
  assertDeepEqual(
    baselineSnapshot.health,
    calculateSecurityHealth(baselineSnapshot.graphState),
    "Baseline snapshot Health must use shared calculator",
  );
  assertDeepEqual(
    degradedSnapshot.health,
    calculateSecurityHealth(degradedSnapshot.graphState),
    "Degraded snapshot Health must use shared calculator",
  );
});

let passed = 0;
for (const entry of tests) {
  try {
    entry.run();
    passed += 1;
    console.log(`PASS ${entry.name}`);
  } catch (error) {
    console.error(`FAIL ${entry.name}`);
    throw error;
  }
}
console.log(`Test summary: ${passed} passed, ${tests.length - passed} failed, ${tests.length} total`);
