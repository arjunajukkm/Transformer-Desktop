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
      className={`rounded-xl border p-4 transition-all shadow-md h-full flex flex-col justify-between ${
        theme === "dark"
          ? "bg-[#0b1222]/95 border-cyan-500/25 text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-sm"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-inherit">
          <div className="flex items-center gap-1.5 min-w-0">
            <Grid className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <h3 className="font-bold text-xs tracking-tight uppercase font-mono whitespace-nowrap truncate">
              BU Matrix — {metricLabel}
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0">Delta vs Org</span>
        </div>

        <div className="overflow-x-auto pb-1">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-inherit text-slate-400 font-mono text-[10px]">
                <th className="py-2 px-2 font-semibold whitespace-nowrap">BU</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Current</th>
                <th className="py-2 px-2 font-semibold text-center whitespace-nowrap">Trend</th>
                {months.slice(-3).map((m, mIdx, arr) => (
                  <th
                    key={m}
                    className={`py-2 ${mIdx === arr.length - 1 ? "pl-2 pr-3.5" : "px-2"} font-semibold text-center whitespace-nowrap`}
                  >
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
                  <td className="py-2 px-2 font-sans font-medium text-xs truncate max-w-[150px] sm:max-w-[170px] whitespace-nowrap" title={row.business_unit}>
                    {row.business_unit}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-xs whitespace-nowrap">
                    {row.current_formatted}
                  </td>
                  <td className="py-2 px-2 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium whitespace-nowrap ${
                        row.trend_direction === "IMPROVING"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : row.trend_direction === "WORSENING" || row.trend_direction === "REGRESSING"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-800/40 text-slate-400"
                      }`}
                    >
                      {row.trend_direction === "IMPROVING" && <TrendingDown className="h-3 w-3 text-emerald-400 shrink-0" />}
                      {row.trend_direction === "WORSENING" && <TrendingUp className="h-3 w-3 text-rose-400 shrink-0" />}
                      {row.trend_direction === "STABLE" && <Minus className="h-3 w-3 text-slate-400 shrink-0" />}
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
                      <td
                        key={mv.period}
                        className={`py-2 ${i === 2 ? "pl-2 pr-3.5" : "px-2"} text-center whitespace-nowrap`}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span
                            className={`font-semibold text-[11px] whitespace-nowrap ${
                              hasVal
                                ? theme === "dark"
                                  ? "text-slate-100"
                                  : "text-slate-800"
                                : "text-slate-400"
                            }`}
                          >
                            {mv.formatted_value}
                          </span>
                          {delta?.formatted_delta && delta.formatted_delta !== "—" && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-sans font-semibold border whitespace-nowrap ${
                                isNegativeDelta
                                  ? theme === "dark"
                                    ? "text-emerald-300 bg-emerald-950/50 border-emerald-500/30"
                                    : "text-emerald-700 bg-emerald-100/90 border-emerald-300"
                                  : isPositiveDelta
                                  ? theme === "dark"
                                    ? "text-rose-300 bg-rose-950/50 border-rose-500/30"
                                    : "text-rose-700 bg-rose-100/90 border-rose-300"
                                  : theme === "dark"
                                  ? "text-slate-400 bg-slate-900 border-slate-800"
                                  : "text-slate-600 bg-slate-100 border-slate-200"
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

      {/* ── Status Footer ── */}
      <div className={`mt-3 pt-2.5 border-t border-inherit flex items-center justify-between text-[10px] font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          Spatial Distribution Matrix
        </span>
        <span>{rows.length} Business Units</span>
      </div>
    </div>
  );
}
