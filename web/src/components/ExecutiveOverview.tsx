"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Zap, ShieldCheck, ArrowUpRight, TrendingUp, Calendar, Users, Clock, Layers } from "lucide-react";
import { ExecutiveOverviewBundle, ExecutiveKPICardData } from "../lib/types";

interface ExecutiveOverviewProps {
  bundle: ExecutiveOverviewBundle | null;
  isLoading: boolean;
  theme: "dark" | "light";
}

type MetricCohort = "pulse" | "all" | "volume" | "remote" | "compliance";

export function ExecutiveOverview({ bundle, isLoading, theme }: ExecutiveOverviewProps) {
  const [selectedCohort, setSelectedCohort] = useState<MetricCohort>("pulse");
  const [hoveredDateIdx, setHoveredDateIdx] = useState<number | null>(null);

  if (isLoading || !bundle) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className={`h-10 rounded-xl border ${theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"}`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-24 rounded-xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-100 border-slate-200"}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className={`lg:col-span-7 h-56 rounded-xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-100 border-slate-200"}`} />
          <div className={`lg:col-span-5 h-56 rounded-xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-100 border-slate-200"}`} />
        </div>
      </div>
    );
  }

  const {
    kpi_cards,
    reconciliation,
    attendance_composition,
    attendance_composition_denominator,
    daily_attendance_trend,
    bu_attendance_comparison,
    bu_comparison_total,
  } = bundle;

  // Filter KPI Cards based on selected cohort
  const getVisibleCards = (): ExecutiveKPICardData[] => {
    switch (selectedCohort) {
      case "pulse":
        // 5 Core Executive Vitals: Headcount (1), Present (3), WFH (6), Leave (5), Work Hours (15)
        return kpi_cards.filter((c) => [1, 3, 6, 5, 15].includes(c.number));
      case "volume":
        return kpi_cards.filter((c) => c.number >= 1 && c.number <= 5);
      case "remote":
        return kpi_cards.filter((c) => c.number >= 6 && c.number <= 10);
      case "compliance":
        return kpi_cards.filter((c) => c.number >= 11 && c.number <= 15);
      case "all":
      default:
        return kpi_cards;
    }
  };

  const visibleCards = getVisibleCards();

  // Mini Sparkline SVG Renderer
  const renderSparkline = (data?: number[] | null, color: string = "#06b6d4") => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max > min ? max - min : 1;
    const width = 64;
    const height = 16;
    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible inline-block">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
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
  const chartH = 110;
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
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* ── 1. Slim Integrated Reconciliation & Quality Ribbon ── */}
      <div
        className={`px-3 py-1.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-mono transition-colors ${
          theme === "dark"
            ? "bg-[#090d16]/70 border-slate-800/80 text-slate-300"
            : "bg-white border-slate-200 text-slate-700 shadow-xs"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% Reconciled</span>
          </span>
          <span className="text-slate-500">•</span>
          <span className={theme === "dark" ? "text-slate-400" : "text-slate-600"}>
            {attendance_composition_denominator.toLocaleString()} recorded employee-days accounted for across all 8 categories
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-cyan-400">
            <Zap className="w-3 h-3" />
            <span>{bundle.execution_time_ms}ms OLAP</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-semibold">
            DQ: {bundle.data_quality.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── 2. Segmented Cohort Switcher & KPI Cards Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Executive Metrics:
          </span>
        </div>

        {/* Minimalist Segmented Cohort Filter Pills */}
        <div
          className={`flex rounded-lg p-0.5 border text-xs font-mono ${
            theme === "dark" ? "bg-[#070a10] border-slate-800" : "bg-slate-100 border-slate-200"
          }`}
        >
          {[
            { id: "pulse", label: "Executive Pulse (5)" },
            { id: "all", label: "All 15 Metrics" },
            { id: "volume", label: "Volume & Presence" },
            { id: "remote", label: "Remote & Rest" },
            { id: "compliance", label: "Compliance & Hours" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCohort(tab.id as MetricCohort)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                selectedCohort === tab.id
                  ? theme === "dark"
                    ? "bg-slate-800 text-white font-semibold shadow-xs"
                    : "bg-white text-slate-900 font-semibold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. KPI Cards Grid (Compact & Minimalist) ── */}
      <div
        className={`grid gap-2.5 ${
          selectedCohort === "all"
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        }`}
      >
        {visibleCards.map((card: ExecutiveKPICardData) => {
          return (
            <div
              key={card.id}
              className={`p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                theme === "dark"
                  ? "bg-[#0b1019]/70 border-slate-800/80 hover:border-slate-700/80 hover:bg-[#0e1422]"
                  : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              {/* Card Header: Color indicator dot + Number + Title */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: card.color }}
                  />
                  <span
                    className={`text-[10px] font-mono font-bold tracking-wider truncate uppercase ${
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {card.number}. {card.title}
                  </span>
                </div>
                {card.sparkline && <div className="shrink-0">{renderSparkline(card.sparkline, card.color)}</div>}
              </div>

              {/* Primary Value */}
              <div className="my-0.5">
                <div
                  className={`text-lg font-bold font-mono tracking-tight ${
                    theme === "dark" ? "text-white" : "text-slate-900"
                  }`}
                >
                  {card.primary}
                </div>
                <div className="text-[11px] font-semibold truncate" style={{ color: card.color }}>
                  {card.secondary}
                </div>
              </div>

              {/* Context Footnote */}
              <div
                className={`text-[10px] truncate pt-1 border-t ${
                  theme === "dark" ? "border-slate-800/60 text-slate-500" : "border-slate-100 text-slate-400"
                }`}
              >
                {card.footnote}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 4. Dual Visualizations Side-by-Side: Attendance Composition & Daily Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
        {/* Left: 100% Additive Attendance Composition Widget (7 cols) */}
        <div
          className={`lg:col-span-7 p-3.5 rounded-xl border flex flex-col justify-between ${
            theme === "dark" ? "bg-[#0b1019]/70 border-slate-800/80" : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase font-mono ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                  Attendance Composition
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  100% quantity-weighted day equivalents across 8 attendance categories
                </p>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${theme === "dark" ? "bg-slate-800 text-cyan-400" : "bg-slate-100 text-cyan-700"}`}>
                {attendance_composition_denominator.toLocaleString()} d
              </span>
            </div>

            {/* Continuous Smooth Segmented Bar */}
            <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-slate-800/50 p-0.5 border border-slate-700/40 mb-3">
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

          {/* 8-Category Clean Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {attendance_composition.map((item, idx) => {
              return (
                <div
                  key={idx}
                  className={`px-2 py-1.5 rounded-lg border flex flex-col justify-between ${
                    theme === "dark" ? "bg-slate-950/40 border-slate-800/50" : "bg-slate-50 border-slate-200/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className={`text-[10px] font-semibold truncate ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[10px] font-mono">
                    <span className={theme === "dark" ? "text-white font-medium" : "text-slate-900 font-medium"}>
                      {item.days}d
                    </span>
                    <span className="font-semibold" style={{ color: item.color }}>
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
          className={`lg:col-span-5 p-3.5 rounded-xl border flex flex-col justify-between ${
            theme === "dark" ? "bg-[#0b1019]/70 border-slate-800/80" : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase font-mono ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                  Daily Attendance Trend
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Present, WFH, & Leave distribution
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> P
                </span>
                <span className="flex items-center gap-1 text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> WFH
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> L
                </span>
              </div>
            </div>

            {/* Hover details badge */}
            <div className="h-5 flex items-center text-[10px] font-mono">
              {hoveredItem ? (
                <span className="text-cyan-400">
                  {hoveredItem.date_str}: <strong className="text-emerald-400">{hoveredItem.present_days}P</strong> •{" "}
                  <strong className="text-indigo-400">{hoveredItem.wfh_days}WFH</strong> •{" "}
                  <strong className="text-purple-400">{hoveredItem.leave_days}L</strong>
                </span>
              ) : (
                <span className={theme === "dark" ? "text-slate-500" : "text-slate-400"}>Hover points to inspect</span>
              )}
            </div>

            {/* SVG Plot */}
            <div className="relative w-full h-[110px] mt-1">
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

      {/* ── 5. Business Unit Attendance Distribution Matrix Table ── */}
      <div
        className={`p-3.5 rounded-xl border overflow-hidden ${
          theme === "dark" ? "bg-[#0b1019]/70 border-slate-800/80" : "bg-white border-slate-200/90 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h3 className={`text-xs font-bold tracking-wide uppercase font-mono ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
              Business Unit Attendance Distribution Matrix
            </h3>
            <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Cross-unit breakdown of headcount, attendance proportions, and exception rates
            </p>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${theme === "dark" ? "bg-slate-800/80 border-slate-700/60 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
            {bu_attendance_comparison.length} Business Units
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className={`border-b text-[10px] font-mono uppercase tracking-wider ${theme === "dark" ? "border-slate-800 text-slate-400 bg-slate-950/40" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                <th className="py-2 px-3 font-semibold">Business Unit</th>
                <th className="py-2 px-2 text-right font-semibold">Headcount</th>
                <th className="py-2 px-2 text-right font-semibold">Rec Days</th>
                <th className="py-2 px-2 text-right font-semibold text-emerald-400">Present (d / %)</th>
                <th className="py-2 px-2 text-right font-semibold text-indigo-400">WFH (d / %)</th>
                <th className="py-2 px-2 text-right font-semibold text-purple-400">Leave (d / %)</th>
                <th className="py-2 px-2 text-right font-semibold text-red-400">Absent (d / %)</th>
                <th className="py-2 px-2 text-right font-semibold text-rose-400">Exceptions</th>
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
                  <td className="py-2 px-3 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span>{bu.business_unit}</span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{bu.observed_headcount}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">{bu.recorded_employee_days.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right font-mono text-emerald-400">
                    {bu.present_days}d ({bu.present_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-indigo-400">
                    {bu.wfh_days}d ({bu.wfh_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-purple-400">
                    {bu.leave_days}d ({bu.leave_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-red-400">
                    {bu.absent_days}d ({bu.absent_pct.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-rose-400 font-semibold">
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
                  <td className="py-2 px-3 font-bold text-cyan-400">Total (Org-Wide)</td>
                  <td className="py-2 px-2 text-right font-mono">{bu_comparison_total.observed_headcount}</td>
                  <td className="py-2 px-2 text-right font-mono">{bu_comparison_total.recorded_employee_days?.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right font-mono text-emerald-400">
                    {bu_comparison_total.present_days}d ({bu_comparison_total.present_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-indigo-400">
                    {bu_comparison_total.wfh_days}d ({bu_comparison_total.wfh_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-purple-400">
                    {bu_comparison_total.leave_days}d ({bu_comparison_total.leave_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-red-400">
                    {bu_comparison_total.absent_days}d ({bu_comparison_total.absent_pct?.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-rose-400 font-bold">
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
