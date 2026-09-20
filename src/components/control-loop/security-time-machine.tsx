"use client";

import { useEffect, useState } from "react";
import type { ChangeImpactDTO, ChangeImpactStageDTO, TimelineDTO } from "../../engine/types";

interface SecurityTimeMachineProps {
  timeline: TimelineDTO;
  changeImpact: ChangeImpactDTO | null;
}

export function SecurityTimeMachine({ timeline, changeImpact }: SecurityTimeMachineProps) {
  const firstEventId = timeline.transitions[0]?.eventId ?? null;
  const [selectedEventId, setSelectedEventId] = useState<string | null>(firstEventId);

  useEffect(() => {
    setSelectedEventId(firstEventId);
  }, [firstEventId]);

  const selectedTransition = timeline.transitions.find((transition) => transition.eventId === selectedEventId) ?? null;
  const canShowComparison = selectedTransition !== null && changeImpact?.event.id === selectedTransition.eventId;
  const selectedSnapshot = selectedTransition
    ? timeline.snapshots.find((snapshot) => snapshot.triggeringEventId === selectedTransition.eventId) ?? null
    : null;
  const selectedDisplayTime = selectedSnapshot?.label.split(" — ")[0] ?? "";

  return (
    <section id="time-machine" className="scroll-mt-24 overflow-hidden rounded-[26px] border border-indigo-100 bg-white shadow-[0_18px_55px_rgba(51,65,85,0.07)]">
      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-5 lg:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Security Time Machine</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-slate-900">See exactly when your security state changed.</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">Follow the evaluated state before a change, the change itself, and the security posture that resulted.</p>
          </div>
          <div className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-indigo-700">
            Before → Change → After
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-7">
        <div className="relative grid gap-4 md:grid-cols-2">
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-slate-200 md:block" />
          {timeline.snapshots.map((snapshot) => {
            const isBaseline = snapshot.triggeringEventId === null;
            const transition = snapshot.triggeringEventId
              ? timeline.transitions.find((candidate) => candidate.eventId === snapshot.triggeringEventId) ?? null
              : null;
            const selected = transition !== null && transition.eventId === selectedEventId;

            return (
              <button
                key={snapshot.snapshotId}
                type="button"
                onClick={() => transition && setSelectedEventId(transition.eventId)}
                disabled={!transition}
                className={`relative rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-indigo-300 bg-indigo-50/70 shadow-[0_8px_24px_rgba(79,70,229,0.10)]"
                    : isBaseline
                      ? "border-emerald-100 bg-emerald-50/55"
                      : "border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/40"
                } ${transition ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400/40" : "cursor-default"}`}
              >
                <div className={`relative z-10 mb-3 h-3 w-3 rounded-full ring-4 ring-white ${isBaseline ? "bg-emerald-500" : "bg-indigo-500"}`} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{snapshot.label}</p>
                    <p className={`mt-2 text-3xl font-semibold tracking-[-0.04em] ${isBaseline ? "text-emerald-700" : "text-rose-600"}`}>
                      {snapshot.healthScore}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Security Health</p>
                  </div>
                  {transition ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{signed(transition.healthDelta)}</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.11em] text-emerald-700">Healthy</span>
                  )}
                </div>
                {transition ? <p className="mt-3 text-xs font-medium text-indigo-700">View before / after →</p> : <p className="mt-3 text-xs text-slate-500">No critical security drift</p>}
              </button>
            );
          })}
        </div>

        {timeline.transitions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-4 text-sm text-slate-500">
            No security changes recorded yet. Trigger S3 Drift to add the next evaluated state.
          </div>
        ) : null}

        {canShowComparison && changeImpact ? <SnapshotComparison impact={changeImpact} eventDisplayTime={selectedDisplayTime} /> : null}
      </div>
    </section>
  );
}

function SnapshotComparison({ impact, eventDisplayTime }: { impact: ChangeImpactDTO; eventDisplayTime: string }) {
  const path = impact.causalChain.attackPath;
  const risk = impact.causalChain.risk;
  const control = impact.causalChain.control;
  const evidence = impact.causalChain.evidence;

  return (
    <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50/60 p-4 lg:p-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        <StateCard
          eyebrow="BEFORE"
          tone="healthy"
          health={impact.health.before}
          items={[
            ["S3 access", businessAccess(impact.configurationChange.beforeValue)],
            ["Attack path", stageValue(path, "beforeValue")],
            ["Risk", stageValue(risk, "beforeValue")],
            ["Control", stageValue(control, "beforeValue")],
            ["Evidence", stageValue(evidence, "beforeValue")],
          ]}
        />
        <Arrow />
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">CHANGE</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{impact.configurationChange.label}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {businessAccess(impact.configurationChange.beforeValue)} → {businessAccess(impact.configurationChange.afterValue)}
          </p>
          <p className="mt-3 text-xs font-semibold text-indigo-700">{eventDisplayTime}</p>
          <div className="mt-4 inline-flex items-center rounded-full bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-700">
            {impact.health.before} → {impact.health.after} · {signed(impact.health.delta)}
          </div>
          <a
            href="#change-impact"
            className="mt-4 inline-flex rounded-md text-xs font-bold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-400/40"
          >
            View impact ↓
          </a>
        </div>
        <Arrow />
        <StateCard
          eyebrow="AFTER"
          tone="degraded"
          health={impact.health.after}
          items={[
            ["S3 access", businessAccess(impact.configurationChange.afterValue)],
            ["Attack path", stageValue(path, "afterValue")],
            ["Risk", stageValue(risk, "afterValue")],
            ["Control", stageValue(control, "afterValue")],
            ["Evidence", stageValue(evidence, "afterValue")],
          ]}
        />
      </div>
    </div>
  );
}

function StateCard({
  eyebrow,
  tone,
  health,
  items,
}: {
  eyebrow: string;
  tone: "healthy" | "degraded";
  health: number;
  items: Array<readonly [string, string]>;
}) {
  const healthy = tone === "healthy";
  return (
    <div className={`rounded-2xl border p-5 ${healthy ? "border-emerald-100 bg-emerald-50/65" : "border-rose-100 bg-rose-50/65"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${healthy ? "text-emerald-700" : "text-rose-700"}`}>{eyebrow}</p>
          <p className={`mt-2 text-4xl font-semibold tracking-[-0.05em] ${healthy ? "text-emerald-700" : "text-rose-600"}`}>{health}</p>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${healthy ? "bg-emerald-500" : "bg-rose-500"}`} />
      </div>
      <div className="mt-4 space-y-2.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 border-t border-white/80 pt-2.5 text-xs">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-800">{businessStatus(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow() {
  return <div className="hidden items-center justify-center text-xl font-semibold text-slate-300 lg:flex">→</div>;
}

function stageValue(stage: ChangeImpactStageDTO | null, side: "beforeValue" | "afterValue"): string {
  return stage ? String(stage[side]) : "—";
}

function businessAccess(value: unknown): string {
  if (value === false) return "Private";
  if (value === true) return "Public";
  return String(value);
}

function businessStatus(value: string): string {
  const labels: Record<string, string> = {
    INACTIVE: "Inactive",
    ACTIVE: "Active",
    MITIGATED: "Mitigated",
    DEGRADED: "Degraded",
    VERIFIED: "Verified",
    VALID: "Valid",
    INVALID: "Invalid",
    Private: "Private",
    Public: "Public",
  };
  return labels[value] ?? value;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
