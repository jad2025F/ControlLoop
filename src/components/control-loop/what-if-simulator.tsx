import type { DemoSimulationPresentation } from "../../demo/demo-controller";

interface WhatIfSimulatorProps {
  actionTitle: string;
  simulation: DemoSimulationPresentation | null;
  onSimulate: () => void;
}

export function WhatIfSimulator({ actionTitle, simulation, onSimulate }: WhatIfSimulatorProps) {
  if (!simulation) {
    return (
      <section id="simulation" className="scroll-mt-24 overflow-hidden rounded-[24px] border border-teal-200 bg-[linear-gradient(135deg,#f0fdfa_0%,#ffffff_52%,#f8fafc_100%)] shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-7">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-teal-800">What-If</span>
              <span className="text-xs font-semibold text-slate-400">Projected state only</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-slate-900">See what the fix repairs before changing production.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Recommended remediation: <span className="font-semibold text-slate-700">{actionTitle}</span>. ControlLoop will clone the current state and run the same deterministic engine on the hypothetical fix.
            </p>
          </div>
          <button
            type="button"
            onClick={onSimulate}
            className="min-h-12 rounded-xl bg-teal-700 px-7 py-3.5 text-sm font-black tracking-[0.04em] text-white shadow-[0_10px_28px_rgba(13,143,131,0.24)] transition hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            SIMULATE FIX
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="simulation" className="scroll-mt-24 overflow-hidden rounded-[26px] border border-teal-200 bg-white shadow-[0_18px_55px_rgba(13,143,131,0.10)]">
      <div className="border-b border-teal-100 bg-teal-50/60 px-6 py-4 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">Projected after fix · hypothetical only</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{simulation.dto.action.title}</p>
          </div>
          <span className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800">Production remains unchanged</span>
        </div>
      </div>

      <div className="p-6 lg:p-7" aria-live="polite">
        <p className="mb-4 text-center text-sm font-semibold text-slate-600">See exactly what the fix would repair before production is touched.</p>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          <HealthState label="CURRENT" score={simulation.dto.health.current} tone="current" subtitle="Production state" />
          <div className="flex items-center justify-center px-2">
            <div className="flex h-14 min-w-20 items-center justify-center rounded-full bg-teal-50 px-4 text-xl font-bold text-teal-700">+{simulation.dto.health.delta}</div>
          </div>
          <HealthState label="PROJECTED" score={simulation.dto.health.projected} tone="projected" subtitle="After simulated fix" />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Current vs projected</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">Engine-derived state changes</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">No production mutation</span>
            </div>
            <div className="mt-4 space-y-2">
              {simulation.comparisonRows.map((row) => (
                <div key={row.nodeId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-200">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{row.label}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{readableType(row.nodeType)}</p>
                  </div>
                  <StatePill value={row.currentValue} projected={false} />
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">→</span>
                    <StatePill value={row.projectedValue} projected />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ExpectedEffects simulation={simulation} />
        </div>
      </div>
    </section>
  );
}

function HealthState({ label, score, subtitle, tone }: { label: string; score: number; subtitle: string; tone: "current" | "projected" }) {
  const projected = tone === "projected";
  return (
    <div className={`rounded-2xl border p-5 ${projected ? "border-emerald-200 bg-emerald-50/65" : "border-rose-200 bg-rose-50/65"}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${projected ? "text-emerald-700" : "text-rose-700"}`}>{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className={`text-6xl font-semibold tracking-[-0.06em] ${projected ? "text-emerald-700" : "text-rose-700"}`}>{score}</span>
        <span className="pb-1 text-xs font-medium text-slate-400">/ 100</span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{subtitle}</p>
    </div>
  );
}

function ExpectedEffects({ simulation }: { simulation: DemoSimulationPresentation }) {
  const effects = simulation.dto.expectedEffects;
  const rows = [
    [effects.attackPathsDeactivated, "Attack path removed"],
    [effects.highRisksMitigated, "HIGH risk mitigated"],
    [effects.criticalControlsRestored, "Critical control restored"],
    [effects.evidenceRestored, "Evidence item restored"],
    [effects.frameworkMappingsImproved, "Framework mappings improved"],
  ] as const;

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-700">Expected effects</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-900">What the fix repairs</h3>
      <div className="mt-4 space-y-2.5">
        {rows.map(([count, label]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-teal-100">
            <span className="text-xs font-semibold text-slate-700">{label}</span>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 px-2 text-xs font-black text-emerald-700">{count}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-slate-300">Security Health improvement</span>
          <span className="text-xl font-bold text-emerald-300">+{simulation.dto.health.delta}</span>
        </div>
      </div>
    </div>
  );
}

function StatePill({ value, projected }: { value: unknown; projected: boolean }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${projected ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {displayValue(value)}
    </span>
  );
}

function displayValue(value: unknown): string {
  if (value === true) return "PUBLIC";
  if (value === false) return "PRIVATE";
  return String(value);
}

function readableType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}
