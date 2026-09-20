import { calculateSecurityHealth } from "./health";
import {
  ActionStatus,
  AttackPathStatus,
  AttackStepStatus,
  ControlCriticality,
  ControlStatus,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskSeverity,
  RiskStatus,
  ThreatConditionStatus,
  type GraphDiff,
  type GraphDiffSemanticSummary,
  type GraphEdge,
  type GraphNode,
  type GraphNodeChange,
  type GraphState,
  type JsonValue,
  type NodeFieldChange,
} from "./types";

const TEMPORAL_FIELDS = new Set(["validFrom", "validUntil", "lastChanged", "source"]);

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/**
 * Compare semantic node fields only. Expected temporal bookkeeping is deliberately
 * excluded from the primary diff so status/value changes remain the security story.
 */
function diffNodeFields(current: GraphNode, target: GraphNode): NodeFieldChange[] {
  const currentRecord = current as unknown as Record<string, unknown>;
  const targetRecord = target as unknown as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(currentRecord), ...Object.keys(targetRecord)])]
    .filter((field) => !TEMPORAL_FIELDS.has(field))
    .sort((left, right) => left.localeCompare(right));

  const changes: NodeFieldChange[] = [];
  for (const field of fields) {
    const beforeValue = currentRecord[field];
    const afterValue = targetRecord[field];
    if (jsonEqual(beforeValue, afterValue)) continue;

    changes.push({
      path: field,
      beforeValue: toJsonValue(beforeValue),
      afterValue: toJsonValue(afterValue),
    });
  }
  return changes;
}

function diffNodes(currentGraph: GraphState, targetGraph: GraphState): GraphNodeChange[] {
  const sharedNodeIds = Object.keys(currentGraph.nodes)
    .filter((nodeId) => targetGraph.nodes[nodeId] !== undefined)
    .sort((left, right) => left.localeCompare(right));

  const changes: GraphNodeChange[] = [];
  for (const nodeId of sharedNodeIds) {
    const current = currentGraph.nodes[nodeId];
    const target = targetGraph.nodes[nodeId];
    const changedFields = diffNodeFields(current, target);
    if (changedFields.length === 0) continue;

    changes.push({
      nodeId,
      nodeType: target.type,
      nodeLabel: target.label,
      changedFields,
    });
  }
  return changes;
}

function diffEdges(
  currentGraph: GraphState,
  targetGraph: GraphState,
): { added: GraphEdge[]; removed: GraphEdge[] } {
  const added: GraphEdge[] = [];
  const removed: GraphEdge[] = [];
  const edgeIds = [...new Set([...Object.keys(currentGraph.edges), ...Object.keys(targetGraph.edges)])]
    .sort((left, right) => left.localeCompare(right));

  for (const edgeId of edgeIds) {
    const current = currentGraph.edges[edgeId];
    const target = targetGraph.edges[edgeId];

    if (!current && target) {
      added.push(target);
    } else if (current && !target) {
      removed.push(current);
    } else if (current && target && !jsonEqual(current, target)) {
      // A stable edge ID whose topology changed is represented as old-edge removal
      // plus new-edge addition; the primary demo has no such topology changes.
      removed.push(current);
      added.push(target);
    }
  }

  return { added, removed };
}

function summarize(
  currentGraph: GraphState,
  targetGraph: GraphState,
  healthDelta: number,
): GraphDiffSemanticSummary {
  const summary: GraphDiffSemanticSummary = {
    configurationChanges: 0,
    threatConditionsResolved: 0,
    attackStepsBlocked: 0,
    attackPathsDeactivated: 0,
    highRisksMitigated: 0,
    criticalControlsRestored: 0,
    evidenceRestored: 0,
    frameworkRequirementsImproved: 0,
    recommendationsResolved: 0,
    healthImprovement: healthDelta,
  };

  const sharedNodeIds = Object.keys(currentGraph.nodes)
    .filter((nodeId) => targetGraph.nodes[nodeId] !== undefined)
    .sort((left, right) => left.localeCompare(right));

  for (const nodeId of sharedNodeIds) {
    const current = currentGraph.nodes[nodeId];
    const target = targetGraph.nodes[nodeId];
    if (current.type !== target.type) continue;

    if (
      current.type === "Configuration" &&
      target.type === "Configuration" &&
      !jsonEqual(current.value, target.value)
    ) {
      summary.configurationChanges += 1;
    } else if (
      current.type === "ThreatCondition" &&
      target.type === "ThreatCondition" &&
      current.status === ThreatConditionStatus.ACTIVE &&
      target.status === ThreatConditionStatus.INACTIVE
    ) {
      summary.threatConditionsResolved += 1;
    } else if (
      current.type === "AttackStep" &&
      target.type === "AttackStep" &&
      current.status === AttackStepStatus.ACTIVE &&
      target.status === AttackStepStatus.BLOCKED
    ) {
      summary.attackStepsBlocked += 1;
    } else if (
      current.type === "AttackPath" &&
      target.type === "AttackPath" &&
      current.status === AttackPathStatus.ACTIVE &&
      target.status === AttackPathStatus.INACTIVE
    ) {
      summary.attackPathsDeactivated += 1;
    } else if (
      current.type === "Risk" &&
      target.type === "Risk" &&
      current.severity === RiskSeverity.HIGH &&
      current.status === RiskStatus.ACTIVE &&
      target.status === RiskStatus.MITIGATED
    ) {
      summary.highRisksMitigated += 1;
    } else if (
      current.type === "Control" &&
      target.type === "Control" &&
      current.criticality === ControlCriticality.CRITICAL &&
      current.status === ControlStatus.DEGRADED &&
      target.status === ControlStatus.VERIFIED
    ) {
      summary.criticalControlsRestored += 1;
    } else if (
      current.type === "Evidence" &&
      target.type === "Evidence" &&
      (current.status === EvidenceStatus.INVALID || current.status === EvidenceStatus.EXPIRED) &&
      target.status === EvidenceStatus.VALID
    ) {
      summary.evidenceRestored += 1;
    } else if (
      current.type === "FrameworkRequirement" &&
      target.type === "FrameworkRequirement" &&
      current.status === FrameworkRequirementStatus.AFFECTED &&
      target.status === FrameworkRequirementStatus.SUPPORTED
    ) {
      summary.frameworkRequirementsImproved += 1;
    } else if (
      current.type === "Action" &&
      target.type === "Action" &&
      current.status === ActionStatus.RECOMMENDED &&
      target.status === ActionStatus.AVAILABLE
    ) {
      summary.recommendationsResolved += 1;
    }
  }

  return summary;
}

/**
 * Pure deterministic comparison of two already-evaluated graph states.
 * It never propagates, simulates, or mutates either input.
 */
export function diffGraphStates(currentGraph: GraphState, targetGraph: GraphState): GraphDiff {
  const currentHealth = calculateSecurityHealth(currentGraph);
  const targetHealth = calculateSecurityHealth(targetGraph);
  const healthDelta = targetHealth.score - currentHealth.score;

  return {
    sourceGraphVersion: currentGraph.version,
    targetGraphVersion: targetGraph.version,
    healthBefore: currentHealth.score,
    healthAfter: targetHealth.score,
    healthDelta,
    nodeChanges: diffNodes(currentGraph, targetGraph),
    edgeChanges: diffEdges(currentGraph, targetGraph),
    semanticSummary: summarize(currentGraph, targetGraph, healthDelta),
  };
}
