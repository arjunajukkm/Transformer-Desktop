"use client";

import React from "react";
import { Grid, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { HeatmapRow } from "@/lib/types";

interface BusinessUnitHeatmapProps {
  months: string[];
  rows: HeatmapRow[];
  metricLabel: string;
  theme?: "dark" | "light";
}

export function BusinessUnitHeatmap({ months, rows, metricLabel, theme = "dark" }: BusinessUnitHeatmapProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-sm flex flex-col justify-between ${
        theme === "dark" ? "bg-[#0b1019]/90 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-inherit">
        <div className="flex items-center gap-1.5">
          <Grid className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="font-bold text-xs tracking-tight uppercase font-mono">
            BU Matrix — {metricLabel}
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Delta vs Org</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-inherit text-slate-400 font-mono text-[10px]">
              <th className="py-1.5 px-2 font-semibold">BU</th>
              <th className="py-1.5 px-2 font-semibold text-right">Current</th>
              <th className="py-1.5 px-2 font-semibold text-center">Trend</th>
              {months.slice(-3).map((m) => (
                <th key={m} className="py-1.5 px-2 font-semibold text-center">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-inherit font-mono">
            {rows.map((row) => (
              <tr
                key={row.business_unit}
                className={`transition-colors ${
                  theme === "dark" ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                }`}
              >
                <td className="py-2 px-2 font-sans font-medium text-xs truncate max-w-[110px]">
                  {row.business_unit}
                </td>
                <td className="py-2 px-2 text-right font-bold text-xs">
                  {row.current_formatted}
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                      row.trend_direction === "IMPROVING"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : row.trend_direction === "WORSENING" || row.trend_direction === "REGRESSING"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    {row.trend_direction === "IMPROVING" && <TrendingDown className="h-3 w-3 text-emerald-400" />}
                    {row.trend_direction === "WORSENING" && <TrendingUp className="h-3 w-3 text-rose-400" />}
                    {row.trend_direction === "STABLE" && <Minus className="h-3 w-3 text-slate-400" />}
                    <span>{row.trend_direction}</span>
                  </span>
                </td>

                {/* Monthly cells */}
                {row.monthly_values.slice(-3).map((mv, i) => {
                  const deltaIndex = row.monthly_values.length - 3 + i;
                  const delta = row.monthly_deltas[deltaIndex >= 0 ? deltaIndex : i];
                  const hasVal = mv.value !== null;
                  const isPositiveDelta = delta?.delta !== null && delta?.delta !== undefined && delta.delta > 0;
                  const isNegativeDelta = delta?.delta !== null && delta?.delta !== undefined && delta.delta < 0;

                  return (
                    <td key={mv.period} className="py-2 px-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className={`font-semibold text-[11px] ${hasVal ? (theme === "dark" ? "text-slate-200" : "text-slate-700") : "text-slate-500"}`}>
                          {mv.formatted_value}
                        </span>
                        {delta?.formatted_delta && delta.formatted_delta !== "—" && (
                          <span
                            className={`text-[9px] px-1 py-0.1 rounded font-sans ${
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
