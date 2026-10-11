"use client";

import React from "react";
import { Filter, Layers, Target, ChevronDown, RotateCcw, Building, Users, User, Briefcase } from "lucide-react";
import { CascadedFilters, MetricMetadata } from "@/lib/types";

interface FilterBarProps {
  metrics: MetricMetadata[];
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
  benchmarkType: string;
  onSelectBenchmarkType: (type: string) => void;
  filters: CascadedFilters;
  selectedBU: string;
  onSelectBU: (bu: string) => void;
  selectedDept: string;
  onSelectDept: (dept: string) => void;
  selectedManager: string;
  onSelectManager: (mgr: string) => void;
  selectedEmployee: string;
  onSelectEmployee: (emp: string) => void;
  theme?: "dark" | "light";
  hideMetricSelector?: boolean;
}

export function FilterBar({
  metrics,
  selectedMetricId,
  onSelectMetric,
  benchmarkType,
  onSelectBenchmarkType,
  filters,
  selectedBU,
  onSelectBU,
  selectedDept,
  onSelectDept,
  selectedManager,
  onSelectManager,
  selectedEmployee,
  onSelectEmployee,
  theme = "dark",
  hideMetricSelector = false,
}: FilterBarProps) {
  const currentMetric = metrics.find((m) => m.id === selectedMetricId);
  const categories = ["Attendance", "Working Time", "Compliance", "Approval"] as const;

  const isFiltered =
    selectedBU !== "All Business Units" ||
    selectedDept !== "All Departments" ||
    selectedManager !== "All Reporting Managers" ||
    selectedEmployee !== "All Employees";

  const handleResetFilters = () => {
    onSelectBU("All Business Units");
    onSelectDept("All Departments");
    onSelectManager("All Reporting Managers");
    onSelectEmployee("All Employees");
  };

  return (
    <div
      className={`rounded-xl border p-3 mb-5 transition-all shadow-sm ${
        theme === "dark"
          ? "bg-[#0b1019]/90 border-slate-800 text-slate-100"
          : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      {/* ── Single-Row Top Control: Target Metric + Benchmark Mode + Reset ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-inherit">
        {hideMetricSelector ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 uppercase">
              <Layers className="h-3.5 w-3.5" />
              <span>Dimensional Scope Filters:</span>
            </span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
              {selectedBU} • {selectedDept} • {selectedManager}
            </span>
          </div>
        ) : (
          /* Metric Selector with Category Color Dot */
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 uppercase">
              <Target className="h-3.5 w-3.5" />
              <span>Target Metric:</span>
            </span>

            <div className="relative min-w-[220px]">
              <select
                value={selectedMetricId}
                onChange={(e) => onSelectMetric(e.target.value)}
                className={`w-full appearance-none rounded-lg px-3 py-1.5 pr-8 text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-mono ${
                  theme === "dark"
                    ? "bg-[#070b10] border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              >
                {categories.map((cat) => (
                  <optgroup key={cat} label={`── ${cat.toUpperCase()} ──`}>
                    {metrics
                      .filter((m) => m.category === cat)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.format})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-400 pointer-events-none" />
            </div>

            {currentMetric && (
              <span
                className={`hidden xl:inline-block text-[11px] px-2 py-0.5 rounded truncate max-w-xs ${
                  theme === "dark"
                    ? "bg-slate-800/60 text-slate-400 border border-slate-700/50"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {currentMetric.description}
              </span>
            )}
          </div>
        )}

        {/* Benchmark Baseline Selector & Reset */}
        <div className="flex items-center gap-2">
          {!hideMetricSelector && (
            <div
              className={`flex rounded-lg p-0.5 border text-xs font-mono ${
                theme === "dark" ? "bg-[#070b10] border-slate-800" : "bg-slate-100 border-slate-200"
              }`}
            >
              {[
                { id: "ORGANIZATION", label: "Organisation" },
                { id: "HISTORICAL", label: "Historical" },
                { id: "PEER", label: "Peer BU" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => onSelectBenchmarkType(btn.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    benchmarkType === btn.id
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
              title="Reset all filters to organization global scope"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Compact Cascading Dropdowns Strip (Single Row) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Business Unit */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
            <Building className="h-3 w-3 text-cyan-400" />
            <span>Business Unit</span>
            {selectedBU !== "All Business Units" && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedBU}
              onChange={(e) => onSelectBU(e.target.value)}
              className={`w-full appearance-none rounded-lg px-2.5 py-1.5 pr-7 text-xs border font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer ${
                theme === "dark"
                  ? selectedBU !== "All Business Units"
                    ? "bg-cyan-950/30 border-cyan-500/40 text-cyan-200"
                    : "bg-[#070b10] border-slate-700 text-slate-200"
                  : selectedBU !== "All Business Units"
                  ? "bg-cyan-50 border-cyan-300 text-cyan-800"
                  : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
            >
              {filters.business_units.map((bu) => (
                <option key={bu} value={bu}>
                  {bu}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Department */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
            <Briefcase className="h-3 w-3 text-indigo-400" />
            <span>Department</span>
            {selectedDept !== "All Departments" && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => onSelectDept(e.target.value)}
              className={`w-full appearance-none rounded-lg px-2.5 py-1.5 pr-7 text-xs border font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                theme === "dark"
                  ? selectedDept !== "All Departments"
                    ? "bg-indigo-950/30 border-indigo-500/40 text-indigo-200"
                    : "bg-[#070b10] border-slate-700 text-slate-200"
                  : selectedDept !== "All Departments"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                  : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
            >
              {filters.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Reporting Manager */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
            <Users className="h-3 w-3 text-purple-400" />
            <span>Reporting Manager</span>
            {selectedManager !== "All Reporting Managers" && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedManager}
              onChange={(e) => onSelectManager(e.target.value)}
              className={`w-full appearance-none rounded-lg px-2.5 py-1.5 pr-7 text-xs border font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer ${
                theme === "dark"
                  ? selectedManager !== "All Reporting Managers"
                    ? "bg-purple-950/30 border-purple-500/40 text-purple-200"
                    : "bg-[#070b10] border-slate-700 text-slate-200"
                  : selectedManager !== "All Reporting Managers"
                  ? "bg-purple-50 border-purple-300 text-purple-800"
                  : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
            >
              {filters.managers.map((mgr) => (
                <option key={mgr} value={mgr}>
                  {mgr}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Employee */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
            <User className="h-3 w-3 text-emerald-400" />
            <span>Individual Employee</span>
            {selectedEmployee !== "All Employees" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedEmployee}
              onChange={(e) => onSelectEmployee(e.target.value)}
              className={`w-full appearance-none rounded-lg px-2.5 py-1.5 pr-7 text-xs border font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer ${
                theme === "dark"
                  ? selectedEmployee !== "All Employees"
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                    : "bg-[#070b10] border-slate-700 text-slate-200"
                  : selectedEmployee !== "All Employees"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
            >
              {filters.employees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
