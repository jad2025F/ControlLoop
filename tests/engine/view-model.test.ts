import { diffGraphStates } from "../../src/engine/diff";
import { createHistory, createSnapshot, recordTransition } from "../../src/engine/history";
import { applyEvent } from "../../src/engine/propagate";
import { simulateAction } from "../../src/engine/simulation";
import {
  buildActionCenterDTO,
  buildChangeImpactDTO,
  buildControlLoopDemoViewModel,
  buildGraphDTO,
  buildOverviewDTO,
  buildSimulationDTO,
  buildTimelineDTO,
} from "../../src/engine/view-model";
import {
  ActionStatus,
  AttackPathStatus,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskStatus,
  ThreatConditionStatus,
  type ConfigurationChangedEvent,
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

const BASELINE_SNAPSHOT_ID = "snapshot:novastack:monday-baseline";
const DEGRADED_SNAPSHOT_ID = "snapshot:novastack:tuesday-s3-public";
const MONDAY_CAPTURED_AT = "2026-09-21T09:00:00-04:00";
const TUESDAY_EVENT_AT = "2026-09-22T14:14:00-04:00";
const SIMULATION_AT = "2026-09-22T14:15:00-04:00";

const demoEvent: ConfigurationChangedEvent = { ...novastackS3PublicEvent, timestamp: TUESDAY_EVENT_AT };

function buildScenario() {
  const baselineSnapshot = createSnapshot(BASELINE_SNAPSHOT_ID, novastackBaseline, MONDAY_CAPTURED_AT);
  const currentGraph = applyEvent(novastackBaseline, demoEvent);
  const degradedSnapshot = createSnapshot(DEGRADED_SNAPSHOT_ID, currentGraph, TUESDAY_EVENT_AT, demoEvent.id);
  const transition = recordTransition(baselineSnapshot, demoEvent, degradedSnapshot);
  const history = createHistory([degradedSnapshot, baselineSnapshot], [transition]);
  const simulation = simulateAction(currentGraph, NOVASTACK_IDS.restrictPublicS3Action, {
    simulationId: "simulation:task7-demo",
    timestamp: SIMULATION_AT,
  });
  const diff = diffGraphStates(currentGraph, simulation.simulatedGraph);
  const viewModel = buildControlLoopDemoViewModel({ currentGraph, history, simulation, diff });
  return { baselineSnapshot, currentGraph, degradedSnapshot, transition, history, simulation, diff, viewModel };
}

test("1. Top-level view model contains all six product DTOs", () => {
  const vm = buildScenario().viewModel;
  assert(vm.overview && vm.timeline && vm.changeImpact && vm.graph && vm.simulation && vm.actionCenter, "Missing product DTO");
});

test("2. Overview identifies NovaStack and company metadata", () => {
  const overview = buildScenario().viewModel.overview;
  assertEqual(overview.companyName, "NovaStack", "Company name mismatch");
  assertEqual(overview.industry, "SaaS", "Industry mismatch");
  assertEqual(overview.approximateEmployeeCount, 25, "Employee count mismatch");
  assertDeepEqual(overview.systems, ["AWS", "GitHub", "Google Workspace"], "Systems mismatch");
});

test("3. Overview current Health is 68", () => {
  assertEqual(buildScenario().viewModel.overview.currentHealth, 68, "Overview Health mismatch");
});

test("4. Overview reports security drift present", () => {
  assertEqual(buildScenario().viewModel.overview.securityDriftPresent, true, "Drift flag mismatch");
});

test("5. Overview reports one active attack path", () => {
  assertEqual(buildScenario().viewModel.overview.activeAttackPathCount, 1, "Active attack path count mismatch");
});

test("6. Overview reports one active HIGH risk", () => {
  assertEqual(buildScenario().viewModel.overview.activeHighRiskCount, 1, "Active HIGH risk count mismatch");
});

test("7. Overview reports one degraded critical control", () => {
  assertEqual(buildScenario().viewModel.overview.degradedCriticalControlCount, 1, "Degraded control count mismatch");
});

test("8. Overview reports one invalid evidence item", () => {
  assertEqual(buildScenario().viewModel.overview.invalidEvidenceCount, 1, "Invalid evidence count mismatch");
});

test("9. Overview reports one recommended action", () => {
  assertEqual(buildScenario().viewModel.overview.recommendedActionCount, 1, "Recommended action count mismatch");
});

test("10. Overview recent change comes from history", () => {
  const recent = buildScenario().viewModel.overview.recentChange;
  assert(recent, "Expected recent change");
  assertEqual(recent.eventId, demoEvent.id, "Recent event mismatch");
  assertEqual(recent.title, "S3 public access enabled", "Recent event title mismatch");
  assertEqual(recent.healthDelta, -16, "Recent Health delta mismatch");
});

test("11. Timeline snapshots are ordered and use demo-friendly labels", () => {
  const timeline = buildScenario().viewModel.timeline;
  assertEqual(timeline.snapshots.length, 2, "Timeline snapshot count mismatch");
  assertEqual(timeline.snapshots[0].label, "Monday — Healthy", "Baseline timeline label mismatch");
  assertEqual(timeline.snapshots[1].label, "Tuesday 2:14 PM — S3 public access enabled", "Change timeline label mismatch");
});

test("12. Timeline preserves underlying deterministic timestamps", () => {
  const timeline = buildScenario().viewModel.timeline;
  assertEqual(timeline.snapshots[0].timestamp, MONDAY_CAPTURED_AT, "Baseline timestamp mismatch");
  assertEqual(timeline.snapshots[1].timestamp, TUESDAY_EVENT_AT, "Degraded timestamp mismatch");
});

test("13. Timeline exposes the S3 transition Health 84 to 68", () => {
  const transition = buildScenario().viewModel.timeline.transitions[0];
  assertEqual(transition.eventId, demoEvent.id, "Timeline event mismatch");
  assertEqual(transition.eventTitle, "S3 public access enabled", "Timeline title mismatch");
  assertEqual(transition.beforeHealth, 84, "Timeline before Health mismatch");
  assertEqual(transition.afterHealth, 68, "Timeline after Health mismatch");
  assertEqual(transition.healthDelta, -16, "Timeline Health delta mismatch");
});

test("14. Timeline user-facing labels do not expose September calendar dates", () => {
  const labels = buildScenario().viewModel.timeline.snapshots.map((snapshot) => snapshot.label).join(" ");
  assert(!labels.includes("September") && !labels.includes("2026-09"), "Timeline label leaked calendar date");
});

test("15. Change Impact identifies the configuration false to true change", () => {
  const impact = buildScenario().viewModel.changeImpact;
  assertEqual(impact.configurationChange.nodeId, NOVASTACK_IDS.s3PublicAccessConfiguration, "Configuration ID mismatch");
  assertEqual(impact.configurationChange.key, "s3.publicAccess", "Configuration key mismatch");
  assertEqual(impact.configurationChange.beforeValue, false, "Configuration before mismatch");
  assertEqual(impact.configurationChange.afterValue, true, "Configuration after mismatch");
});

test("16. Change Impact reports Health 84 to 68 and delta -16", () => {
  assertDeepEqual(buildScenario().viewModel.changeImpact.health, { before: 84, after: 68, delta: -16 }, "Change Impact Health mismatch");
});

test("17. Change Impact uses the existing Risk business impact", () => {
  assertEqual(buildScenario().viewModel.changeImpact.businessImpact, "Unauthorized public access to customer data.", "Business impact mismatch");
});

test("18. Change Impact causal chain captures threat INACTIVE to ACTIVE", () => {
  const stage = buildScenario().viewModel.changeImpact.causalChain.threatCondition;
  assert(stage, "Threat stage missing");
  assertEqual(stage.beforeValue, ThreatConditionStatus.INACTIVE, "Threat before mismatch");
  assertEqual(stage.afterValue, ThreatConditionStatus.ACTIVE, "Threat after mismatch");
});

test("19. Change Impact causal chain captures attack path INACTIVE to ACTIVE", () => {
  const stage = buildScenario().viewModel.changeImpact.causalChain.attackPath;
  assert(stage, "Attack path stage missing");
  assertEqual(stage.beforeValue, AttackPathStatus.INACTIVE, "Attack path before mismatch");
  assertEqual(stage.afterValue, AttackPathStatus.ACTIVE, "Attack path after mismatch");
});

test("20. Change Impact causal chain captures risk, control, evidence, and action transitions", () => {
  const chain = buildScenario().viewModel.changeImpact.causalChain;
  assert(chain.risk && chain.control && chain.evidence && chain.action, "Required causal stage missing");
  assertDeepEqual([chain.risk.beforeValue, chain.risk.afterValue], [RiskStatus.MITIGATED, RiskStatus.ACTIVE], "Risk transition mismatch");
  assertDeepEqual([chain.control.beforeValue, chain.control.afterValue], [ControlStatus.VERIFIED, ControlStatus.DEGRADED], "Control transition mismatch");
  assertDeepEqual([chain.evidence.beforeValue, chain.evidence.afterValue], [EvidenceStatus.VALID, EvidenceStatus.INVALID], "Evidence transition mismatch");
  assertDeepEqual([chain.action.beforeValue, chain.action.afterValue], [ActionStatus.AVAILABLE, ActionStatus.RECOMMENDED], "Action transition mismatch");
});

test("21. Change Impact exposes all three framework impacts with references", () => {
  const frameworks = buildScenario().viewModel.changeImpact.causalChain.frameworkRequirements;
  assertEqual(frameworks.length, 3, "Framework impact count mismatch");
  for (const framework of frameworks) {
    assertEqual(framework.beforeStatus, FrameworkRequirementStatus.SUPPORTED, "Framework before mismatch");
    assertEqual(framework.afterStatus, FrameworkRequirementStatus.AFFECTED, "Framework after mismatch");
    assert(framework.reference.startsWith("DEMO-"), "Expected demo framework reference");
    assert(framework.title.length > 0, "Framework title missing");
  }
});

test("22. Graph DTO is renderer-neutral and preserves topology", () => {
  const { currentGraph, viewModel } = buildScenario();
  assertEqual(viewModel.graph.nodes.length, Object.keys(currentGraph.nodes).length, "Graph node count mismatch");
  assertEqual(viewModel.graph.edges.length, Object.keys(currentGraph.edges).length, "Graph edge count mismatch");
  const serialized = JSON.stringify(viewModel.graph);
  for (const forbidden of ["position", "className", "reactFlow", "component"]) {
    assert(!serialized.includes(`\"${forbidden}\"`), `Graph DTO contains renderer-specific field ${forbidden}`);
  }
});

test("23. Graph DTO exposes typed state plus risk severity and framework metadata", () => {
  const graph = buildScenario().viewModel.graph;
  const risk = graph.nodes.find((node) => node.id === NOVASTACK_IDS.customerDataExposureRisk);
  const framework = graph.nodes.find((node) => node.id === NOVASTACK_IDS.nistRequirement);
  assert(risk && framework, "Graph DTO nodes missing");
  assertEqual(risk.state, RiskStatus.ACTIVE, "Graph risk state mismatch");
  assertEqual(risk.severity, "HIGH", "Graph risk severity mismatch");
  assertEqual(framework.state, FrameworkRequirementStatus.AFFECTED, "Graph framework state mismatch");
  assertEqual(framework.framework, "NIST", "Graph framework metadata mismatch");
});

test("24. Graph DTO ordering is deterministic", () => {
  const graph = buildScenario().viewModel.graph;
  const nodeIds = graph.nodes.map((node) => node.id);
  const edgeIds = graph.edges.map((edge) => edge.id);
  assertDeepEqual(nodeIds, [...nodeIds].sort(), "Graph nodes not sorted");
  assertDeepEqual(edgeIds, [...edgeIds].sort(), "Graph edges not sorted");
});

test("25. Simulation DTO exposes Health 68 to projected 84 with +16", () => {
  assertDeepEqual(buildScenario().viewModel.simulation.health, { current: 68, projected: 84, delta: 16 }, "Simulation Health mismatch");
});

test("26. Simulation DTO uses the existing remediation action", () => {
  const action = buildScenario().viewModel.simulation.action;
  assertEqual(action.id, NOVASTACK_IDS.restrictPublicS3Action, "Simulation action ID mismatch");
  assertEqual(action.title, "Restrict Public S3 Access", "Simulation action title mismatch");
  assertEqual(action.priority, "HIGH", "Simulation action priority mismatch");
});

test("27. Simulation expected effects come from semantic graph diff", () => {
  const { diff, viewModel } = buildScenario();
  assertDeepEqual(viewModel.simulation.expectedEffects, {
    attackPathsDeactivated: diff.semanticSummary.attackPathsDeactivated,
    highRisksMitigated: diff.semanticSummary.highRisksMitigated,
    criticalControlsRestored: diff.semanticSummary.criticalControlsRestored,
    evidenceRestored: diff.semanticSummary.evidenceRestored,
    frameworkMappingsImproved: diff.semanticSummary.frameworkRequirementsImproved,
    recommendationsResolved: diff.semanticSummary.recommendationsResolved,
  }, "Simulation effect summary mismatch");
});

test("28. Simulation DTO exposes structured current-vs-projected node changes", () => {
  const changes = buildScenario().viewModel.simulation.nodeChanges;
  const config = changes.find((change) => change.nodeId === NOVASTACK_IDS.s3PublicAccessConfiguration);
  assert(config, "Simulation configuration change missing");
  const value = config.changedFields.find((field) => field.path === "value");
  assert(value, "Simulation configuration value change missing");
  assertEqual(value.beforeValue, true, "Simulation config before mismatch");
  assertEqual(value.afterValue, false, "Simulation config after mismatch");
});

test("29. Action Center exposes only the recommended remediation", () => {
  const actions = buildScenario().viewModel.actionCenter.actions;
  assertEqual(actions.length, 1, "Action Center count mismatch");
  assertEqual(actions[0].actionId, NOVASTACK_IDS.restrictPublicS3Action, "Action Center action mismatch");
  assertEqual(actions[0].status, ActionStatus.RECOMMENDED, "Action Center status mismatch");
});

test("30. Action Center exposes target current/proposed values and Health improvement", () => {
  const action = buildScenario().viewModel.actionCenter.actions[0];
  assertEqual(action.targetConfigurationLabel, "S3 Public Access", "Target label mismatch");
  assertEqual(action.currentValue, true, "Action Center current value mismatch");
  assertEqual(action.proposedValue, false, "Action Center proposed value mismatch");
  assertEqual(action.currentHealth, 68, "Action Center current Health mismatch");
  assertEqual(action.projectedHealth, 84, "Action Center projected Health mismatch");
  assertEqual(action.healthImprovement, 16, "Action Center Health improvement mismatch");
});

test("31. Action Center expected effects match Simulation DTO expected effects", () => {
  const vm = buildScenario().viewModel;
  assertDeepEqual(vm.actionCenter.actions[0].expectedEffects, vm.simulation.expectedEffects, "Action Center effects mismatch");
});

test("32. Baseline Action Center exposes no recommendation", () => {
  assertEqual(buildActionCenterDTO(novastackBaseline, []).actions.length, 0, "Baseline should have no recommended actions");
});

test("33. Individual DTO builders agree with the top-level adapter", () => {
  const scenario = buildScenario();
  assertDeepEqual(buildOverviewDTO(scenario.currentGraph, scenario.history), scenario.viewModel.overview, "Overview builder mismatch");
  assertDeepEqual(buildTimelineDTO(scenario.history), scenario.viewModel.timeline, "Timeline builder mismatch");
  assertDeepEqual(buildChangeImpactDTO(scenario.baselineSnapshot, scenario.transition, scenario.degradedSnapshot), scenario.viewModel.changeImpact, "Change Impact builder mismatch");
  assertDeepEqual(buildGraphDTO(scenario.currentGraph), scenario.viewModel.graph, "Graph builder mismatch");
  assertDeepEqual(buildSimulationDTO(scenario.currentGraph, scenario.simulation, scenario.diff), scenario.viewModel.simulation, "Simulation builder mismatch");
});

test("34. View-model generation does not mutate engine inputs", () => {
  const scenario = buildScenario();
  const graphBefore = JSON.stringify(scenario.currentGraph);
  const historyBefore = JSON.stringify(scenario.history);
  const simulationBefore = JSON.stringify(scenario.simulation);
  const diffBefore = JSON.stringify(scenario.diff);
  buildControlLoopDemoViewModel({ currentGraph: scenario.currentGraph, history: scenario.history, simulation: scenario.simulation, diff: scenario.diff });
  assertEqual(JSON.stringify(scenario.currentGraph), graphBefore, "Current graph mutated");
  assertEqual(JSON.stringify(scenario.history), historyBefore, "History mutated");
  assertEqual(JSON.stringify(scenario.simulation), simulationBefore, "Simulation mutated");
  assertEqual(JSON.stringify(scenario.diff), diffBefore, "Diff mutated");
});

test("35. Entire demo view model is JSON-serializable", () => {
  const vm = buildScenario().viewModel;
  const parsed = JSON.parse(JSON.stringify(vm));
  assertEqual(parsed.overview.currentHealth, 68, "Serialized overview mismatch");
  assertEqual(parsed.simulation.health.projected, 84, "Serialized simulation mismatch");
});

test("36. Repeated adapter execution is deterministic", () => {
  assertDeepEqual(buildScenario().viewModel, buildScenario().viewModel, "Repeated view-model output differs");
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
