"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Zap,
  Activity,
  ShieldAlert,
  Flame,
  UserX,
  TrendingUp,
  Clock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PunchAnomaly, EmployeeBurnoutProfile, CohortBurnoutRisk, BurnoutSummary } from "../lib/types";
import { fetchPunchAnomalies, fetchBurnoutRisks } from "../lib/api";

interface PredictiveSignalsPanelProps {
  businessUnit?: string | null;
  department?: string | null;
}

export function PredictiveSignalsPanel({
  businessUnit,
  department,
}: PredictiveSignalsPanelProps) {
  const [anomalies, setAnomalies] = useState<PunchAnomaly[]>([]);
  const [anomalyTime, setAnomalyTime] = useState<number>(0);
  const [burnoutProfiles, setBurnoutProfiles] = useState<EmployeeBurnoutProfile[]>([]);
  const [cohortRisks, setCohortRisks] = useState<CohortBurnoutRisk[]>([]);
  const [burnoutSummary, setBurnoutSummary] = useState<BurnoutSummary | null>(null);
  const [burnoutTime, setBurnoutTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"anomalies" | "burnout">("anomalies");

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    Promise.all([
      fetchPunchAnomalies(businessUnit, department, 25).catch(() => ({ anomalies: [], count: 0, execution_time_ms: 0 })),
      fetchBurnoutRisks(businessUnit, department, 20).catch(() => ({ employee_risks: [], cohort_risks: [], summary: null, execution_time_ms: 0 })),
    ]).then(([anomData, burnData]) => {
      if (!isCurrent) return;
      setAnomalies(anomData.anomalies || []);
      setAnomalyTime(anomData.execution_time_ms || 0);
      setBurnoutProfiles(burnData.employee_risks || []);
      setCohortRisks(burnData.cohort_risks || []);
      setBurnoutSummary(burnData.summary || null);
      setBurnoutTime(burnData.execution_time_ms || 0);
      setLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [businessUnit, department]);

  return (
    <div className="bg-[#0b1017] border border-cyan-500/20 rounded-xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h2 className="text-lg font-bold tracking-wider text-slate-100 uppercase flex items-center gap-2 font-mono">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              AI & Predictive Decision Intelligence
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Unsupervised Isolation Forest punch rhythm outlier modeling &amp; multi-dimensional burnout fatigue scoring.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-2 bg-[#06090e] p-1 rounded-lg border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("anomalies")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === "anomalies"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Punch Rhythm Anomalies ({anomalies.length})
          </button>
          <button
            onClick={() => setActiveTab("burnout")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === "burnout"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Burnout &amp; Flight Risk ({burnoutProfiles.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="text-xs font-mono tracking-wider">Evaluating Isolation Forest multidimensional matrices...</span>
        </div>
      ) : activeTab === "anomalies" ? (
        /* TAB 1: PUNCH ANOMALIES */
        <div>
          {/* Top telemetry status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Isolated Outliers</span>
              <span className="text-xl font-bold font-mono text-cyan-400">{anomalies.length} cases</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Top 8% Contamination Slice</span>
            </div>
            <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Critical Deviations</span>
              <span className="text-xl font-bold font-mono text-rose-400">
                {anomalies.filter((a) => a.severity === "CRITICAL").length} cases
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">&gt; 85.0 Isolation Score</span>
            </div>
            <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">ML Model</span>
              <span className="text-base font-bold font-mono text-slate-200">IsolationForest</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">100 Estimators Ensembled</span>
            </div>
            <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Inference Latency</span>
              <span className="text-xl font-bold font-mono text-emerald-400">{anomalyTime} ms</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Vectorized Polars Engine</span>
            </div>
          </div>

          {/* Anomaly cards feed */}
          {anomalies.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
              No statistical punch rhythm anomalies detected in the current slice.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {anomalies.map((anom, idx) => (
                <div
                  key={`${anom.employee_code}-${anom.date}-${idx}`}
                  className="bg-[#070c12] border border-slate-800/90 hover:border-cyan-500/50 rounded-lg p-4 transition-all duration-200 group flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top: Code & Severity */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300">
                          {anom.employee_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {anom.employee_code}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          anom.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                            : anom.severity === "HIGH"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                            : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                        }`}
                      >
                        {anom.severity} ({anom.anomaly_score})
                      </span>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-slate-400 font-mono">
                      <span className="bg-slate-900/80 px-2 py-0.5 rounded text-slate-300">{anom.business_unit}</span>
                      <span>{anom.department}</span>
                      <span className="text-slate-500">•</span>
                      <span>{anom.date}</span>
                    </div>

                    {/* Punch details */}
                    <div className="grid grid-cols-3 gap-2 bg-[#04070a] p-2 rounded border border-slate-900 mb-3 text-center">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">In</span>
                        <span className="text-xs font-mono text-slate-200">{anom.in_time || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Out</span>
                        <span className="text-xs font-mono text-slate-200">{anom.out_time || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Duration</span>
                        <span className="text-xs font-mono text-cyan-300">{anom.duration_hours}h</span>
                      </div>
                    </div>

                    {/* Feature explainability reasons */}
                    <div className="space-y-1 mb-2">
                      {anom.reasons.map((r, rIdx) => (
                        <div key={rIdx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Anomaly intensity bar */}
                  <div className="mt-3 pt-2 border-t border-slate-900">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                      <span>Anomaly Probability</span>
                      <span className="text-cyan-400">{anom.anomaly_score}%</span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          anom.severity === "CRITICAL"
                            ? "bg-rose-500"
                            : anom.severity === "HIGH"
                            ? "bg-amber-400"
                            : "bg-cyan-400"
                        }`}
                        style={{ width: `${anom.anomaly_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: BURNOUT & FLIGHT RISK */
        <div>
          {/* Executive Pulse for Burnout */}
          {burnoutSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Global Burnout Index</span>
                <span className="text-xl font-bold font-mono text-purple-400">
                  {burnoutSummary.global_burnout_index} / 100
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Multi-factor fatigue load</span>
              </div>
              <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Critical Flight Risks</span>
                <span className="text-xl font-bold font-mono text-rose-400">
                  {burnoutSummary.critical_flight_risks} staff
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Immediate intervention tier</span>
              </div>
              <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">At-Risk Ratio</span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {burnoutSummary.at_risk_percentage}%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">High or Critical fatigue</span>
              </div>
              <div className="bg-[#070b10] border border-slate-800/80 rounded-lg p-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Engine Latency</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{burnoutTime} ms</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Analyzed {burnoutSummary.total_workforce_analyzed} staff</span>
              </div>
            </div>
          )}

          {/* BU Cohort Stress Table */}
          {cohortRisks.length > 0 && (
            <div className="mb-6 bg-[#070b10] border border-slate-800/80 rounded-lg p-4">
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Business Unit Fatigue Intensity Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                      <th className="pb-2">Business Unit</th>
                      <th className="pb-2">Headcount</th>
                      <th className="pb-2">Avg Burnout Score</th>
                      <th className="pb-2">At-Risk Staff</th>
                      <th className="pb-2">Primary Stressor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {cohortRisks.map((c) => (
                      <tr key={c.business_unit} className="hover:bg-slate-900/40">
                        <td className="py-2.5 font-bold text-slate-200">{c.business_unit}</td>
                        <td className="py-2.5 text-slate-400">{c.headcount}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                c.avg_burnout_score > 50
                                  ? "text-rose-400"
                                  : c.avg_burnout_score > 30
                                  ? "text-amber-400"
                                  : "text-purple-300"
                              }`}
                            >
                              {c.avg_burnout_score}
                            </span>
                            <div className="w-16 bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-purple-500 h-full"
                                style={{ width: `${Math.min(100, c.avg_burnout_score)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <span className={c.high_risk_count > 0 ? "text-rose-400 font-bold" : "text-slate-500"}>
                            {c.high_risk_count} ({c.high_risk_pct}%)
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className="bg-slate-900 px-2 py-0.5 rounded text-[10px] text-slate-300 border border-slate-800">
                            {c.primary_stressor}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Individual employee retention flight risk dossier */}
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserX className="w-4 h-4 text-rose-400" />
            Prioritized Employee Flight-Risk Dossiers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {burnoutProfiles.slice(0, 12).map((profile) => (
              <div
                key={profile.employee_code}
                className="bg-[#070c12] border border-slate-800 hover:border-purple-500/50 rounded-lg p-4 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-200 block">
                        {profile.employee_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {profile.business_unit} • {profile.department}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        profile.flight_risk_level === "CRITICAL"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : profile.flight_risk_level === "HIGH"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : profile.flight_risk_level === "ELEVATED"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {profile.flight_risk_level} ({profile.burnout_score})
                    </span>
                  </div>

                  {/* Overtime metrics */}
                  <div className="grid grid-cols-3 gap-2 bg-[#04070a] p-2 rounded border border-slate-900 mb-3 text-center font-mono">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">OT Shifts</span>
                      <span className="text-xs text-amber-300">{profile.overtime_shifts_pct}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Extended</span>
                      <span className="text-xs text-rose-300">{profile.short_rest_turnarounds}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Avg Shift</span>
                      <span className="text-xs text-slate-200">{profile.avg_shift_hours}h</span>
                    </div>
                  </div>

                  {/* Signals */}
                  <div className="space-y-1 mb-3">
                    {profile.top_signals.map((sig, sIdx) => (
                      <div key={sIdx} className="text-[11px] text-slate-300 flex items-start gap-1.5 font-mono">
                        <Flame className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                        <span>{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Managerial recommendation */}
                <div className="pt-2 border-t border-slate-900">
                  <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Recommended Action</span>
                  <p className="text-[11px] text-cyan-300/90 font-mono leading-relaxed bg-cyan-950/20 p-2 rounded border border-cyan-900/30">
                    {profile.recommended_intervention}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
