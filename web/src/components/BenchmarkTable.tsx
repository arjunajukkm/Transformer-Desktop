"use client";

import React from "react";
import { Table, ShieldCheck, AlertCircle } from "lucide-react";
import { BenchmarkTableRow } from "@/lib/types";

interface BenchmarkTableProps {
  rows: BenchmarkTableRow[];
  total: BenchmarkTableRow | null;
  metricLabel: string;
}

export function BenchmarkTable({ rows, total, metricLabel }: BenchmarkTableProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-sm text-white tracking-tight">
            Multi-Dimension BU Benchmark Matrix — {metricLabel}
          </h3>
        </div>
        <span className="text-xs text-slate-400">Standardized Cross-Unit Performance Distribution</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3 font-semibold">Business Unit</th>
              <th className="py-2.5 px-3 font-semibold text-right">Current</th>
              <th className="py-2.5 px-3 font-semibold text-right">3M Average</th>
              <th className="py-2.5 px-3 font-semibold text-right">Org Baseline</th>
              <th className="py-2.5 px-3 font-semibold text-right">Historical</th>
              <th className="py-2.5 px-3 font-semibold text-right">Gap</th>
              <th className="py-2.5 px-3 font-semibold text-center">Trend Trajectory</th>
              <th className="py-2.5 px-3 font-semibold text-right">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {rows.map((row) => (
              <tr key={row.business_unit} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-3 font-sans font-medium text-slate-200">{row.business_unit}</td>
                <td className="py-3 px-3 text-right font-bold text-white">{row.current}</td>
                <td className="py-3 px-3 text-right text-slate-300">{row.three_month_avg}</td>
                <td className="py-3 px-3 text-right text-slate-400">{row.org_benchmark}</td>
                <td className="py-3 px-3 text-right text-slate-400">{row.historical}</td>
                <td
                  className={`py-3 px-3 text-right font-semibold ${
                    row.gap_val !== null && row.gap_val !== undefined && row.gap_val > 0
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                >
                  {row.gap}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-slate-800 text-slate-300 border border-white/5">
                    {row.trend}
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-slate-400">{row.volume}</td>
              </tr>
            ))}

            {/* Total Row */}
            {total && (
              <tr className="bg-slate-900/90 font-bold border-t-2 border-white/10 text-white">
                <td className="py-3 px-3 font-sans text-cyan-300">{total.business_unit}</td>
                <td className="py-3 px-3 text-right text-cyan-300">{total.current}</td>
                <td className="py-3 px-3 text-right">{total.three_month_avg}</td>
                <td className="py-3 px-3 text-right text-slate-400">{total.org_benchmark}</td>
                <td className="py-3 px-3 text-right text-slate-400">{total.historical}</td>
                <td className="py-3 px-3 text-right text-slate-300">{total.gap}</td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-cyan-950/60 text-cyan-400 border border-cyan-500/20">
                    {total.trend}
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-slate-400">{total.volume}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
