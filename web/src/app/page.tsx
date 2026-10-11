"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
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
import { ExecutiveOverview } from "@/components/ExecutiveOverview";
import {
  fetchCascadedFilters,
  fetchHealth,
  fetchMetrics,
  fetchSnapshotMetadata,
  queryTrendIntelligence,
  fetchExecutiveOverview,
} from "@/lib/api";
import {
  CascadedFilters,
  MetricMetadata,
  SnapshotMetadata,
  TrendBundle,
  ExecutiveOverviewBundle,
} from "@/lib/types";

type ActiveTab = "overview" | "telemetry" | "predictive" | "simulation" | "connectors" | "operations" | "all";

export default function WorkforceIntelligenceDashboard() {
  const [gatewayStatus, setGatewayStatus] = useState("checking");
  const [metadata, setMetadata] = useState<SnapshotMetadata | null>(null);
  const [metrics, setMetrics] = useState<MetricMetadata[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState("missing_swipe_rate");
  const [benchmarkType, setBenchmarkType] = useState("ORGANIZATION");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showDetailedBenchmarks, setShowDetailedBenchmarks] = useState(false);

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

  const [overviewBundle, setOverviewBundle] = useState<ExecutiveOverviewBundle | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);

  // Sync theme with document element
  useEffect(() => {
    const savedTheme = (localStorage.getItem("transformers_theme") as "dark" | "light") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("transformers_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  };

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

      // Enforce RLS restriction if active persona scope is restricted
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

  // 2. Cascaded Filters update
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

  // 3. Trend Intelligence Query
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

  // 4. Executive Overview Query
  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      setIsOverviewLoading(true);
      try {
        const res = await fetchExecutiveOverview({
          business_unit: selectedBU,
          department: selectedDept,
          manager: selectedManager,
          employee: selectedEmployee,
        });
        if (isMounted) setOverviewBundle(res);
      } catch (err) {
        console.error("Failed to fetch executive overview:", err);
      } finally {
        if (isMounted) setIsOverviewLoading(false);
      }
    };

    if (activeTab === "overview" || activeTab === "all") {
      loadOverview();
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedBU, selectedDept, selectedManager, selectedEmployee]);

  const currentMetric = metrics.find((m) => m.id === selectedMetricId);
  const metricLabel = currentMetric?.label || "Missing Swipe Rate";

  const tabTitles: Record<ActiveTab, string> = {
    overview: "Executive Overview (15 Primary KPIs & Reconciliation)",
    telemetry: "Workforce Telemetry & Decision Trends",
    predictive: "AI Predictive Signals & Retention Risk",
    simulation: "What-If Policy Simulation Studio",
    connectors: "Data Connection Hub (Keka & Slack)",
    operations: "Desktop Operations Suite",
    all: "Executive War Room (Composite Analytics)",
  };

  return (
    <div
      className={`min-h-screen flex font-sans transition-colors duration-200 ${
        theme === "dark"
          ? "bg-[#080c14] text-slate-100 selection:bg-cyan-500 selection:text-slate-950"
          : "bg-[#f8fafc] text-slate-900 selection:bg-cyan-600 selection:text-white"
      }`}
    >
      {/* ── Left Collapsible Sidebar Navigation ── */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab as ActiveTab)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onPersonaChanged={loadInitialData}
      />

      {/* ── Main Workspace Viewport Canvas ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? "ml-[72px]" : "ml-[250px]"
        }`}
      >
        {/* Top Context & Quick Actions Bar */}
        <TopBar
          metadata={metadata}
          gatewayStatus={gatewayStatus}
          activeTabTitle={tabTitles[activeTab]}
          scopeLabel={selectedBU !== "All Business Units" ? selectedBU : "Global FinBox"}
          theme={theme}
          onRefresh={loadInitialData}
        />

        {/* Content Viewport with Fit-to-Screen Constraints */}
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-7xl w-full mx-auto">
          {/* Cascading Filter Bar (Shown in Overview, Telemetry, Predictive, and War Room) */}
          {(activeTab === "overview" || activeTab === "telemetry" || activeTab === "all" || activeTab === "predictive") && (
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
              theme={theme}
              hideMetricSelector={activeTab === "overview"}
            />
          )}

          {/* ── VIEW 0: EXECUTIVE OVERVIEW (15 PRIMARY KPIS, RECONCILIATION, COMPOSITION & BU TABLE) ── */}
          {(activeTab === "overview" || activeTab === "all") && (
            <div className="mb-6">
              <ExecutiveOverview
                bundle={overviewBundle}
                isLoading={isOverviewLoading}
                theme={theme}
              />
            </div>
          )}

          {/* ── VIEW 1: WORKFORCE TELEMETRY & TRENDS (COMPACT FIT TO SCREEN) ── */}
          {(activeTab === "telemetry" || activeTab === "all") && (
            <div className="space-y-4 mb-6">
              {/* Row 1: Compact Trend Pulse Cards */}
              {bundle && (
                <TrendPulseCards
                  cards={bundle.trend_pulse}
                  pulse={bundle.pulse}
                  metricLabel={metricLabel}
                  theme={theme}
                />
              )}

              {/* Row 2: 2-Column Responsive Layout (Main Chart & Heatmap Side-by-Side) */}
              {bundle && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-7">
                    <MainTrendChart
                      points={bundle.chart.points}
                      metricName={bundle.chart.metric_name}
                      metricFormat={bundle.chart.format}
                      benchmarkLabel={bundle.benchmark_label}
                      entityLabel={bundle.chart.entity_label}
                      policyEffectiveDate={bundle.policy_effective_date}
                      unit={bundle.chart.unit}
                      theme={theme}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <BusinessUnitHeatmap
                      months={bundle.heatmap.months}
                      rows={bundle.heatmap.rows}
                      metricLabel={metricLabel}
                      theme={theme}
                    />
                  </div>
                </div>
              )}

              {/* Row 3: Deterministic Attribution & Sentinel Insights */}
              {bundle && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <WhatChangedPanel decomposition={bundle.what_changed} theme={theme} />
                  <EmergingPatternsPanel patterns={bundle.patterns} theme={theme} />
                </div>
              )}

              {/* Collapsible Detailed Benchmark Table */}
              {bundle && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowDetailedBenchmarks(!showDetailedBenchmarks)}
                    className={`text-xs font-mono font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                      theme === "dark"
                        ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>{showDetailedBenchmarks ? "Hide" : "Show"} Detailed Department Benchmark Table</span>
                  </button>
                  {showDetailedBenchmarks && (
                    <div className="mt-3">
                      <BenchmarkTable
                        rows={bundle.benchmark_table.rows}
                        total={bundle.benchmark_table.total}
                        metricLabel={metricLabel}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── VIEW 2: AI PREDICTIVE SIGNALS & BURNOUT ── */}
          {(activeTab === "predictive" || activeTab === "all") && (
            <div className="mb-6">
              <PredictiveSignalsPanel
                businessUnit={selectedBU}
                department={selectedDept}
              />
            </div>
          )}

          {/* ── VIEW 3: WHAT-IF POLICY SIMULATION STUDIO ── */}
          {(activeTab === "simulation" || activeTab === "all") && (
            <div className="mb-6">
              <PolicySimulationStudio
                businessUnit={selectedBU}
              />
            </div>
          )}

          {/* ── VIEW 4: DATA CONNECTION HUB (KEKA & SLACK) ── */}
          {(activeTab === "connectors" || activeTab === "all") && (
            <div className="mb-6">
              <ConnectorsHub onSyncCompleted={loadInitialData} />
            </div>
          )}

          {/* ── VIEW 5: DESKTOP OPERATIONS SUITE ── */}
          {(activeTab === "operations" || activeTab === "all") && (
            <div className="mb-6">
              <DesktopOperationsSuite />
            </div>
          )}
        </main>
      </div>

      {/* Floating AI Workforce Decision Intelligence Copilot */}
      <WorkforceCopilot
        currentBundle={bundle}
        selectedMetricLabel={metricLabel}
      />
    </div>
  );
}
