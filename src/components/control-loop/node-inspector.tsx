import type { GraphNodeDTO } from "../../engine/types";

export function NodeInspector({ node, stateLabel = "Current state" }: { node: GraphNodeDTO | null; stateLabel?: string }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:self-start" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Node Inspector</p>
        <span className={`h-2 w-2 rounded-full ${node ? "bg-teal-500" : "bg-slate-300"}`} aria-hidden="true" />
      </div>
      {node ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-lg font-semibold leading-6 text-slate-900">{node.label}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">{readableType(node.nodeType)}</p>
          </div>
          <dl className="space-y-2 text-sm">
            {node.state !== undefined ? <Row label={stateLabel} value={display(node.state)} /> : null}
            {node.severity ? <Row label="Severity" value={node.severity} /> : null}
            {node.framework ? <Row label="Framework" value={node.framework === "SOC2" ? "SOC 2" : node.framework} /> : null}
          </dl>
          <p className="text-[11px] leading-5 text-slate-400">Select another node to inspect it, or click the graph background to clear the selection.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-4">
          <p className="text-sm font-semibold text-slate-700">Inspect the evaluated state</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Select any graph node to view its current status and relevant metadata.</p>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-xs font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function display(value: GraphNodeDTO["state"]): string {
  if (value === true) return "PUBLIC";
  if (value === false) return "PRIVATE";
  return String(value);
}

function readableType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}
