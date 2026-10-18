"use client";

import React, { useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, CheckCircle2, ArrowRightLeft, Layers } from "lucide-react";
import { WhatChangedDecomposition, WhatChangedDriver } from "@/lib/types";

interface WhatChangedPanelProps {
  decomposition: WhatChangedDecomposition;
  theme?: "dark" | "light";
}

export function WhatChangedPanel({ decomposition, theme = "dark" }: WhatChangedPanelProps) {
  const [hoveredDriverIdx, setHoveredDriverIdx] = useState<number | null>(null);

  if (!decomposition) return null;

  const rawDrivers = decomposition.drivers || [];
  // Filter meaningful drivers with abs(delta) >= 0.05
  const activeDrivers = rawDrivers.filter((d) => Math.abs(Number(d.delta || 0)) >= 0.05);
  const hasDrivers = activeDrivers.length > 0;

  // Chart layout calculations
  const rowSpacing = 26;
  const barHeight = 14;
  const activeCount = Math.min(5, activeDrivers.length);
  const chartHeight = Math.max(110, activeCount * rowSpacing + 18);
  const chartWidth = 580;
  const labelWidth = 180;
  const valueTagWidth = 70;
  const barAreaWidth = chartWidth - labelWidth - valueTagWidth;
  const zeroX = labelWidth + barAreaWidth / 2;

  const rawMax = activeDrivers.length > 0 ? Math.max(...activeDrivers.map((d) => Math.abs(Number(d.delta || 0)))) : 1.0;
  const maxAbsDelta = Math.max(1.0, rawMax * 1.25);

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all shadow-md h-[525px] flex flex-col justify-between overflow-hidden ${
        theme === "dark"
          ? "bg-[#0b1222]/95 border-cyan-500/25 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-sm"
      }`}
    >
      <div>
        {/* ── Header Strip ── */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-inherit">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-tight font-mono whitespace-nowrap">
                {decomposition.title || "WHAT CHANGED? ATTRIBUTION"}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Diverging factor variance & waterfall attribution</p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold border whitespace-nowrap ${
                decomposition.direction === "favorable"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : decomposition.direction === "unfavorable"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
              }`}
            >
              {decomposition.total_change_str || "0.0 pp"}
            </span>
          </div>
        </div>

      {/* ── Executive Narrative Card ── */}
      <div
        className={`mb-2 p-2 rounded-lg border text-xs leading-relaxed transition-all ${
          theme === "dark"
            ? "bg-gradient-to-r from-slate-900/90 via-[#0b1528] to-slate-900/90 border-slate-800/80 text-slate-200"
            : "bg-gradient-to-r from-slate-50 to-cyan-50/20 border-slate-200 text-slate-700"
        }`}
      >
        <p className="font-semibold text-xs mb-0.5 text-cyan-300 flex items-center gap-1.5">
          <ArrowRightLeft className="h-3 w-3 text-cyan-400" />
          <span>{decomposition.headline || "Baseline Period Established"}</span>
        </p>
        <p className="text-[11px] text-slate-400 leading-normal">{decomposition.summary}</p>
      </div>

      {/* ── Diverging Horizontal Waterfall / Bar Chart (Desktop Parity) ── */}
      {hasDrivers ? (
        <div className="mb-2 p-2 rounded-lg border border-slate-800/60 bg-[#070b14]/80">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5 px-1">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ◀ Favorable / Improving
            </span>
            <span className="text-slate-500 font-semibold">Center: 0.0 pp</span>
            <span className="flex items-center gap-1 text-rose-400">
              Adverse / Deteriorating ▶
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            </span>
          </div>

          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto select-none overflow-visible">
            <defs>
              <linearGradient id="roseBarGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#fb7185" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="emeraldBarGrad" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.95" />
              </linearGradient>
              <filter id="driverBarGlow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Zero Axis Reference Line */}
            <line
              x1={zeroX}
              y1={6}
              x2={zeroX}
              y2={chartHeight - 6}
              stroke={theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />

            {/* Render Diverging Horizontal Bars */}
            {activeDrivers.slice(0, 5).map((d, idx) => {
              const deltaNum = Number(d.delta || 0);
              const isAdverse = d.is_adverse !== undefined ? d.is_adverse : deltaNum > 0;
              const barPixelWidth = Math.max(4, (Math.abs(deltaNum) / maxAbsDelta) * (barAreaWidth / 2));
              const y = 10 + idx * rowSpacing;
              const isHovered = hoveredDriverIdx === idx;

              // If delta is adverse (usually positive in swipe rate), extends RIGHT from zeroX
              // If delta is favorable (usually negative in swipe rate), extends LEFT from zeroX
              const barX = isAdverse ? zeroX : zeroX - barPixelWidth;
              const barColor = isAdverse ? "url(#roseBarGrad)" : "url(#emeraldBarGrad)";
              const textColor = isAdverse ? "#fb7185" : "#34d399";
              const driverName = d.driver || d.entity || d.name || "Driver";
              const tagText = d.formatted_delta || d.delta_str || `${deltaNum > 0 ? "+" : ""}${deltaNum.toFixed(1)} pp`;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredDriverIdx(idx)}
                  onMouseLeave={() => setHoveredDriverIdx(null)}
                  className="cursor-pointer transition-opacity duration-150"
                  opacity={hoveredDriverIdx === null || isHovered ? 1 : 0.65}
                >
                  {/* Subtle row highlight on hover */}
                  {isHovered && (
                    <rect
                      x={2}
                      y={y - 4}
                      width={chartWidth - 4}
                      height={barHeight + 8}
                      rx="4"
                      fill={theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}
                    />
                  )}

                  {/* Y-Axis Driver Label (Left-aligned) */}
                  <text
                    x={labelWidth - 10}
                    y={y + 11}
                    textAnchor="end"
                    fill={isHovered ? (theme === "dark" ? "#ffffff" : "#0f172a") : theme === "dark" ? "#cbd5e1" : "#334155"}
                    fontSize="11"
                    fontWeight={isHovered ? "700" : "600"}
                    fontFamily="monospace"
                  >
                    <title>{driverName}</title>
                    {driverName.length > 26 ? `${driverName.slice(0, 24)}…` : driverName}
                  </text>

                  {/* Horizontal Bar */}
                  <rect
                    x={barX}
                    y={y}
                    width={barPixelWidth}
                    height={barHeight}
                    rx="3"
                    fill={barColor}
                    filter={isHovered ? "url(#driverBarGlow)" : undefined}
                  />

                  {/* Value Tag beside the bar */}
                  <text
                    x={isAdverse ? barX + barPixelWidth + 6 : barX - 6}
                    textAnchor={isAdverse ? "start" : "end"}
                    y={y + 11}
                    fill={textColor}
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {tagText}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        /* Baseline Period Notice (Exact Parity with Desktop shell) */
        <div className="mb-2 py-3 px-3.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 flex items-center gap-2 text-xs text-emerald-400 font-mono">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>✓ Baseline period established • Stable trajectory across active scope</span>
        </div>
      )}
      </div>

      {/* ── Driver Breakdown Cards Strip ── */}
      {hasDrivers && (
        <div className="space-y-1 mt-1">
          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
            <span>Primary Entity Drivers</span>
            <span>Contribution Weight</span>
          </div>
          {activeDrivers.slice(0, 3).map((driver, idx) => {
            const deltaNum = Number(driver.delta || 0);
            const isAdverse = driver.is_adverse !== undefined ? driver.is_adverse : deltaNum > 0;
            const driverTitle = driver.driver || driver.entity || driver.name || "Entity";

            return (
              <div
                key={idx}
                className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg border text-xs transition-colors ${
                  theme === "dark"
                    ? "bg-slate-900/40 border-slate-800/80 hover:border-cyan-500/30"
                    : "bg-slate-50 border-slate-200/80 hover:border-cyan-500/30"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1 rounded-md shrink-0 ${
                      isAdverse ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {isAdverse ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-xs text-slate-200" title={driverTitle}>{driverTitle}</span>
                    {driver.summary && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5" title={driver.summary}>{driver.summary}</p>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0 font-mono text-[11px]">
                  <span className={isAdverse ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                    {driver.formatted_delta || `${deltaNum > 0 ? "+" : ""}${deltaNum.toFixed(1)} pp`}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {driver.contribution_str || `${driver.contribution_pct || 0}% weight`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
