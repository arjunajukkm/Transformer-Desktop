"use client";

import React from "react";
import { Filter, Layers, Target, ChevronDown } from "lucide-react";
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
}: FilterBarProps) {
  const currentMetric = metrics.find((m) => m.id === selectedMetricId);

  // Group metrics by category
  const categories = ["Attendance", "Working Time", "Compliance", "Approval"] as const;

  return (
    <div className="glass-panel p-4 mb-6">
      {/* Upper Tier: Metric Selector & Benchmark Mode */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/5">
        {/* Metric Selector Dropdown with Category Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span>Target Metric:</span>
          </label>
          <div className="relative min-w-[280px]">
            <select
              value={selectedMetricId}
              onChange={(e) => onSelectMetric(e.target.value)}
              className="w-full appearance-none bg-slate-900/90 border border-cyan-500/30 text-white font-medium text-sm rounded-lg px-3.5 py-2 pr-9 focus:outline-none focus:border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer"
            >
              {categories.map((cat) => (
                <optgroup key={cat} label={`── ${cat.toUpperCase()} ──`} className="bg-slate-950 text-slate-400">
                  {metrics
                    .filter((m) => m.category === cat)
                    .map((m) => (
                      <option key={m.id} value={m.id} className="text-white py-1">
                        {m.label} ({m.format})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400 pointer-events-none" />
          </div>

          {currentMetric && (
            <span className="hidden xl:inline-block text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-white/5 max-w-sm truncate">
              {currentMetric.description}
            </span>
          )}
        </div>

        {/* Benchmark Baseline Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-amber-400" />
            <span>Baseline:</span>
          </span>
          <div className="flex rounded-lg bg-slate-900 p-0.5 border border-white/5 text-xs">
            {[
              { id: "ORGANIZATION", label: "Organisation" },
              { id: "HISTORICAL", label: "Historical Trajectory" },
              { id: "PEER", label: "Peer Business Unit" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => onSelectBenchmarkType(btn.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  benchmarkType === btn.id
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Tier: Dependent Cascading Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
        {/* Business Unit */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <span>Business Unit</span>
            {selectedBU !== "All Business Units" && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedBU}
              onChange={(e) => onSelectBU(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-white/10 text-slate-200 text-xs rounded-md px-2.5 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="All Business Units">All Business Units</option>
              {filters.business_units
                .filter((b) => b !== "All Business Units")
                .map((bu) => (
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
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <span>Department</span>
            {selectedDept !== "All Departments" && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => onSelectDept(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-white/10 text-slate-200 text-xs rounded-md px-2.5 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="All Departments">All Departments</option>
              {filters.departments
                .filter((d) => d !== "All Departments")
                .map((dept) => (
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
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <span>Reporting Manager</span>
            {selectedManager !== "All Reporting Managers" && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedManager}
              onChange={(e) => onSelectManager(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-white/10 text-slate-200 text-xs rounded-md px-2.5 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="All Reporting Managers">All Reporting Managers</option>
              {filters.managers
                .filter((m) => m !== "All Reporting Managers")
                .map((mgr) => (
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
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <span>Employee</span>
            {selectedEmployee !== "All Employees" && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
          </label>
          <div className="relative">
            <select
              value={selectedEmployee}
              onChange={(e) => onSelectEmployee(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-white/10 text-slate-200 text-xs rounded-md px-2.5 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="All Employees">All Employees</option>
              {filters.employees
                .filter((e) => e !== "All Employees")
                .map((emp) => (
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
