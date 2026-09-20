import { cloneGraph, validateGraph } from "./graph";
import {
  evaluateAction,
  evaluateAttackPath,
  evaluateAttackSteps,
  evaluateControl,
  evaluateEvidence,
  evaluateFrameworkRequirements,
  evaluateRisk,
  evaluateThreatCondition,
  type PropagationContext,
} from "./rules";
import { applyConfigurationChangedEvent } from "./events";
import { type ConfigurationChangedEvent, type GraphState } from "./types";

/**
 * Re-evaluates the MVP security state in explicit causal order.
 * The input graph is never mutated.
 */
export function propagate(graph: GraphState, context: PropagationContext): GraphState {
  const next = cloneGraph(graph);

  // Configuration is already the raw input to propagation.
  evaluateThreatCondition(next, context);
  evaluateAttackSteps(next, context);
  evaluateAttackPath(next, context);
  evaluateRisk(next, context);
  evaluateControl(next, context);
  evaluateEvidence(next, context);
  evaluateFrameworkRequirements(next, context);
  evaluateAction(next, context);

  next.evaluatedAt = context.timestamp;
  validateGraph(next);
  return next;
}

/**
 * Public Task 2 interface: apply the raw configuration event, then derive every
 * downstream security state through deterministic propagation.
 */
export function applyEvent(graph: GraphState, event: ConfigurationChangedEvent): GraphState {
  const eventApplied = applyConfigurationChangedEvent(graph, event);
  return propagate(eventApplied, { eventId: event.id, timestamp: event.timestamp });
}
