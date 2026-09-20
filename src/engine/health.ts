import {
  AttackPathStatus,
  ControlCriticality,
  ControlStatus,
  EvidenceStatus,
  RiskSeverity,
  RiskStatus,
  type GraphNode,
  type GraphState,
  type HealthPenalty,
  type HealthPenaltyReason,
  type HealthResult,
} from "./types";

export const SECURITY_HEALTH_BASE_SCORE = 84;

const ACTIVE_ATTACK_PATH_PENALTY = -6;
const ACTIVE_RISK_PENALTIES: Record<RiskSeverity, number> = {
  [RiskSeverity.HIGH]: -4,
  [RiskSeverity.MEDIUM]: -2,
  [RiskSeverity.LOW]: -1,
};
const DEGRADED_CRITICAL_CONTROL_PENALTY = -4;
const NEEDS_REVIEW_CRITICAL_CONTROL_PENALTY = -2;
const INVALID_EVIDENCE_PENALTY = -2;
const EXPIRED_EVIDENCE_PENALTY = -1;

function penalty(
  node: GraphNode,
  reason: HealthPenaltyReason,
  amount: number,
): HealthPenalty {
  return {
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    reason,
    amount,
  };
}

function sortedNodes(graph: GraphState): GraphNode[] {
  return Object.values(graph.nodes).slice().sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Pure deterministic Security Health evaluation over an already-evaluated graph.
 * This function never propagates or mutates graph state.
 */
export function calculateSecurityHealth(graph: GraphState): HealthResult {
  const nodes = sortedNodes(graph);
  const penaltyBreakdown: HealthPenalty[] = [];

  // Fixed category order keeps the explanation stable as well as the score.
  for (const node of nodes) {
    if (node.type === "AttackPath" && node.status === AttackPathStatus.ACTIVE) {
      penaltyBreakdown.push(penalty(node, "Active attack path", ACTIVE_ATTACK_PATH_PENALTY));
    }
  }

  for (const node of nodes) {
    if (node.type !== "Risk" || node.status !== RiskStatus.ACTIVE) continue;

    const amount = ACTIVE_RISK_PENALTIES[node.severity];
    const reason: HealthPenaltyReason =
      node.severity === RiskSeverity.HIGH
        ? "Active HIGH risk"
        : node.severity === RiskSeverity.MEDIUM
          ? "Active MEDIUM risk"
          : "Active LOW risk";
    penaltyBreakdown.push(penalty(node, reason, amount));
  }

  for (const node of nodes) {
    if (node.type !== "Control" || node.criticality !== ControlCriticality.CRITICAL) continue;

    if (node.status === ControlStatus.DEGRADED) {
      penaltyBreakdown.push(
        penalty(node, "Degraded CRITICAL control", DEGRADED_CRITICAL_CONTROL_PENALTY),
      );
    } else if (node.status === ControlStatus.NEEDS_REVIEW) {
      penaltyBreakdown.push(
        penalty(node, "CRITICAL control needs review", NEEDS_REVIEW_CRITICAL_CONTROL_PENALTY),
      );
    }
  }

  for (const node of nodes) {
    if (node.type !== "Evidence") continue;

    if (node.status === EvidenceStatus.INVALID) {
      penaltyBreakdown.push(penalty(node, "Invalid evidence", INVALID_EVIDENCE_PENALTY));
    } else if (node.status === EvidenceStatus.EXPIRED) {
      penaltyBreakdown.push(penalty(node, "Expired evidence", EXPIRED_EVIDENCE_PENALTY));
    }
  }

  const totalPenalty = penaltyBreakdown.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const rawScore = SECURITY_HEALTH_BASE_SCORE - totalPenalty;
  const score = Math.min(100, Math.max(0, rawScore));

  return {
    score,
    baseScore: SECURITY_HEALTH_BASE_SCORE,
    totalPenalty,
    penaltyBreakdown,
  };
}
