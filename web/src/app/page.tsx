"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { TrendPulseCards } from "@/components/TrendPulseCards";
import { MainTrendChart } from "@/components/MainTrendChart";
import { BusinessUnitHeatmap } from "@/components/BusinessUnitHeatmap";
import { BenchmarkTable } from "@/components/BenchmarkTable";
import { WhatChangedPanel } from "@/components/WhatChangedPanel";
import { EmergingPatternsPanel } from "@/components/EmergingPatternsPanel";
import { WorkforceCopilot } from "@/components/WorkforceCopilot";
import { PredictiveSignalsPanel } from "@/components/PredictiveSignalsPanel";
import { PolicySimulationStudio } from "@/components/PolicySimulationStudio";
import { ConnectorsHub } from "@/components/ConnectorsHub";
import { DesktopOperationsSuite } from "@/components/DesktopOperationsSuite";
import {
  fetchCascadedFilters,
  fetchHealth,
  fetchMetrics,
  fetchSnapshotMetadata,
  queryTrendIntelligence,
} from "@/lib/api";
import { CascadedFilters, MetricMetadata, SnapshotMetadata, TrendBundle } from "@/lib/types";
import { Activity, Sparkles, Sliders, LayoutGrid, Plug, FileSpreadsheet } from "lucide-react";

type ActiveTab = "telemetry" | "predictive" | "simulation" | "connectors" | "operations" | "all";

export default function WorkforceIntelligenceDashboard() {
  const [gatewayStatus, setGatewayStatus] = useState("checking");
  const [metadata, setMetadata] = useState<SnapshotMetadata | null>(null);
  const [metrics, setMetrics] = useState<MetricMetadata[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState("missing_swipe_rate");
  const [benchmarkType, setBenchmarkType] = useState("ORGANIZATION");
  const [activeTab, setActiveTab] = useState<ActiveTab>("telemetry");

  const [filters, setFilters] = useState<CascadedFilters>({
    business_units: ["All Business Units"],
    departments: ["All Departments"],
    managers: ["All Reporting Managers"],
    employees: ["All Employees"],
    emp_pairs: [],
  });

  const [selectedBU, setSelectedBU] = useState("All Business Units");
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedManager, setSelectedManager] = useState("All Reporting Managers");
  const [selectedEmployee, setSelectedEmployee] = useState("All Employees");

  const [bundle, setBundle] = useState<TrendBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial Load: Check gateway, fetch metrics, active snapshot, filters
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const health = await fetchHealth();
      setGatewayStatus(health.status);

      const [metricsList, snapMeta] = await Promise.all([
        fetchMetrics(),
        fetchSnapshotMetadata(),
      ]);

      setMetrics(metricsList);
      setMetadata(snapMeta);

      const initialFilters = await fetchCascadedFilters({});
      setFilters(initialFilters);

      // If user's allowed business units is restricted (e.g. BU Head Lending), lock the selection
      if (initialFilters.business_units.length === 1 && initialFilters.business_units[0] !== "All Business Units") {
        setSelectedBU(initialFilters.business_units[0]);
      } else if (!initialFilters.business_units.includes(selectedBU)) {
        setSelectedBU(initialFilters.business_units[0] || "All Business Units");
      }
    } catch (err) {
      console.error("Initial load failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBU]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Fetch Cascaded Filter Options when BU, Dept, or Manager changes
  useEffect(() => {
    const updateCascadedFilters = async () => {
      try {
        const updated = await fetchCascadedFilters({
          business_unit: selectedBU,
          department: selectedDept,
          manager: selectedManager,
        });
        setFilters(updated);
      } catch (err) {
        console.error("Failed to update cascaded filters:", err);
      }
    };

    updateCascadedFilters();
  }, [selectedBU, selectedDept, selectedManager]);

  // 3. Query Trend Intelligence when selection parameters change
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        const res = await queryTrendIntelligence({
          metric_id: selectedMetricId,
          benchmark_type: benchmarkType,
          business_unit: selectedBU,
          department: selectedDept,
          manager: selectedManager,
          employee: selectedEmployee,
        });
        setBundle(res);
      } catch (err) {
        console.error("Trend query failed:", err);
      }
    };

    fetchTrendData();
  }, [selectedMetricId, benchmarkType, selectedBU, selectedDept, selectedManager, selectedEmployee]);

  const currentMetric = metrics.find((m) => m.id === selectedMetricId);
  const metricLabel = currentMetric?.label || "Missing Swipe Rate";

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header & Telemetry Status */}
      <Header
        metadata={metadata}
        gatewayStatus={gatewayStatus}
        onRefresh={loadInitialData}
        onPersonaChanged={loadInitialData}
      />

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Navigation Mode Segmented Controller */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-[#070b10] p-1.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === "telemetry"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              Workforce Telemetry &amp; Trends
            </button>
            <button
              onClick={() => setActiveTab("predictive")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === "predictive"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Predictive Signals &amp; Burnout
            </button>
            <button
              onClick={() => setActiveTab("simulation")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === "simulation"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Sliders className="w-4 h-4 text-blue-400" />
              What-If Simulation Studio
            </button>
            <button
              onClick={() => setActiveTab("connectors")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === "connectors"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Plug className="w-4 h-4 text-emerald-400" />
              Data Connection Hub (Keka &amp; Slack)
            </button>
            <button
              onClick={() => setActiveTab("operations")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === "operations"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              Desktop Operations Suite
            </button>
          </div>

          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Executive War Room (All)
          </button>
        </div>

        {/* Cascading Filter Bar */}
        {(activeTab === "telemetry" || activeTab === "all" || activeTab === "predictive") && (
          <FilterBar
            metrics={metrics}
            selectedMetricId={selectedMetricId}
            onSelectMetric={setSelectedMetricId}
            benchmarkType={benchmarkType}
            onSelectBenchmarkType={setBenchmarkType}
            filters={filters}
            selectedBU={selectedBU}
            onSelectBU={(bu) => {
              setSelectedBU(bu);
              setSelectedDept("All Departments");
              setSelectedManager("All Reporting Managers");
              setSelectedEmployee("All Employees");
            }}
            selectedDept={selectedDept}
            onSelectDept={(dept) => {
              setSelectedDept(dept);
              setSelectedManager("All Reporting Managers");
              setSelectedEmployee("All Employees");
            }}
            selectedManager={selectedManager}
            onSelectManager={(mgr) => {
              setSelectedManager(mgr);
              setSelectedEmployee("All Employees");
            }}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={setSelectedEmployee}
          />
        )}

        {/* VIEW 1: WORKFORCE TELEMETRY & TRENDS */}
        {(activeTab === "telemetry" || activeTab === "all") && (
          <div className="space-y-6 mb-8">
            {/* Executive Pulse KPI Cards */}
            {bundle && (
              <TrendPulseCards
                cards={bundle.trend_pulse}
                pulse={bundle.pulse}
                metricLabel={metricLabel}
              />
            )}

            {/* Primary Time-Series Trajectory Visualizer */}
            {bundle && (
              <MainTrendChart
                points={bundle.chart.points}
                metricName={bundle.chart.metric_name}
                metricFormat={bundle.chart.format}
                benchmarkLabel={bundle.benchmark_label}
                entityLabel={bundle.chart.entity_label}
                policyEffectiveDate={bundle.policy_effective_date}
                unit={bundle.chart.unit}
              />
            )}

            {/* Deterministic Drivers & Emerging Exception Risk Dossiers */}
            {bundle && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WhatChangedPanel decomposition={bundle.what_changed} />
                <EmergingPatternsPanel patterns={bundle.patterns} />
              </div>
            )}

            {/* Business Unit Matrix Heatmap */}
            {bundle && (
              <BusinessUnitHeatmap
                months={bundle.heatmap.months}
                rows={bundle.heatmap.rows}
                metricLabel={metricLabel}
              />
            )}

            {/* Multi-Dimension Benchmark Matrix Table */}
            {bundle && (
              <BenchmarkTable
                rows={bundle.benchmark_table.rows}
                total={bundle.benchmark_table.total}
                metricLabel={metricLabel}
              />
            )}
          </div>
        )}

        {/* VIEW 2: AI PREDICTIVE SIGNALS & BURNOUT */}
        {(activeTab === "predictive" || activeTab === "all") && (
          <div className="mb-8">
            <PredictiveSignalsPanel
              businessUnit={selectedBU}
              department={selectedDept}
            />
          </div>
        )}

        {/* VIEW 3: WHAT-IF POLICY SIMULATION STUDIO */}
        {(activeTab === "simulation" || activeTab === "all") && (
          <div className="mb-8">
            <PolicySimulationStudio
              businessUnit={selectedBU}
            />
          </div>
        )}

        {/* VIEW 4: DATA CONNECTION HUB (KEKA & SLACK) */}
        {(activeTab === "connectors" || activeTab === "all") && (
          <div className="mb-8">
            <ConnectorsHub onSyncCompleted={loadInitialData} />
          </div>
        )}

        {/* VIEW 5: DESKTOP OPERATIONS SUITE */}
        {(activeTab === "operations" || activeTab === "all") && (
          <div className="mb-8">
            <DesktopOperationsSuite />
          </div>
        )}
      </main>

      {/* Floating AI Workforce Decision Intelligence Copilot */}
      <WorkforceCopilot
        currentBundle={bundle}
        selectedMetricLabel={metricLabel}
      />
    </div>
  );
}
