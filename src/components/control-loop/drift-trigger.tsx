interface DriftTriggerProps {
  degraded: boolean;
  onTrigger: () => void;
  onReset: () => void;
}

export function DriftTrigger({ degraded, onTrigger, onReset }: DriftTriggerProps) {
  return (
    <section aria-label="Demo controls" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Demo the change</p>
            {degraded ? (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700">S3 drift applied</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Ready</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {degraded ? "The real evaluated state is now degraded. Continue through Time, Impact, Action, and Simulation." : "Simulate one AWS configuration change and watch ControlLoop trace the impact."}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onTrigger}
            disabled={degraded}
            className="min-h-11 flex-1 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:flex-none"
          >
            {degraded ? "S3 Drift Triggered" : "Trigger S3 Drift"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            Reset Demo
          </button>
        </div>
      </div>
    </section>
  );
}
