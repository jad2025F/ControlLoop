import {
  type ActionNode,
  type AttackPathNode,
  type ConfigurationNode,
  type EdgeId,
  type EvidenceNode,
  type GraphEdge,
  type GraphInput,
  type GraphNode,
  type GraphNodeType,
  type GraphState,
  type NodeId,
} from "./types";

export class GraphValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Graph validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "GraphValidationError";
    this.issues = issues;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function assertNoDuplicateIds<T extends { id: string }>(items: T[], kind: "node" | "edge"): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  if (duplicates.size > 0) {
    throw new GraphValidationError(
      [...duplicates]
        .sort()
        .map((id) => `duplicate ${kind} ID: ${id}`),
    );
  }
}

export function createGraph(input: GraphInput): GraphState {
  assertNoDuplicateIds(input.nodes, "node");
  assertNoDuplicateIds(input.edges, "edge");

  const graph: GraphState = {
    version: input.version,
    companyId: input.companyId,
    evaluatedAt: input.evaluatedAt,
    nodes: Object.fromEntries(input.nodes.map((node) => [node.id, cloneJson(node)])),
    edges: Object.fromEntries(input.edges.map((edge) => [edge.id, cloneJson(edge)])),
  };

  validateGraph(graph);
  return deepFreeze(graph);
}

export function cloneGraph(graph: GraphState): GraphState {
  return cloneJson(graph);
}

export function getNode(graph: GraphState, id: NodeId): GraphNode | undefined {
  return graph.nodes[id];
}

export function getEdge(graph: GraphState, id: EdgeId): GraphEdge | undefined {
  return graph.edges[id];
}

export function getNodesByType<T extends GraphNodeType>(
  graph: GraphState,
  type: T,
): Extract<GraphNode, { type: T }>[] {
  return Object.values(graph.nodes).filter(
    (node): node is Extract<GraphNode, { type: T }> => node.type === type,
  );
}

export function getOutgoingEdges(graph: GraphState, sourceNodeId: NodeId): GraphEdge[] {
  return Object.values(graph.edges).filter((edge) => edge.sourceNodeId === sourceNodeId);
}

export function getIncomingEdges(graph: GraphState, targetNodeId: NodeId): GraphEdge[] {
  return Object.values(graph.edges).filter((edge) => edge.targetNodeId === targetNodeId);
}

export function validateGraph(graph: GraphState): void {
  const issues: string[] = [];
  const nodes = graph.nodes;

  const company = nodes[graph.companyId];
  if (!company || company.type !== "Company") {
    issues.push(`missing company node for companyId: ${graph.companyId}`);
  }

  for (const edge of Object.values(graph.edges).sort((a, b) => a.id.localeCompare(b.id))) {
    if (!nodes[edge.sourceNodeId]) {
      issues.push(`edge ${edge.id} references nonexistent source node: ${edge.sourceNodeId}`);
    }
    if (!nodes[edge.targetNodeId]) {
      issues.push(`edge ${edge.id} references nonexistent target node: ${edge.targetNodeId}`);
    }
  }

  for (const node of Object.values(nodes).sort((a, b) => a.id.localeCompare(b.id))) {
    if (node.type === "AttackPath") {
      validateAttackPath(node, nodes, issues);
    } else if (node.type === "Configuration") {
      validateConfiguration(node, nodes, issues);
    } else if (node.type === "Evidence") {
      validateEvidence(node, nodes, issues);
    } else if (node.type === "Action") {
      validateAction(node, nodes, issues);
    }
  }

  if (issues.length > 0) {
    throw new GraphValidationError(issues);
  }
}

function validateAttackPath(
  node: AttackPathNode,
  nodes: Record<NodeId, GraphNode>,
  issues: string[],
): void {
  for (const stepId of node.stepIds) {
    const step = nodes[stepId];
    if (!step || step.type !== "AttackStep") {
      issues.push(`AttackPath ${node.id} references nonexistent AttackStep: ${stepId}`);
    }
  }
}

function validateConfiguration(
  node: ConfigurationNode,
  nodes: Record<NodeId, GraphNode>,
  issues: string[],
): void {
  const asset = nodes[node.assetId];
  if (!asset || asset.type !== "Asset") {
    issues.push(`Configuration ${node.id} references nonexistent Asset: ${node.assetId}`);
  }
}

function validateEvidence(
  node: EvidenceNode,
  nodes: Record<NodeId, GraphNode>,
  issues: string[],
): void {
  const control = nodes[node.controlId];
  if (!control || control.type !== "Control") {
    issues.push(`Evidence ${node.id} references nonexistent Control: ${node.controlId}`);
  }
}

function validateAction(
  node: ActionNode,
  nodes: Record<NodeId, GraphNode>,
  issues: string[],
): void {
  const configuration = nodes[node.configurationId];
  if (!configuration || configuration.type !== "Configuration") {
    issues.push(`Action ${node.id} references nonexistent Configuration: ${node.configurationId}`);
  }
}
