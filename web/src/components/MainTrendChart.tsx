"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
  ShieldAlert,
  Calendar,
  Layers,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  X,
} from "lucide-react";
import { TrendChartPoint } from "@/lib/types";
import { formatToMMMYY } from "./BusinessUnitHeatmap";

interface MainTrendChartProps {
  points: TrendChartPoint[];
  metricName: string;
  metricFormat: string;
  benchmarkLabel: string;
  entityLabel: string;
  policyEffectiveDate?: string;
  unit?: string;
  theme?: "dark" | "light";
  referenceRange?: [number, number] | null;
  comparisonMode?: string;
  deptLabel?: string;
  buLabel?: string;
  orgLabel?: string;
  peerLabel?: string;
  metricId?: string;
  metricDirection?: string;
}

// Catmull-Rom to Cubic Bezier curve path generator
function buildSmoothPath(coords: { x: number; y: number; hasVal: boolean }[]): string {
  const valid = coords.filter((c) => c.hasVal);
  if (valid.length === 0) return "";
  if (valid.length === 1) return `M ${valid[0].x.toFixed(1)} ${valid[0].y.toFixed(1)}`;
  if (valid.length === 2) {
    return `M ${valid[0].x.toFixed(1)} ${valid[0].y.toFixed(1)} L ${valid[1].x.toFixed(1)} ${valid[1].y.toFixed(1)}`;
  }

  let d = `M ${valid[0].x.toFixed(1)} ${valid[0].y.toFixed(1)}`;
  const tension = 0.2;

  for (let i = 0; i < valid.length - 1; i++) {
    const p0 = valid[Math.max(0, i - 1)];
    const p1 = valid[i];
    const p2 = valid[i + 1];
    const p3 = valid[Math.min(valid.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

export function MainTrendChart({
  points,
  metricName,
  metricFormat,
  benchmarkLabel,
  entityLabel,
  policyEffectiveDate,
  unit,
  theme = "dark",
  referenceRange,
  comparisonMode,
  deptLabel = "Department",
  buLabel = "Business Unit",
  orgLabel = "Organisation",
  peerLabel,
}: MainTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Series visibility toggles for executive customization
  const [visibleSeries, setVisibleSeries] = useState({
    actual: true,
    benchmark: true,
    historical: true,
    peer: true,
    dept: true,
    bu: true,
    org: true,
    corridor: true,
    leaveMgr: true,
    leaveAdmin: true,
    wfhMgr: true,
    wfhAdmin: true,
  });

  const isContextual =
    comparisonMode === "EMPLOYEE" ||
    comparisonMode === "MANAGER" ||
    (points && points.some((p) => p.dept_benchmark !== null && p.dept_benchmark !== undefined));

  const isApprovalMetric =
    metricName.toLowerCase().includes("approval") ||
    metricName.toLowerCase().includes("turnaround") ||
    points.some(
      (p) =>
        (p.leave_mgr !== null && p.leave_mgr !== undefined) ||
        (p.wfh_mgr !== null && p.wfh_mgr !== undefined)
    );

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!points || points.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-slate-400 min-h-[340px] flex flex-col items-center justify-center">
        <Info className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-sm font-medium">No time-series observations available for this selection.</p>
        <p className="text-xs text-slate-500 mt-1">Try broadening your business unit or department filter.</p>
      </div>
    );
  }

  // Chart layout dimensions
  const height = 300;
  const width = 840;
  const paddingX = 65;
  const paddingY = 45;

  const hasPeer = Boolean(
    peerLabel &&
    peerLabel.trim() &&
    points &&
    points.some((p) => p.peer_comparison !== null && p.peer_comparison !== undefined)
  );

  // Extract all active numeric values across all series to compute tight Y-bounds
  const allNumericVals: number[] = [];
  points.forEach((p) => {
    if (p.actual !== null && !isNaN(p.actual)) allNumericVals.push(p.actual);
    if (p.benchmark !== null && !isNaN(p.benchmark)) allNumericVals.push(p.benchmark);
    if (p.historical !== null && !isNaN(p.historical)) allNumericVals.push(p.historical);
    if (p.dept_benchmark !== null && !isNaN(p.dept_benchmark)) allNumericVals.push(p.dept_benchmark);
    if (p.bu_benchmark !== null && !isNaN(p.bu_benchmark)) allNumericVals.push(p.bu_benchmark);
    if (p.org_benchmark !== null && !isNaN(p.org_benchmark)) allNumericVals.push(p.org_benchmark);
    if (hasPeer && p.peer_comparison !== null && p.peer_comparison !== undefined && !isNaN(p.peer_comparison)) {
      allNumericVals.push(p.peer_comparison);
    }
    if (isApprovalMetric) {
      if (p.leave_mgr !== null && p.leave_mgr !== undefined && !isNaN(p.leave_mgr)) allNumericVals.push(p.leave_mgr);
      if (p.leave_admin !== null && p.leave_admin !== undefined && !isNaN(p.leave_admin)) allNumericVals.push(p.leave_admin);
      if (p.wfh_mgr !== null && p.wfh_mgr !== undefined && !isNaN(p.wfh_mgr)) allNumericVals.push(p.wfh_mgr);
      if (p.wfh_admin !== null && p.wfh_admin !== undefined && !isNaN(p.wfh_admin)) allNumericVals.push(p.wfh_admin);
    }
  });

  if (referenceRange && referenceRange[0] !== null && referenceRange[1] !== null) {
    allNumericVals.push(referenceRange[0], referenceRange[1]);
  }

  let minVal = allNumericVals.length > 0 ? Math.min(...allNumericVals) : 0;
  let maxVal = allNumericVals.length > 0 ? Math.max(...allNumericVals) : 100;
  const hasNegative = minVal < 0 || allNumericVals.some((v) => v < 0);

  // Dynamic scale padding: cleanly accommodates negative movements (e.g. days before leave)
  if (minVal === maxVal) {
    if (hasNegative) {
      minVal = minVal - 5;
    } else {
      minVal = Math.max(0, minVal - 5);
    }
    maxVal = maxVal + 5;
  } else {
    const span = maxVal - minVal;
    if (hasNegative) {
      minVal = minVal - span * 0.18;
    } else {
      minVal = Math.max(0, minVal - span * 0.15);
    }
    maxVal = maxVal + span * 0.22;
  }

  const getY = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return height - paddingY;
    const norm = (val - minVal) / (maxVal - minVal || 1);
    return height - paddingY - norm * (height - paddingY * 2);
  };

  const getX = (idx: number) => {
    if (points.length <= 1) return width / 2;
    return paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
  };

  // Coordinates arrays
  const actualCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.actual), hasVal: p.actual !== null }));
  const benchCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.benchmark), hasVal: p.benchmark !== null }));
  const histCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.historical), hasVal: p.historical !== null }));
  const deptCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.dept_benchmark), hasVal: p.dept_benchmark !== null }));
  const buCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.bu_benchmark), hasVal: p.bu_benchmark !== null }));
  const orgCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.org_benchmark), hasVal: p.org_benchmark !== null }));
  const peerCoords = points.map((p, i) => ({
    x: getX(i),
    y: getY(p.peer_comparison),
    hasVal: p.peer_comparison !== null && p.peer_comparison !== undefined,
  }));

  // Approval breakdown coordinates
  const leaveMgrCoords = points.map((p, i) => ({
    x: getX(i),
    y: getY(p.leave_mgr),
    hasVal: p.leave_mgr !== null && p.leave_mgr !== undefined,
  }));
  const leaveAdminCoords = points.map((p, i) => ({
    x: getX(i),
    y: getY(p.leave_admin),
    hasVal: p.leave_admin !== null && p.leave_admin !== undefined,
  }));
  const wfhMgrCoords = points.map((p, i) => ({
    x: getX(i),
    y: getY(p.wfh_mgr),
    hasVal: p.wfh_mgr !== null && p.wfh_mgr !== undefined,
  }));
  const wfhAdminCoords = points.map((p, i) => ({
    x: getX(i),
    y: getY(p.wfh_admin),
    hasVal: p.wfh_admin !== null && p.wfh_admin !== undefined,
  }));

  // Smooth spline paths
  const actualPath = buildSmoothPath(actualCoords);
  const benchPath = buildSmoothPath(benchCoords);
  const histPath = buildSmoothPath(histCoords);
  const deptPath = buildSmoothPath(deptCoords);
  const buPath = buildSmoothPath(buCoords);
  const orgPath = buildSmoothPath(orgCoords);
  const peerPath = buildSmoothPath(peerCoords);

  const leaveMgrPath = buildSmoothPath(leaveMgrCoords);
  const leaveAdminPath = buildSmoothPath(leaveAdminCoords);
  const wfhMgrPath = buildSmoothPath(wfhMgrCoords);
  const wfhAdminPath = buildSmoothPath(wfhAdminCoords);

  // Gradient area fill underneath actual curve
  const validActual = actualCoords.filter((c) => c.hasVal);
  const areaPath =
    validActual.length > 1
      ? `${actualPath} L ${validActual[validActual.length - 1].x.toFixed(1)} ${height - paddingY} L ${validActual[0].x.toFixed(1)} ${height - paddingY} Z`
      : "";

  // Corridor bounds
  const corridorTopY = referenceRange && referenceRange[1] !== null ? getY(referenceRange[1]) : null;
  const corridorBottomY = referenceRange && referenceRange[0] !== null ? getY(referenceRange[0]) : null;

  // Active hovered point details
  const activePt = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-md h-full flex flex-col justify-between ${
        theme === "dark"
          ? "bg-[#0b1222]/95 border-cyan-500/25 text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-sm"
      }`}
    >
      <div>
        {/* ── Top Header Strip ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2.5 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h3
                className={`font-bold text-xs uppercase tracking-tight font-mono whitespace-nowrap ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}
              >
                {metricName}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                TRAJECTORY &amp; BENCHMARKS
              </span>
              {unit && <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">({unit})</span>}
            </div>
            <p className={`text-[11px] mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {isContextual
                ? `${entityLabel} vs Department, Business Unit & Organisation Baselines`
                : `Actual (${entityLabel}) vs ${benchmarkLabel} Baseline • Trailing trajectory`}
            </p>
          </div>

        {/* ── Interactive Legend with Visibility Toggles ── */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono select-none">
          {/* Actual Series Toggle */}
          <button
            onClick={() => toggleSeries("actual")}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
              visibleSeries.actual
                ? theme === "dark"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "bg-cyan-50 text-cyan-800 border border-cyan-300 font-semibold"
                : "opacity-40 text-slate-500"
            }`}
            title="Toggle Actual trend"
          >
            <span className="h-2 w-4 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span>Actual</span>
          </button>

          {isApprovalMetric ? (
            <>
              {/* Leave - Manager Toggle */}
              <button
                onClick={() => toggleSeries("leaveMgr")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.leaveMgr
                    ? "bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Leave approved by Manager"
              >
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <span>Leave (Mgr)</span>
              </button>

              {/* Leave - Admin Toggle */}
              <button
                onClick={() => toggleSeries("leaveAdmin")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.leaveAdmin
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Leave approved by Admin"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>Leave (Admin)</span>
              </button>

              {/* WFH - Manager Toggle */}
              <button
                onClick={() => toggleSeries("wfhMgr")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.wfhMgr
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle WFH approved by Manager"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>WFH (Mgr)</span>
              </button>

              {/* WFH - Admin Toggle */}
              <button
                onClick={() => toggleSeries("wfhAdmin")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.wfhAdmin
                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle WFH approved by Admin"
              >
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                <span>WFH (Admin)</span>
              </button>
            </>
          ) : isContextual ? (
            <>
              {/* Dept Benchmark */}
              <button
                onClick={() => toggleSeries("dept")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.dept
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Department benchmark"
              >
                <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-400" />
                <span>Dept</span>
              </button>

              {/* BU Benchmark */}
              <button
                onClick={() => toggleSeries("bu")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.bu
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Business Unit benchmark"
              >
                <span className="h-0.5 w-4 border-t-2 border-dotted border-emerald-400" />
                <span>BU</span>
              </button>

              {/* Org Benchmark */}
              <button
                onClick={() => toggleSeries("org")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.org
                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Organisation benchmark"
              >
                <span className="h-0.5 w-4 border-t-2 border-dotted border-purple-400" />
                <span>Org</span>
              </button>
            </>
          ) : (
            <>
              {/* Standard Benchmark Toggle */}
              <button
                onClick={() => toggleSeries("benchmark")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.benchmark
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Benchmark line"
              >
                <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-400" />
                <span>{benchmarkLabel}</span>
              </button>

              {/* Historical Baseline Toggle */}
              <button
                onClick={() => toggleSeries("historical")}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  visibleSeries.historical
                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold"
                    : "opacity-40 text-slate-500"
                }`}
                title="Toggle Historical baseline"
              >
                <span className="h-0.5 w-4 border-t-2 border-dotted border-rose-400" />
                <span>Historical</span>
              </button>
            </>
          )}

          {/* User-Selected Peer Comparison Toggle */}
          {hasPeer && (
            <button
              onClick={() => toggleSeries("peer")}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                visibleSeries.peer
                  ? theme === "dark"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold"
                  : "opacity-40 text-slate-500"
              }`}
              title={`Toggle ${peerLabel || "Peer"} comparison`}
            >
              <span className="h-2 w-4 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span>{peerLabel || "Peer"}</span>
            </button>
          )}

          {/* Reference Corridor Toggle */}
          {corridorTopY !== null && corridorBottomY !== null && (
            <button
              onClick={() => toggleSeries("corridor")}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                visibleSeries.corridor
                  ? "bg-slate-700/40 text-slate-200 border border-slate-600/60 font-semibold"
                  : "opacity-40 text-slate-500"
              }`}
              title="Toggle Normal SLA / Tolerance band"
            >
              <span className="h-2 w-3 rounded bg-slate-500/50" />
              <span>Tolerance Corridor</span>
            </button>
          )}

          {/* Quick Guide Trigger Button */}
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              showGuide
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                : "bg-slate-800/50 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600"
            }`}
            title="Click to view/hide chart interpretation guide"
          >
            <HelpCircle className="h-3 w-3 text-cyan-400" />
            <span>Guide</span>
          </button>
        </div>
      </div>

      {/* ── Expandable Quick Guide Card ── */}
      {showGuide && (
        <div className="mb-3 p-3 rounded-lg bg-slate-900/95 border border-cyan-500/35 text-xs shadow-xl backdrop-blur-md transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 text-[11px] text-slate-300 w-full">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300 font-mono text-xs">
                <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>How to Read this Trend Chart:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 font-sans text-xs">
                {/* Card 1: Actual Line */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="h-2 w-4 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)] inline-block" />
                      <span className="text-cyan-300 font-mono font-bold text-[10.5px] uppercase">
                        Actual Trajectory
                      </span>
                    </div>
                    <p className="text-slate-300 text-[10.5px] leading-snug">
                      Actual monthly performance for {entityLabel || "selected scope"}. Filled nodes mark monthly readings; spline curve reflects momentum.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">SOLID CYAN LINE</span>
                </div>

                {/* Card 2: Benchmark Line */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-400 inline-block" />
                      <span className="text-amber-300 font-mono font-bold text-[10.5px] uppercase">
                        Benchmark Baseline
                      </span>
                    </div>
                    <p className="text-slate-300 text-[10.5px] leading-snug">
                      Comparison cohort baseline ({benchmarkLabel || "Organisation"}). Distance between Actual and Benchmark reveals relative advantage or deficit.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">DASHED AMBER LINE</span>
                </div>

                {/* Card 3: Historical Baseline */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="h-0.5 w-4 border-t-2 border-dotted border-rose-400 inline-block" />
                      <span className="text-rose-300 font-mono font-bold text-[10.5px] uppercase">
                        Historical Baseline
                      </span>
                    </div>
                    <p className="text-slate-300 text-[10.5px] leading-snug">
                      Pre-policy long-term median anchor. Shows if modern trends represent sustained shifts from prior operational norms.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">DOTTED ROSE LINE</span>
                </div>

                {/* Card 4: Policy Effective Date */}
                {policyEffectiveDate && (
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="h-3 w-3 text-rose-400" />
                        <span className="text-rose-400 font-mono font-bold text-[10.5px] uppercase">
                          Policy Date ({policyEffectiveDate})
                        </span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] leading-snug">
                        Vertical dashed marker indicating policy enactment. Compare the curve slope before vs after this marker to measure policy impact.
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">VERTICAL RED LINE</span>
                  </div>
                )}

                {/* Card 5: Tolerance Corridor */}
                {referenceRange && (
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="h-2 w-3 rounded bg-slate-500/50 inline-block" />
                        <span className="text-slate-300 font-mono font-bold text-[10.5px] uppercase">
                          Tolerance Corridor
                        </span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] leading-snug">
                        Standard SLA operational envelope. Points falling inside this shaded band meet expected corporate performance tolerances.
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">SHADED SLA BAND</span>
                  </div>
                )}

                {/* Card 6: Peer / Approvals / Interactive Tips */}
                {hasPeer ? (
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="h-2 w-4 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] inline-block" />
                        <span className="text-emerald-300 font-mono font-bold text-[10.5px] uppercase">
                          Peer Comparison
                        </span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] leading-snug">
                        Side-by-side trajectory for {peerLabel} to evaluate direct parity and competitiveness.
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">SOLID EMERALD LINE</span>
                  </div>
                ) : isApprovalMetric ? (
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="h-3 w-3 text-purple-400" />
                        <span className="text-purple-300 font-mono font-bold text-[10.5px] uppercase">
                          Multi-Tier Approvals
                        </span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] leading-snug">
                        Compares turnaround speeds between Manager vs Admin approval tiers across Leave and WFH requests.
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">TIER COMPARISONS</span>
                  </div>
                ) : (
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="h-3 w-3 text-cyan-400" />
                        <span className="text-cyan-300 font-mono font-bold text-[10.5px] uppercase">
                          Point Inspection
                        </span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] leading-snug">
                        Hover over any monthly node on the chart to inspect the active metric value, sample count, and benchmark delta in the bottom strip.
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">INTERACTIVE HUD</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>
                  Tip: Click any series pill in the toolbar above to isolate or hide individual lines. Hover over nodes to inspect details.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer shrink-0"
              title="Close guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── SVG Canvas Viewport ── */}
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[620px] select-none">
          <defs>
            {/* Multi-stop atmospheric glow gradients */}
            <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f5ff" stopOpacity={theme === "dark" ? "0.32" : "0.22"} />
              <stop offset="65%" stopColor="#0284c7" stopOpacity={theme === "dark" ? "0.10" : "0.06"} />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            <filter id="neonSplineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="emeraldSplineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Reference Normal Range Corridor Band (Desktop Parity) */}
          {visibleSeries.corridor && corridorTopY !== null && corridorBottomY !== null && (
            <g className="transition-opacity duration-200">
              <rect
                x={paddingX}
                y={corridorTopY}
                width={width - paddingX * 2}
                height={Math.max(4, corridorBottomY - corridorTopY)}
                fill={theme === "dark" ? "rgba(51, 65, 85, 0.28)" : "rgba(226, 232, 240, 0.6)"}
                stroke={theme === "dark" ? "rgba(100, 116, 139, 0.45)" : "rgba(148, 163, 184, 0.65)"}
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <text
                x={width - paddingX - 8}
                y={corridorTopY - 5}
                textAnchor="end"
                fill={theme === "dark" ? "#94a3b8" : "#475569"}
                fontSize="9"
                fontWeight="600"
                fontFamily="monospace"
              >
                Normal Tolerance Band ({referenceRange?.[0]}{metricFormat === "percentage" ? "%" : ""} – {referenceRange?.[1]}{metricFormat === "percentage" ? "%" : ""})
              </text>
            </g>
          )}

          {/* 2. Grid lines & Numeric Y-Axis Scale */}
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
                  stroke={theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill={theme === "dark" ? "#94a3b8" : "#64748b"}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {val.toFixed(metricFormat === "percentage" ? 1 : 0)}
                  {metricFormat === "percentage" ? "%" : ""}
                </text>
              </g>
            );
          })}

          {/* Zero Baseline (for timing compliance & negative movements) */}
          {minVal < 0 && maxVal > 0 && (
            <g>
              <line
                x1={paddingX}
                y1={getY(0)}
                x2={width - paddingX}
                y2={getY(0)}
                stroke={theme === "dark" ? "rgba(0, 245, 255, 0.45)" : "rgba(2, 132, 199, 0.45)"}
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text
                x={width - paddingX - 4}
                y={getY(0) - 4}
                textAnchor="end"
                fill={theme === "dark" ? "#38bdf8" : "#0284c7"}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                0.0 (Event Date)
              </text>
            </g>
          )}

          {/* 4. Atmospheric Gradient Area Fill */}
          {visibleSeries.actual && areaPath && <path d={areaPath} fill="url(#trendAreaGradient)" />}

          {/* 5. Benchmarks Spline Paths */}
          {/* A. Historical Baseline */}
          {!isContextual && !isApprovalMetric && visibleSeries.historical && histPath && (
            <path
              d={histPath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.2"
              strokeDasharray="5 3 2 3"
              opacity={theme === "dark" ? "0.9" : "0.8"}
            />
          )}



          {/* B. Organisation Benchmark (in contextual mode) */}
          {isContextual && !isApprovalMetric && visibleSeries.org && orgPath && (
            <path
              d={orgPath}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2"
              strokeDasharray="3 3"
              opacity={theme === "dark" ? "0.85" : "0.75"}
            />
          )}

          {/* C. Business Unit Benchmark (in contextual mode) */}
          {isContextual && !isApprovalMetric && visibleSeries.bu && buPath && (
            <path
              d={buPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="5 3 2 3"
              opacity={theme === "dark" ? "0.9" : "0.8"}
            />
          )}

          {/* D. Department Benchmark (in contextual mode) */}
          {isContextual && !isApprovalMetric && visibleSeries.dept && deptPath && (
            <path
              d={deptPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.2"
              strokeDasharray="5 3"
              opacity={theme === "dark" ? "0.95" : "0.85"}
            />
          )}

          {/* E. Standard Benchmark */}
          {!isContextual && !isApprovalMetric && visibleSeries.benchmark && benchPath && (
            <path
              d={benchPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.2"
              strokeDasharray="5 4"
              opacity={theme === "dark" ? "0.95" : "0.85"}
            />
          )}

          {/* F. Approval Breakdown Spline Paths */}
          {isApprovalMetric && visibleSeries.leaveMgr && leaveMgrPath && (
            <path
              d={leaveMgrPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.4"
              strokeDasharray="5 3"
              opacity={theme === "dark" ? "0.95" : "0.85"}
            />
          )}
          {isApprovalMetric && visibleSeries.leaveAdmin && leaveAdminPath && (
            <path
              d={leaveAdminPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.4"
              strokeDasharray="5 3"
              opacity={theme === "dark" ? "0.95" : "0.85"}
            />
          )}
          {isApprovalMetric && visibleSeries.wfhMgr && wfhMgrPath && (
            <path
              d={wfhMgrPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.4"
              strokeDasharray="5 3"
              opacity={theme === "dark" ? "0.95" : "0.85"}
            />
          )}
          {isApprovalMetric && visibleSeries.wfhAdmin && wfhAdminPath && (
            <path
              d={wfhAdminPath}
              fill="none"
              stroke="#c084fc"
              strokeWidth="2.4"
              strokeDasharray="5 3"
              opacity={theme === "dark" ? "0.95" : "0.85"}
            />
          )}

          {/* 6. Primary Spline Curves (Actual & Peer) */}
          {/* A. User-Selected Peer Comparison Path (Solid Spline matching Actual style in Emerald) */}
          {hasPeer && visibleSeries.peer && peerPath && (
            <path
              d={peerPath}
              fill="none"
              stroke={theme === "dark" ? "#10b981" : "#059669"}
              strokeWidth="3.2"
              filter={theme === "dark" ? "url(#emeraldSplineGlow)" : undefined}
            />
          )}

          {/* B. Primary Actual Spline Curve (Smooth Monotone Cubic in Cyan) */}
          {visibleSeries.actual && actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke={theme === "dark" ? "#00f5ff" : "#0284c7"}
              strokeWidth="3.2"
              filter={theme === "dark" ? "url(#neonSplineGlow)" : undefined}
            />
          )}

          {/* 7. Observation Node Rings & Hit Targets */}
          {points.map((p, idx) => {
            const x = getX(idx);
            const yAct = getY(p.actual);
            const yBn = getY(p.benchmark);
            const yDept = getY(p.dept_benchmark);
            const yBu = getY(p.bu_benchmark);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Vertical hover indicator line */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingY}
                    x2={x}
                    y2={height - paddingY}
                    stroke={theme === "dark" ? "rgba(0, 245, 255, 0.4)" : "rgba(2, 132, 199, 0.4)"}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Benchmark node cap */}
                {!isApprovalMetric && visibleSeries.benchmark && p.benchmark !== null && (
                  <circle
                    cx={x}
                    cy={yBn}
                    r="3.5"
                    fill={theme === "dark" ? "#090e1c" : "#ffffff"}
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                )}

                {/* Dept benchmark cap */}
                {isContextual && !isApprovalMetric && visibleSeries.dept && p.dept_benchmark !== null && (
                  <circle
                    cx={x}
                    cy={yDept}
                    r="3.5"
                    fill={theme === "dark" ? "#090e1c" : "#ffffff"}
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                )}

                {/* BU benchmark cap */}
                {isContextual && !isApprovalMetric && visibleSeries.bu && p.bu_benchmark !== null && (
                  <circle
                    cx={x}
                    cy={yBu}
                    r="3"
                    fill={theme === "dark" ? "#090e1c" : "#ffffff"}
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                )}

                {/* Approval breakdown node caps */}
                {isApprovalMetric && visibleSeries.leaveMgr && p.leave_mgr !== null && p.leave_mgr !== undefined && (
                  <circle cx={x} cy={getY(p.leave_mgr)} r="3" fill={theme === "dark" ? "#090e1c" : "#ffffff"} stroke="#38bdf8" strokeWidth="2" />
                )}
                {isApprovalMetric && visibleSeries.leaveAdmin && p.leave_admin !== null && p.leave_admin !== undefined && (
                  <circle cx={x} cy={getY(p.leave_admin)} r="3" fill={theme === "dark" ? "#090e1c" : "#ffffff"} stroke="#f59e0b" strokeWidth="2" />
                )}
                {isApprovalMetric && visibleSeries.wfhMgr && p.wfh_mgr !== null && p.wfh_mgr !== undefined && (
                  <circle cx={x} cy={getY(p.wfh_mgr)} r="3" fill={theme === "dark" ? "#090e1c" : "#ffffff"} stroke="#10b981" strokeWidth="2" />
                )}
                {isApprovalMetric && visibleSeries.wfhAdmin && p.wfh_admin !== null && p.wfh_admin !== undefined && (
                  <circle cx={x} cy={getY(p.wfh_admin)} r="3" fill={theme === "dark" ? "#090e1c" : "#ffffff"} stroke="#c084fc" strokeWidth="2" />
                )}

                {/* Peer comparison node & value badge (matching Actual node style) */}
                {hasPeer && visibleSeries.peer && p.peer_comparison !== null && p.peer_comparison !== undefined && (
                  <>
                    <circle
                      cx={x}
                      cy={getY(p.peer_comparison)}
                      r={isHovered ? "6.5" : "4.5"}
                      fill={theme === "dark" ? "#10b981" : "#059669"}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? "2.5" : "1.5"}
                      style={{
                        filter:
                          theme === "dark"
                            ? "drop-shadow(0 0 6px rgba(16, 185, 129, 0.9))"
                            : "drop-shadow(0 1px 2px rgba(5, 150, 105, 0.5))",
                      }}
                    />

                    {/* Value Badge on Peer Node */}
                    {(() => {
                      let anchor: "start" | "middle" | "end" = "middle";
                      let xPos = x;
                      if (idx === 0) {
                        anchor = "start";
                        xPos = x + 8;
                      } else if (idx === points.length - 1) {
                        anchor = "end";
                        xPos = x - 8;
                      }
                      const yPeer = getY(p.peer_comparison);
                      const diff = yAct - yPeer;
                      let labelY = yPeer - (isHovered ? 12 : 9);
                      if (Math.abs(diff) < 20) {
                        labelY = diff > 0 ? yPeer - 12 : yPeer + 16;
                      } else if (labelY < paddingY + 5) {
                        labelY = yPeer + 16;
                      }
                      return (
                        <text
                          x={xPos}
                          y={labelY}
                          textAnchor={anchor}
                          fill={theme === "dark" ? "#34d399" : "#059669"}
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {p.peer_comparison_formatted || `${p.peer_comparison}%`}
                        </text>
                      );
                    })()}
                  </>
                )}

                {/* Actual node */}
                {visibleSeries.actual && p.actual !== null && (
                  <>
                    <circle
                      cx={x}
                      cy={yAct}
                      r={isHovered ? "6.5" : "4.5"}
                      fill={theme === "dark" ? "#00f5ff" : "#0284c7"}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? "2.5" : "1.5"}
                      style={{
                        filter:
                          theme === "dark"
                            ? "drop-shadow(0 0 6px rgba(0, 245, 255, 0.9))"
                            : "drop-shadow(0 1px 2px rgba(2, 132, 199, 0.5))",
                      }}
                    />

                    {/* Value Badge on Node (Desktop Parity with Bound-Safe Anchoring) */}
                    {(() => {
                      let anchor: "start" | "middle" | "end" = "middle";
                      let xPos = x;
                      if (idx === 0) {
                        anchor = "start";
                        xPos = x + 8;
                      } else if (idx === points.length - 1) {
                        anchor = "end";
                        xPos = x - 8;
                      }
                      const labelY = yAct - (isHovered ? 12 : 9) < paddingY + 5 ? yAct + 16 : yAct - (isHovered ? 12 : 9);
                      return (
                        <text
                          x={xPos}
                          y={labelY}
                          textAnchor={anchor}
                          fill={theme === "dark" ? "#38bdf8" : "#0369a1"}
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {p.actual_formatted || `${p.actual}%`}
                        </text>
                      );
                    })()}
                  </>
                )}

                {/* Regression Alert Ring */}
                {p.is_regression && p.actual !== null && (
                  <circle
                    cx={x}
                    cy={yAct}
                    r="10"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                    className="animate-ping opacity-75"
                  />
                )}

                {/* Low-Volume Warning Ring */}
                {p.is_low_volume && p.actual !== null && (
                  <circle
                    cx={x}
                    cy={yAct}
                    r="8.5"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Period X-Axis Label */}
                <text
                  x={x}
                  y={height - paddingY + 22}
                  textAnchor="middle"
                  fill={
                    isHovered
                      ? theme === "dark"
                        ? "#00f5ff"
                        : "#0284c7"
                      : theme === "dark"
                      ? "#94a3b8"
                      : "#64748b"
                  }
                  fontSize="11"
                  fontWeight={isHovered ? "700" : "600"}
                  fontFamily="monospace"
                >
                  {formatToMMMYY(p.period_display || p.period)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      </div>

      {/* ── Rich Comparison HUD Strip (Desktop Inspection Parity) ── */}
      {activePt && (() => {
        const parseVal = (v: string | undefined | null) => {
          if (!v) return { val: "—", sub: null, raw: "" };
          const s = String(v).trim();
          const m = s.match(/^Applied\s+([\d\.]+)\s*(days?|d)\s*(before|after)\s*(.*)$/i);
          if (m) {
            const isAdv = m[3].toLowerCase() === "before";
            return {
              val: `${m[1]}d ${isAdv ? "in adv." : "retro"}`,
              sub: isAdv ? "In advance" : "Retroactive",
              raw: s,
            };
          }
          return { val: s, sub: null, raw: s };
        };

        const deptParsed = parseVal(activePt.dept_benchmark_formatted);
        const buParsed = parseVal(activePt.bu_benchmark_formatted);
        const orgParsed = parseVal(activePt.org_benchmark_formatted);
        const actParsed = parseVal(activePt.actual_formatted || (activePt.actual !== null ? `${activePt.actual}%` : "—"));
        const benchParsed = parseVal(activePt.benchmark_formatted);
        const histParsed = parseVal(activePt.historical_formatted);
        const peerParsed = parseVal(
          activePt.peer_comparison_formatted ||
            (activePt.peer_comparison !== null && activePt.peer_comparison !== undefined
              ? `${activePt.peer_comparison}%`
              : "—")
        );

        return (
          <div
            className={`mt-3 p-3 rounded-lg border text-xs font-mono grid grid-cols-2 sm:grid-cols-3 ${
              hasPeer ? "lg:grid-cols-7" : "lg:grid-cols-6"
            } gap-3 transition-all overflow-hidden ${
              theme === "dark"
                ? "bg-[#070b14]/90 border-slate-800 text-slate-300"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            {/* Period */}
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans whitespace-nowrap">Period</span>
              <span className="font-bold text-slate-200 mt-0.5 whitespace-nowrap truncate">{formatToMMMYY(activePt.period_display || activePt.period)}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-sans whitespace-nowrap truncate">{activePt.evaluable?.toLocaleString()} records</span>
            </div>

            {/* Actual Value */}
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title={`Actual observed rate for ${entityLabel}`}>
                Actual
              </span>
              <span className="font-bold text-cyan-300 text-sm mt-0.5 truncate block" title={activePt.actual_formatted || "—"}>
                {actParsed.val}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={actParsed.sub ? `${actParsed.sub}` : (activePt.is_regression ? "⚠ Regression alert" : "Observed rate")}>
                {actParsed.sub ? actParsed.sub : (activePt.is_regression ? "⚠ Regression alert" : "Observed rate")}
              </span>
            </div>

            {isApprovalMetric ? (
              <>
                {/* Leave - Manager */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-sky-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title="Leave approved by Manager">
                    Leave (Mgr)
                  </span>
                  <span className="font-bold text-sky-300 text-sm mt-0.5 truncate block" title={activePt.leave_mgr_formatted || "—"}>
                    {activePt.leave_mgr_formatted || "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans whitespace-nowrap truncate">Manager approval</span>
                </div>

                {/* Leave - Admin */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title="Leave approved by Admin">
                    Leave (Admin)
                  </span>
                  <span className="font-bold text-amber-300 text-sm mt-0.5 truncate block" title={activePt.leave_admin_formatted || "—"}>
                    {activePt.leave_admin_formatted || "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans whitespace-nowrap truncate">Admin approval</span>
                </div>

                {/* WFH - Manager */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title="WFH approved by Manager">
                    WFH (Mgr)
                  </span>
                  <span className="font-bold text-emerald-300 text-sm mt-0.5 truncate block" title={activePt.wfh_mgr_formatted || "—"}>
                    {activePt.wfh_mgr_formatted || "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans whitespace-nowrap truncate">Manager approval</span>
                </div>

                {/* WFH - Admin */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-purple-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title="WFH approved by Admin">
                    WFH (Admin)
                  </span>
                  <span className="font-bold text-purple-300 text-sm mt-0.5 truncate block" title={activePt.wfh_admin_formatted || "—"}>
                    {activePt.wfh_admin_formatted || "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans whitespace-nowrap truncate">Admin approval</span>
                </div>
              </>
            ) : isContextual ? (
              <>
                {/* Department Benchmark */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider font-sans whitespace-nowrap">Dept Baseline</span>
                  <span className="font-bold text-amber-300 mt-0.5 truncate block" title={activePt.dept_benchmark_formatted || "—"}>
                    {deptParsed.val}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={`Dept Baseline: ${activePt.dept_benchmark_formatted || "—"} • Gap: ${activePt.gap_vs_dept_formatted || "—"}`}>
                    Gap: {activePt.gap_vs_dept_formatted || "—"}
                  </span>
                </div>

                {/* BU Benchmark */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-sans whitespace-nowrap">BU Baseline</span>
                  <span className="font-bold text-emerald-300 mt-0.5 truncate block" title={activePt.bu_benchmark_formatted || "—"}>
                    {buParsed.val}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={`BU Baseline: ${activePt.bu_benchmark_formatted || "—"} • Gap: ${activePt.gap_vs_bu_formatted || "—"}`}>
                    Gap: {activePt.gap_vs_bu_formatted || "—"}
                  </span>
                </div>

                {/* Org Benchmark */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-purple-400 uppercase tracking-wider font-sans whitespace-nowrap">Org Benchmark</span>
                  <span className="font-bold text-purple-300 mt-0.5 truncate block" title={activePt.org_benchmark_formatted || "—"}>
                    {orgParsed.val}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={`Org Benchmark: ${activePt.org_benchmark_formatted || "—"} • Gap: ${activePt.gap_vs_org_formatted || "—"}`}>
                    Gap: {activePt.gap_vs_org_formatted || "—"}
                  </span>
                </div>

                {/* Peer Comparison (when selected in contextual mode) */}
                {hasPeer && activePt.peer_comparison !== null && activePt.peer_comparison !== undefined && (
                  <div className="flex flex-col min-w-0 overflow-hidden">
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title={peerLabel || "Peer Benchmark"}>
                      Peer Benchmark
                    </span>
                    <span className="font-bold text-emerald-300 mt-0.5 truncate block" title={activePt.peer_comparison_formatted || "—"}>
                      {peerParsed.val}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={peerLabel || "Peer entity"}>
                      {peerLabel ? peerLabel.replace(/^Peer:\s*/i, "") : "Peer"}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Benchmark */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title={benchmarkLabel}>
                    {benchmarkLabel.toLowerCase().includes("organisation") ? "Org Benchmark" : benchmarkLabel}
                  </span>
                  <span className="font-bold text-amber-300 mt-0.5 truncate block" title={activePt.benchmark_formatted || "—"}>
                    {benchParsed.val}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={`Benchmark: ${activePt.benchmark_formatted || "—"} • Gap: ${activePt.gap_vs_org_formatted || "—"}`}>
                    {activePt.gap_vs_org_formatted === "At benchmark" ? "At benchmark" : `Gap: ${activePt.gap_vs_org_formatted || "—"}`}
                  </span>
                </div>

                {/* Historical Baseline */}
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] text-rose-400 uppercase tracking-wider font-sans whitespace-nowrap">Historical</span>
                  <span className="font-bold text-rose-300 mt-0.5 truncate block" title={activePt.historical_formatted || "—"}>
                    {histParsed.val}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={histParsed.raw || "Trailing reference"}>
                    {histParsed.sub || "Trailing reference"}
                  </span>
                </div>

                {/* Peer Comparison (when selected) */}
                {hasPeer && activePt.peer_comparison !== null && activePt.peer_comparison !== undefined && (
                  <div className="flex flex-col min-w-0 overflow-hidden">
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-sans whitespace-nowrap truncate" title={peerLabel || "Peer Benchmark"}>
                      Peer Benchmark
                    </span>
                    <span className="font-bold text-emerald-300 mt-0.5 truncate block" title={activePt.peer_comparison_formatted || "—"}>
                      {peerParsed.val}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-sans truncate block" title={peerLabel || "Peer entity"}>
                      {peerLabel ? peerLabel.replace(/^Peer:\s*/i, "") : "Peer"}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Volume Confidence */}
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans whitespace-nowrap">Confidence</span>
              <span
                className={`font-bold mt-0.5 text-[10px] whitespace-nowrap inline-flex items-center gap-1 truncate ${
                  activePt.is_low_volume ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${activePt.is_low_volume ? "bg-amber-400" : "bg-emerald-400"}`} />
                {activePt.is_low_volume ? "Low Volume" : "High Confidence"}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-sans whitespace-nowrap truncate">
                {activePt.evaluable} {activePt.evaluable === 1 ? "unit" : "units"}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
