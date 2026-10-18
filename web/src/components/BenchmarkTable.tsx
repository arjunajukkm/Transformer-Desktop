"use client";

import React, { useState } from "react";
import { Table, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Layers, Building2, FolderTree } from "lucide-react";
import { BenchmarkTableRow } from "@/lib/types";

interface BenchmarkTableProps {
  rows?: BenchmarkTableRow[];
  buRows?: BenchmarkTableRow[];
  deptRows?: BenchmarkTableRow[];
  total: BenchmarkTableRow | null;
  metricLabel: string;
  dimensionLabel?: string;
  theme?: "dark" | "light";
  collapsible?: boolean;
}

export function BenchmarkTable({
  rows: initialRows,
  buRows,
  deptRows,
  total,
  metricLabel,
  dimensionLabel = "Business Unit",
  theme = "dark",
  collapsible = true,
}: BenchmarkTableProps) {
  const [activeDimension, setActiveDimension] = useState<"bu" | "dept">(
    dimensionLabel.toLowerCase().includes("dept") ? "dept" : "bu"
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Determine effective rows based on active dimension tab
  const activeRows =
    activeDimension === "dept" && deptRows && deptRows.length > 0
      ? deptRows
      : buRows && buRows.length > 0
      ? buRows
      : initialRows || [];

  const effectiveDimensionLabel = activeDimension === "dept" ? "Department" : "Business Unit";

  if (!activeRows || activeRows.length === 0) return null;

  return (
    <div
      className={`rounded-xl border transition-all shadow-md overflow-hidden ${
        theme === "dark"
          ? "bg-[#0c1324]/90 border-slate-800 text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-sm"
      }`}
    >
      {/* ── Integrated Header Toolbar ── */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-3.5 border-b ${
          theme === "dark" ? "border-slate-800/80 bg-slate-950/40" : "border-slate-200/80 bg-slate-50/50"
        }`}
      >
        {/* Left: Title & Metric */}
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              theme === "dark" ? "bg-cyan-500/15 text-cyan-400" : "bg-cyan-50 text-cyan-700"
            }`}
          >
            <Table className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3
              className={`font-bold text-xs uppercase tracking-wider font-mono truncate ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}
            >
              Multi-Dimension Benchmark Matrix — {metricLabel}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Comparative cohort gap evaluation vs organisation baseline
            </p>
          </div>
        </div>

        {/* Center/Right: Dimension Switcher Tabs & Collapse Button */}
        <div className="flex items-center gap-2.5">
          {buRows && deptRows && deptRows.length > 0 && (
            <div
              className={`flex rounded-lg p-0.5 border text-xs font-mono ${
                theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                onClick={() => setActiveDimension("bu")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeDimension === "bu"
                    ? theme === "dark"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                      : "bg-white text-cyan-800 border border-cyan-300 font-bold shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Building2 className="h-3 w-3" />
                <span>Business Units ({buRows.length})</span>
              </button>
              <button
                onClick={() => setActiveDimension("dept")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeDimension === "dept"
                    ? theme === "dark"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                      : "bg-white text-cyan-800 border border-cyan-300 font-bold shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FolderTree className="h-3 w-3" />
                <span>Departments ({deptRows.length})</span>
              </button>
            </div>
          )}

          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title={isCollapsed ? "Expand Benchmark Matrix" : "Collapse Benchmark Matrix"}
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              <span className="text-[11px] hidden sm:inline">{isCollapsed ? "Expand" : "Collapse"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Table Viewport with Controlled Scroll Height ── */}
      {!isCollapsed && (
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 z-10">
              <tr
                className={`border-b font-mono text-[10px] uppercase tracking-wider ${
                  theme === "dark"
                    ? "border-slate-800 text-slate-400 bg-slate-950"
                    : "border-slate-200 text-slate-600 bg-slate-100"
                }`}
              >
                <th className="py-2.5 px-3.5 font-semibold">{effectiveDimensionLabel}</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Current</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">3M Average</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Org Baseline</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Historical</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Gap</th>
                <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">Trend Trajectory</th>
                <th className="py-2.5 px-3.5 font-semibold text-right whitespace-nowrap">Volume</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y font-mono ${
                theme === "dark" ? "divide-slate-800/60" : "divide-slate-200/70"
              }`}
            >
              {activeRows.map((row) => {
                const isPositiveGap = row.gap_val !== null && row.gap_val !== undefined && row.gap_val > 0;
                return (
                  <tr
                    key={row.business_unit}
                    className={`transition-colors ${
                      theme === "dark" ? "hover:bg-cyan-500/5 text-slate-200" : "hover:bg-cyan-50/50 text-slate-800"
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-sans font-medium whitespace-nowrap">
                      {row.business_unit}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {row.current}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        theme === "dark" ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {row.three_month_avg}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        theme === "dark" ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {row.org_baseline || row.org_benchmark}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        theme === "dark" ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {row.historical}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          (row.gap_formatted || row.gap) === "—"
                            ? "text-slate-400"
                            : isPositiveGap
                            ? theme === "dark"
                              ? "text-rose-400 bg-rose-500/10"
                              : "text-rose-700 bg-rose-50"
                            : theme === "dark"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : "text-emerald-700 bg-emerald-50"
                        }`}
                      >
                        {row.gap_formatted || row.gap}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {(() => {
                        const traj = row.trajectory || row.trend;
                        const isImp = traj?.toLowerCase().includes("improv");
                        const isDet = traj?.toLowerCase().includes("deter") || traj?.toLowerCase().includes("regress");
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                              isImp
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : isDet
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : theme === "dark"
                                ? "bg-slate-800/40 text-slate-400 border border-slate-700/40"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {isImp && <TrendingDown className="h-3 w-3 text-emerald-400" />}
                            {isDet && <TrendingUp className="h-3 w-3 text-rose-400" />}
                            {!isImp && !isDet && <Minus className="h-3 w-3 text-slate-400" />}
                            <span>{traj}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <span
                        className={`text-[11px] ${
                          theme === "dark" ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        {row.volume}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* ── Organisation Total Row ── */}
              {total && (
                <tr
                  className={`border-t-2 font-bold ${
                    theme === "dark"
                      ? "bg-cyan-950/20 border-cyan-500/40 text-cyan-300"
                      : "bg-cyan-50/70 border-cyan-400 text-cyan-900"
                  }`}
                >
                  <td className="py-3 px-3.5 font-sans whitespace-nowrap">
                    Total (Organisation-Wide)
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap font-mono">{total.current}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap font-mono">{total.three_month_avg}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap font-mono">{total.org_baseline || total.org_benchmark}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap font-mono">{total.historical}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap font-mono">{total.gap_formatted || total.gap}</td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {(() => {
                      const totalTraj = total.trajectory || total.trend;
                      const isImp = totalTraj?.toLowerCase().includes("improv");
                      const isDet = totalTraj?.toLowerCase().includes("deter") || totalTraj?.toLowerCase().includes("regress");
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                            isImp
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : isDet
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-slate-800/60 text-slate-300 border border-slate-700/60"
                          }`}
                        >
                          {isImp && <TrendingDown className="h-3 w-3 text-emerald-400" />}
                          {isDet && <TrendingUp className="h-3 w-3 text-rose-400" />}
                          {!isImp && !isDet && <Minus className="h-3 w-3 text-slate-400" />}
                          <span>{totalTraj}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono">{total.volume}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
