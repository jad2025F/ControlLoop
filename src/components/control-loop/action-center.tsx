import type { ActionCenterDTO, ActionCenterItemDTO } from "../../engine/types";

interface ActionCenterProps {
  actionCenter: ActionCenterDTO;
  simulationReady: boolean;
}

export function ActionCenter({ actionCenter, simulationReady }: ActionCenterProps) {
  const action = actionCenter.actions[0] ?? null;

  return (
    <section id="action-center" className="scroll-mt-24 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(20,32,51,0.07)]">
      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#ecfdf5_100%)] px-6 py-5 lg:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">Action Center</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-slate-900">What should I do next?</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Prioritize the remediation with the clearest predicted security impact—without changing production.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
            Recommendation · projection only
          </span>
        </div>
      </div>

      <div className="p-6 lg:p-7">
        {!action ? <HealthyActionState /> : <PriorityActionCard action={action} simulationReady={simulationReady} />}
      </div>
    </section>
  );
}

function HealthyActionState() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-emerald-100 bg-emerald-50/55 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span>
        <div>
          <p className="text-sm font-semibold text-slate-900">No high-priority remediation needed.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">ControlLoop has no recommended actions in the current evaluated state.</p>
        </div>
      </div>
      <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">0 recommended</span>
    </div>
  );
}

function PriorityActionCard({ action, simulationReady }: { action: ActionCenterItemDTO; simulationReady: boolean }) {
  const effects = action.expectedEffects;
  const effectRows = [
    [effects.attackPathsDeactivated, "Attack path removed"],
    [effects.highRisksMitigated, "HIGH risk mitigated"],
    [effects.criticalControlsRestored, "Critical control restored"],
    [effects.evidenceRestored, "Evidence item restored"],
    [effects.frameworkMappingsImproved, "Framework mappings improved"],
  ] as const;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(145deg,#fff7f7_0%,#ffffff_68%)] p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">Priority {titleCase(action.priority)}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{titleCase(action.status)}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-900">{action.title}</h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">Target: {action.targetConfigurationLabel}</p>
          </div>
          <div className="rounded-xl bg-white px-3.5 py-3 text-right ring-1 ring-rose-100">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Health impact</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{action.currentHealth} → {action.projectedHealth}</p>
            <p className="mt-0.5 text-xs font-black text-emerald-700">+{action.healthImprovement}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <SettingState label="Current setting" value={businessValue(action.currentValue)} tone="current" />
          <div className="mx-auto hidden text-lg font-semibold text-slate-300 sm:block">→</div>
          <SettingState label="Proposed setting" value={businessValue(action.proposedValue)} tone="projected" />
        </div>

        <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/55 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900">Projection only — no production remediation is performed.</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-800/75">The recommendation predicts the outcome using the existing deterministic simulation path.</p>
        </div>

        <a
          href="#simulation"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black tracking-[0.02em] text-white shadow-sm transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-teal-500/30 sm:w-auto"
        >
          {simulationReady ? "View projected outcome" : "Simulate Fix"}
        </a>
      </div>

      <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5 lg:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-700">Expected impact</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">One fix, multiple security repairs.</h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          One technical fix improves <span className="font-bold text-slate-700">{effects.frameworkMappingsImproved}</span> mapped framework requirements.
        </p>

        <div className="mt-4 space-y-2.5">
          {effectRows.map(([count, label]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-teal-100">
              <span className="text-xs font-semibold text-slate-700">{label}</span>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 px-2 text-xs font-black text-emerald-700">{count}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Projected Security Health</p>
              <p className="mt-1 text-sm font-semibold text-white">{action.currentHealth} → {action.projectedHealth}</p>
            </div>
            <span className="text-xl font-bold text-emerald-300">+{action.healthImprovement}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingState({ label, value, tone }: { label: string; value: string; tone: "current" | "projected" }) {
  const projected = tone === "projected";
  return (
    <div className={`rounded-xl border p-4 ${projected ? "border-emerald-100 bg-emerald-50/65" : "border-rose-100 bg-rose-50/65"}`}>
      <p className={`text-[9px] font-black uppercase tracking-[0.13em] ${projected ? "text-emerald-700" : "text-rose-700"}`}>{label}</p>
      <p className={`mt-1.5 text-lg font-semibold ${projected ? "text-emerald-800" : "text-rose-800"}`}>{value}</p>
    </div>
  );
}

function businessValue(value: unknown): string {
  if (value === true) return "Public";
  if (value === false) return "Private";
  return String(value);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
