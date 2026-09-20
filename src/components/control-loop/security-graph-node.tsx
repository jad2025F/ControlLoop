import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Framework, GraphNodeType, JsonValue, RiskSeverity } from "../../engine/types";

export interface SecurityGraphNodeData extends Record<string, unknown> {
  label: string;
  nodeType: GraphNodeType;
  state?: JsonValue;
  severity?: RiskSeverity;
  framework?: Framework;
}

export type SecurityFlowNode = Node<SecurityGraphNodeData, "security">;

export function SecurityGraphNode({ data, selected }: NodeProps<SecurityFlowNode>) {
  const tone = stateTone(data.nodeType, data.state);
  return (
    <div
      className={`min-w-[168px] max-w-[196px] rounded-xl border bg-white px-3.5 py-3 shadow-[0_8px_22px_rgba(20,32,51,0.09)] transition ${
        selected ? "border-teal-600 ring-4 ring-teal-100" : tone.border
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" isConnectable={false} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">{typeLabel(data.nodeType)}</span>
        {data.state !== undefined ? (
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${tone.badge}`}>{displayState(data.state)}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-4 text-slate-800">{data.label}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {data.severity ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">{data.severity}</span> : null}
        {data.framework ? <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-700">{data.framework === "SOC2" ? "SOC 2" : data.framework}</span> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" isConnectable={false} />
    </div>
  );
}

function displayState(state: JsonValue): string {
  if (state === false) return "PRIVATE";
  if (state === true) return "PUBLIC";
  return String(state);
}

function typeLabel(type: GraphNodeType): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function stateTone(type: GraphNodeType, state: JsonValue | undefined): { border: string; badge: string } {
  if (type === "AttackStep") {
    return state === "BLOCKED"
      ? { border: "border-slate-200", badge: "bg-slate-100 text-slate-600" }
      : { border: "border-amber-200", badge: "bg-amber-50 text-amber-700" };
  }
  if (["DEGRADED", "INVALID", "AFFECTED", "RECOMMENDED"].includes(String(state))) {
    return { border: "border-rose-200", badge: "bg-rose-50 text-rose-700" };
  }
  if (state === "ACTIVE" && ["ThreatCondition", "AttackPath", "Risk"].includes(type)) {
    return { border: "border-rose-200", badge: "bg-rose-50 text-rose-700" };
  }
  if (state === true && type === "Configuration") {
    return { border: "border-rose-200", badge: "bg-rose-50 text-rose-700" };
  }
  if (["VERIFIED", "VALID", "SUPPORTED", "MITIGATED", "INACTIVE", "AVAILABLE"].includes(String(state)) || (state === false && type === "Configuration")) {
    return { border: "border-emerald-200", badge: "bg-emerald-50 text-emerald-700" };
  }
  return { border: "border-slate-200", badge: "bg-slate-100 text-slate-600" };
}
