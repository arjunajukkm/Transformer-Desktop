"use client";

import React, { useState } from "react";
import { TrendingUp, Info, AlertCircle, ShieldAlert } from "lucide-react";
import { TrendChartPoint } from "@/lib/types";

interface MainTrendChartProps {
  points: TrendChartPoint[];
  metricName: string;
  metricFormat: string;
  benchmarkLabel: string;
  entityLabel: string;
  policyEffectiveDate?: string;
  unit?: string;
}

export function MainTrendChart({
  points,
  metricName,
  metricFormat,
  benchmarkLabel,
  entityLabel,
  policyEffectiveDate,
  unit,
}: MainTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!points || points.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-slate-400 min-h-[340px] flex flex-col items-center justify-center">
        <Info className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-sm font-medium">No time-series observations available for this selection.</p>
        <p className="text-xs text-slate-500 mt-1">Try broadening your business unit or department filter.</p>
      </div>
    );
  }

  // Chart dimensions & coordinates
  const height = 280;
  const width = 800;
  const paddingX = 60;
  const paddingY = 40;

  // Extract all valid numeric values for Y range
  const allVals = points.flatMap((p) => [p.actual, p.benchmark]).filter((v): v is number => v !== null && !isNaN(v));

  let minVal = allVals.length > 0 ? Math.min(...allVals) : 0;
  let maxVal = allVals.length > 0 ? Math.max(...allVals) : 100;

  // Add buffer
  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - 10);
    maxVal = maxVal + 10;
  } else {
    const span = maxVal - minVal;
    minVal = Math.max(0, minVal - span * 0.15);
    maxVal = maxVal + span * 0.2;
  }

  const getY = (val: number | null) => {
    if (val === null || isNaN(val)) return height - paddingY;
    const norm = (val - minVal) / (maxVal - minVal || 1);
    return height - paddingY - norm * (height - paddingY * 2);
  };

  const getX = (idx: number) => {
    if (points.length <= 1) return width / 2;
    return paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
  };

  // Build SVG Path strings
  const actualCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.actual), hasVal: p.actual !== null }));
  const benchCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.benchmark), hasVal: p.benchmark !== null }));

  const actualPath = actualCoords
    .filter((c) => c.hasVal)
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const benchPath = benchCoords
    .filter((c) => c.hasVal)
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  // Gradient area underneath actual path
  const areaPath =
    actualCoords.filter((c) => c.hasVal).length > 0
      ? `${actualPath} L ${actualCoords[actualCoords.length - 1].x.toFixed(1)} ${height - paddingY} L ${actualCoords[0].x.toFixed(1)} ${height - paddingY} Z`
      : "";

  return (
    <div className="glass-panel p-5 mb-6">
      {/* Chart Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white tracking-tight">{metricName} — Trajectory & Benchmark</h3>
            {unit && <span className="text-xs text-slate-500 font-mono">({unit})</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Scope Actual ({entityLabel}) vs {benchmarkLabel} Baseline
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2.5 w-6 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span>Actual ({entityLabel})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="h-0.5 w-6 border-t-2 border-dashed border-amber-400" />
            <span>{benchmarkLabel} Baseline</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] select-none"
        >
          <defs>
            <linearGradient id="actualAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = height - paddingY - pct * (height - paddingY * 2);
            const val = minVal + pct * (maxVal - minVal);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val.toFixed(metricFormat === "percentage" ? 1 : 0)}
                  {metricFormat === "percentage" ? "%" : ""}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#actualAreaGrad)" />}

          {/* Benchmark line */}
          {benchPath && (
            <path
              d={benchPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="5 4"
              opacity="0.85"
            />
          )}

          {/* Actual line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3"
              filter="url(#glowFilter)"
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const x = getX(idx);
            const yAct = getY(p.actual);
            const yBn = getY(p.benchmark);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Benchmark dot */}
                {p.benchmark !== null && (
                  <circle cx={x} cy={yBn} r="3.5" fill="#0b0f17" stroke="#f59e0b" strokeWidth="2" />
                )}

                {/* Actual dot */}
                {p.actual !== null && (
                  <circle
                    cx={x}
                    cy={yAct}
                    r={isHovered ? "6" : "4.5"}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? "2.5" : "1.5"}
                    className="transition-all duration-150"
                  />
                )}

                {/* Regression alert ring */}
                {p.is_regression && p.actual !== null && (
                  <circle
                    cx={x}
                    cy={yAct}
                    r="9"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                    className="animate-ping opacity-75"
                  />
                )}

                {/* X Axis period label */}
                <text
                  x={x}
                  y={height - paddingY + 22}
                  textAnchor="middle"
                  fill={isHovered ? "#38bdf8" : "#94a3b8"}
                  fontSize="11"
                  fontWeight={isHovered ? "600" : "500"}
                  fontFamily="sans-serif"
                >
                  {p.period_display}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute top-4 right-6 bg-slate-950/95 border border-cyan-500/40 p-3.5 rounded-lg shadow-2xl text-xs z-20 min-w-[210px] pointer-events-none animate-fadeIn"
          >
            <div className="font-bold text-white text-sm mb-1 pb-1 border-b border-white/10 flex items-center justify-between">
              <span>{points[hoveredIdx].period_display}</span>
              {points[hoveredIdx].is_regression && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> Regression
                </span>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-cyan-400 font-medium">Actual ({entityLabel}):</span>
                <span className="text-white font-mono font-bold text-sm">
                  {points[hoveredIdx].actual_formatted}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span>{benchmarkLabel}:</span>
                <span className="text-amber-300 font-mono">
                  {points[hoveredIdx].benchmark_formatted}
                </span>
              </div>

              {points[hoveredIdx].gap_vs_org_formatted && (
                <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[11px]">
                  <span className="text-slate-400">Gap vs Baseline:</span>
                  <span className="font-mono text-slate-200">
                    {points[hoveredIdx].gap_vs_org_formatted}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                <span>Observations:</span>
                <span className="font-mono">{points[hoveredIdx].evaluable.toLocaleString()} events</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
