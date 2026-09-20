import { applyEvent } from "../engine/propagate";
import { createHistory, createSnapshot, recordTransition } from "../engine/history";
import { diffGraphStates } from "../engine/diff";
import { simulateAction } from "../engine/simulation";
import {
  buildActionCenterDTO,
  buildChangeImpactDTO,
  buildGraphDTO,
  buildOverviewDTO,
  buildSimulationDTO,
  buildTimelineDTO,
} from "../engine/view-model";
import {
  ActionStatus,
  type ActionCenterDTO,
  type ActionNode,
  type ChangeImpactDTO,
  type ConfigurationChangedEvent,
  type GraphDTO,
  type GraphHistory,
  type GraphNodeType,
  type GraphSnapshot,
  type GraphState,
  type JsonValue,
  type OverviewDTO,
  type SimulationDTO,
  type TimelineDTO,
} from "../engine/types";
import { novastackBaseline } from "../fixtures/novastack-baseline";
import { novastackS3PublicEvent } from "../fixtures/novastack-s3-public-event";

export const DEMO_BASELINE_SNAPSHOT_ID = "snapshot:demo:novastack-baseline";
export const DEMO_DEGRADED_SNAPSHOT_ID = "snapshot:demo:novastack-s3-public";
export const DEMO_BASELINE_CAPTURED_AT = "2026-09-21T09:00:00-04:00";
export const DEMO_DRIFT_EVENT_TIMESTAMP = "2026-09-22T14:14:00-04:00";
export const DEMO_SIMULATION_ID = "simulation:demo:restrict-public-s3-access";
export const DEMO_SIMULATION_TIMESTAMP = "2026-09-22T14:20:00-04:00";

/**
 * The judge-facing demo uses the approved S3 event semantics and stable event
 * ID, with the fixed Tuesday 2:14 PM presentation timestamp established by the
 * temporal demo model. No security outcome is encoded here.
 */
export const demoPrimaryDriftEvent: ConfigurationChangedEvent = Object.freeze({
  ...novastackS3PublicEvent,
  timestamp: DEMO_DRIFT_EVENT_TIMESTAMP,
});

export interface SimulationComparisonRow {
  nodeId: string;
  nodeType: GraphNodeType;
  label: string;
  currentValue: JsonValue;
  projectedValue: JsonValue;
}

export interface DemoSimulationPresentation {
  dto: SimulationDTO;
  projectedGraph: GraphDTO;
  comparisonRows: SimulationComparisonRow[];
}

export interface DemoPresentationState {
  mode: "healthy" | "degraded";
  overview: OverviewDTO;
  timeline: TimelineDTO;
  graph: GraphDTO;
  changeImpact: ChangeImpactDTO | null;
  eventId: string | null;
  actionCenter: ActionCenterDTO;
  simulation: DemoSimulationPresentation | null;
  /** Controller-owned evaluated graph; React renders DTOs and never derives security state from this object. */
  currentGraph: GraphState;
}

interface BaselineHistoryState {
  snapshot: GraphSnapshot;
  history: GraphHistory;
}

function buildBaselineHistory(): BaselineHistoryState {
  const snapshot = createSnapshot(
    DEMO_BASELINE_SNAPSHOT_ID,
    novastackBaseline,
    DEMO_BASELINE_CAPTURED_AT,
  );
  return {
    snapshot,
    history: createHistory([snapshot], []),
  };
}

/**
 * Builds the real healthy NovaStack presentation from the approved baseline
 * graph, history layer, and DTO builders. No UI-owned security values are
 * introduced here.
 */
export function buildBaselineDemoState(): DemoPresentationState {
  const { history } = buildBaselineHistory();
  return {
    mode: "healthy",
    overview: buildOverviewDTO(novastackBaseline, history),
    timeline: buildTimelineDTO(history),
    graph: buildGraphDTO(novastackBaseline),
    changeImpact: null,
    eventId: null,
    actionCenter: buildActionCenterDTO(novastackBaseline, []),
    simulation: null,
    currentGraph: novastackBaseline,
  };
}

/**
 * Executes the approved S3 fixture semantics through the real engine and
 * converts the resulting evaluated state/history into presentation DTOs.
 * React never applies the event or derives security meaning itself.
 */
export function runPrimaryDriftDemo(): DemoPresentationState {
  const { snapshot: beforeSnapshot } = buildBaselineHistory();
  const degradedGraph = applyEvent(novastackBaseline, demoPrimaryDriftEvent);
  const afterSnapshot = createSnapshot(
    DEMO_DEGRADED_SNAPSHOT_ID,
    degradedGraph,
    demoPrimaryDriftEvent.timestamp,
    demoPrimaryDriftEvent.id,
  );
  const transition = recordTransition(beforeSnapshot, demoPrimaryDriftEvent, afterSnapshot);
  const history = createHistory([beforeSnapshot, afterSnapshot], [transition]);
  const actionProjection = buildPrimaryActionProjection(degradedGraph);

  return {
    mode: "degraded",
    overview: buildOverviewDTO(degradedGraph, history),
    timeline: buildTimelineDTO(history),
    graph: buildGraphDTO(degradedGraph),
    changeImpact: buildChangeImpactDTO(beforeSnapshot, transition, afterSnapshot),
    eventId: demoPrimaryDriftEvent.id,
    actionCenter: buildActionCenterDTO(degradedGraph, [{ simulation: actionProjection.simulation, diff: actionProjection.diff }]),
    simulation: null,
    currentGraph: degradedGraph,
  };
}

/**
 * Projects the existing recommended remediation without touching the supplied
 * current graph or its timeline. Security state comes exclusively from
 * simulateAction(), the normal propagation path, GraphDiff, and existing DTO
 * builders.
 */
export function runPrimarySimulationDemo(current: DemoPresentationState): DemoPresentationState {
  if (current.mode !== "degraded") {
    throw new Error("Primary simulation requires the degraded demo state");
  }

  const { simulation: result, diff } = buildPrimaryActionProjection(current.currentGraph);
  const dto = buildSimulationDTO(current.currentGraph, result, diff);

  return {
    ...current,
    simulation: {
      dto,
      projectedGraph: buildGraphDTO(result.simulatedGraph),
      comparisonRows: comparisonRows(dto),
    },
  };
}

function requireRecommendedAction(graph: GraphState): ActionNode {
  const recommendedActions = Object.values(graph.nodes)
    .filter((node): node is ActionNode => node.type === "Action" && node.status === ActionStatus.RECOMMENDED)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (recommendedActions.length !== 1) {
    throw new Error(`Primary demo requires exactly one recommended action; found ${recommendedActions.length}`);
  }
  return recommendedActions[0];
}

function buildPrimaryActionProjection(graph: GraphState) {
  const action = requireRecommendedAction(graph);
  const simulation = simulateAction(graph, action.id, {
    simulationId: DEMO_SIMULATION_ID,
    timestamp: DEMO_SIMULATION_TIMESTAMP,
  });
  const diff = diffGraphStates(graph, simulation.simulatedGraph);
  return { simulation, diff };
}

function comparisonRows(dto: SimulationDTO): SimulationComparisonRow[] {
  const allowedTypes = new Set<GraphNodeType>([
    "Configuration",
    "AttackPath",
    "Risk",
    "Control",
    "Evidence",
  ]);

  return dto.nodeChanges
    .filter((change) => allowedTypes.has(change.nodeType))
    .map((change) => {
      const semanticField = change.changedFields.find((field) => field.path === "status" || field.path === "value");
      if (!semanticField) return null;
      return {
        nodeId: change.nodeId,
        nodeType: change.nodeType,
        label: change.nodeLabel,
        currentValue: semanticField.beforeValue,
        projectedValue: semanticField.afterValue,
      } satisfies SimulationComparisonRow;
    })
    .filter((row): row is SimulationComparisonRow => row !== null)
    .sort((left, right) => {
      const order: Record<GraphNodeType, number> = {
        Company: 0,
        Asset: 1,
        Configuration: 2,
        ThreatCondition: 3,
        AttackStep: 4,
        AttackPath: 5,
        Risk: 6,
        Control: 7,
        Evidence: 8,
        FrameworkRequirement: 9,
        Action: 10,
      };
      return order[left.nodeType] - order[right.nodeType] || left.nodeId.localeCompare(right.nodeId);
    });
}
