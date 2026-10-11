"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Zap, ShieldCheck, ArrowUpRight, TrendingUp, Calendar, Users, Clock } from "lucide-react";
import { ExecutiveOverviewBundle, ExecutiveKPICardData } from "../lib/types";

interface ExecutiveOverviewProps {
  bundle: ExecutiveOverviewBundle | null;
  isLoading: boolean;
  theme: "dark" | "light";
}

export function ExecutiveOverview({ bundle, isLoading, theme }: ExecutiveOverviewProps) {
  const [hoveredDateIdx, setHoveredDateIdx] = useState<number | null>(null);

  if (isLoading || !bundle) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className={`h-12 rounded-xl border ${theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"}`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className={`h-24 rounded-xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-100 border-slate-200"}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`h-64 rounded-xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-100 border-slate-200"}`} />
          <div className={`h-64 rounded-xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-100 border-slate-200"}`} />
        </div>
      </div>
    );
  }

  const { kpi_cards, reconciliation, attendance_composition, attendance_composition_denominator, daily_attendance_trend, bu_attendance_comparison, bu_comparison_total } = bundle;

  // Mini Sparkline SVG Renderer
  const renderSparkline = (data?: number[] | null, color: string = "#06b6d4") => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max > min ? max - min : 1;
    const width = 80;
    const height = 18;
    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible inline-block">
        <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        {data.length > 0 && (
          <circle
            cx={(width).toFixed(1)}
            cy={(height - ((data[data.length - 1] - min) / range) * (height - 4) - 2).toFixed(1)}
            r="2"
            fill={color}
          />
        )}
      </svg>
    );
  };

  // SVG Daily Trend Chart dimensions
  const trendPoints = daily_attendance_trend || [];
  const chartW = 560;
  const chartH = 120;
  const maxDayVal = Math.max(...trendPoints.map((d) => Math.max(d.present_days, d.wfh_days, d.leave_days)), 1);

  const getSvgY = (val: number) => {
    return chartH - (val / (maxDayVal || 1)) * (chartH - 20) - 10;
  };

  const getSvgX = (idx: number) => {
    if (trendPoints.length <= 1) return 0;
    return (idx / (trendPoints.length - 1)) * (chartW - 20) + 10;
  };

  const presentSvgPath = trendPoints.map((d, i) => `${i === 0 ? "M" : "L"} ${getSvgX(i)} ${getSvgY(d.present_days)}`).join(" ");
  const wfhSvgPath = trendPoints.map((d, i) => `${i === 0 ? "M" : "L"} ${getSvgX(i)} ${getSvgY(d.wfh_days)}`).join(" ");
  const leaveSvgPath = trendPoints.map((d, i) => `${i === 0 ? "M" : "L"} ${getSvgX(i)} ${getSvgY(d.leave_days)}`).join(" ");

  const hoveredItem = hoveredDateIdx !== null && trendPoints[hoveredDateIdx] ? trendPoints[hoveredDateIdx] : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── 1. Reconciliation & Data Quality Transparency Strip ── */}
      <div
        className={`px-4 py-3 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
          theme === "dark"
            ? "bg-slate-900/60 border-slate-800/80 backdrop-blur-md"
            : "bg-white border-slate-200/90 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              reconciliation.is_reconciled
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
            }`}
          >
            {reconciliation.is_reconciled ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${reconciliation.is_reconciled ? "text-emerald-400" : "text-amber-400"}`}>
                {reconciliation.summary}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                Denominator: {attendance_composition_denominator.toLocaleString()} days
              </span>
            </div>
            <p className={`text-[11px] leading-tight ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {reconciliation.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-mono px-2 py-1 rounded-md border flex items-center gap-1 ${
              theme === "dark" ? "bg-slate-950/80 border-slate-800 text-cyan-400" : "bg-slate-50 border-slate-200 text-cyan-700"
            }`}
          >
            <Zap className="w-3 h-3 text-cyan-400" />
            <span>{bundle.execution_time_ms}ms OLAP</span>
          </span>
          <span
            className={`text-[10px] font-mono px-2 py-1 rounded-md border flex items-center gap-1 ${
              bundle.data_quality.status === "clean"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>DQ: {bundle.data_quality.status.toUpperCase()}</span>
          </span>
        </div>
      </div>

      {/* ── 2. The 15 Executive KPI Cards (Compact 5-Col Grid) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {kpi_cards.map((card: ExecutiveKPICardData) => {
          return (
            <div
              key={card.id}
              className={`p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                theme === "dark"
                  ? "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
                  : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {/* Card Header: Color indicator dot + Number + Title */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: card.color, boxShadow: `0 0 6px ${card.color}80` }}
                  />
                  <span className={`text-[10px] font-mono font-bold tracking-wider truncate uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    {card.number}. {card.title}
                  </span>
                </div>
                {card.sparkline && <div className="shrink-0">{renderSparkline(card.sparkline, card.color)}</div>}
              </div>

              {/* Primary Value */}
              <div className="my-0.5">
                <div className={`text-lg font-bold font-mono tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {card.primary}
                </div>
                <div className="text-[11px] font-semibold truncate" style={{ color: card.color }}>
                  {card.secondary}
                </div>
              </div>

              {/* Context Footnote */}
              <div className={`text-[10px] truncate pt-1 border-t ${theme === "dark" ? "border-slate-800/50 text-slate-500" : "border-slate-100 text-slate-400"}`}>
                {card.footnote}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. Dual Visualizations Side-by-Side: Attendance Composition & Daily Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: 100% Additive Attendance Composition Widget (7 cols) */}
        <div
          className={`lg:col-span-7 p-4 rounded-xl border flex flex-col justify-between ${
            theme === "dark" ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                  Attendance Composition
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Quantity-weighted day equivalents & % of composition denominator
                </p>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${theme === "dark" ? "bg-slate-800 text-cyan-400" : "bg-slate-100 text-cyan-700"}`}>
                Total: {attendance_composition_denominator.toLocaleString()} d
              </span>
            </div>

            {/* Stacked 100% Horizontal Segmented Bar */}
            <div className="h-4 w-full rounded-md overflow-hidden flex bg-slate-800/50 p-0.5 border border-slate-700/50 mb-3">
              {attendance_composition.map((item, idx) => {
                const pct = item.pct || 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={idx}
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                    title={`${item.label}: ${item.days} days (${pct.toFixed(1)}%)`}
                    className="h-full transition-all hover:opacity-80"
                  />
                );
              })}
            </div>
          </div>

          {/* 8-Category Pills Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {attendance_composition.map((item, idx) => {
              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border flex flex-col justify-between ${
                    theme === "dark" ? "bg-slate-950/50 border-slate-800/60" : "bg-slate-50 border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className={`text-[11px] font-bold truncate ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[10px] font-mono">
                    <span className={theme === "dark" ? "text-white font-semibold" : "text-slate-900 font-semibold"}>
                      {item.days}d
                    </span>
                    <span className="font-bold" style={{ color: item.color }}>
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Daily Attendance Trend Line Chart (5 cols) */}
        <div
          className={`lg:col-span-5 p-4 rounded-xl border flex flex-col justify-between ${
            theme === "dark" ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                  Daily Attendance Trend
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Present, WFH, & Leave days across calendar dates
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Present
                </span>
                <span className="flex items-center gap-1 text-indigo-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" /> WFH
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> Leave
                </span>
              </div>
            </div>

            {/* Hover details badge */}
            <div className="h-5 flex items-center text-[10px] font-mono">
              {hoveredItem ? (
                <span className="text-cyan-400">
                  {hoveredItem.date_str}: <strong className="text-emerald-400">{hoveredItem.present_days}P</strong> •{" "}
                  <strong className="text-indigo-400">{hoveredItem.wfh_days}WFH</strong> •{" "}
                  <strong className="text-purple-400">{hoveredItem.leave_days}L</strong> (Total: {hoveredItem.recorded_days}d)
                </span>
              ) : (
                <span className={theme === "dark" ? "text-slate-500" : "text-slate-400"}>Hover over points to inspect dates</span>
              )}
            </div>

            {/* SVG Plot */}
            <div className="relative w-full h-[120px] mt-1">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredDateIdx(null)}
              >
                {/* Horizontal Guide Lines */}
                <line x1="10" y1={getSvgY(maxDayVal)} x2={chartW - 10} y2={getSvgY(maxDayVal)} stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="3 3" />
                <line x1="10" y1={getSvgY(maxDayVal / 2)} x2={chartW - 10} y2={getSvgY(maxDayVal / 2)} stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="3 3" />
                <line x1="10" y1={chartH - 10} x2={chartW - 10} y2={chartH - 10} stroke={theme === "dark" ? "#334155" : "#cbd5e1"} strokeWidth="1" />

                {/* Series Lines */}
                <path d={leaveSvgPath} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" />
                <path d={wfhSvgPath} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
                <path d={presentSvgPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

                {/* Interactive points */}
                {trendPoints.map((d, idx) => {
                  const x = getSvgX(idx);
                  const isHovered = hoveredDateIdx === idx;
                  return (
                    <g key={idx} onMouseEnter={() => setHoveredDateIdx(idx)} className="cursor-pointer">
                      <rect x={x - 4} y="0" width="8" height={chartH} fill="transparent" />
                      {isHovered && (
                        <>
                          <line x1={x} y1="0" x2={x} y2={chartH} stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
                          <circle cx={x} cy={getSvgY(d.present_days)} r="3" fill="#10b981" />
                          <circle cx={x} cy={getSvgY(d.wfh_days)} r="3" fill="#6366f1" />
                          <circle cx={x} cy={getSvgY(d.leave_days)} r="3" fill="#8b5cf6" />
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1">
            <span>{trendPoints[0]?.date_str || "Start"}</span>
            <span>{trendPoints[Math.floor(trendPoints.length / 2)]?.date_str || "Mid"}</span>
            <span>{trendPoints[trendPoints.length - 1]?.date_str || "End"}</span>
          </div>
        </div>
      </div>

      {/* ── 4. Business Unit Attendance Distribution Breakdown Table ── */}
      <div
        className={`p-4 rounded-xl border overflow-hidden ${
          theme === "dark" ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200/90 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className={`text-xs font-bold tracking-wide uppercase ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
              Business Unit Attendance Distribution Matrix
            </h3>
            <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Comparative breakdown of headcount, attendance categories, exceptions, and compliance rates
            </p>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
            {bu_attendance_comparison.length} Business Units
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className={`border-b text-[10px] font-mono uppercase tracking-wider ${theme === "dark" ? "border-slate-800 text-slate-400 bg-slate-950/40" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                <th className="py-2.5 px-3 font-semibold">Business Unit</th>
                <th className="py-2.5 px-2 text-right font-semibold">Headcount</th>
                <th className="py-2.5 px-2 text-right font-semibold">Rec Days</th>
                <th className="py-2.5 px-2 text-right font-semibold text-emerald-400">Present (d / %)</th>
                <th className="py-2.5 px-2 text-right font-semibold text-indigo-400">WFH (d / %)</th>
                <th className="py-2.5 px-2 text-right font-semibold text-purple-400">Leave (d / %)</th>
                <th className="py-2.5 px-2 text-right font-semibold text-red-400">Absent (d / %)</th>
                <th className="py-2.5 px-2 text-right font-semibold text-rose-400">Exceptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {bu_attendance_comparison.map((bu, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors text-[11px] ${
                    theme === "dark" ? "hover:bg-slate-800/30 text-slate-300" : "hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span>{bu.business_unit}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">{bu.observed_headcount}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-400">{bu.recorded_employee_days.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-emerald-400">
                    {bu.present_days}d ({bu.present_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-indigo-400">
                    {bu.wfh_days}d ({bu.wfh_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-purple-400">
                    {bu.leave_days}d ({bu.leave_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-red-400">
                    {bu.absent_days}d ({bu.absent_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-rose-400 font-semibold">
                    {bu.exception_days} ({bu.exception_rate_pct.toFixed(1)}%)
                  </td>
                </tr>
              ))}

              {/* Organization-Wide Total Row */}
              {bu_comparison_total && (
                <tr
                  className={`border-t font-semibold text-[11px] ${
                    theme === "dark"
                      ? "bg-slate-950/70 border-slate-700 text-white"
                      : "bg-slate-100 border-slate-300 text-slate-900"
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-cyan-400">Total (Org-Wide)</td>
                  <td className="py-2.5 px-2 text-right font-mono">{bu_comparison_total.observed_headcount}</td>
                  <td className="py-2.5 px-2 text-right font-mono">{bu_comparison_total.recorded_employee_days?.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-emerald-400">
                    {bu_comparison_total.present_days}d ({bu_comparison_total.present_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-indigo-400">
                    {bu_comparison_total.wfh_days}d ({bu_comparison_total.wfh_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-purple-400">
                    {bu_comparison_total.leave_days}d ({bu_comparison_total.leave_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-red-400">
                    {bu_comparison_total.absent_days}d ({bu_comparison_total.absent_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-rose-400 font-bold">
                    {bu_comparison_total.exception_days} ({bu_comparison_total.exception_rate_pct?.toFixed(1)}%)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
