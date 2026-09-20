import { calculateSecurityHealth } from "./health";
import {
  ActionStatus,
  AttackPathStatus,
  ControlCriticality,
  ControlStatus,
  EvidenceStatus,
  RiskSeverity,
  RiskStatus,
  type ActionCenterDTO,
  type ActionCenterItemDTO,
  type ChangeImpactDTO,
  type ChangeImpactStageDTO,
  type ChangeRecord,
  type ControlLoopDemoViewModel,
  type DomainEvent,
  type FrameworkImpactDTO,
  type GraphDTO,
  type GraphDiff,
  type GraphHistory,
  type GraphNode,
  type GraphSnapshot,
  type GraphState,
  type IsoTimestamp,
  type JsonValue,
  type OverviewDTO,
  type OverviewRecentChangeDTO,
  type SimulationDTO,
  type SimulationEffectsDTO,
  type SimulationResult,
  type TimelineDTO,
} from "./types";

export class ViewModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewModelError";
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function requireCompany(graph: GraphState) {
  const company = graph.nodes[graph.companyId];
  if (!company || company.type !== "Company") {
    throw new ViewModelError(`Graph company is missing or invalid: ${graph.companyId}`);
  }
  return company;
}

function requireSnapshot(history: GraphHistory, snapshotId: string): GraphSnapshot {
  const snapshot = history.snapshots.find((item) => item.snapshotId === snapshotId);
  if (!snapshot) throw new ViewModelError(`History snapshot does not exist: ${snapshotId}`);
  return snapshot;
}

function titleCaseConfigurationLabel(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length === 0) return label;
  return [words[0], ...words.slice(1).map((word) => word.toLowerCase())].join(" ");
}

function eventTitle(event: DomainEvent, graph: GraphState): string {
  const target = graph.nodes[event.targetConfigurationId];
  const label = target?.type === "Configuration" ? titleCaseConfigurationLabel(target.label) : "Configuration";

  if (event.beforeValue === false && event.afterValue === true) return `${label} enabled`;
  if (event.beforeValue === true && event.afterValue === false) return `${label} disabled`;
  return `${label} changed`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function displayParts(timestamp: IsoTimestamp): { weekday: string; time: string } {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new ViewModelError(`Invalid ISO timestamp for display: ${timestamp}`);
  const [, year, month, day, hourText, minute] = match;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()];
  const hour24 = Number(hourText);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return { weekday, time: `${hour12}:${minute} ${suffix}` };
}

function meaningfulState(node: GraphNode): JsonValue | undefined {
  switch (node.type) {
    case "Configuration":
      return node.value;
    case "ThreatCondition":
    case "AttackStep":
    case "AttackPath":
    case "Risk":
    case "Control":
    case "Evidence":
    case "FrameworkRequirement":
    case "Action":
      return node.status;
    default:
      return undefined;
  }
}

function toStage(beforeNode: GraphNode, afterNode: GraphNode): ChangeImpactStageDTO {
  const beforeValue = meaningfulState(beforeNode);
  const afterValue = meaningfulState(afterNode);
  if (beforeValue === undefined || afterValue === undefined) {
    throw new ViewModelError(`Node type ${afterNode.type} has no meaningful state for Change Impact`);
  }
  return {
    nodeId: afterNode.id,
    nodeType: afterNode.type,
    label: afterNode.label,
    beforeValue,
    afterValue,
  };
}

function latestChange(history: GraphHistory): ChangeRecord | undefined {
  return history.changeRecords[history.changeRecords.length - 1];
}

function recentChangeDTO(history: GraphHistory): OverviewRecentChangeDTO | null {
  const record = latestChange(history);
  if (!record) return null;
  const after = requireSnapshot(history, record.afterSnapshotId);
  return {
    eventId: record.event.id,
    title: eventTitle(record.event, after.graphState),
    timestamp: record.event.timestamp,
    healthBefore: record.healthBefore,
    healthAfter: record.healthAfter,
    healthDelta: record.healthDelta,
  };
}

export function buildOverviewDTO(currentGraph: GraphState, history?: GraphHistory): OverviewDTO {
  const company = requireCompany(currentGraph);
  let activeAttackPathCount = 0;
  let activeHighRiskCount = 0;
  let degradedCriticalControlCount = 0;
  let invalidEvidenceCount = 0;
  let recommendedActionCount = 0;

  for (const node of Object.values(currentGraph.nodes)) {
    if (node.type === "AttackPath" && node.status === AttackPathStatus.ACTIVE) activeAttackPathCount += 1;
    if (node.type === "Risk" && node.status === RiskStatus.ACTIVE && node.severity === RiskSeverity.HIGH) activeHighRiskCount += 1;
    if (
      node.type === "Control" &&
      node.criticality === ControlCriticality.CRITICAL &&
      node.status === ControlStatus.DEGRADED
    ) degradedCriticalControlCount += 1;
    if (node.type === "Evidence" && node.status === EvidenceStatus.INVALID) invalidEvidenceCount += 1;
    if (node.type === "Action" && node.status === ActionStatus.RECOMMENDED) recommendedActionCount += 1;
  }

  const securityDriftPresent =
    activeAttackPathCount > 0 ||
    activeHighRiskCount > 0 ||
    degradedCriticalControlCount > 0 ||
    invalidEvidenceCount > 0 ||
    recommendedActionCount > 0;

  // Reuse the existing engine-owned calculator; no scoring logic lives in the adapter.
  const currentHealth = calculateSecurityHealth(currentGraph).score;

  return {
    companyId: company.id,
    companyName: company.name,
    industry: company.industry,
    approximateEmployeeCount: company.approximateEmployeeCount,
    systems: [...company.systems],
    currentHealth,
    securityDriftPresent,
    activeAttackPathCount,
    activeHighRiskCount,
    degradedCriticalControlCount,
    invalidEvidenceCount,
    recommendedActionCount,
    recentChange: history ? recentChangeDTO(history) : null,
  };
}

export function buildTimelineDTO(history: GraphHistory): TimelineDTO {
  const recordByEventId = new Map(history.changeRecords.map((record) => [record.event.id, record]));

  const snapshots = history.snapshots.map((snapshot) => {
    const parts = displayParts(snapshot.capturedAt);
    let label: string;
    if (!snapshot.triggeringEventId) {
      label = `${parts.weekday} — ${snapshot.health.totalPenalty === 0 ? "Healthy" : "Snapshot"}`;
    } else {
      const record = recordByEventId.get(snapshot.triggeringEventId);
      const title = record ? eventTitle(record.event, snapshot.graphState) : "Change recorded";
      label = `${parts.weekday} ${parts.time} — ${title}`;
    }
    return {
      snapshotId: snapshot.snapshotId,
      timestamp: snapshot.capturedAt,
      label,
      healthScore: snapshot.health.score,
      triggeringEventId: snapshot.triggeringEventId,
    };
  });

  const transitions = history.changeRecords.map((record) => {
    const after = requireSnapshot(history, record.afterSnapshotId);
    return {
      eventId: record.event.id,
      eventTitle: eventTitle(record.event, after.graphState),
      timestamp: record.event.timestamp,
      beforeHealth: record.healthBefore,
      afterHealth: record.healthAfter,
      healthDelta: record.healthDelta,
    };
  });

  return { snapshots, transitions };
}

function findChangedPair(
  record: ChangeRecord,
  before: GraphSnapshot,
  after: GraphSnapshot,
  type: GraphNode["type"],
): [GraphNode, GraphNode] | null {
  for (const nodeId of record.changedNodeIds) {
    const beforeNode = before.graphState.nodes[nodeId];
    const afterNode = after.graphState.nodes[nodeId];
    if (beforeNode?.type === type && afterNode?.type === type) return [beforeNode, afterNode];
  }
  return null;
}

export function buildChangeImpactDTO(
  before: GraphSnapshot,
  record: ChangeRecord,
  after: GraphSnapshot,
): ChangeImpactDTO {
  const beforeConfiguration = before.graphState.nodes[record.event.targetConfigurationId];
  const afterConfiguration = after.graphState.nodes[record.event.targetConfigurationId];
  if (beforeConfiguration?.type !== "Configuration" || afterConfiguration?.type !== "Configuration") {
    throw new ViewModelError(`Change event target is not a Configuration: ${record.event.targetConfigurationId}`);
  }

  const threat = findChangedPair(record, before, after, "ThreatCondition");
  const attackPath = findChangedPair(record, before, after, "AttackPath");
  const risk = findChangedPair(record, before, after, "Risk");
  const control = findChangedPair(record, before, after, "Control");
  const evidence = findChangedPair(record, before, after, "Evidence");
  const action = findChangedPair(record, before, after, "Action");

  const frameworkRequirements: FrameworkImpactDTO[] = record.changedNodeIds
    .map((nodeId) => [before.graphState.nodes[nodeId], after.graphState.nodes[nodeId]] as const)
    .filter((pair): pair is readonly [Extract<GraphNode, { type: "FrameworkRequirement" }>, Extract<GraphNode, { type: "FrameworkRequirement" }>] =>
      pair[0]?.type === "FrameworkRequirement" && pair[1]?.type === "FrameworkRequirement",
    )
    .map(([beforeNode, afterNode]) => ({
      nodeId: afterNode.id,
      framework: afterNode.framework,
      reference: afterNode.reference,
      title: afterNode.title,
      beforeStatus: beforeNode.status,
      afterStatus: afterNode.status,
    }))
    .sort((left, right) => compareText(left.framework, right.framework));

  const riskAfter = risk?.[1];
  return {
    event: {
      id: record.event.id,
      title: eventTitle(record.event, after.graphState),
      timestamp: record.event.timestamp,
    },
    configurationChange: {
      nodeId: afterConfiguration.id,
      label: afterConfiguration.label,
      key: afterConfiguration.key,
      beforeValue: beforeConfiguration.value,
      afterValue: afterConfiguration.value,
    },
    health: {
      before: record.healthBefore,
      after: record.healthAfter,
      delta: record.healthDelta,
    },
    businessImpact: riskAfter?.type === "Risk" ? riskAfter.businessImpact : null,
    causalChain: {
      configuration: toStage(beforeConfiguration, afterConfiguration),
      threatCondition: threat ? toStage(threat[0], threat[1]) : null,
      attackPath: attackPath ? toStage(attackPath[0], attackPath[1]) : null,
      risk: risk ? toStage(risk[0], risk[1]) : null,
      control: control ? toStage(control[0], control[1]) : null,
      evidence: evidence ? toStage(evidence[0], evidence[1]) : null,
      frameworkRequirements,
      action: action ? toStage(action[0], action[1]) : null,
    },
  };
}

export function buildGraphDTO(graph: GraphState): GraphDTO {
  const nodes = Object.values(graph.nodes)
    .sort((left, right) => compareText(left.id, right.id))
    .map((node) => {
      const dto: GraphDTO["nodes"][number] = {
        id: node.id,
        nodeType: node.type,
        label: node.label,
      };
      const state = meaningfulState(node);
      if (state !== undefined) dto.state = cloneJson(state);
      if (node.type === "Risk") dto.severity = node.severity;
      if (node.type === "FrameworkRequirement") dto.framework = node.framework;
      return dto;
    });

  const edges = Object.values(graph.edges)
    .sort((left, right) => compareText(left.id, right.id))
    .map((edge) => ({
      id: edge.id,
      edgeType: edge.type,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
    }));

  return { graphVersion: graph.version, evaluatedAt: graph.evaluatedAt, nodes, edges };
}

function effectsFromDiff(diff: GraphDiff): SimulationEffectsDTO {
  return {
    attackPathsDeactivated: diff.semanticSummary.attackPathsDeactivated,
    highRisksMitigated: diff.semanticSummary.highRisksMitigated,
    criticalControlsRestored: diff.semanticSummary.criticalControlsRestored,
    evidenceRestored: diff.semanticSummary.evidenceRestored,
    frameworkMappingsImproved: diff.semanticSummary.frameworkRequirementsImproved,
    recommendationsResolved: diff.semanticSummary.recommendationsResolved,
  };
}

export function buildSimulationDTO(
  currentGraph: GraphState,
  simulation: SimulationResult,
  diff: GraphDiff,
): SimulationDTO {
  const action = currentGraph.nodes[simulation.actionId];
  if (!action || action.type !== "Action") {
    throw new ViewModelError(`Simulation action is missing from current graph: ${simulation.actionId}`);
  }
  return {
    simulationId: simulation.simulationId,
    timestamp: simulation.simulationTimestamp,
    action: { id: action.id, title: action.title, priority: action.priority },
    health: {
      current: simulation.currentHealth.score,
      projected: simulation.projectedHealth.score,
      delta: diff.healthDelta,
    },
    expectedEffects: effectsFromDiff(diff),
    nodeChanges: cloneJson(diff.nodeChanges),
  };
}

export interface ActionProjection {
  simulation: SimulationResult;
  diff: GraphDiff;
}

export function buildActionCenterDTO(
  currentGraph: GraphState,
  projections: readonly ActionProjection[],
): ActionCenterDTO {
  const projectionByActionId = new Map(projections.map((projection) => [projection.simulation.actionId, projection]));
  const actions: ActionCenterItemDTO[] = [];

  for (const node of Object.values(currentGraph.nodes).sort((left, right) => compareText(left.id, right.id))) {
    if (node.type !== "Action" || node.status !== ActionStatus.RECOMMENDED) continue;
    const projection = projectionByActionId.get(node.id);
    if (!projection) throw new ViewModelError(`Recommended Action has no simulation projection: ${node.id}`);
    const configuration = currentGraph.nodes[node.configurationId];
    if (!configuration || configuration.type !== "Configuration") {
      throw new ViewModelError(`Action ${node.id} target Configuration is missing: ${node.configurationId}`);
    }
    actions.push({
      actionId: node.id,
      title: node.title,
      priority: node.priority,
      status: node.status,
      targetConfigurationLabel: configuration.label,
      currentValue: cloneJson(configuration.value),
      proposedValue: cloneJson(node.proposedValue),
      currentHealth: projection.simulation.currentHealth.score,
      projectedHealth: projection.simulation.projectedHealth.score,
      healthImprovement: projection.diff.healthDelta,
      expectedEffects: effectsFromDiff(projection.diff),
    });
  }

  return { actions };
}

export interface ControlLoopDemoViewModelInput {
  currentGraph: GraphState;
  history: GraphHistory;
  simulation: SimulationResult;
  diff: GraphDiff;
}

export function buildControlLoopDemoViewModel(input: ControlLoopDemoViewModelInput): ControlLoopDemoViewModel {
  const record = latestChange(input.history);
  if (!record) throw new ViewModelError("Demo view model requires at least one history transition");
  const before = requireSnapshot(input.history, record.beforeSnapshotId);
  const after = requireSnapshot(input.history, record.afterSnapshotId);

  return {
    overview: buildOverviewDTO(input.currentGraph, input.history),
    timeline: buildTimelineDTO(input.history),
    changeImpact: buildChangeImpactDTO(before, record, after),
    graph: buildGraphDTO(input.currentGraph),
    simulation: buildSimulationDTO(input.currentGraph, input.simulation, input.diff),
    actionCenter: buildActionCenterDTO(input.currentGraph, [{ simulation: input.simulation, diff: input.diff }]),
  };
}
