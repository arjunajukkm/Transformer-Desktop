"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { EmergingPattern } from "@/lib/types";

interface EmergingPatternsPanelProps {
  patterns: EmergingPattern[];
  theme?: "dark" | "light";
}

export function EmergingPatternsPanel({ patterns, theme = "dark" }: EmergingPatternsPanelProps) {
  if (!patterns || patterns.length === 0) {
    return (
      <div
        className={`rounded-xl border p-4 transition-all shadow-md h-[525px] flex flex-col justify-between ${
          theme === "dark" ? "bg-[#0b1222]/95 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-inherit">
            <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
            <h3 className="font-bold text-xs uppercase tracking-tight font-mono whitespace-nowrap">Emerging Risk Patterns</h3>
          </div>
          <div className="text-xs text-slate-400 text-center py-8 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            <span className="font-medium">No anomalous exception clusters detected.</span>
            <span className="text-[11px] text-slate-500">All workforce telemetry parameters remain within nominal bounds.</span>
          </div>
        </div>
        <div className={`pt-2 border-t border-inherit flex items-center justify-between text-[10px] font-mono ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
          <span>Sentinel Autonomous Monitoring</span>
          <span className="text-emerald-400">Status: Nominal</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all shadow-md h-[525px] flex flex-col min-h-0 overflow-hidden ${
        theme === "dark"
          ? "bg-[#0b1222]/95 border-rose-500/25 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-sm"
      }`}
    >
      {/* ── Panel Header ── */}
      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-inherit shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <h3 className="font-bold text-xs uppercase tracking-tight font-mono whitespace-nowrap truncate">
            Emerging Risk Patterns
          </h3>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold whitespace-nowrap shrink-0">
            {patterns.length} DETECTED
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0">Autonomous Sentinel</span>
      </div>

      {/* ── Scrollable Pattern Card Stream (fills all remaining height, zero gap) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {patterns.map((pat) => {
          const isCritical = pat.badge === "CRITICAL";
          const isAttention = pat.badge === "ATTENTION";

          const badgeColor = isCritical
            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
            : isAttention
            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

          return (
            <div
              key={pat.id || `${pat.name}-${pat.scope}`}
              className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 transition-colors ${
                theme === "dark" ? "bg-slate-900/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-xs truncate">
                    {pat.pattern_title || pat.name}
                  </span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase border shrink-0 whitespace-nowrap ${badgeColor}`}>
                  {pat.badge}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">{pat.explanation}</p>
              
              <div className="mt-0.5 pt-1.5 border-t border-inherit/40 flex items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="truncate">
                    Scope: <strong className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>{pat.scope}</strong>
                  </span>
                  {pat.business_unit && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800/90 text-cyan-300 border border-slate-700/80 font-mono font-medium truncate max-w-[130px]">
                      {pat.business_unit}
                    </span>
                  )}
                  {pat.department && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 font-mono truncate max-w-[160px]">
                      {pat.department}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-medium whitespace-nowrap">
                  Volume: <strong className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>{pat.volume}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sentinel Intelligence Telemetry Footer ── */}
      <div className={`mt-2.5 pt-2 border-t border-inherit flex items-center justify-between text-[10px] font-mono shrink-0 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Sentinel Live Monitoring Active
        </span>
        <span className="text-slate-500">Autonomous Heuristics Engine</span>
      </div>
    </div>
  );
}
