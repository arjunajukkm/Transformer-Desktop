"use client";

import React, { useState } from "react";
import { Grid, TrendingUp, TrendingDown, Minus, Info, HelpCircle, X, CheckCircle2, AlertCircle } from "lucide-react";
import { HeatmapRow } from "@/lib/types";

interface OrgBenchmarkItem {
  period: string;
  period_display: string;
  value: number | null;
  formatted_value: string;
}

interface BusinessUnitHeatmapProps {
  months: string[];
  rows: HeatmapRow[];
  metricLabel: string;
  theme?: "dark" | "light";
  lowerIsBetter?: boolean;
  orgBenchmarks?: OrgBenchmarkItem[];
}

interface TooltipState {
  x: number;
  y: number;
  placement: "top" | "bottom";
  title: string;
  subtitle?: string;
  stats: { label: string; value: string; highlight?: boolean; color?: string }[];
  statusBadge?: { text: string; favorable: boolean; neutral?: boolean };
  explanation: string;
}

export function BusinessUnitHeatmap({
  months,
  rows,
  metricLabel,
  theme = "dark",
  lowerIsBetter = true,
  orgBenchmarks,
}: BusinessUnitHeatmapProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  if (!rows || rows.length === 0) return null;

  const latestMonth = months && months.length > 0 ? months[months.length - 1] : "Latest";

  // Helper to extract the org benchmark formatted value for a specific month column index
  const getOrgBenchmarkForMonth = (mIdx: number, monthName: string) => {
    if (orgBenchmarks && orgBenchmarks.length > 0) {
      const match = orgBenchmarks.find(
        (b) => b.period_display === monthName || b.period === monthName
      );
      if (match && match.formatted_value && match.formatted_value !== "—") {
        return match.formatted_value;
      }
    }
    // Fallback: check first row's monthly_deltas
    const deltaIndex = rows[0]?.monthly_deltas?.length - 3 + mIdx;
    const delta = rows[0]?.monthly_deltas?.[deltaIndex >= 0 ? deltaIndex : mIdx];
    if (delta?.org_formatted && delta.org_formatted !== "—") {
      return delta.org_formatted;
    }
    if (delta?.org_value !== null && delta?.org_value !== undefined) {
      return `${delta.org_value}%`;
    }
    return null;
  };

  const handleCellMouseEnter = (
    e: React.MouseEvent,
    buName: string,
    monthName: string,
    buFmt: string,
    delta: { delta: number | null; formatted_delta: string; org_value?: number | null; org_formatted?: string } | undefined
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearTop = rect.top < 180;
    const deltaVal = delta?.delta ?? null;
    const orgFmt = delta?.org_formatted || (delta?.org_value !== null && delta?.org_value !== undefined ? `${delta.org_value}%` : "Org Baseline");

    let isFavorable = false;
    let isNeutral = deltaVal === null || deltaVal === 0;

    if (!isNeutral && deltaVal !== null) {
      isFavorable = lowerIsBetter ? deltaVal < 0 : deltaVal > 0;
    }

    const deltaSign = deltaVal !== null && deltaVal > 0 ? `+${deltaVal}` : `${deltaVal}`;
    const favorableText = isFavorable ? "Favorable · Beating Org" : "Adverse · Lagging Org";
    const deltaSummary = isNeutral
      ? "Matching the company average exactly."
      : isFavorable
      ? `${buName} performed ${Math.abs(deltaVal!)} pp better than the company average in ${monthName}.`
      : `${buName} performed ${Math.abs(deltaVal!)} pp worse than the company average in ${monthName}.`;

    setActiveTooltip({
      x: rect.left + rect.width / 2,
      y: isNearTop ? rect.bottom + 8 : rect.top - 8,
      placement: isNearTop ? "bottom" : "top",
      title: `${buName} · ${monthName}`,
      subtitle: "Benchmark Comparison vs Organisation",
      stats: [
        { label: "BU Actual", value: buFmt, highlight: true },
        { label: "Org Average", value: orgFmt },
        { label: "Delta vs Org", value: delta?.formatted_delta || `${deltaSign} pp`, color: isFavorable ? "#34d399" : isNeutral ? "#94a3b8" : "#fb7185" },
      ],
      statusBadge: {
        text: isNeutral ? "On Par with Org" : favorableText,
        favorable: isFavorable,
        neutral: isNeutral,
      },
      explanation: deltaSummary,
    });
  };

  const handleTrendMouseEnter = (
    e: React.MouseEvent,
    row: HeatmapRow
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearTop = rect.top < 180;
    const recentVals = row.monthly_values.slice(-3);
    const trajectoryStr = recentVals
      .map((v) => `${v.period}: ${v.formatted_value}`)
      .join(" → ");

    const isImproving = row.trend_direction === "IMPROVING";
    const isDeteriorating = row.trend_direction === "DETERIORATING" || row.trend_direction === "WORSENING" || row.trend_direction === "REGRESSING";
    const isStable = row.trend_direction === "STABLE";

    const explanation = isImproving
      ? `Performance has consistently improved over the last 3 months compared to this team's own history.`
      : isDeteriorating
      ? `Performance has worsened over the last 3 months compared to this team's own history.`
      : `Performance has remained steady within historical tolerance over the last 3 months.`;

    setActiveTooltip({
      x: rect.left + rect.width / 2,
      y: isNearTop ? rect.bottom + 8 : rect.top - 8,
      placement: isNearTop ? "bottom" : "top",
      title: `${row.business_unit} · 3M Trend`,
      subtitle: "Internal Trajectory (Self-Comparison)",
      stats: [
        { label: "3M Trajectory", value: trajectoryStr },
        { label: "Current Rate", value: row.current_formatted, highlight: true },
        { label: "Momentum", value: row.trend_direction, color: isImproving ? "#34d399" : isDeteriorating ? "#fb7185" : "#94a3b8" },
      ],
      statusBadge: {
        text: `${row.trend_direction} (vs Self)`,
        favorable: isImproving,
        neutral: isStable,
      },
      explanation,
    });
  };

  const handleHeaderMouseEnter = (
    e: React.MouseEvent,
    title: string,
    subtitle: string,
    explanation: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearTop = rect.top < 180;
    setActiveTooltip({
      x: rect.left + rect.width / 2,
      y: isNearTop ? rect.bottom + 8 : rect.top - 8,
      placement: isNearTop ? "bottom" : "top",
      title,
      subtitle,
      stats: [],
      explanation,
    });
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-md h-full flex flex-col justify-between ${
        theme === "dark"
          ? "bg-[#0b1222]/95 border-cyan-500/25 text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-sm"
      }`}
    >
      <div>
        {/* ── Top Header Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2.5 border-b border-inherit">
          {/* Left: Title + Direction Pill */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <Grid className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <h3 className="font-bold text-xs tracking-tight uppercase font-mono whitespace-nowrap">
                BU Matrix — {metricLabel}
              </h3>
            </div>
            {/* Self-explanatory direction micro-pill */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-tight whitespace-nowrap cursor-help ${
                lowerIsBetter
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                  : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/25"
              }`}
              title={
                lowerIsBetter
                  ? "Lower values represent better performance / fewer anomalies"
                  : "Higher values represent better performance"
              }
              onMouseEnter={(e) =>
                handleHeaderMouseEnter(
                  e,
                  metricLabel,
                  lowerIsBetter ? "Lower is Better" : "Higher is Better",
                  lowerIsBetter
                    ? `For ${metricLabel}, a lower percentage is favorable (e.g. fewer missing swipes or absences). 0% is ideal.`
                    : `For ${metricLabel}, a higher percentage is favorable (e.g. higher compliance or attendance).`
                )
              }
              onMouseLeave={() => setActiveTooltip(null)}
            >
              {lowerIsBetter ? "↓ Lower is better" : "↑ Higher is better"}
            </span>
          </div>

          {/* Right: Color Legend & Interactive Guide Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Visual Micro-Legend */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 font-semibold">Beating Org</span>
              </span>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                <span className="text-rose-400 font-semibold">Lagging Org</span>
              </span>
            </div>

            {/* Quick Guide Trigger Button */}
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all flex items-center gap-1 cursor-pointer ${
                showGuide
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                  : "bg-slate-800/50 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600"
              }`}
              title="Click to view/hide quick interpretation guide"
            >
              <HelpCircle className="h-3 w-3 text-cyan-400" />
              <span>Guide</span>
            </button>
          </div>
        </div>

        {/* ── Expandable Quick Guide Card ── */}
        {showGuide && (
          <div className="mb-2.5 p-2.5 rounded-lg bg-slate-900/95 border border-cyan-500/35 text-xs shadow-xl backdrop-blur-md transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5 font-semibold text-cyan-300 font-mono text-xs">
                  <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>How to Read this Matrix:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 font-sans text-xs">
                  <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800">
                    <span className="text-cyan-400 font-mono font-bold block text-[10px] uppercase">
                      1. Trend (vs Self)
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-0.5 leading-tight">
                      3-month trajectory vs its own past. Rising missing swipes = <strong>DETERIORATING</strong>.
                    </p>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800">
                    <span className="text-emerald-400 font-mono font-bold block text-[10px] uppercase">
                      2. Badges (vs Org)
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-0.5 leading-tight">
                      Gap vs Company Benchmark that month. <strong>Green</strong> = beating company average.
                    </p>
                  </div>
                </div>
                <div className="text-[9.5px] text-slate-400 font-mono pt-0.5 border-t border-slate-800/80 flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
                  <span>
                    A BU can be <em>Deteriorating vs self</em> while still <em>Green (favorable) vs company benchmark</em>.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 cursor-pointer"
                title="Close guide"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Main Matrix Table ── */}
        <div className="overflow-x-auto pb-1">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-inherit text-slate-400 font-mono text-[10px]">
                <th className="py-1.5 px-1.5 font-semibold whitespace-nowrap">BU</th>

                <th className="py-1.5 px-1.5 font-semibold text-right whitespace-nowrap">
                  <div>Current</div>
                  <div className="text-[8.5px] font-normal text-slate-500 font-sans tracking-tight">
                    ({latestMonth.split(" ")[0]})
                  </div>
                </th>

                <th
                  className="py-1.5 px-1 font-semibold text-center whitespace-nowrap cursor-help"
                  onMouseEnter={(e) =>
                    handleHeaderMouseEnter(
                      e,
                      "3M Trend",
                      "Self-Comparison Trajectory",
                      "Evaluates whether this BU is improving or deteriorating against its own past 3 months. This is independent of the company average."
                    )
                  }
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <div className="flex flex-col items-center leading-none">
                    <div className="flex items-center gap-0.5">
                      <span>Trend</span>
                      <Info className="h-2.5 w-2.5 text-cyan-400/80" />
                    </div>
                    <span className="text-[8.5px] font-normal text-cyan-400/80 font-sans tracking-tight mt-0.5">
                      (vs Self)
                    </span>
                  </div>
                </th>

                {/* Monthly Columns with Org Benchmark Sub-Header */}
                {months.slice(-3).map((m, mIdx, arr) => {
                  const orgFmt = getOrgBenchmarkForMonth(mIdx, m);

                  return (
                    <th
                      key={m}
                      className={`py-1.5 ${
                        mIdx === arr.length - 1 ? "pl-1.5 pr-2" : "px-1.5"
                      } font-semibold text-center whitespace-nowrap cursor-help`}
                      onMouseEnter={(e) =>
                        handleHeaderMouseEnter(
                          e,
                          `${m} Benchmark`,
                          `Company Average: ${orgFmt || "N/A"}`,
                          `Top number shows BU rate. Bottom badge shows difference against the company average (${orgFmt || "Org baseline"}).`
                        )
                      }
                      onMouseLeave={() => setActiveTooltip(null)}
                    >
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-slate-200 text-[10px]">{m}</span>
                        {orgFmt && (
                          <span
                            className="text-[8.5px] text-cyan-300 font-mono font-medium tracking-tight bg-cyan-950/70 px-1 py-0.2 rounded border border-cyan-500/25 mt-0.5"
                            title={`Organisation Baseline in ${m}: ${orgFmt}`}
                          >
                            Org: {orgFmt}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
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
                  <td
                    className="py-1.5 px-1.5 font-sans font-medium text-xs truncate max-w-[110px] sm:max-w-[125px] whitespace-nowrap text-slate-200"
                    title={row.business_unit}
                  >
                    {row.business_unit}
                  </td>

                  <td className="py-1.5 px-1.5 text-right font-bold text-xs whitespace-nowrap text-slate-100">
                    {row.current_formatted}
                  </td>

                  {/* Trend Column */}
                  <td
                    className="py-2 px-2 text-center whitespace-nowrap cursor-help"
                    onMouseEnter={(e) => handleTrendMouseEnter(e, row)}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium whitespace-nowrap transition-all ${
                        row.trend_direction === "IMPROVING"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : row.trend_direction === "WORSENING" ||
                            row.trend_direction === "REGRESSING" ||
                            row.trend_direction === "DETERIORATING"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-800/40 text-slate-400 border border-slate-700/30"
                      }`}
                    >
                      {row.trend_direction === "IMPROVING" && (
                        <TrendingDown className="h-3 w-3 text-emerald-400 shrink-0" />
                      )}
                      {(row.trend_direction === "WORSENING" ||
                        row.trend_direction === "DETERIORATING" ||
                        row.trend_direction === "REGRESSING") && (
                        <TrendingUp className="h-3 w-3 text-rose-400 shrink-0" />
                      )}
                      {row.trend_direction === "STABLE" && (
                        <Minus className="h-3 w-3 text-slate-400 shrink-0" />
                      )}
                      <span>{row.trend_direction}</span>
                    </span>
                  </td>

                  {/* Monthly cells */}
                  {row.monthly_values.slice(-3).map((mv, i) => {
                    const deltaIndex = row.monthly_values.length - 3 + i;
                    const delta = row.monthly_deltas[deltaIndex >= 0 ? deltaIndex : i];
                    const hasVal = mv.value !== null;
                    const deltaNum = delta?.delta ?? null;

                    // Color evaluation
                    let isFavorable = false;
                    let isNeutral = deltaNum === null || deltaNum === 0;

                    if (!isNeutral && deltaNum !== null) {
                      isFavorable = lowerIsBetter ? deltaNum < 0 : deltaNum > 0;
                    }

                    return (
                      <td
                        key={mv.period}
                        className={`py-2 ${
                          i === 2 ? "pl-2 pr-3.5" : "px-2"
                        } text-center whitespace-nowrap cursor-help`}
                        onMouseEnter={(e) =>
                          handleCellMouseEnter(
                            e,
                            row.business_unit,
                            mv.period,
                            mv.formatted_value,
                            delta
                          )
                        }
                        onMouseLeave={() => setActiveTooltip(null)}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {/* BU Actual Value */}
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

                          {/* Delta vs Org Badge */}
                          {delta?.formatted_delta && delta.formatted_delta !== "—" && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-sans font-semibold border whitespace-nowrap transition-transform hover:scale-105 ${
                                isNeutral
                                  ? theme === "dark"
                                    ? "text-slate-400 bg-slate-900 border-slate-800"
                                    : "text-slate-600 bg-slate-100 border-slate-200"
                                  : isFavorable
                                  ? theme === "dark"
                                    ? "text-emerald-300 bg-emerald-950/50 border-emerald-500/35"
                                    : "text-emerald-700 bg-emerald-100/90 border-emerald-300"
                                  : theme === "dark"
                                  ? "text-rose-300 bg-rose-950/50 border-rose-500/35"
                                  : "text-rose-700 bg-rose-100/90 border-rose-300"
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
      <div
        className={`mt-3 pt-2.5 border-t border-inherit flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${
          theme === "dark" ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          Spatial Distribution Matrix · {rows.length} Business Units
        </span>
        <span className="text-slate-500 hidden sm:inline">
          Trend = 3M vs Self · Badges = vs Org Baseline
        </span>
      </div>

      {/* ── Fixed Floating Glassmorphism Tooltip ── */}
      {activeTooltip && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(
              Math.max(160, activeTooltip.x),
              typeof window !== "undefined" ? window.innerWidth - 160 : 800
            )}px`,
            top: `${activeTooltip.y}px`,
            transform:
              activeTooltip.placement === "bottom"
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="w-72 p-3 rounded-lg bg-slate-950/95 border border-cyan-500/40 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-1.5 pb-2 mb-2 border-b border-slate-800">
            <div>
              <h4 className="font-bold text-xs text-white font-sans">
                {activeTooltip.title}
              </h4>
              {activeTooltip.subtitle && (
                <p className="text-[10px] text-cyan-400 font-mono">
                  {activeTooltip.subtitle}
                </p>
              )}
            </div>
            {activeTooltip.statusBadge && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border shrink-0 ${
                  activeTooltip.statusBadge.neutral
                    ? "text-slate-400 bg-slate-900 border-slate-700"
                    : activeTooltip.statusBadge.favorable
                    ? "text-emerald-300 bg-emerald-950/60 border-emerald-500/40"
                    : "text-rose-300 bg-rose-950/60 border-rose-500/40"
                }`}
              >
                {activeTooltip.statusBadge.text}
              </span>
            )}
          </div>

          {/* Stats Rows */}
          {activeTooltip.stats && activeTooltip.stats.length > 0 && (
            <div className="space-y-1 mb-2 font-mono text-xs">
              {activeTooltip.stats.map((st, sIdx) => (
                <div key={sIdx} className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">{st.label}:</span>
                  <span
                    className={`font-semibold ${
                      st.highlight ? "text-cyan-300 font-bold" : "text-slate-200"
                    }`}
                    style={st.color ? { color: st.color } : undefined}
                  >
                    {st.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Plain English Explanation */}
          <div className="pt-1.5 border-t border-slate-800/80 text-[11px] font-sans text-slate-300 leading-snug">
            {activeTooltip.explanation}
          </div>
        </div>
      )}
    </div>
  );
}
