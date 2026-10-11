"use client";

import React from "react";
import { GitCommit, Sparkles, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { WhatChangedDecomposition } from "@/lib/types";

interface WhatChangedPanelProps {
  decomposition: WhatChangedDecomposition;
}

export function WhatChangedPanel({ decomposition }: WhatChangedPanelProps) {
  if (!decomposition) return null;

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-sm text-white tracking-tight">{decomposition.title}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            DETERMINISTIC ATTRIBUTION
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{decomposition.total_change_str}</span>
      </div>

      {/* Headline & Summary */}
      <div className="mb-4 p-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-300 leading-relaxed">
        <p className="font-semibold text-white mb-1">{decomposition.headline}</p>
        <p className="text-slate-400">{decomposition.summary}</p>
      </div>

      {/* Driver Breakdown List */}
      {decomposition.drivers && decomposition.drivers.length > 0 ? (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Top Driving Entities
          </div>
          {decomposition.drivers.map((driver, idx) => {
            const isIncrease = driver.direction === "increased";
            return (
              <div
                key={idx}
                className="p-3 rounded-md bg-slate-900/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded ${
                      isIncrease ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {isIncrease ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="font-semibold text-white text-xs">{driver.entity}</span>
                    <span className="text-[11px] text-slate-500 ml-2 font-mono">({driver.dimension})</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{driver.summary}</p>
                  </div>
                </div>

                <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                  <span
                    className={`font-mono font-bold text-xs ${
                      isIncrease ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {isIncrease ? "+" : ""}
                    {driver.delta}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {driver.contribution_pct}% contribution
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-slate-500 text-center py-2 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          <span>No material drivers exceeded significance thresholds for this period.</span>
        </div>
      )}
    </div>
  );
}
