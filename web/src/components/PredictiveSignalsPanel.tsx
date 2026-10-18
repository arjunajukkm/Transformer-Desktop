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
import { CyberneticOrbitalCore } from "./WorkforceLoadingExperience";

interface PredictiveSignalsPanelProps {
  businessUnit?: string | null;
  department?: string | null;
  theme?: "dark" | "light";
}

export function PredictiveSignalsPanel({
  businessUnit,
  department,
  theme = "dark",
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
    <div
      className={`border rounded-xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden transition-all ${
        theme === "dark"
          ? "bg-[#0c1324]/90 border-cyan-500/30 text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-md"
      }`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          theme === "dark" ? "bg-cyan-500/10" : "bg-cyan-500/5"
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          theme === "dark" ? "bg-purple-500/10" : "bg-purple-500/5"
        }`}
      />

      {/* Header telemetry */}
      <div
        className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 mb-6 ${
          theme === "dark" ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`flex h-2.5 w-2.5 rounded-full animate-pulse ${
                theme === "dark"
                  ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                  : "bg-cyan-600 shadow-sm"
              }`}
            />
            <h2
              className={`text-lg font-bold tracking-wider uppercase flex items-center gap-2 font-mono ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}
            >
              <Sparkles className="w-5 h-5 text-cyan-500" />
              AI &amp; Predictive Decision Intelligence
            </h2>
          </div>
          <p
            className={`text-xs ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Unsupervised Isolation Forest punch rhythm outlier modeling &amp; multi-dimensional burnout fatigue scoring.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div
          className={`flex items-center gap-2 p-1 rounded-lg border self-start md:self-auto ${
            theme === "dark"
              ? "bg-[#060a12] border-slate-800"
              : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            onClick={() => setActiveTab("anomalies")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === "anomalies"
                ? theme === "dark"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_14px_rgba(6,182,212,0.3)] font-bold"
                  : "bg-cyan-600 text-white shadow-sm font-bold"
                : theme === "dark"
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Punch Rhythm Anomalies ({anomalies.length})
          </button>
          <button
            onClick={() => setActiveTab("burnout")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === "burnout"
                ? theme === "dark"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_14px_rgba(168,85,247,0.3)] font-bold"
                  : "bg-purple-600 text-white shadow-sm font-bold"
                : theme === "dark"
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Burnout &amp; Flight Risk ({burnoutProfiles.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
          <CyberneticOrbitalCore size="md" />
          <span className="text-xs font-mono tracking-wider">Evaluating Isolation Forest multidimensional matrices...</span>
        </div>
      ) : activeTab === "anomalies" ? (
        /* TAB 1: PUNCH ANOMALIES */
        <div>
          {/* Top telemetry status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div
              className={`rounded-xl p-3 border ${
                theme === "dark"
                  ? "bg-[#090f1d] border-slate-800"
                  : "bg-slate-50 border-slate-200 shadow-xs"
              }`}
            >
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Isolated Outliers</span>
              <span className={`text-xl font-bold font-mono ${theme === "dark" ? "text-cyan-400" : "text-cyan-700"}`}>
                {anomalies.length} cases
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Top 8% Contamination Slice</span>
            </div>
            <div
              className={`rounded-xl p-3 border ${
                theme === "dark"
                  ? "bg-[#090f1d] border-slate-800"
                  : "bg-slate-50 border-slate-200 shadow-xs"
              }`}
            >
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Critical Deviations</span>
              <span className="text-xl font-bold font-mono text-rose-500">
                {anomalies.filter((a) => a.severity === "CRITICAL").length} cases
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">&gt; 85.0 Isolation Score</span>
            </div>
            <div
              className={`rounded-xl p-3 border ${
                theme === "dark"
                  ? "bg-[#090f1d] border-slate-800"
                  : "bg-slate-50 border-slate-200 shadow-xs"
              }`}
            >
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">ML Model</span>
              <span className={`text-base font-bold font-mono ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                IsolationForest
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold block mt-0.5">100 Estimators Ensembled</span>
            </div>
            <div
              className={`rounded-xl p-3 border ${
                theme === "dark"
                  ? "bg-[#090f1d] border-slate-800"
                  : "bg-slate-50 border-slate-200 shadow-xs"
              }`}
            >
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Inference Latency</span>
              <span className="text-xl font-bold font-mono text-emerald-500">{anomalyTime} ms</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Vectorized Polars Engine</span>
            </div>
          </div>

          {/* Anomaly cards feed */}
          {anomalies.length === 0 ? (
            <div
              className={`text-center py-12 font-mono text-xs border border-dashed rounded-lg ${
                theme === "dark"
                  ? "border-slate-800 text-slate-500"
                  : "border-slate-300 text-slate-500 bg-slate-50/50"
              }`}
            >
              No statistical punch rhythm anomalies detected in the current slice.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {anomalies.map((anom, idx) => (
                <div
                  key={`${anom.employee_code}-${anom.date}-${idx}`}
                  className={`rounded-xl p-4 transition-all duration-200 group flex flex-col justify-between border ${
                    theme === "dark"
                      ? "bg-[#080d19] border-slate-800/90 hover:border-cyan-500/50 hover:bg-[#0c1324]"
                      : "bg-slate-50/70 border-slate-200 hover:border-cyan-400 hover:bg-white shadow-xs"
                  }`}
                >
                  <div>
                    {/* Card Top: Code & Severity */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono font-bold transition-colors ${
                            theme === "dark"
                              ? "text-slate-200 group-hover:text-cyan-300"
                              : "text-slate-800 group-hover:text-cyan-700"
                          }`}
                        >
                          {anom.employee_name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            theme === "dark"
                              ? "bg-slate-900 text-slate-400 border-slate-800"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {anom.employee_code}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          anom.severity === "CRITICAL"
                            ? theme === "dark"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                              : "bg-rose-100 text-rose-700 border-rose-300"
                            : anom.severity === "HIGH"
                            ? theme === "dark"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                            : theme === "dark"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-cyan-100 text-cyan-800 border-cyan-300"
                        }`}
                      >
                        {anom.severity} ({anom.anomaly_score})
                      </span>
                    </div>

                    {/* Metadata tags */}
                    <div
                      className={`flex flex-wrap items-center gap-2 mb-3 text-[11px] font-mono ${
                        theme === "dark" ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      <span
                        className={`px-2 py-0.5 rounded ${
                          theme === "dark" ? "bg-slate-900 text-slate-300" : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {anom.business_unit}
                      </span>
                      <span>{anom.department}</span>
                      <span className="text-slate-400">•</span>
                      <span>{anom.date}</span>
                    </div>

                    {/* Punch details */}
                    <div
                      className={`grid grid-cols-3 gap-2 p-2 rounded border mb-3 text-center ${
                        theme === "dark"
                          ? "bg-[#050810] border-slate-900"
                          : "bg-white border-slate-200 shadow-xs"
                      }`}
                    >
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block">In</span>
                        <span className={`text-xs font-mono font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                          {anom.in_time || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block">Out</span>
                        <span className={`text-xs font-mono font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                          {anom.out_time || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block">Duration</span>
                        <span className={`text-xs font-mono font-bold ${theme === "dark" ? "text-cyan-400" : "text-cyan-700"}`}>
                          {anom.duration_hours}h
                        </span>
                      </div>
                    </div>

                    {/* Feature explainability reasons */}
                    <div className="space-y-1 mb-2">
                      {anom.reasons.map((r, rIdx) => (
                        <div
                          key={rIdx}
                          className={`flex items-start gap-1.5 text-[11px] ${
                            theme === "dark" ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Anomaly intensity bar */}
                  <div
                    className={`mt-3 pt-2 border-t ${
                      theme === "dark" ? "border-slate-800/80" : "border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                      <span>Anomaly Probability</span>
                      <span className={`font-bold ${theme === "dark" ? "text-cyan-400" : "text-cyan-700"}`}>
                        {anom.anomaly_score}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          anom.severity === "CRITICAL"
                            ? "bg-rose-500"
                            : anom.severity === "HIGH"
                            ? "bg-amber-500"
                            : "bg-cyan-500"
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
              <div
                className={`rounded-xl p-3 border ${
                  theme === "dark" ? "bg-[#090f1d] border-slate-800" : "bg-slate-50 border-slate-200 shadow-xs"
                }`}
              >
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Global Burnout Index</span>
                <span className="text-xl font-bold font-mono text-purple-500">
                  {burnoutSummary.global_burnout_index} / 100
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Multi-factor fatigue load</span>
              </div>
              <div
                className={`rounded-xl p-3 border ${
                  theme === "dark" ? "bg-[#090f1d] border-slate-800" : "bg-slate-50 border-slate-200 shadow-xs"
                }`}
              >
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Critical Flight Risks</span>
                <span className="text-xl font-bold font-mono text-rose-500">
                  {burnoutSummary.critical_flight_risks} staff
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Immediate intervention tier</span>
              </div>
              <div
                className={`rounded-xl p-3 border ${
                  theme === "dark" ? "bg-[#090f1d] border-slate-800" : "bg-slate-50 border-slate-200 shadow-xs"
                }`}
              >
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">At-Risk Ratio</span>
                <span className="text-xl font-bold font-mono text-amber-500">
                  {burnoutSummary.at_risk_percentage}%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">High or Critical fatigue</span>
              </div>
              <div
                className={`rounded-xl p-3 border ${
                  theme === "dark" ? "bg-[#090f1d] border-slate-800" : "bg-slate-50 border-slate-200 shadow-xs"
                }`}
              >
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Engine Latency</span>
                <span className="text-xl font-bold font-mono text-emerald-500">{burnoutTime} ms</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Analyzed {burnoutSummary.total_workforce_analyzed} staff</span>
              </div>
            </div>
          )}

          {/* BU Cohort Stress Table */}
          {cohortRisks.length > 0 && (
            <div
              className={`mb-6 rounded-xl p-4 border ${
                theme === "dark"
                  ? "bg-[#090f1d] border-slate-800"
                  : "bg-slate-50/80 border-slate-200 shadow-xs"
              }`}
            >
              <h3
                className={`text-xs font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
                  theme === "dark" ? "text-slate-300" : "text-slate-800"
                }`}
              >
                <Activity className="w-4 h-4 text-purple-500" />
                Business Unit Fatigue Intensity Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr
                      className={`border-b text-[10px] uppercase ${
                        theme === "dark" ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <th className="pb-2">Business Unit</th>
                      <th className="pb-2">Headcount</th>
                      <th className="pb-2">Avg Burnout Score</th>
                      <th className="pb-2">At-Risk Staff</th>
                      <th className="pb-2">Primary Stressor</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === "dark" ? "divide-slate-850" : "divide-slate-200"}`}>
                    {cohortRisks.map((c) => (
                      <tr
                        key={c.business_unit}
                        className={theme === "dark" ? "hover:bg-slate-850/50" : "hover:bg-white"}
                      >
                        <td className={`py-2.5 font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                          {c.business_unit}
                        </td>
                        <td className={`py-2.5 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                          {c.headcount}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                c.avg_burnout_score > 50
                                  ? "text-rose-500"
                                  : c.avg_burnout_score > 30
                                  ? "text-amber-500"
                                  : "text-purple-500"
                              }`}
                            >
                              {c.avg_burnout_score}
                            </span>
                            <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-purple-500 h-full"
                                style={{ width: `${Math.min(100, c.avg_burnout_score)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <span className={c.high_risk_count > 0 ? "text-rose-500 font-bold" : "text-slate-400"}>
                            {c.high_risk_count} ({c.high_risk_pct}%)
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] border ${
                              theme === "dark"
                                ? "bg-slate-900 text-slate-300 border-slate-800"
                                : "bg-white text-slate-700 border-slate-200 shadow-xs"
                            }`}
                          >
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
          <h3
            className={`text-xs font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
              theme === "dark" ? "text-slate-300" : "text-slate-800"
            }`}
          >
            <UserX className="w-4 h-4 text-rose-500" />
            Prioritized Employee Flight-Risk Dossiers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {burnoutProfiles.slice(0, 12).map((profile) => (
              <div
                key={profile.employee_code}
                className={`rounded-xl p-4 transition-all duration-200 flex flex-col justify-between border ${
                  theme === "dark"
                    ? "bg-[#080d19] border-slate-800 hover:border-purple-500/50 hover:bg-[#0c1324]"
                    : "bg-slate-50/70 border-slate-200 hover:border-purple-400 hover:bg-white shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span
                        className={`text-xs font-mono font-bold block ${
                          theme === "dark" ? "text-slate-200" : "text-slate-800"
                        }`}
                      >
                        {profile.employee_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {profile.business_unit} • {profile.department}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        profile.flight_risk_level === "CRITICAL"
                          ? theme === "dark"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-rose-100 text-rose-700 border-rose-300"
                          : profile.flight_risk_level === "HIGH"
                          ? theme === "dark"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                          : profile.flight_risk_level === "ELEVATED"
                          ? theme === "dark"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : "bg-purple-100 text-purple-800 border-purple-300"
                          : theme === "dark"
                          ? "bg-slate-800 text-slate-400 border-slate-700"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {profile.flight_risk_level} ({profile.burnout_score})
                    </span>
                  </div>

                  {/* Overtime metrics */}
                  <div
                    className={`grid grid-cols-3 gap-2 p-2 rounded border mb-3 text-center font-mono ${
                      theme === "dark"
                        ? "bg-[#050810] border-slate-900"
                        : "bg-white border-slate-200 shadow-xs"
                    }`}
                  >
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block">OT Shifts</span>
                      <span className="text-xs text-amber-500 font-bold">{profile.overtime_shifts_pct}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block">Extended</span>
                      <span className="text-xs text-rose-500 font-bold">{profile.short_rest_turnarounds}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block">Avg Shift</span>
                      <span className={`text-xs font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                        {profile.avg_shift_hours}h
                      </span>
                    </div>
                  </div>

                  {/* Signals */}
                  <div className="space-y-1 mb-3">
                    {profile.top_signals.map((sig, sIdx) => (
                      <div
                        key={sIdx}
                        className={`text-[11px] flex items-start gap-1.5 font-mono ${
                          theme === "dark" ? "text-slate-300" : "text-slate-700"
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
                        <span>{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Managerial recommendation */}
                <div
                  className={`pt-2 border-t ${
                    theme === "dark" ? "border-slate-800/80" : "border-slate-200"
                  }`}
                >
                  <span className="text-[9px] font-mono text-slate-400 uppercase block mb-1">Recommended Action</span>
                  <p
                    className={`text-[11px] font-mono leading-relaxed p-2 rounded border ${
                      theme === "dark"
                        ? "text-cyan-300 bg-cyan-950/30 border-cyan-800/40"
                        : "text-cyan-800 bg-cyan-50 border-cyan-200"
                    }`}
                  >
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
