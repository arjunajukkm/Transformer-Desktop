"use client";

import React from "react";
import { Grid, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { HeatmapRow } from "@/lib/types";

interface BusinessUnitHeatmapProps {
  months: string[];
  rows: HeatmapRow[];
  metricLabel: string;
}

export function BusinessUnitHeatmap({ months, rows, metricLabel }: BusinessUnitHeatmapProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Grid className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-sm text-white tracking-tight">
            Business Unit Heatmap Matrix — {metricLabel}
          </h3>
        </div>
        <span className="text-xs text-slate-400">Monthly Performance & Delta vs Org Baseline</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3 font-semibold">Business Unit</th>
              <th className="py-2.5 px-3 font-semibold text-right">Current</th>
              <th className="py-2.5 px-3 font-semibold text-center">Trajectory</th>
              {months.map((m) => (
                <th key={m} className="py-2.5 px-3 font-semibold text-center">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {rows.map((row) => (
              <tr key={row.business_unit} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-3 font-sans font-medium text-slate-200">
                  {row.business_unit}
                </td>
                <td className="py-3 px-3 text-right font-bold text-white">
                  {row.current_formatted}
                </td>
                <td className="py-3 px-3 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                      row.trend_direction === "IMPROVING"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : row.trend_direction === "WORSENING" || row.trend_direction === "REGRESSING"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {row.trend_direction}
                  </span>
                </td>

                {/* Monthly cells */}
                {row.monthly_values.map((mv, i) => {
                  const delta = row.monthly_deltas[i];
                  const hasVal = mv.value !== null;
                  const isPositiveDelta = delta?.delta !== null && delta?.delta !== undefined && delta.delta > 0;
                  const isNegativeDelta = delta?.delta !== null && delta?.delta !== undefined && delta.delta < 0;

                  return (
                    <td key={mv.period} className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className={`font-semibold ${hasVal ? "text-slate-200" : "text-slate-600"}`}>
                          {mv.formatted_value}
                        </span>
                        {delta?.formatted_delta && delta.formatted_delta !== "—" && (
                          <span
                            className={`text-[10px] px-1 py-0.2 rounded font-sans ${
                              isNegativeDelta
                                ? "text-emerald-400 bg-emerald-950/40"
                                : isPositiveDelta
                                ? "text-rose-400 bg-rose-950/40"
                                : "text-slate-400"
                            }`}
                          >
                            {delta.formatted_delta}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
