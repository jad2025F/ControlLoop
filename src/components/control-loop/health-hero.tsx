import type { ChangeImpactDTO, OverviewDTO } from "../../engine/types";

interface HealthHeroProps {
  overview: OverviewDTO;
  changeImpact: ChangeImpactDTO | null;
}

export function HealthHero({ overview, changeImpact }: HealthHeroProps) {
  const degraded = overview.securityDriftPresent;

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_20px_70px_rgba(20,32,51,0.08)]">
      <div className="grid gap-7 p-6 sm:p-7 lg:grid-cols-[1.18fr_0.82fr] lg:gap-9 lg:p-9">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                degraded ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${degraded ? "bg-rose-500" : "bg-emerald-500"}`} aria-hidden="true" />
              {degraded ? "Security drift detected" : "No critical security drift"}
            </span>
            {changeImpact ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                {changeImpact.event.title}
              </span>
            ) : null}
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Security Health</p>
          <div className="mt-2" aria-live="polite" aria-atomic="true">
            {changeImpact ? (
              <div className="demo-health-change flex flex-wrap items-end gap-3 sm:gap-4">
                <span className="pb-1 text-4xl font-semibold tracking-[-0.04em] text-slate-300">{changeImpact.health.before}</span>
                <span className="pb-2 text-2xl font-semibold text-slate-300" aria-hidden="true">→</span>
                <span className="text-7xl font-semibold tracking-[-0.065em] text-rose-600 sm:text-8xl">{changeImpact.health.after}</span>
                <span className="mb-2 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-black text-rose-700">{signed(changeImpact.health.delta)}</span>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <span className="text-7xl font-semibold tracking-[-0.065em] text-slate-900 sm:text-8xl">{overview.currentHealth}</span>
                <span className="pb-2 text-sm font-medium text-slate-400">/ 100</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Protected company</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-900 sm:text-4xl">{overview.companyName}</h1>
            </div>
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {overview.industry} · ~{overview.approximateEmployeeCount} employees
            </span>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
            {degraded && changeImpact
              ? "One customer-data configuration changed. ControlLoop traced exactly what it affected across exposure, risk, controls, evidence, and mapped requirements."
              : "Security state is stable. Critical protection is verified and the customer-data exposure path is blocked."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 self-stretch">
          <Metric label="Active attack paths" value={overview.activeAttackPathCount} alert={overview.activeAttackPathCount > 0} />
          <Metric label="HIGH risks" value={overview.activeHighRiskCount} alert={overview.activeHighRiskCount > 0} />
          <Metric label="Critical controls degraded" value={overview.degradedCriticalControlCount} alert={overview.degradedCriticalControlCount > 0} />
          <Metric label="Invalid evidence" value={overview.invalidEvidenceCount} alert={overview.invalidEvidenceCount > 0} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, alert }: { label: string; value: number; alert: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${alert ? "border-rose-100 bg-rose-50/70" : "border-slate-100 bg-slate-50/80"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-2xl font-semibold sm:text-3xl ${alert ? "text-rose-700" : "text-slate-800"}`}>{value}</div>
        <span className={`h-2 w-2 rounded-full ${alert ? "bg-rose-500" : "bg-emerald-500"}`} aria-hidden="true" />
      </div>
      <div className="mt-1.5 text-xs font-medium leading-5 text-slate-500">{label}</div>
    </div>
  );
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
