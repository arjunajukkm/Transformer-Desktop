"use client";

import React from "react";
import { Filter, Layers, Target, ChevronDown, RotateCcw, Building2, Briefcase, Users2, User } from "lucide-react";
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
      className={`rounded-xl border px-3 py-2 mb-4 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        theme === "dark"
          ? "bg-[#090d16]/80 border-slate-800/80 text-slate-100 backdrop-blur-md"
          : "bg-white/95 border-slate-200/90 text-slate-800 shadow-xs backdrop-blur-md"
      }`}
    >
      {/* ── Left Section: Metric & Benchmark Controls (Telemetry mode) OR Label (Overview mode) ── */}
      <div className="flex flex-wrap items-center gap-2">
        {!hideMetricSelector ? (
          <>
            {/* Metric Dropdown Pill */}
            <div className="relative min-w-[200px]">
              <select
                value={selectedMetricId}
                onChange={(e) => onSelectMetric(e.target.value)}
                className={`w-full appearance-none rounded-lg px-2.5 py-1.5 pr-7 text-xs font-mono font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors ${
                  theme === "dark"
                    ? "bg-[#0c101a] border-slate-700/80 text-cyan-300"
                    : "bg-slate-50 border-slate-300 text-cyan-800"
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
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-400 pointer-events-none" />
            </div>

            {/* Benchmark Baseline Switcher */}
            <div
              className={`flex rounded-lg p-0.5 border text-xs font-mono ${
                theme === "dark" ? "bg-[#070a10] border-slate-800" : "bg-slate-100 border-slate-200"
              }`}
            >
              {[
                { id: "ORGANIZATION", label: "Org" },
                { id: "HISTORICAL", label: "History" },
                { id: "PEER", label: "Peer BU" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => onSelectBenchmarkType(btn.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    benchmarkType === btn.id
                      ? "bg-amber-500/20 text-amber-300 font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Filter className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-300">Filter Scope:</span>
          </div>
        )}
      </div>

      {/* ── Right Section: Dimensional Cascading Pills Strip ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Business Unit Pill */}
        <div className="relative">
          <select
            value={selectedBU}
            onChange={(e) => onSelectBU(e.target.value)}
            className={`appearance-none rounded-lg px-2.5 py-1.5 pr-6 text-xs font-mono font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors ${
              theme === "dark"
                ? selectedBU !== "All Business Units"
                  ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-200"
                  : "bg-[#0c101a] border-slate-700/60 text-slate-300 hover:border-slate-600"
                : selectedBU !== "All Business Units"
                ? "bg-cyan-50 border-cyan-300 text-cyan-800"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            {filters.business_units.map((bu) => (
              <option key={bu} value={bu}>
                {bu}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>

        {/* Department Pill */}
        <div className="relative">
          <select
            value={selectedDept}
            onChange={(e) => onSelectDept(e.target.value)}
            className={`appearance-none rounded-lg px-2.5 py-1.5 pr-6 text-xs font-mono font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
              theme === "dark"
                ? selectedDept !== "All Departments"
                  ? "bg-indigo-950/40 border-indigo-500/50 text-indigo-200"
                  : "bg-[#0c101a] border-slate-700/60 text-slate-300 hover:border-slate-600"
                : selectedDept !== "All Departments"
                ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            {filters.departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>

        {/* Manager Pill */}
        <div className="relative">
          <select
            value={selectedManager}
            onChange={(e) => onSelectManager(e.target.value)}
            className={`appearance-none rounded-lg px-2.5 py-1.5 pr-6 text-xs font-mono font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors ${
              theme === "dark"
                ? selectedManager !== "All Reporting Managers"
                  ? "bg-purple-950/40 border-purple-500/50 text-purple-200"
                  : "bg-[#0c101a] border-slate-700/60 text-slate-300 hover:border-slate-600"
                : selectedManager !== "All Reporting Managers"
                ? "bg-purple-50 border-purple-300 text-purple-800"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            {filters.managers.map((mgr) => (
              <option key={mgr} value={mgr}>
                {mgr}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>

        {/* Individual Employee Pill */}
        <div className="relative">
          <select
            value={selectedEmployee}
            onChange={(e) => onSelectEmployee(e.target.value)}
            className={`appearance-none rounded-lg px-2.5 py-1.5 pr-6 text-xs font-mono font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors ${
              theme === "dark"
                ? selectedEmployee !== "All Employees"
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                  : "bg-[#0c101a] border-slate-700/60 text-slate-300 hover:border-slate-600"
                : selectedEmployee !== "All Employees"
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            {filters.employees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>

        {/* Reset Button (only shown when filtered) */}
        {isFiltered && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
            title="Reset all filters to organization scope"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
