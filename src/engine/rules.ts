import { getOutgoingEdges } from "./graph";
import {
  ActionStatus,
  AttackPathStatus,
  AttackStepStatus,
  ControlStatus,
  EdgeType,
  EvidenceStatus,
  FrameworkRequirementStatus,
  RiskStatus,
  ThreatConditionStatus,
  type ActionNode,
  type AttackPathNode,
  type AttackStepNode,
  type ConfigurationNode,
  type ControlNode,
  type EvidenceNode,
  type GraphNode,
  type GraphState,
  type IsoTimestamp,
  type NodeId,
  type RiskNode,
  type ThreatConditionNode,
} from "./types";

export interface PropagationContext {
  eventId: string;
  timestamp: IsoTimestamp;
}

const S3_PUBLIC_ACCESS_KEY = "s3.publicAccess";
const PUBLIC_EXPOSURE_RULE_ID = "demo-rule:s3-public-exposure";
const PRIMARY_S3_PATH_RULE_ID = "demo-rule:s3-public-attack-path";
const BLOCK_PUBLIC_S3_RULE_ID = "demo-rule:block-public-s3-access";
const INTERNET_STEP_KEY = "internet";
const PUBLIC_S3_STEP_KEY = "public-s3-bucket";
const CUSTOMER_DATA_STEP_KEY = "customer-data";

function propagationSource(context: PropagationContext): string {
  return `propagation:${context.eventId}`;
}

function markChanged(node: GraphNode, context: PropagationContext): void {
  node.lastChanged = context.timestamp;
  node.source = propagationSource(context);
}

function findUniqueNode<T extends GraphNode["type"]>(
  graph: GraphState,
  type: T,
  predicate: (node: Extract<GraphNode, { type: T }>) => boolean,
  description: string,
): Extract<GraphNode, { type: T }> {
  const matches = Object.values(graph.nodes).filter(
    (node): node is Extract<GraphNode, { type: T }> => node.type === type && predicate(node as Extract<GraphNode, { type: T }>),
  );

  if (matches.length !== 1) {
    throw new Error(`Propagation expected exactly one ${description}, found ${matches.length}`);
  }

  return matches[0];
}

function getS3PublicAccessConfiguration(graph: GraphState): ConfigurationNode {
  return findUniqueNode(
    graph,
    "Configuration",
    (node) => node.key === S3_PUBLIC_ACCESS_KEY,
    `Configuration with key ${S3_PUBLIC_ACCESS_KEY}`,
  );
}

function getPublicExposureThreat(graph: GraphState): ThreatConditionNode {
  return findUniqueNode(
    graph,
    "ThreatCondition",
    (node) => node.ruleId === PUBLIC_EXPOSURE_RULE_ID,
    `ThreatCondition with ruleId ${PUBLIC_EXPOSURE_RULE_ID}`,
  );
}

function getAttackStep(graph: GraphState, stepKey: string): AttackStepNode {
  return findUniqueNode(
    graph,
    "AttackStep",
    (node) => node.stepKey === stepKey,
    `AttackStep with stepKey ${stepKey}`,
  );
}

function getPrimaryS3AttackPath(graph: GraphState): AttackPathNode {
  return findUniqueNode(
    graph,
    "AttackPath",
    (node) => node.ruleId === PRIMARY_S3_PATH_RULE_ID,
    `AttackPath with ruleId ${PRIMARY_S3_PATH_RULE_ID}`,
  );
}

function getBlockPublicS3Control(graph: GraphState): ControlNode {
  return findUniqueNode(
    graph,
    "Control",
    (node) => node.ruleId === BLOCK_PUBLIC_S3_RULE_ID,
    `Control with ruleId ${BLOCK_PUBLIC_S3_RULE_ID}`,
  );
}

function updateStatus<T extends GraphNode & { status: string }>(
  node: T,
  status: T["status"],
  context: PropagationContext,
): void {
  if (node.status !== status) {
    node.status = status;
    markChanged(node, context);
  }
}

export function evaluateThreatCondition(graph: GraphState, context: PropagationContext): void {
  const configuration = getS3PublicAccessConfiguration(graph);
  const threat = getPublicExposureThreat(graph);
  const desired = configuration.value === true
    ? ThreatConditionStatus.ACTIVE
    : ThreatConditionStatus.INACTIVE;
  updateStatus(threat, desired, context);
}

export function evaluateAttackSteps(graph: GraphState, context: PropagationContext): void {
  const threat = getPublicExposureThreat(graph);
  const internet = getAttackStep(graph, INTERNET_STEP_KEY);
  const publicS3 = getAttackStep(graph, PUBLIC_S3_STEP_KEY);
  const customerData = getAttackStep(graph, CUSTOMER_DATA_STEP_KEY);

  // Internet is an always-available starting condition in the MVP path.
  updateStatus(internet, AttackStepStatus.ACTIVE, context);

  const downstreamStatus = threat.status === ThreatConditionStatus.ACTIVE
    ? AttackStepStatus.ACTIVE
    : AttackStepStatus.BLOCKED;
  updateStatus(publicS3, downstreamStatus, context);
  updateStatus(customerData, downstreamStatus, context);
}

export function evaluateAttackPath(graph: GraphState, context: PropagationContext): void {
  const path = getPrimaryS3AttackPath(graph);
  const allStepsActive = path.stepIds.every((stepId) => {
    const step = graph.nodes[stepId];
    return step?.type === "AttackStep" && step.status === AttackStepStatus.ACTIVE;
  });
  updateStatus(
    path,
    allStepsActive ? AttackPathStatus.ACTIVE : AttackPathStatus.INACTIVE,
    context,
  );
}

export function evaluateRisk(graph: GraphState, context: PropagationContext): void {
  const risk = findUniqueNode(
    graph,
    "Risk",
    (node) => node.sourceAttackPathIds.includes(getPrimaryS3AttackPath(graph).id),
    "Risk sourced from the primary S3 attack path",
  ) as RiskNode;

  const active = risk.sourceAttackPathIds.some((pathId) => {
    const path = graph.nodes[pathId];
    return path?.type === "AttackPath" && path.status === AttackPathStatus.ACTIVE;
  });

  updateStatus(risk, active ? RiskStatus.ACTIVE : RiskStatus.MITIGATED, context);
}

export function evaluateControl(graph: GraphState, context: PropagationContext): void {
  const configuration = getS3PublicAccessConfiguration(graph);
  const control = getBlockPublicS3Control(graph);
  updateStatus(
    control,
    configuration.value === true ? ControlStatus.DEGRADED : ControlStatus.VERIFIED,
    context,
  );
}

export function evaluateEvidence(graph: GraphState, context: PropagationContext): void {
  const configuration = getS3PublicAccessConfiguration(graph);
  const control = getBlockPublicS3Control(graph);
  const evidence = findUniqueNode(
    graph,
    "Evidence",
    (node) => node.controlId === control.id,
    `Evidence for Control ${control.id}`,
  ) as EvidenceNode;

  const observedChanged = JSON.stringify(evidence.observedValue) !== JSON.stringify(configuration.value);
  const desiredStatus = JSON.stringify(configuration.value) === JSON.stringify(evidence.requiredValue)
    ? EvidenceStatus.VALID
    : EvidenceStatus.INVALID;
  const statusChanged = evidence.status !== desiredStatus;

  if (observedChanged || statusChanged) {
    evidence.observedValue = configuration.value;
    evidence.status = desiredStatus;
    markChanged(evidence, context);
  }
}

export function evaluateFrameworkRequirements(
  graph: GraphState,
  context: PropagationContext,
): void {
  const control = getBlockPublicS3Control(graph);
  const mappedRequirementIds = getOutgoingEdges(graph, control.id)
    .filter((edge) => edge.type === EdgeType.MAPS_TO)
    .map((edge) => edge.targetNodeId)
    .sort();

  for (const requirementId of mappedRequirementIds) {
    const requirement = graph.nodes[requirementId];
    if (!requirement || requirement.type !== "FrameworkRequirement") {
      throw new Error(`MAPS_TO target is not a FrameworkRequirement: ${requirementId}`);
    }
    updateStatus(
      requirement,
      control.status === ControlStatus.VERIFIED
        ? FrameworkRequirementStatus.SUPPORTED
        : FrameworkRequirementStatus.AFFECTED,
      context,
    );
  }
}

export function evaluateAction(graph: GraphState, context: PropagationContext): void {
  const configuration = getS3PublicAccessConfiguration(graph);
  const action = findUniqueNode(
    graph,
    "Action",
    (node) => node.configurationId === configuration.id,
    `Action for Configuration ${configuration.id}`,
  ) as ActionNode;

  const desiredStatus = JSON.stringify(configuration.value) === JSON.stringify(action.proposedValue)
    ? ActionStatus.AVAILABLE
    : ActionStatus.RECOMMENDED;
  updateStatus(action, desiredStatus, context);
}
