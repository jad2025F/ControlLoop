"use client";

import { useState } from "react";
import {
  buildBaselineDemoState,
  runPrimaryDriftDemo,
  runPrimarySimulationDemo,
  type DemoPresentationState,
} from "../../demo/demo-controller";
import type { GraphNodeDTO } from "../../engine/types";
import { ActionCenter } from "./action-center";
import { ChangeImpactPanel } from "./change-impact-panel";
import { DriftTrigger } from "./drift-trigger";
import { GraphViewToggle, type GraphViewMode } from "./graph-view-toggle";
import { HealthHero } from "./health-hero";
import { NodeInspector } from "./node-inspector";
import { SecurityGraph } from "./security-graph";
import { SecurityTimeMachine } from "./security-time-machine";
import { WhatIfSimulator } from "./what-if-simulator";

export function ControlLoopDemo() {
  const [demo, setDemo] = useState<DemoPresentationState>(() => buildBaselineDemoState());
  const [selectedNode, setSelectedNode] = useState<GraphNodeDTO | null>(null);
  const [graphView, setGraphView] = useState<GraphViewMode>("current");
  const degraded = demo.mode === "degraded";
  const simulated = demo.simulation !== null;
  const displayedGraph = simulated && graphView === "projected" ? demo.simulation!.projectedGraph : demo.graph;
  const recommendedAction = demo.actionCenter.actions[0] ?? null;

  function triggerDrift() {
    if (degraded) return;
    setDemo(runPrimaryDriftDemo());
    setSelectedNode(null);
    setGraphView("current");
  }

  function simulateFix() {
    if (!degraded || simulated) return;
    const next = runPrimarySimulationDemo(demo);
    setDemo(next);
    setSelectedNode(null);
    setGraphView("projected");
  }

  function resetDemo() {
    setDemo(buildBaselineDemoState());
    setSelectedNode(null);
    setGraphView("current");
  }

  function changeGraphView(next: GraphViewMode) {
    setGraphView(next);
    setSelectedNode(null);
  }

  return (
    <main className="min-h-screen px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-2 z-50 mb-5 rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-[0_10px_35px_rgba(20,32,51,0.08)] backdrop-blur-xl sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black tracking-tight text-white">CL</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold tracking-[-0.02em] text-slate-900">ControlLoop</span>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">Live demo</span>
                </div>
                <p className="truncate text-xs text-slate-500">NovaStack · deterministic security change intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <nav aria-label="Demo sections" className="hidden items-center gap-1 rounded-xl bg-slate-50 p-1 lg:flex">
                <NavLink href="#overview" label="Overview" />
                <NavLink href="#time-machine" label="Time" />
                {degraded ? <NavLink href="#change-impact" label="Impact" /> : null}
                <NavLink href="#graph" label="Graph" />
                <NavLink href="#action-center" label="Action" />
                {degraded ? <NavLink href="#simulation" label="Simulation" /> : null}
              </nav>
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                <span className={`h-2.5 w-2.5 rounded-full ${degraded ? "bg-rose-500" : "bg-emerald-500"}`} aria-hidden="true" />
                <div className="text-right leading-tight">
                  <p className="text-xs font-semibold text-slate-800">{degraded ? "Drift detected" : "Healthy"}</p>
                  <p className="text-[10px] text-slate-400">Health {demo.overview.currentHealth}</p>
                </div>
              </div>
              {degraded ? (
                <button
                  type="button"
                  onClick={resetDemo}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-500/30"
                >
                  Reset Demo
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="space-y-5 lg:space-y-6">
          <div id="overview" className="scroll-mt-24">
            <HealthHero overview={demo.overview} changeImpact={demo.changeImpact} />
          </div>
          <DriftTrigger degraded={degraded} onTrigger={triggerDrift} onReset={resetDemo} />
          <SecurityTimeMachine timeline={demo.timeline} changeImpact={demo.changeImpact} />

          {demo.changeImpact ? <ChangeImpactPanel impact={demo.changeImpact} /> : null}

          <section id="graph" className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4 lg:mb-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Evidence / Attack Graph</p>
                  {simulated ? (
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.13em] ${graphView === "projected" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {graphView === "projected" ? "Hypothetical projection" : "Current production"}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-slate-900 sm:text-2xl">
                  {simulated && graphView === "projected" ? "Projected security state" : "Trace the security state"}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                  {simulated
                    ? "Switch between production and the cloned projection. The topology stays fixed; only engine-derived state changes."
                    : "Follow the real causal topology. Click any node to inspect its evaluated state."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {demo.simulation ? (
                  <GraphViewToggle
                    value={graphView}
                    currentHealth={demo.simulation.dto.health.current}
                    projectedHealth={demo.simulation.dto.health.projected}
                    onChange={changeGraphView}
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                  <Legend dot="bg-emerald-500" label="Protected" />
                  <Legend dot="bg-rose-500" label="Exposed / affected" />
                  <Legend dot="bg-slate-400" label="Blocked / neutral" />
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
              <SecurityGraph graph={displayedGraph} onSelectNode={setSelectedNode} />
              <NodeInspector node={selectedNode} stateLabel={simulated && graphView === "projected" ? "Projected state" : "Current state"} />
            </div>
          </section>

          <ActionCenter actionCenter={demo.actionCenter} simulationReady={simulated} />

          {degraded && recommendedAction ? (
            <WhatIfSimulator actionTitle={recommendedAction.title} simulation={demo.simulation} onSimulate={simulateFix} />
          ) : null}
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 pb-3 text-[11px] text-slate-400">
          <span>Engine → DTOs → Demo Controller → React presentation</span>
          <span>Deterministic · no AI-generated security decisions</span>
        </footer>
      </div>
    </main>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:bg-white">
      {label}
    </a>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
