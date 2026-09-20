import {
  buildBaselineDemoState,
  demoPrimaryDriftEvent,
  runPrimaryDriftDemo,
  runPrimarySimulationDemo,
} from "../../src/demo/demo-controller";
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

function drift() { return runPrimaryDriftDemo(); }

// 1
test("1. Baseline Time Machine contains one healthy snapshot", () => {
  const timeline = buildBaselineDemoState().timeline;
  assertEqual(timeline.snapshots.length, 1, "Baseline snapshot count mismatch");
  assertEqual(timeline.snapshots[0].label, "Monday — Healthy", "Baseline display label mismatch");
});

// 2
test("2. Baseline Time Machine Health is 84", () => {
  assertEqual(buildBaselineDemoState().timeline.snapshots[0].healthScore, 84, "Baseline timeline Health mismatch");
});

// 3
test("3. Baseline does not expose the S3 drift event", () => {
  const timeline = buildBaselineDemoState().timeline;
  assertEqual(timeline.transitions.length, 0, "Baseline should not have a transition");
  assertEqual(timeline.snapshots[0].triggeringEventId, null, "Baseline snapshot should have no triggering event");
});

// 4
test("4. After drift timeline contains two snapshots", () => {
  assertEqual(drift().timeline.snapshots.length, 2, "Drift snapshot count mismatch");
});

// 5
test("5. After drift timeline exposes the S3 event", () => {
  const timeline = drift().timeline;
  assertEqual(timeline.transitions.length, 1, "Expected one transition");
  assertEqual(timeline.transitions[0].eventId, novastackS3PublicEvent.id, "Timeline event ID mismatch");
});

// 6
test("6. Event display label uses Tuesday 2:14 PM", () => {
  assertEqual(
    drift().timeline.snapshots[1].label,
    "Tuesday 2:14 PM — S3 public access enabled",
    "Drift display label mismatch",
  );
});

// 7
test("7. Visible timeline labels do not expose September calendar date", () => {
  for (const snapshot of drift().timeline.snapshots) {
    assert(!/September|Sep\.?\s|2026-09-2[12]/i.test(snapshot.label), `Calendar date leaked into label: ${snapshot.label}`);
  }
});

// 8
test("8. Before Health is 84", () => {
  assertEqual(drift().timeline.transitions[0].beforeHealth, 84, "Before Health mismatch");
});

// 9
test("9. After Health is 68", () => {
  assertEqual(drift().timeline.transitions[0].afterHealth, 68, "After Health mismatch");
});

// 10
test("10. Health delta is -16", () => {
  assertEqual(drift().timeline.transitions[0].healthDelta, -16, "Timeline Health delta mismatch");
});

// 11
test("11. Change Impact remains linked to the same S3 event", () => {
  const state = drift();
  assert(state.changeImpact, "Expected Change Impact DTO");
  assertEqual(state.timeline.transitions[0].eventId, state.changeImpact.event.id, "Timeline/Change Impact event mismatch");
  assertEqual(state.eventId, state.changeImpact.event.id, "Controller event/Change Impact mismatch");
  assertEqual(demoPrimaryDriftEvent.id, novastackS3PublicEvent.id, "Demo event must retain approved event identity");
});

// 12
test("12. Reset returns history to baseline-only state", () => {
  const reset = buildBaselineDemoState();
  assertEqual(reset.mode, "healthy", "Reset mode mismatch");
  assertEqual(reset.timeline.snapshots.length, 1, "Reset snapshot count mismatch");
  assertEqual(reset.timeline.transitions.length, 0, "Reset transition count mismatch");
  assertEqual(reset.timeline.snapshots[0].healthScore, 84, "Reset timeline Health mismatch");
});

// 13
test("13. Simulation does not alter current timeline history", () => {
  const current = drift();
  const before = JSON.stringify(current.timeline);
  const simulated = runPrimarySimulationDemo(current);
  assertEqual(JSON.stringify(current.timeline), before, "Simulation mutated current timeline");
  assertEqual(JSON.stringify(simulated.timeline), before, "Simulation replaced timeline history");
});

// 14
test("14. Repeated demo construction remains deterministic", () => {
  assertDeepEqual(buildBaselineDemoState(), buildBaselineDemoState(), "Repeated baseline demo mismatch");
  assertDeepEqual(runPrimaryDriftDemo(), runPrimaryDriftDemo(), "Repeated drift demo mismatch");
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
