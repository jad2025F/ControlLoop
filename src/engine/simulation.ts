import { applyEvent } from "./propagate";
import { cloneGraph } from "./graph";
import { calculateSecurityHealth } from "./health";
import {
  DomainEventType,
  type ConfigurationChangedEvent,
  type GraphState,
  type JsonValue,
  type NodeId,
  type SimulationContext,
  type SimulationResult,
} from "./types";

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationError";
  }
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Projects an existing Action against a detached graph clone.
 * Security state is recomputed only through the normal event/propagation path.
 */
export function simulateAction(
  graph: GraphState,
  actionId: NodeId,
  context: SimulationContext,
): SimulationResult {
  // Clone before any hypothetical work. The supplied current graph remains untouched.
  const simulationInput = cloneGraph(graph);
  const currentHealth = calculateSecurityHealth(graph);

  const target = simulationInput.nodes[actionId];
  if (!target) {
    throw new SimulationError(`simulation action does not exist: ${actionId}`);
  }
  if (target.type !== "Action") {
    throw new SimulationError(`simulation target is not an Action: ${actionId}`);
  }

  const configuration = simulationInput.nodes[target.configurationId];
  if (!configuration || configuration.type !== "Configuration") {
    throw new SimulationError(
      `Action ${actionId} references nonexistent Configuration: ${target.configurationId}`,
    );
  }

  if (jsonEqual(configuration.value, target.proposedValue)) {
    throw new SimulationError(
      `Action ${actionId} has nothing to remediate; configuration already equals proposed value`,
    );
  }

  const event: ConfigurationChangedEvent = {
    id: `simulation-event:${context.simulationId}:${actionId}`,
    type: DomainEventType.CONFIGURATION_CHANGED,
    targetConfigurationId: target.configurationId,
    beforeValue: configuration.value,
    afterValue: target.proposedValue,
    source: `simulation:${context.simulationId}`,
    timestamp: context.timestamp,
  };

  const simulatedGraph = applyEvent(simulationInput, event);
  const projectedHealth = calculateSecurityHealth(simulatedGraph);

  return {
    simulationId: context.simulationId,
    actionId,
    simulationTimestamp: context.timestamp,
    currentHealth,
    projectedHealth,
    simulatedGraph,
  };
}
