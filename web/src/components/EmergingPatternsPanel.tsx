"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, Eye, Info, CheckCircle2 } from "lucide-react";
import { EmergingPattern } from "@/lib/types";

interface EmergingPatternsPanelProps {
  patterns: EmergingPattern[];
}

export function EmergingPatternsPanel({ patterns }: EmergingPatternsPanelProps) {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="glass-panel p-5 mb-6">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
          <ShieldAlert className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-sm text-white tracking-tight">Emerging Patterns & Dossiers</h3>
        </div>
        <div className="text-xs text-slate-500 text-center py-4 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>No anomalous exception clusters detected. All parameters within governance thresholds.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <h3 className="font-bold text-sm text-white tracking-tight">Emerging Exception Patterns & Risk Dossiers</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            {patterns.length} ACTIVE
          </span>
        </div>
        <span className="text-xs text-slate-400">Autonomous Governance Detection</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {patterns.slice(0, 6).map((pat) => {
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
              className="p-4 rounded-lg bg-slate-900/50 border border-white/5 hover:border-white/15 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-bold text-white text-xs leading-snug">
                    {pat.pattern_title || pat.name}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${badgeColor}`}>
                    {pat.badge}
                  </span>
                </div>

                {/* Explanation */}
                <p className="text-xs text-slate-300 mb-2 leading-relaxed">{pat.explanation}</p>
                <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-white/5 leading-relaxed font-mono">
                  {pat.why_detected}
                </p>
              </div>

              {/* Footer Meta */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Scope: <strong className="text-slate-300">{pat.scope}</strong></span>
                <span>Volume: <strong className="text-slate-300">{pat.volume}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
