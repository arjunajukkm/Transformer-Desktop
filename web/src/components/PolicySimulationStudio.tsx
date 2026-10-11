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
}

export function PolicySimulationStudio({ businessUnit }: PolicySimulationStudioProps) {
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
        const payload: SimulationRequest = {
          grace_period_mins: gracePeriod,
          ot_threshold_hours: otThreshold,
          regularization_sla_hours: slaHours,
          wfh_weekly_allowance: wfhAllowance,
          business_unit: businessUnit || "All",
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
    <div className="bg-[#0b1017] border border-cyan-500/20 rounded-xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h2 className="text-lg font-bold tracking-wider text-slate-100 uppercase flex items-center gap-2 font-mono">
              <Sliders className="w-5 h-5 text-cyan-400" />
              What-If Policy Simulation Studio
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Dynamically adjust workforce parameters to project downstream compliance, payroll costs, and friction index in &lt; 5ms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded">
            Latency: {execTime} ms
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INTERACTIVE LEVERS (4 cols) */}
        <div className="lg:col-span-5 space-y-5 bg-[#070b10] border border-slate-800/90 rounded-lg p-5">
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Policy Levers
          </h3>

          {/* Lever 1: Grace Period */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="text-slate-400">Arrival Grace Period</span>
              <span className="text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800">
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
              className="w-full accent-cyan-400 bg-slate-800 cursor-pointer h-1.5 rounded-lg"
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
              <span className="text-slate-400">Overtime Trigger Threshold</span>
              <span className="text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800">
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
              className="w-full accent-cyan-400 bg-slate-800 cursor-pointer h-1.5 rounded-lg"
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
              <span className="text-slate-400">Regularization SLA Window</span>
              <span className="text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800">
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
              className="w-full accent-cyan-400 bg-slate-800 cursor-pointer h-1.5 rounded-lg"
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
              <span className="text-slate-400">Weekly WFH Allowance</span>
              <span className="text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800">
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
              className="w-full accent-cyan-400 bg-slate-800 cursor-pointer h-1.5 rounded-lg"
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
                <div className="bg-[#070b10] border border-slate-800/90 rounded-lg p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Compliance Impact</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-slate-200">
                      {outcome.simulated_compliance_rate}%
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold flex items-center ${
                        outcome.compliance_delta >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {outcome.compliance_delta >= 0 ? "+" : ""}
                      {outcome.compliance_delta}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Baseline: {outcome.baseline_compliance_rate}%</span>
                </div>

                {/* Late Instances Delta */}
                <div className="bg-[#070b10] border border-slate-800/90 rounded-lg p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Late Marks Delta</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-slate-200">
                      {outcome.simulated_late_instances}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        outcome.late_delta <= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {outcome.late_delta > 0 ? "+" : ""}
                      {outcome.late_delta}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Baseline: {outcome.baseline_late_instances}</span>
                </div>

                {/* Overtime Payroll Cost Delta */}
                <div className="bg-[#070b10] border border-slate-800/90 rounded-lg p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Overtime Expense</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-lg font-bold font-mono ${
                        outcome.est_ot_cost_delta_usd <= 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {outcome.est_ot_cost_delta_usd >= 0 ? "+" : ""}${outcome.est_ot_cost_delta_usd.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {outcome.ot_hours_delta >= 0 ? "+" : ""}
                    {outcome.ot_hours_delta}h OT delta
                  </span>
                </div>

                {/* Policy Health Score */}
                <div className="bg-[#070b10] border border-slate-800/90 rounded-lg p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Policy Health</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-cyan-400">
                      {outcome.policy_health_score} / 100
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Friction: {outcome.friction_index_simulated}/100
                  </span>
                </div>
              </div>

              {/* Recommendation Box */}
              <div className="bg-gradient-to-r from-cyan-950/30 to-blue-950/20 border border-cyan-800/40 rounded-lg p-3.5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block mb-0.5">
                    Simulation Outcome Synthesis
                  </span>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {outcome.recommendation}
                  </p>
                </div>
              </div>

              {/* BU Impact Breakdown Table */}
              {outcome.bu_impacts.length > 0 && (
                <div className="bg-[#070b10] border border-slate-800/90 rounded-lg p-4">
                  <h4 className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    Business Unit Downstream Projections
                  </h4>
                  <table className="w-full text-left font-mono text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                        <th className="pb-1.5">Business Unit</th>
                        <th className="pb-1.5">Late Marks Shift</th>
                        <th className="pb-1.5">OT Hours Shift</th>
                        <th className="pb-1.5">Est. Payroll Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {outcome.bu_impacts.map((b) => (
                        <tr key={b.business_unit} className="hover:bg-slate-900/30">
                          <td className="py-2 text-slate-200 font-bold">{b.business_unit}</td>
                          <td className="py-2">
                            <span className={b.late_instances_delta <= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {b.late_instances_delta > 0 ? "+" : ""}{b.late_instances_delta}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={b.ot_hours_delta <= 0 ? "text-emerald-400" : "text-amber-400"}>
                              {b.ot_hours_delta > 0 ? "+" : ""}{b.ot_hours_delta}h
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={b.est_cost_delta <= 0 ? "text-emerald-400" : "text-amber-400"}>
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
