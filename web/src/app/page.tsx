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
import { DataSyncCenter } from "@/components/DataSyncCenter";
import {
  fetchCascadedFilters,
  fetchHealth,
  fetchMetrics,
  fetchSnapshotMetadata,
  queryTrendIntelligence,
  fetchExecutiveOverview,
  syncKekaPipeline,
  syncAndRecalculatePipeline,
} from "@/lib/api";
import { Zap } from "lucide-react";
import {
  CascadedFilters,
  MetricMetadata,
  SnapshotMetadata,
  TrendBundle,
  ExecutiveOverviewBundle,
} from "@/lib/types";
import {
  TopLaserProgressBar,
  WorkforceLoadingOverlay,
  ChartLoadingOverlay,
} from "@/components/WorkforceLoadingExperience";

type ActiveTab = "overview" | "telemetry" | "predictive" | "simulation" | "datasync" | "connectors" | "operations";

export default function WorkforceIntelligenceDashboard() {
  const [gatewayStatus, setGatewayStatus] = useState("checking");
  const [metadata, setMetadata] = useState<SnapshotMetadata | null>(null);
  const [metrics, setMetrics] = useState<MetricMetadata[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState("missing_swipe_rate");
  const [benchmarkType, setBenchmarkType] = useState("ORGANIZATION");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDetailedBenchmarks, setShowDetailedBenchmarks] = useState(true);
  const [benchmarkDimension, setBenchmarkDimension] = useState<"bu" | "dept">("bu");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTrendLoading, setIsTrendLoading] = useState(false);

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
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [peerBU, setPeerBU] = useState<string | null>(null);
  const [peerDept, setPeerDept] = useState<string | null>(null);
  const [allBUs, setAllBUs] = useState<string[]>([]);
  const [allDepts, setAllDepts] = useState<string[]>([]);

  const [bundle, setBundle] = useState<TrendBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [overviewBundle, setOverviewBundle] = useState<ExecutiveOverviewBundle | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Bidirectional sync for selectedMonth <-> URL query param (?month=2026-07)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("month");
      if (m && m !== selectedMonth) {
        setSelectedMonth(m);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (selectedMonth && selectedMonth !== "all") {
        if (url.searchParams.get("month") !== selectedMonth) {
          url.searchParams.set("month", selectedMonth);
          window.history.replaceState({}, "", url.toString());
        }
      } else {
        if (url.searchParams.has("month")) {
          url.searchParams.delete("month");
          window.history.replaceState({}, "", url.toString());
        }
      }
    }
  }, [selectedMonth]);

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
      setAllBUs(initialFilters.business_units);
      setAllDepts(initialFilters.departments);

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

  // 3. Trend Intelligence Query (only executed when Telemetry tab is visible)
  useEffect(() => {
    if (activeTab !== "telemetry") return;
    const fetchTrendData = async () => {
      setIsTrendLoading(true);
      try {
        const res = await queryTrendIntelligence({
          metric_id: selectedMetricId,
          benchmark_type: benchmarkType,
          business_unit: selectedBU,
          department: selectedDept,
          manager: selectedManager,
          employee: selectedEmployee,
          month: selectedMonth,
          peer_bu: peerBU,
          peer_department: peerDept,
        });
        setBundle(res);
      } catch (err) {
        console.error("Trend query failed:", err);
      } finally {
        setIsTrendLoading(false);
      }
    };

    fetchTrendData();
  }, [activeTab, selectedMetricId, benchmarkType, selectedBU, selectedDept, selectedManager, selectedEmployee, selectedMonth, refreshKey, peerBU, peerDept]);

  // 4. Executive Overview Query (only executed when Overview tab is visible)
  const loadOverview = useCallback(async (monthOverride?: string) => {
    setIsOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetchExecutiveOverview({
        business_unit: selectedBU,
        department: selectedDept,
        manager: selectedManager,
        employee: selectedEmployee,
        month: monthOverride || selectedMonth,
      });
      setOverviewBundle(res);
      setOverviewError(null);
    } catch (err: unknown) {
      console.error("Failed to fetch executive overview:", err);
      const message = err instanceof Error ? err.message : "Failed to load executive overview analytics.";
      setOverviewError(message);
    } finally {
      setIsOverviewLoading(false);
    }
  }, [selectedBU, selectedDept, selectedManager, selectedEmployee, selectedMonth]);

  useEffect(() => {
    if (activeTab === "overview") {
      loadOverview();
    }
  }, [activeTab, loadOverview]);

  const handleRealTimeSync = async (month: string = selectedMonth) => {
    setIsSyncing(true);
    try {
      await syncKekaPipeline(month);
      setRefreshKey((k) => k + 1);
      await Promise.all([
        loadInitialData(),
        loadOverview(month),
      ]);
    } catch (err) {
      console.error("Failed to sync real-time workforce stream:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAndRecalculate = async () => {
    setIsSyncing(true);
    try {
      await syncAndRecalculatePipeline();
      setRefreshKey((k) => k + 1);
      await Promise.all([
        loadInitialData(),
        loadOverview(),
      ]);
    } catch (err) {
      console.error("Failed to sync & precalculate workforce cache:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentMetric = metrics.find((m) => m.id === selectedMetricId);
  const metricLabel = currentMetric?.label || "Missing Swipe Rate";

  const tabTitles: Record<ActiveTab, string> = {
    overview: "Executive Overview",
    telemetry: "Telemetry & Trends",
    predictive: "Predictive Signals",
    simulation: "Policy Studio",
    datasync: "Data Sync Command Center",
    connectors: "Connectors & CDC",
    operations: "Operations Suite",
  };

  return (
    <div className="min-h-screen flex font-sans bg-transparent text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* ── Top-Edge Precision Laser Progress Bar for Live Data Queries ── */}
      <TopLaserProgressBar active={isLoading || isOverviewLoading || isSyncing || isTrendLoading} />

      {/* ── Futuristic Holographic Loading Modal during Live Sync ── */}
      <WorkforceLoadingOverlay isOpen={isSyncing} onClose={() => setIsSyncing(false)} />

      {/* ── Left Collapsible Sidebar Navigation ── */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab as ActiveTab)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onPersonaChanged={async () => {
          await loadInitialData();
          if (activeTab === "overview") {
            await loadOverview();
          }
        }}
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
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onRefresh={async () => {
            await loadInitialData();
            if (activeTab === "overview") {
              await loadOverview();
            }
          }}
          onRealTimeSync={handleRealTimeSync}
          onSyncAndRecalculate={handleSyncAndRecalculate}
        />

        {/* Content Viewport with Fit-to-Screen Constraints */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 max-w-[1600px] w-full mx-auto pb-16">
          {/* Cascading Filter Bar (Shown in Overview, Telemetry, and Predictive) */}
          {(activeTab === "overview" || activeTab === "telemetry" || activeTab === "predictive") && (
            <div className="relative z-30">
              <FilterBar
                metrics={metrics}
                selectedMetricId={selectedMetricId}
                onSelectMetric={setSelectedMetricId}
                benchmarkType={benchmarkType}
                onSelectBenchmarkType={setBenchmarkType}
                filters={filters}
                allBusinessUnits={allBUs}
                allDepartments={allDepts}
                selectedBU={selectedBU}
                onSelectBU={(bu) => {
                  setSelectedBU(bu);
                  if (peerBU === bu) setPeerBU(null);
                  setSelectedDept("All Departments");
                  setSelectedManager("All Reporting Managers");
                  setSelectedEmployee("All Employees");
                }}
                selectedDept={selectedDept}
                onSelectDept={(dept) => {
                  setSelectedDept(dept);
                  if (peerDept === dept) setPeerDept(null);
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
                selectedPeerBU={peerBU}
                selectedPeerDept={peerDept}
                onSelectPeer={(type, name) => {
                  if (type === "bu") {
                    setPeerBU(name);
                    setPeerDept(null);
                  } else if (type === "dept") {
                    setPeerDept(name);
                    setPeerBU(null);
                  } else {
                    setPeerBU(null);
                    setPeerDept(null);
                  }
                }}
                hideMetricSelector={activeTab === "overview"}
              />
            </div>
          )}

          {/* ── VIEW 0: EXECUTIVE OVERVIEW (15 PRIMARY KPIS, RECONCILIATION, COMPOSITION & BU TABLE) ── */}
          {activeTab === "overview" && (
            <div className="mb-6 relative z-10">
              <ExecutiveOverview
                bundle={overviewBundle}
                isLoading={isOverviewLoading}
                error={overviewError}
                onRetry={loadOverview}
                onResetFilters={() => {
                  setSelectedBU("All Business Units");
                  setSelectedDept("All Departments");
                  setSelectedManager("All Reporting Managers");
                  setSelectedEmployee("All Employees");
                }}
              />
            </div>
          )}

          {/* ── VIEW 1: WORKFORCE TELEMETRY & TRENDS (COMPACT FIT TO SCREEN) ── */}
          {activeTab === "telemetry" && (
            <div className="space-y-4 mb-6">
              {/* Row 0: Minimalist Telemetry Stream Status */}
              <div className="px-3.5 py-1.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-all bg-slate-900/40 border-slate-800 text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold text-emerald-400 text-[11px] tracking-wide">
                    {metadata?.dataset_id?.startsWith("keka_live_sync") ? "LIVE HRMS STREAM ACTIVE" : "TELEMETRY & TREND STREAM"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 text-[11px]">
                    {bundle ? `${bundle.chart.points.length} observed periods • Benchmark: ${bundle.benchmark_label}` : "Streaming active data"}
                  </span>
                </div>
                {isTrendLoading && (
                  <span className="text-[11px] text-cyan-400 flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Updating...
                  </span>
                )}
              </div>

              {/* Row 1: Compact Trend Pulse Cards */}
              {bundle && (
                <TrendPulseCards
                  cards={bundle.trend_pulse}
                  pulse={bundle.pulse}
                  metricLabel={metricLabel}
                  metricId={selectedMetricId}
                  metricDirection={currentMetric?.direction}
                  benchmarkLabel={bundle.benchmark_label}
                  entityLabel={bundle.chart.entity_label}
                />
              )}

              {/* Row 2: 2-Column Responsive Layout (Main Chart & Heatmap Side-by-Side) */}
              {bundle && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <div className="flex flex-col relative">
                    <MainTrendChart
                      points={bundle.chart.points}
                      metricName={bundle.chart.metric_name}
                      metricFormat={bundle.chart.format}
                      benchmarkLabel={bundle.benchmark_label}
                      entityLabel={bundle.chart.entity_label}
                      policyEffectiveDate={bundle.policy_effective_date}
                      unit={bundle.chart.unit}
                      referenceRange={bundle.chart.reference_range}
                      comparisonMode={bundle.chart.comparison_mode}
                      deptLabel={bundle.chart.dept_label}
                      buLabel={bundle.chart.bu_label}
                      orgLabel={bundle.chart.org_label}
                      peerLabel={(peerBU || peerDept) ? bundle.chart.peer_label : undefined}
                      metricId={selectedMetricId}
                      metricDirection={currentMetric?.direction}
                    />
                    <ChartLoadingOverlay active={isTrendLoading} />
                  </div>
                  <div className="flex flex-col">
                    <BusinessUnitHeatmap
                      months={bundle.heatmap.months}
                      rows={bundle.heatmap.rows}
                      metricLabel={metricLabel}
                      lowerIsBetter={bundle.heatmap.lower_is_better}
                      metricId={bundle.heatmap.metric_id || bundle.chart.metric_id}
                      metricDirection={bundle.heatmap.metric_direction || bundle.chart.direction}
                      orgBenchmarks={bundle.heatmap.org_benchmarks}
                    />
                  </div>
                </div>
              )}

              {/* Row 3: Deterministic Attribution & Sentinel Insights */}
              {bundle && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col min-h-0">
                    <WhatChangedPanel decomposition={bundle.what_changed} />
                  </div>
                  <div className="flex flex-col min-h-0">
                    <EmergingPatternsPanel patterns={bundle.patterns} />
                  </div>
                </div>
              )}

              {/* Detailed Multi-Dimension Benchmark Table with Integrated BU & Department Tabs */}
              {bundle && (
                <div className="pt-1">
                  <BenchmarkTable
                    buRows={bundle.benchmark_table.rows}
                    deptRows={bundle.dept_benchmark_table?.rows || []}
                    total={bundle.benchmark_table.total}
                    metricLabel={metricLabel}
                    collapsible={true}
                    lowerIsBetter={bundle.heatmap.lower_is_better ?? bundle.chart.lower_is_better}
                    metricDirection={bundle.heatmap.metric_direction || bundle.chart.direction}
                    metricId={bundle.heatmap.metric_id || bundle.chart.metric_id}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── VIEW 2: AI PREDICTIVE SIGNALS & BURNOUT ── */}
          {activeTab === "predictive" && (
            <div className="mb-6">
              <PredictiveSignalsPanel
                businessUnit={selectedBU}
                department={selectedDept}
              />
            </div>
          )}

          {/* ── VIEW 3: WHAT-IF POLICY SIMULATION STUDIO ── */}
          {activeTab === "simulation" && (
            <div className="mb-6">
              <PolicySimulationStudio
                businessUnit={selectedBU}
              />
            </div>
          )}

          {/* ── VIEW 4: DATA SYNC COMMAND CENTER ── */}
          {activeTab === "datasync" && (
            <div className="mb-6">
              <DataSyncCenter
                onSyncCompleted={async () => {
                  setRefreshKey((k) => k + 1);
                  await Promise.all([loadInitialData(), loadOverview()]);
                }}
              />
            </div>
          )}

          {/* ── VIEW 5: DATA CONNECTION HUB (KEKA & SLACK) ── */}
          {activeTab === "connectors" && (
            <div className="mb-6">
              <ConnectorsHub onSyncCompleted={loadInitialData} />
            </div>
          )}

          {/* ── VIEW 5: DESKTOP OPERATIONS SUITE ── */}
          {activeTab === "operations" && (
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
