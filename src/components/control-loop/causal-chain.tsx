import type { ChangeImpactDTO, ChangeImpactStageDTO } from "../../engine/types";

export function CausalChain({ impact }: { impact: ChangeImpactDTO }) {
  const chain = impact.causalChain;
  const stages: Array<{ title: string; stage: ChangeImpactStageDTO | null; emphasis?: boolean }> = [
    { title: "Change", stage: chain.configuration, emphasis: true },
    { title: "Threat", stage: chain.threatCondition },
    { title: "Attack Path", stage: chain.attackPath, emphasis: true },
    { title: "Risk", stage: chain.risk, emphasis: true },
    { title: "Control", stage: chain.control },
    { title: "Evidence", stage: chain.evidence },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-8">
        {stages.map(({ title, stage, emphasis }) =>
          stage ? <StageCard key={stage.nodeId} title={title} stage={stage} emphasis={emphasis} /> : null,
        )}

        <div className="relative rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Framework</p>
          <p className="mt-2 min-h-8 text-xs font-semibold leading-5 text-slate-800">NIST · CIS · SOC 2</p>
          <Transition before="SUPPORTED" after="AFFECTED" />
          <Arrow />
        </div>

        {chain.action ? <StageCard title="Action" stage={chain.action} terminal emphasis /> : null}
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.14em] text-slate-500 focus-visible:outline-none">
          Supporting framework mappings <span className="ml-2 text-[11px] font-medium normal-case tracking-normal text-slate-400">NIST · CIS · SOC 2</span>
        </summary>
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="text-[11px] text-slate-400">Supporting mappings only — not a legal compliance determination.</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {chain.frameworkRequirements.map((framework) => (
            <div key={framework.nodeId} className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">{framework.framework === "SOC2" ? "SOC 2" : framework.framework}</span>
                <span className="text-[10px] font-semibold text-slate-400">{framework.reference}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
                <span className="text-emerald-700">{framework.beforeStatus}</span>
                <span className="text-slate-300">→</span>
                <span className="text-rose-700">{framework.afterStatus}</span>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function StageCard({
  title,
  stage,
  terminal = false,
  emphasis = false,
}: {
  title: string;
  stage: ChangeImpactStageDTO;
  terminal?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className={`relative rounded-xl border p-3.5 ${emphasis ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50/55"}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${emphasis ? "text-slate-700" : "text-slate-400"}`}>{title}</p>
      <p className="mt-2 min-h-8 text-xs font-semibold leading-5 text-slate-800">{stage.label}</p>
      <Transition before={formatValue(stage.beforeValue)} after={formatValue(stage.afterValue)} />
      {!terminal ? <Arrow /> : null}
    </div>
  );
}

function Transition({ before, after }: { before: string; after: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
      <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{before}</span>
      <span className="text-slate-300" aria-hidden="true">→</span>
      <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">{after}</span>
    </div>
  );
}

function Arrow() {
  return <span className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-sm font-bold text-slate-300 xl:block" aria-hidden="true">→</span>;
}

function formatValue(value: ChangeImpactStageDTO["beforeValue"]): string {
  if (value === false) return "Private";
  if (value === true) return "Public";
  return String(value);
}
