"use client";

import React from "react";
import { Sparkles, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { WhatChangedDecomposition } from "@/lib/types";

interface WhatChangedPanelProps {
  decomposition: WhatChangedDecomposition;
  theme?: "dark" | "light";
}

export function WhatChangedPanel({ decomposition, theme = "dark" }: WhatChangedPanelProps) {
  if (!decomposition) return null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-sm ${
        theme === "dark" ? "bg-[#0b1019]/90 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-inherit">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="font-bold text-xs uppercase tracking-tight font-mono">{decomposition.title}</h3>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold">
            ATTRIBUTION
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-cyan-400">{decomposition.total_change_str}</span>
      </div>

      {/* Headline & Summary */}
      <div
        className={`mb-3 p-2.5 rounded-lg border text-xs leading-relaxed ${
          theme === "dark" ? "bg-slate-900/50 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
        }`}
      >
        <p className="font-semibold text-xs mb-0.5">{decomposition.headline}</p>
        <p className="text-[11px] text-slate-400">{decomposition.summary}</p>
      </div>

      {/* Driver Breakdown List */}
      {decomposition.drivers && decomposition.drivers.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
            Top Driving Entities
          </div>
          {decomposition.drivers.slice(0, 3).map((driver, idx) => {
            const isIncrease = driver.direction === "increased";
            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                  theme === "dark" ? "bg-slate-900/30 border-slate-800/80" : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1 rounded-md shrink-0 ${
                      isIncrease ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-xs">{driver.entity}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({driver.dimension})</span>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{driver.summary}</p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0 font-mono text-[11px]">
                  <span className={isIncrease ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
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
          <span>No material drivers exceeded significance thresholds.</span>
        </div>
      )}
    </div>
  );
}
