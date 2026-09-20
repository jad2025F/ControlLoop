export type GraphViewMode = "current" | "projected";

export function GraphViewToggle({
  value,
  currentHealth,
  projectedHealth,
  onChange,
}: {
  value: GraphViewMode;
  currentHealth: number;
  projectedHealth: number;
  onChange: (value: GraphViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Graph state view">
      <button
        type="button"
        aria-pressed={value === "current"}
        onClick={() => onChange("current")}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-teal-500/30 ${
          value === "current" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Current · {currentHealth}
      </button>
      <button
        type="button"
        aria-pressed={value === "projected"}
        onClick={() => onChange("projected")}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-teal-500/30 ${
          value === "projected" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Projected · {projectedHealth}
      </button>
    </div>
  );
}
