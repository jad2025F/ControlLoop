import { cloneGraph, validateGraph } from "./graph";
import {
  DomainEventType,
  type ConfigurationChangedEvent,
  type GraphState,
  type JsonValue,
} from "./types";

export class DomainEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainEventError";
  }
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Applies only the raw configuration mutation described by the external event.
 * Downstream security meaning is intentionally owned by deterministic propagation.
 */
export function applyConfigurationChangedEvent(
  graph: GraphState,
  event: ConfigurationChangedEvent,
): GraphState {
  if (event.type !== DomainEventType.CONFIGURATION_CHANGED) {
    throw new DomainEventError(`unsupported event type: ${String(event.type)}`);
  }

  const next = cloneGraph(graph);
  const target = next.nodes[event.targetConfigurationId];

  if (!target || target.type !== "Configuration") {
    throw new DomainEventError(
      `CONFIGURATION_CHANGED target does not exist or is not a Configuration: ${event.targetConfigurationId}`,
    );
  }

  if (!jsonEqual(target.value, event.beforeValue)) {
    throw new DomainEventError(
      `CONFIGURATION_CHANGED expected before value ${JSON.stringify(event.beforeValue)} ` +
        `for ${event.targetConfigurationId}, received ${JSON.stringify(target.value)}`,
    );
  }

  target.value = event.afterValue;
  target.lastChanged = event.timestamp;
  target.source = `event:${event.id}`;
  next.version = graph.version + 1;
  next.evaluatedAt = event.timestamp;

  validateGraph(next);
  return next;
}
