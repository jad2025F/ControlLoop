"use client";

import { useMemo, type MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
} from "@xyflow/react";
import type { GraphDTO, GraphNodeDTO, GraphNodeType } from "../../engine/types";
import { SecurityGraphNode, type SecurityFlowNode, type SecurityGraphNodeData } from "./security-graph-node";

const nodeTypes = { security: SecurityGraphNode };

export function SecurityGraph({ graph, onSelectNode }: { graph: GraphDTO; onSelectNode: (node: GraphNodeDTO | null) => void }) {
  const nodes = useMemo<SecurityFlowNode[]>(() => layoutNodes(graph), [graph]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#94a3b8" },
        style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
        selectable: false,
        focusable: false,
      })),
    [graph],
  );

  return (
    <div
      className="h-[500px] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-[#fbfcfe] sm:h-[570px] lg:h-[610px]"
      role="region"
      aria-label="Security evidence and attack graph"
    >
      <ReactFlow<SecurityFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.11, maxZoom: 1.08 }}
        minZoom={0.32}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        deleteKeyCode={null}
        onPaneClick={() => onSelectNode(null)}
        onNodeClick={(_event: ReactMouseEvent, node: SecurityFlowNode) => {
          const dtoNode = graph.nodes.find((candidate) => candidate.id === node.id);
          if (dtoNode) onSelectNode(dtoNode);
        }}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#dfe6ee" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}

function layoutNodes(graph: GraphDTO): SecurityFlowNode[] {
  const groups = new Map<GraphNodeType, GraphNodeDTO[]>();
  for (const node of graph.nodes) {
    const group = groups.get(node.nodeType) ?? [];
    group.push(node);
    groups.set(node.nodeType, group);
  }

  const coords: Record<GraphNodeType, { x: number; y: number; stepY: number }> = {
    Company: { x: 0, y: 190, stepY: 160 },
    Asset: { x: 215, y: 95, stepY: 190 },
    Configuration: { x: 440, y: 90, stepY: 165 },
    ThreatCondition: { x: 665, y: 90, stepY: 165 },
    AttackStep: { x: 890, y: 0, stepY: 155 },
    AttackPath: { x: 1115, y: 150, stepY: 165 },
    Risk: { x: 1340, y: 150, stepY: 165 },
    Control: { x: 1115, y: 405, stepY: 165 },
    Evidence: { x: 890, y: 445, stepY: 165 },
    FrameworkRequirement: { x: 1340, y: 350, stepY: 138 },
    Action: { x: 440, y: 425, stepY: 165 },
  };

  const positionById = new Map<string, { x: number; y: number }>();
  for (const [type, items] of groups.entries()) {
    const base = coords[type];
    items
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((node, index) => positionById.set(node.id, { x: base.x, y: base.y + index * base.stepY }));
  }

  return graph.nodes.map((node) => ({
    id: node.id,
    type: "security",
    position: positionById.get(node.id) ?? { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.nodeType,
      state: node.state,
      severity: node.severity,
      framework: node.framework,
    } satisfies SecurityGraphNodeData,
    draggable: false,
    connectable: false,
  }));
}
