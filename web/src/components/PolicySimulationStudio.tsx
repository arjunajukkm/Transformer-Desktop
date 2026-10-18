"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Sliders,
  DollarSign,
  ShieldCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  RotateCcw,
  Building,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { SimulationRequest, SimulationOutcome } from "../lib/types";
import { runPolicySimulation } from "../lib/api";

interface PolicySimulationStudioProps {
  businessUnit?: string | null;
  theme?: "dark" | "light";
}

export function PolicySimulationStudio({ businessUnit, theme = "dark" }: PolicySimulationStudioProps) {
  const [gracePeriod, setGracePeriod] = useState<number>(15);
  const [otThreshold, setOtThreshold] = useState<number>(8.5);
  const [slaHours, setSlaHours] = useState<number>(48);
  const [wfhAllowance, setWfhAllowance] = useState<number>(1);

  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);
  const [isPending, startTransition] = useTransition();
  const [execTime, setExecTime] = useState<number>(0);

  // Trigger vectorized simulation upon slider adjustment
  useEffect(() => {
    let isCurrent = true;
    startTransition(async () => {
      try {
        const normalizedBU =
          !businessUnit ||
          businessUnit.toLowerCase() === "all" ||
          businessUnit.toLowerCase().startsWith("all")
            ? "All"
            : businessUnit;

        const payload: SimulationRequest = {
          grace_period_mins: gracePeriod,
          ot_threshold_hours: otThreshold,
          regularization_sla_hours: slaHours,
          wfh_weekly_allowance: wfhAllowance,
          business_unit: normalizedBU,
        };
        const res = await runPolicySimulation(payload);
        if (isCurrent) {
          setOutcome(res);
          setExecTime(res.execution_time_ms || 0);
        }
      } catch (err) {
        // Fallback gracefully
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [gracePeriod, otThreshold, slaHours, wfhAllowance, businessUnit]);

  const handleReset = () => {
    setGracePeriod(15);
    setOtThreshold(8.5);
    setSlaHours(48);
    setWfhAllowance(1);
  };

  return (
    <div
      className={`border rounded-xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden transition-all ${
        theme === "dark"
          ? "bg-[#0c1324]/90 border-cyan-500/30 text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-md"
      }`}
    >
      <div
        className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
          theme === "dark" ? "bg-blue-500/10" : "bg-blue-500/5"
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
              <Sliders className="w-5 h-5 text-cyan-500" />
              What-If Policy Simulation Studio
            </h2>
          </div>
          <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            Dynamically adjust workforce parameters to project downstream compliance, payroll costs, and friction index in &lt; 5ms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] font-mono px-2.5 py-1 rounded border font-semibold ${
              theme === "dark"
                ? "text-emerald-400 bg-emerald-950/50 border-emerald-800/60"
                : "text-emerald-800 bg-emerald-100 border-emerald-300"
            }`}
          >
            Latency: {execTime} ms
          </span>
          <button
            onClick={handleReset}
            className={`flex items-center gap-1.5 px-3 py-1 border rounded text-xs font-mono transition-colors ${
              theme === "dark"
                ? "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INTERACTIVE LEVERS (5 cols) */}
        <div
          className={`lg:col-span-5 space-y-5 rounded-xl p-5 border ${
            theme === "dark"
              ? "bg-[#080d19] border-slate-800/90"
              : "bg-slate-50/80 border-slate-200 shadow-xs"
          }`}
        >
          <h3
            className={`text-xs font-mono font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${
              theme === "dark" ? "text-slate-200" : "text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-500" />
            Policy Levers
          </h3>

          {/* Lever 1: Grace Period */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className={theme === "dark" ? "text-slate-400" : "text-slate-600"}>Arrival Grace Period</span>
              <span
                className={`font-bold px-2 py-0.5 rounded border ${
                  theme === "dark"
                    ? "text-cyan-300 bg-cyan-950/60 border-cyan-800/60"
                    : "text-cyan-800 bg-cyan-100 border-cyan-300"
                }`}
              >
                {gracePeriod} mins
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="45"
              step="5"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(parseInt(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 cursor-pointer h-2 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0m (Strict)</span>
              <span>15m (Baseline)</span>
              <span>45m (Flexible)</span>
            </div>
          </div>

          {/* Lever 2: Overtime Threshold */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className={theme === "dark" ? "text-slate-400" : "text-slate-600"}>Overtime Trigger Threshold</span>
              <span
                className={`font-bold px-2 py-0.5 rounded border ${
                  theme === "dark"
                    ? "text-cyan-300 bg-cyan-950/60 border-cyan-800/60"
                    : "text-cyan-800 bg-cyan-100 border-cyan-300"
                }`}
              >
                {otThreshold} hrs
              </span>
            </div>
            <input
              type="range"
              min="7.5"
              max="11.0"
              step="0.5"
              value={otThreshold}
              onChange={(e) => setOtThreshold(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 cursor-pointer h-2 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>7.5h</span>
              <span>8.5h (Baseline)</span>
              <span>11.0h</span>
            </div>
          </div>

          {/* Lever 3: Regularization SLA */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className={theme === "dark" ? "text-slate-400" : "text-slate-600"}>Regularization SLA Window</span>
              <span
                className={`font-bold px-2 py-0.5 rounded border ${
                  theme === "dark"
                    ? "text-cyan-300 bg-cyan-950/60 border-cyan-800/60"
                    : "text-cyan-800 bg-cyan-100 border-cyan-300"
                }`}
              >
                {slaHours} hrs
              </span>
            </div>
            <input
              type="range"
              min="12"
              max="96"
              step="12"
              value={slaHours}
              onChange={(e) => setSlaHours(parseInt(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 cursor-pointer h-2 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>12h (Rapid)</span>
              <span>48h (Baseline)</span>
              <span>96h</span>
            </div>
          </div>

          {/* Lever 4: WFH Weekly Allowance */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className={theme === "dark" ? "text-slate-400" : "text-slate-600"}>Weekly WFH Allowance</span>
              <span
                className={`font-bold px-2 py-0.5 rounded border ${
                  theme === "dark"
                    ? "text-cyan-300 bg-cyan-950/60 border-cyan-800/60"
                    : "text-cyan-800 bg-cyan-100 border-cyan-300"
                }`}
              >
                {wfhAllowance} days/wk
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={wfhAllowance}
              onChange={(e) => setWfhAllowance(parseInt(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 cursor-pointer h-2 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0 days (Onsite)</span>
              <span>1 day (Baseline)</span>
              <span>3 days (Hybrid)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SIMULATED IMPACT DASHBOARD (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {outcome && (
            <>
              {/* Top 4 Impact KPI tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Compliance Shift */}
                <div
                  className={`rounded-xl p-3 border ${
                    theme === "dark"
                      ? "bg-[#080d19] border-slate-800/90"
                      : "bg-slate-50 border-slate-200 shadow-xs"
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Compliance Impact</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-lg font-bold font-mono ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}>
                      {outcome.simulated_compliance_rate}%
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold flex items-center ${
                        outcome.compliance_delta >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {outcome.compliance_delta >= 0 ? "+" : ""}
                      {outcome.compliance_delta}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Baseline: {outcome.baseline_compliance_rate}%</span>
                </div>

                {/* Late Instances Delta */}
                <div
                  className={`rounded-xl p-3 border ${
                    theme === "dark"
                      ? "bg-[#080d19] border-slate-800/90"
                      : "bg-slate-50 border-slate-200 shadow-xs"
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Late Marks Delta</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-lg font-bold font-mono ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}>
                      {outcome.simulated_late_instances}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        outcome.late_delta <= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {outcome.late_delta > 0 ? "+" : ""}
                      {outcome.late_delta}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Baseline: {outcome.baseline_late_instances}</span>
                </div>

                {/* Overtime Payroll Cost Delta */}
                <div
                  className={`rounded-xl p-3 border ${
                    theme === "dark"
                      ? "bg-[#080d19] border-slate-800/90"
                      : "bg-slate-50 border-slate-200 shadow-xs"
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Overtime Expense</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-lg font-bold font-mono ${
                        outcome.est_ot_cost_delta_usd <= 0 ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      {outcome.est_ot_cost_delta_usd >= 0 ? "+" : ""}${outcome.est_ot_cost_delta_usd.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {outcome.ot_hours_delta >= 0 ? "+" : ""}
                    {outcome.ot_hours_delta}h OT delta
                  </span>
                </div>

                {/* Policy Health Score */}
                <div
                  className={`rounded-xl p-3 border ${
                    theme === "dark"
                      ? "bg-[#080d19] border-slate-800/90"
                      : "bg-slate-50 border-slate-200 shadow-xs"
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Policy Health</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-lg font-bold font-mono ${theme === "dark" ? "text-cyan-400" : "text-cyan-700"}`}>
                      {outcome.policy_health_score} / 100
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Friction: {outcome.friction_index_simulated}/100
                  </span>
                </div>
              </div>

              {/* Recommendation Box */}
              <div
                className={`border rounded-xl p-3.5 flex items-start gap-3 ${
                  theme === "dark"
                    ? "bg-gradient-to-r from-cyan-950/40 to-blue-950/30 border-cyan-800/50"
                    : "bg-cyan-50/80 border-cyan-200"
                }`}
              >
                <Sparkles className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                <div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider font-bold block mb-0.5 ${
                      theme === "dark" ? "text-cyan-400" : "text-cyan-800"
                    }`}
                  >
                    Simulation Outcome Synthesis
                  </span>
                  <p
                    className={`text-xs font-mono leading-relaxed ${
                      theme === "dark" ? "text-slate-300" : "text-slate-800"
                    }`}
                  >
                    {outcome.recommendation}
                  </p>
                </div>
              </div>

              {/* BU Impact Breakdown Table */}
              {outcome.bu_impacts.length > 0 && (
                <div
                  className={`rounded-xl p-4 border ${
                    theme === "dark"
                      ? "bg-[#080d19] border-slate-800/90"
                      : "bg-slate-50/80 border-slate-200 shadow-xs"
                  }`}
                >
                  <h4
                    className={`text-[11px] font-mono font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                      theme === "dark" ? "text-slate-400" : "text-slate-700"
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    Business Unit Downstream Projections
                  </h4>
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr
                        className={`border-b text-[10px] uppercase ${
                          theme === "dark" ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <th className="pb-1.5">Business Unit</th>
                        <th className="pb-1.5">Late Marks Shift</th>
                        <th className="pb-1.5">OT Hours Shift</th>
                        <th className="pb-1.5">Est. Payroll Impact</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme === "dark" ? "divide-slate-900" : "divide-slate-200"}`}>
                      {outcome.bu_impacts.map((b) => (
                        <tr
                          key={b.business_unit}
                          className={theme === "dark" ? "hover:bg-slate-900/40" : "hover:bg-white"}
                        >
                          <td className={`py-2 font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                            {b.business_unit}
                          </td>
                          <td className="py-2">
                            <span className={b.late_instances_delta <= 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                              {b.late_instances_delta > 0 ? "+" : ""}{b.late_instances_delta}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={b.ot_hours_delta <= 0 ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
                              {b.ot_hours_delta > 0 ? "+" : ""}{b.ot_hours_delta}h
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={b.est_cost_delta <= 0 ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
                              {b.est_cost_delta >= 0 ? "+" : ""}${b.est_cost_delta.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
