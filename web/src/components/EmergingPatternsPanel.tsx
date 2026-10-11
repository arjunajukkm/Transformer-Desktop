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
        className={`rounded-xl border p-4 transition-all shadow-sm ${
          theme === "dark" ? "bg-[#0b1019]/90 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-inherit">
          <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="font-bold text-xs uppercase tracking-tight font-mono">Emerging Risk Patterns</h3>
        </div>
        <div className="text-xs text-slate-500 text-center py-3 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>No anomalous exception clusters detected. All parameters nominal.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-sm ${
        theme === "dark" ? "bg-[#0b1019]/90 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-inherit">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          <h3 className="font-bold text-xs uppercase tracking-tight font-mono">Emerging Patterns &amp; Sentinel</h3>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold">
            {patterns.length} DETECTED
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Autonomous Sentinel</span>
      </div>

      <div className="space-y-2">
        {patterns.slice(0, 3).map((pat) => {
          const isCritical = pat.badge === "CRITICAL";
          const isAttention = pat.badge === "ATTENTION";

          const badgeColor = isCritical
            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
            : isAttention
            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

          return (
            <div
              key={pat.id}
              className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 transition-colors ${
                theme === "dark" ? "bg-slate-900/30 border-slate-800/80" : "bg-slate-50 border-slate-200/80"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="font-semibold text-xs truncate">
                    {pat.pattern_title || pat.name}
                  </span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase border ${badgeColor}`}>
                  {pat.badge}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight">{pat.explanation}</p>
              
              <div className="mt-1 pt-1.5 border-t border-inherit flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Scope: <strong className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>{pat.scope}</strong></span>
                <span>Volume: <strong className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>{pat.volume}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
