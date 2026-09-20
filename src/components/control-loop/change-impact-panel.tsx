import type { ChangeImpactDTO } from "../../engine/types";
import { CausalChain } from "./causal-chain";

export function ChangeImpactPanel({ impact }: { impact: ChangeImpactDTO }) {
  return (
    <section id="change-impact" className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Change Impact</p>
          <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-[-0.025em] text-slate-900">One configuration change. Everything it affected.</h2>
          <div className="mt-3 max-w-3xl rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Why it matters</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{impact.businessImpact}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Security Health</p>
            <p className="mt-1 text-xl font-semibold">{impact.health.before} → {impact.health.after}</p>
          </div>
          <div className="h-9 w-px bg-white/15" aria-hidden="true" />
          <div className="text-2xl font-semibold text-rose-300">{impact.health.delta}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <StateCard eyebrow="Before" label={impact.configurationChange.label} value="Private" tone="healthy" />
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">→</div>
        <StateCard eyebrow="After" label={impact.configurationChange.label} value="Public" tone="degraded" />
      </div>

      <div className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Causal chain</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Change → Threat → Attack Path → Risk → Control → Evidence → Framework → Action</p>
          </div>
          <span className="text-[11px] text-slate-400">Every transition comes from the evaluated graph</span>
        </div>
        <CausalChain impact={impact} />
      </div>
    </section>
  );
}

function StateCard({ eyebrow, label, value, tone }: { eyebrow: string; label: string; value: string; tone: "healthy" | "degraded" }) {
  const healthy = tone === "healthy";
  return (
    <div className={`rounded-xl border p-4 ${healthy ? "border-emerald-100 bg-emerald-50/55" : "border-rose-100 bg-rose-50/60"}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${healthy ? "text-emerald-700" : "text-rose-700"}`}>{eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${healthy ? "text-emerald-700" : "text-rose-700"}`}>{value}</p>
    </div>
  );
}
