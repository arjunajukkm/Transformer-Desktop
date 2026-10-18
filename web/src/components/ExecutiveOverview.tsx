"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  Calendar,
  Users,
  Clock,
  Layers,
  Search,
  Building2,
  FolderTree,
  UserCheck,
} from "lucide-react";
import { ExecutiveOverviewBundle, ExecutiveKPICardData } from "../lib/types";
import { ExecutiveOverviewSkeleton } from "./WorkforceLoadingExperience";

interface ExecutiveOverviewProps {
  bundle: ExecutiveOverviewBundle | null;
  isLoading: boolean;
  theme?: "dark" | "light";
  onRealTimeSync?: () => Promise<void>;
  isSyncing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

type MetricCohort = "pulse" | "all" | "volume" | "remote" | "compliance";
type BreakdownView = "bu" | "dept" | "emp";

export function ExecutiveOverview({
  bundle,
  isLoading,
  theme = "dark",
  onRealTimeSync,
  isSyncing,
  error,
  onRetry,
  onResetFilters,
}: ExecutiveOverviewProps) {
  const [selectedCohort, setSelectedCohort] = useState<MetricCohort>("pulse");
  const [hoveredDateIdx, setHoveredDateIdx] = useState<number | null>(null);
  const [breakdownView, setBreakdownView] = useState<BreakdownView>("bu");
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return <ExecutiveOverviewSkeleton theme={theme} />;
  }

  if (error || !bundle) {
    return (
      <div
        className={`p-8 rounded-2xl border text-center transition-all ${
          theme === "dark"
            ? "bg-[#0c1222]/90 border-slate-800 text-slate-200 shadow-xl"
            : "bg-white border-slate-200 text-slate-800 shadow-sm"
        }`}
      >
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 mb-3 border border-amber-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-bold font-mono tracking-wide uppercase mb-1.5 text-amber-400">
          Executive Overview Feed Interrupted
        </h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto mb-5 leading-relaxed">
          {error || "The analytical gateway did not return an executive summary for this scope. This can occur if a filter has zero matching records or if the analytical backend was updating."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          )}
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300"
                  : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Reset Filters to All Business Units
            </button>
          )}
        </div>
      </div>
    );
  }

  const kpi_cards = bundle.kpi_cards || [];
  const reconciliation = bundle.reconciliation;
  const attendance_composition = bundle.attendance_composition || [];
  const attendance_composition_denominator = bundle.attendance_composition_denominator || 0;
  const daily_attendance_trend = bundle.daily_attendance_trend || [];
  const bu_attendance_comparison = bundle.bu_attendance_comparison || [];
  const bu_comparison_total = bundle.bu_comparison_total;

  // Filter KPI Cards based on selected cohort
  const getVisibleCards = (): ExecutiveKPICardData[] => {
    switch (selectedCohort) {
      case "pulse":
        // 5 Core Executive Vitals: Headcount (1), Present (3), Leave (5), WFH (6), Work Hours (15)
        return kpi_cards.filter((c) => [1, 3, 5, 6, 15].includes(c.number));
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

  // Vibrant Glowing Waveform Sparkline SVG Renderer with Area Gradient
  const renderSparkline = (cardId: string, data?: number[] | null, color: string = "#06b6d4") => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max > min ? max - min : 1;
    const width = 72;
    const height = 20;

    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const lastVal = data[data.length - 1];
    const lastY = height - ((lastVal - min) / range) * (height - 6) - 3;
    const gradId = `spark-${cardId}`;

    return (
      <svg width={width} height={height} className="overflow-visible inline-block">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={theme === "dark" ? 0.35 : 0.22} />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Area fill under curve */}
        <polygon
          fill={`url(#${gradId})`}
          points={`0,${height} ${points} ${width},${height}`}
        />
        {/* Crisp line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {/* End glowing pip */}
        <circle
          cx={width.toFixed(1)}
          cy={lastY.toFixed(1)}
          r="2.5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      </svg>
    );
  };

  // SVG Daily Trend Chart dimensions
  const trendPoints = daily_attendance_trend || [];
  const chartW = 560;
  const chartH = 115;
  const maxDayVal = Math.max(...trendPoints.map((d) => Math.max(d.present_days, d.wfh_days, d.leave_days)), 1);

  const getSvgY = (val: number) => {
    return chartH - (val / (maxDayVal || 1)) * (chartH - 22) - 10;
  };

  const getSvgX = (idx: number) => {
    if (trendPoints.length <= 1) return 0;
    return (idx / (trendPoints.length - 1)) * (chartW - 20) + 10;
  };

  const presentSvgPath = trendPoints.map((d, i) => `${i === 0 ? "M" : "L"} ${getSvgX(i)} ${getSvgY(d.present_days)}`).join(" ");
  const wfhSvgPath = trendPoints.map((d, i) => `${i === 0 ? "M" : "L"} ${getSvgX(i)} ${getSvgY(d.wfh_days)}`).join(" ");
  const leaveSvgPath = trendPoints.map((d, i) => `${i === 0 ? "M" : "L"} ${getSvgX(i)} ${getSvgY(d.leave_days)}`).join(" ");

  const presentAreaPath = trendPoints.length > 0 
    ? `${presentSvgPath} L ${getSvgX(trendPoints.length - 1)} ${chartH - 10} L ${getSvgX(0)} ${chartH - 10} Z`
    : "";
  const wfhAreaPath = trendPoints.length > 0 
    ? `${wfhSvgPath} L ${getSvgX(trendPoints.length - 1)} ${chartH - 10} L ${getSvgX(0)} ${chartH - 10} Z`
    : "";

  const hoveredItem = hoveredDateIdx !== null && trendPoints[hoveredDateIdx] ? trendPoints[hoveredDateIdx] : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Segmented Cohort Switcher Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Executive Metrics:
          </span>
        </div>

        {/* Minimalist Segmented Cohort Filter Pills with Vibrant Active State */}
        <div
          className={`flex rounded-xl p-1 border text-xs font-mono ${
            theme === "dark" ? "bg-[#0a0f19] border-slate-800" : "bg-slate-100 border-slate-200"
          }`}
        >
          {[
            { id: "pulse", label: "Executive Pulse (5)" },
            { id: "all", label: "All 15 Metrics" },
            { id: "volume", label: "Volume & Presence" },
            { id: "remote", label: "Remote & Rest" },
            { id: "compliance", label: "Compliance & Hours" },
          ].map((tab) => {
            const isActive = selectedCohort === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCohort(tab.id as MetricCohort)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  isActive
                    ? theme === "dark"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                      : "bg-slate-900 text-white font-bold shadow-xs"
                    : theme === "dark"
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. KPI Cards Grid (Vibrant Jewel-Toned Cards with Waveform Sparklines) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {visibleCards.map((card: ExecutiveKPICardData) => {
          return (
            <div
              key={card.id}
              className={`p-3.5 rounded-xl border relative overflow-hidden transition-all duration-200 flex flex-col justify-between group ${
                theme === "dark"
                  ? "bg-[#0d1426]/90 border-slate-800/80 hover:border-slate-700 hover:bg-[#111a32] shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                  : "bg-white/95 border-slate-200 hover:border-slate-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] shadow-sm"
              }`}
            >
              {/* Jewel-Toned Ambient Top Accent Strip */}
              <div
                className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-xl"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${card.color} 50%, transparent 100%)`,
                  boxShadow: theme === "dark" ? `0 0 10px ${card.color}80` : `0 0 6px ${card.color}50`,
                }}
              />

              {/* Card Header: Color Indicator Dot + Title + Waveform Sparkline */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: card.color,
                      boxShadow: `0 0 8px ${card.color}`,
                    }}
                  />
                  <span
                    className={`text-[10px] font-mono font-bold tracking-wider truncate uppercase ${
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {card.number}. {card.title}
                  </span>
                </div>
                {card.sparkline && (
                  <div className="shrink-0">{renderSparkline(card.id, card.sparkline, card.color)}</div>
                )}
              </div>

              {/* Primary Value */}
              <div className="my-1">
                <div
                  className={`text-xl font-bold font-mono tracking-tight ${
                    theme === "dark" ? "text-white" : "text-slate-900"
                  }`}
                >
                  {card.primary}
                </div>
                <div className="mt-0.5">
                  <span
                    className="inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: theme === "dark" ? `${card.color}25` : `${card.color}15`,
                      color: card.color,
                      border: `1px solid ${card.color}40`,
                    }}
                  >
                    {card.secondary}
                  </span>
                </div>
              </div>

              {/* Context Footnote */}
              <div
                className={`text-[10px] truncate pt-1.5 border-t ${
                  theme === "dark" ? "border-slate-800/60 text-slate-400" : "border-slate-100 text-slate-500"
                }`}
                title={card.footnote}
              >
                {card.footnote}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 4. Dual Visualizations Side-by-Side: Attendance Composition & Daily Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 pt-1 items-stretch">
        {/* Left: 100% Additive Attendance Composition Widget (7 cols) */}
        <div
          className={`lg:col-span-7 p-4 rounded-xl border flex flex-col justify-between h-full ${
            theme === "dark"
              ? "bg-[#0d1426]/90 border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
              : "bg-white/95 border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase font-mono ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
                  Attendance Composition
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  100% quantity-weighted day equivalents across all 8 attendance categories
                </p>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                  theme === "dark"
                    ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-300"
                    : "bg-cyan-50 border-cyan-200 text-cyan-800"
                }`}
              >
                {attendance_composition_denominator.toLocaleString()} d
              </span>
            </div>

            {/* Continuous Luminous Segmented Bar */}
            <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-900/60 p-0.5 border border-slate-700/50 mb-3.5 shadow-inner">
              {attendance_composition.map((item, idx) => {
                const pct = item.pct || 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={idx}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: item.color,
                      boxShadow: `0 0 6px ${item.color}60`,
                    }}
                    title={`${item.label}: ${item.days} days (${pct.toFixed(1)}%)`}
                    className="h-full transition-all hover:opacity-85"
                  />
                );
              })}
            </div>
          </div>

          {/* 8-Category Clean Legend Grid with Saturated Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {attendance_composition.map((item, idx) => {
              return (
                <div
                  key={idx}
                  className={`px-2.5 py-1.5 rounded-lg border flex flex-col justify-between transition-colors ${
                    theme === "dark"
                      ? "bg-slate-950/50 border-slate-800/60 hover:border-slate-700"
                      : "bg-slate-50 border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 6px ${item.color}`,
                      }}
                    />
                    <span
                      className={`text-[10px] font-bold truncate ${
                        theme === "dark" ? "text-slate-200" : "text-slate-700"
                      }`}
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] font-mono">
                    <span className={theme === "dark" ? "text-white font-semibold" : "text-slate-900 font-semibold"}>
                      {item.days}d
                    </span>
                    <span
                      className="font-bold text-[10px] px-1.5 py-0.2 rounded"
                      style={{
                        backgroundColor: theme === "dark" ? `${item.color}25` : `${item.color}15`,
                        color: item.color,
                      }}
                    >
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Daily Attendance Trend Line Chart with Area Gradient (5 cols) */}
        <div
          className={`lg:col-span-5 p-4 rounded-xl border flex flex-col justify-between h-full ${
            theme === "dark"
              ? "bg-[#0d1426]/90 border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
              : "bg-white/95 border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase font-mono ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
                  Daily Attendance Trend
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Present, WFH, & Leave distribution curves
                </p>
              </div>

              {/* Legend with Luminous Color Dots */}
              <div className="flex items-center gap-2.5 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" /> P
                </span>
                <span className="flex items-center gap-1 text-indigo-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_#6366f1]" /> WFH
                </span>
                <span className="flex items-center gap-1 text-purple-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" /> L
                </span>
              </div>
            </div>

            {/* Hover details badge */}
            <div className="h-5 flex items-center text-[10px] font-mono">
              {hoveredItem ? (
                <span className="text-cyan-400 font-semibold">
                  {hoveredItem.date_str}: <strong className="text-emerald-400">{hoveredItem.present_days}P</strong> •{" "}
                  <strong className="text-indigo-400">{hoveredItem.wfh_days}WFH</strong> •{" "}
                  <strong className="text-purple-400">{hoveredItem.leave_days}L</strong>
                </span>
              ) : (
                <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>Hover points to inspect</span>
              )}
            </div>

            {/* SVG Telemetry Plot with Glowing Gradients */}
            <div className="relative w-full h-[115px] mt-1">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredDateIdx(null)}
              >
                <defs>
                  {/* Present Area Gradient */}
                  <linearGradient id="area-pres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={theme === "dark" ? 0.35 : 0.22} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                  {/* WFH Area Gradient */}
                  <linearGradient id="area-wfh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={theme === "dark" ? 0.28 : 0.18} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line x1="10" y1={getSvgY(maxDayVal)} x2={chartW - 10} y2={getSvgY(maxDayVal)} stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="3 3" />
                <line x1="10" y1={getSvgY(maxDayVal / 2)} x2={chartW - 10} y2={getSvgY(maxDayVal / 2)} stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="3 3" />
                <line x1="10" y1={chartH - 10} x2={chartW - 10} y2={chartH - 10} stroke={theme === "dark" ? "#334155" : "#cbd5e1"} strokeWidth="1" />

                {/* Filled Gradient Areas */}
                {presentAreaPath && <path d={presentAreaPath} fill="url(#area-pres)" />}
                {wfhAreaPath && <path d={wfhAreaPath} fill="url(#area-wfh)" />}

                {/* Series Lines with Vibrant Thickness */}
                <path d={leaveSvgPath} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" />
                <path d={wfhSvgPath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                <path d={presentSvgPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px rgba(16,185,129,0.3))" }} />

                {/* Interactive Datapoints */}
                {trendPoints.map((d, idx) => {
                  const x = getSvgX(idx);
                  const isHovered = hoveredDateIdx === idx;
                  return (
                    <g key={idx} onMouseEnter={() => setHoveredDateIdx(idx)} className="cursor-pointer">
                      <rect x={x - 4} y="0" width="8" height={chartH} fill="transparent" />
                      {isHovered && (
                        <>
                          <line x1={x} y1="0" x2={x} y2={chartH} stroke="#00f2fe" strokeWidth="1.5" strokeDasharray="2 2" />
                          <circle cx={x} cy={getSvgY(d.present_days)} r="4" fill="#10b981" style={{ filter: "drop-shadow(0 0 4px #10b981)" }} />
                          <circle cx={x} cy={getSvgY(d.wfh_days)} r="3.5" fill="#6366f1" />
                          <circle cx={x} cy={getSvgY(d.leave_days)} r="3" fill="#a855f7" />
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1">
            <span>{trendPoints[0]?.date_str || "Start"}</span>
            <span>{trendPoints[Math.floor(trendPoints.length / 2)]?.date_str || "Mid"}</span>
            <span>{trendPoints[trendPoints.length - 1]?.date_str || "End"}</span>
          </div>
        </div>
      </div>

      {/* ── 5. Workforce Distribution & Entity Roster Breakdown Matrix ── */}
      {(() => {
        const depts = bundle.dept_attendance_comparison || [];
        const emps = bundle.emp_attendance_comparison || [];

        const filteredDepts = depts.filter((d) =>
          !searchQuery.trim()
            ? true
            : d.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
              d.business_unit.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const filteredEmps = emps.filter((e) =>
          !searchQuery.trim()
            ? true
            : e.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              e.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
              e.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
              e.business_unit.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div
            className={`p-4 rounded-xl border overflow-hidden ${
              theme === "dark"
                ? "bg-[#0d1426]/90 border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
                : "bg-white/95 border-slate-200/90 shadow-sm"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className={`text-xs font-bold tracking-wide uppercase font-mono ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
                  Workforce Attendance Distribution & Entity Breakdown Matrix
                </h3>
                <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  {breakdownView === "bu"
                    ? "Cross-unit comparative distribution of headcount, attendance categories, and exceptions"
                    : breakdownView === "dept"
                    ? `Operational attendance distribution across all ${depts.length} departments in synced dataset`
                    : `Verified individual attendance and hours roster across ${emps.length} actual employees`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar for Departments and Employees */}
                {breakdownView !== "bu" && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={breakdownView === "dept" ? "Filter departments..." : "Filter employee name or ID..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`h-7 pl-7 pr-2.5 text-[11px] font-mono rounded-lg border outline-none transition-colors ${
                        theme === "dark"
                          ? "bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-cyan-400"
                          : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400 focus:border-cyan-600"
                      }`}
                    />
                    <Search className="h-3 w-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                  </div>
                )}

                {/* Level Tabs: Business Units / Departments / Employees */}
                <div className={`flex rounded-lg p-0.5 border ${theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-300"}`}>
                  <button
                    onClick={() => { setBreakdownView("bu"); setSearchQuery(""); }}
                    className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      breakdownView === "bu"
                        ? theme === "dark"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                          : "bg-white text-cyan-800 border border-cyan-300 font-bold shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Building2 className="h-3 w-3" />
                    <span>Business Units ({bu_attendance_comparison.length})</span>
                  </button>

                  <button
                    onClick={() => { setBreakdownView("dept"); setSearchQuery(""); }}
                    className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      breakdownView === "dept"
                        ? theme === "dark"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                          : "bg-white text-cyan-800 border border-cyan-300 font-bold shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <FolderTree className="h-3 w-3" />
                    <span>Departments ({depts.length})</span>
                  </button>

                  <button
                    onClick={() => { setBreakdownView("emp"); setSearchQuery(""); }}
                    className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      breakdownView === "emp"
                        ? theme === "dark"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                          : "bg-white text-cyan-800 border border-cyan-300 font-bold shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <UserCheck className="h-3 w-3" />
                    <span>Employee Roster ({emps.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── 1. BUSINESS UNITS TABLE VIEW ── */}
            {breakdownView === "bu" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr
                      className={`border-b text-[10px] font-mono uppercase tracking-wider ${
                        theme === "dark"
                          ? "border-slate-800 text-slate-400 bg-slate-950/60"
                          : "border-slate-200 text-slate-600 bg-slate-50"
                      }`}
                    >
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">Business Unit</th>
                      <th className="py-2.5 px-2 text-right font-bold whitespace-nowrap">Headcount</th>
                      <th className="py-2.5 px-2 text-right font-bold text-emerald-500 whitespace-nowrap">Present</th>
                      <th className="py-2.5 px-2 text-right font-bold text-purple-400 whitespace-nowrap">Leave</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-400 whitespace-nowrap">OD</th>
                      <th className="py-2.5 px-2 text-right font-bold text-indigo-400 whitespace-nowrap">WFH</th>
                      <th className="py-2.5 px-2 text-right font-bold text-teal-400 whitespace-nowrap">Holiday</th>
                      <th className="py-2.5 px-2 text-right font-bold text-rose-500 whitespace-nowrap">Absent</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-400 whitespace-nowrap">Week OFF</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-200 whitespace-nowrap">Total</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-300 whitespace-nowrap">Calendar days</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === "dark" ? "divide-slate-800/40" : "divide-slate-200/70"}`}>
                    {bu_attendance_comparison.map((bu, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors text-[11px] ${
                          theme === "dark" ? "hover:bg-slate-800/40 text-slate-200" : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f2fe] shrink-0" />
                          <span>{bu.business_unit}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-medium whitespace-nowrap">{bu.observed_headcount}</td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-500 whitespace-nowrap">
                          {bu.present_days}d ({bu.present_pct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-purple-400 whitespace-nowrap">
                          {bu.leave_days}d ({bu.leave_pct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-cyan-400 whitespace-nowrap">
                          {bu.od_days ?? 0}d ({(bu.od_pct ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-indigo-400 whitespace-nowrap">
                          {bu.wfh_days}d ({bu.wfh_pct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-teal-400 whitespace-nowrap">
                          {bu.holiday_days ?? 0}d ({(bu.holiday_pct ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-rose-500 whitespace-nowrap">
                          {bu.absent_days}d ({bu.absent_pct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-400 whitespace-nowrap">
                          {bu.week_off_days ?? 0}d ({(bu.week_off_pct ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                          {(bu.total_days ?? bu.recorded_employee_days).toLocaleString()}d
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-cyan-300 whitespace-nowrap">
                          {bu.calendar_days ?? 0}d
                        </td>
                      </tr>
                    ))}

                    {/* Organization-Wide Total Row with Radiant Accent */}
                    {bu_comparison_total && (
                      <tr
                        className={`border-t-2 font-bold text-[11px] ${
                          theme === "dark"
                            ? "bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-cyan-500/50 text-white"
                            : "bg-gradient-to-r from-slate-100 via-white to-slate-100 border-cyan-500/60 text-slate-900"
                        }`}
                      >
                        <td className="py-2.5 px-3 text-cyan-400 font-bold flex items-center gap-1.5">
                          <span>Total (Org-Wide)</span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">{bu_comparison_total.observed_headcount}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-500">
                          {bu_comparison_total.present_days}d ({bu_comparison_total.present_pct?.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-purple-400">
                          {bu_comparison_total.leave_days}d ({bu_comparison_total.leave_pct?.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-400">
                          {bu_comparison_total.od_days ?? 0}d ({(bu_comparison_total.od_pct ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-indigo-400">
                          {bu_comparison_total.wfh_days}d ({bu_comparison_total.wfh_pct?.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-teal-400">
                          {bu_comparison_total.holiday_days ?? 0}d ({(bu_comparison_total.holiday_pct ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-rose-500">
                          {bu_comparison_total.absent_days}d ({bu_comparison_total.absent_pct?.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                          {bu_comparison_total.week_off_days ?? 0}d ({(bu_comparison_total.week_off_pct ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-300 font-bold">
                          {(bu_comparison_total.total_days ?? bu_comparison_total.recorded_employee_days ?? 0).toLocaleString()}d
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-300">
                          {bu_comparison_total.calendar_days ?? 0}d
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── 2. DEPARTMENTS TABLE VIEW (ALL 42 DEPARTMENTS) ── */}
            {breakdownView === "dept" && (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="sticky top-0 z-10">
                    <tr
                      className={`border-b text-[10px] font-mono uppercase tracking-wider ${
                        theme === "dark"
                          ? "border-slate-800 text-slate-400 bg-slate-950"
                          : "border-slate-200 text-slate-600 bg-slate-100"
                      }`}
                    >
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">Department</th>
                      <th className="py-2.5 px-2 font-bold whitespace-nowrap">Business Unit</th>
                      <th className="py-2.5 px-2 text-right font-bold whitespace-nowrap">Headcount</th>
                      <th className="py-2.5 px-2 text-right font-bold text-emerald-500 whitespace-nowrap">Present</th>
                      <th className="py-2.5 px-2 text-right font-bold text-purple-400 whitespace-nowrap">Leave</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-400 whitespace-nowrap">OD</th>
                      <th className="py-2.5 px-2 text-right font-bold text-indigo-400 whitespace-nowrap">WFH</th>
                      <th className="py-2.5 px-2 text-right font-bold text-teal-400 whitespace-nowrap">Holiday</th>
                      <th className="py-2.5 px-2 text-right font-bold text-rose-500 whitespace-nowrap">Absent</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-400 whitespace-nowrap">Week OFF</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-200 whitespace-nowrap">Total</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-300 whitespace-nowrap">Calendar days</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === "dark" ? "divide-slate-800/40" : "divide-slate-200/70"}`}>
                    {filteredDepts.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-6 text-center text-slate-400 font-mono text-xs">
                          No departments matching &quot;{searchQuery}&quot;
                        </td>
                      </tr>
                    ) : (
                      filteredDepts.map((d, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors text-[11px] ${
                            theme === "dark" ? "hover:bg-slate-800/40 text-slate-200" : "hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          <td className="py-2 px-3 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            <span>{d.department}</span>
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-400 text-[10px] whitespace-nowrap">{d.business_unit}</td>
                          <td className="py-2 px-2 text-right font-mono font-medium whitespace-nowrap">{d.observed_headcount}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-500 whitespace-nowrap">
                            {d.present_days}d ({d.present_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-purple-400 whitespace-nowrap">
                            {d.leave_days}d ({d.leave_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-cyan-400 whitespace-nowrap">
                            {d.od_days ?? 0}d ({(d.od_pct ?? 0).toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-indigo-400 whitespace-nowrap">
                            {d.wfh_days}d ({d.wfh_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-teal-400 whitespace-nowrap">
                            {d.holiday_days ?? 0}d ({(d.holiday_pct ?? 0).toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-rose-500 whitespace-nowrap">
                            {d.absent_days}d ({d.absent_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-slate-400 whitespace-nowrap">
                            {d.week_off_days ?? 0}d ({(d.week_off_pct ?? 0).toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                            {(d.total_days ?? d.recorded_employee_days).toLocaleString()}d
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-cyan-300 whitespace-nowrap">
                            {d.calendar_days ?? 0}d
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── 3. EMPLOYEE ROSTER TABLE VIEW (ALL 395 REAL EMPLOYEES) ── */}
            {breakdownView === "emp" && (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="sticky top-0 z-10">
                    <tr
                      className={`border-b text-[10px] font-mono uppercase tracking-wider ${
                        theme === "dark"
                          ? "border-slate-800 text-slate-400 bg-slate-950"
                          : "border-slate-200 text-slate-600 bg-slate-100"
                      }`}
                    >
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">Emp ID</th>
                      <th className="py-2.5 px-2 font-bold whitespace-nowrap">Employee Name</th>
                      <th className="py-2.5 px-2 font-bold whitespace-nowrap">Department</th>
                      <th className="py-2.5 px-2 font-bold whitespace-nowrap">Business Unit</th>
                      <th className="py-2.5 px-2 text-right font-bold text-emerald-500 whitespace-nowrap">Present</th>
                      <th className="py-2.5 px-2 text-right font-bold text-purple-400 whitespace-nowrap">Leave</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-400 whitespace-nowrap">OD</th>
                      <th className="py-2.5 px-2 text-right font-bold text-indigo-400 whitespace-nowrap">WFH</th>
                      <th className="py-2.5 px-2 text-right font-bold text-teal-400 whitespace-nowrap">Holiday</th>
                      <th className="py-2.5 px-2 text-right font-bold text-rose-500 whitespace-nowrap">Absent</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-400 whitespace-nowrap">Week OFF</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-200 whitespace-nowrap">Total</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-300 whitespace-nowrap">Calendar days</th>
                      <th className="py-2.5 px-2 text-right font-bold text-cyan-400 whitespace-nowrap">Avg Hours</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === "dark" ? "divide-slate-800/40" : "divide-slate-200/70"}`}>
                    {filteredEmps.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-6 text-center text-slate-400 font-mono text-xs">
                          No employees matching &quot;{searchQuery}&quot;
                        </td>
                      </tr>
                    ) : (
                      filteredEmps.map((emp, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors text-[11px] ${
                            theme === "dark" ? "hover:bg-slate-800/40 text-slate-200" : "hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-[10px] text-cyan-400 font-bold whitespace-nowrap">{emp.employee_id}</td>
                          <td className="py-2 px-2 font-semibold text-slate-100 flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>{emp.employee_name}</span>
                          </td>
                          <td className="py-2 px-2 text-[10px] text-slate-300 whitespace-nowrap">{emp.department}</td>
                          <td className="py-2 px-2 text-[10px] text-slate-400 whitespace-nowrap">{emp.business_unit}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-500 whitespace-nowrap">
                            {emp.present_days}d ({emp.present_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-purple-400 whitespace-nowrap">
                            {emp.leave_days}d ({emp.leave_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-cyan-400 whitespace-nowrap">
                            {emp.od_days ?? 0}d ({(emp.od_pct ?? 0).toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-indigo-400 whitespace-nowrap">
                            {emp.wfh_days}d ({emp.wfh_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-teal-400 whitespace-nowrap">
                            {emp.holiday_days ?? 0}d ({(emp.holiday_pct ?? 0).toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-rose-500 whitespace-nowrap">
                            {emp.absent_days}d ({emp.absent_pct.toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-slate-400 whitespace-nowrap">
                            {emp.week_off_days ?? 0}d ({(emp.week_off_pct ?? 0).toFixed(1)}%)
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                            {(emp.total_days ?? emp.recorded_employee_days).toLocaleString()}d
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-cyan-300 whitespace-nowrap">
                            {emp.calendar_days ?? 0}d
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-cyan-300 font-semibold whitespace-nowrap">
                            {emp.avg_working_hours}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
