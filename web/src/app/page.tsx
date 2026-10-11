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
import {
  fetchCascadedFilters,
  fetchHealth,
  fetchMetrics,
  fetchSnapshotMetadata,
  queryTrendIntelligence,
} from "@/lib/api";
import { CascadedFilters, MetricMetadata, SnapshotMetadata, TrendBundle } from "@/lib/types";

export default function WorkforceIntelligenceDashboard() {
  const [gatewayStatus, setGatewayStatus] = useState("checking");
  const [metadata, setMetadata] = useState<SnapshotMetadata | null>(null);
  const [metrics, setMetrics] = useState<MetricMetadata[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState("missing_swipe_rate");
  const [benchmarkType, setBenchmarkType] = useState("ORGANIZATION");

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

  // 1. Initial Load: Check gateway, fetch metrics, active snapshot
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

      // Load initial filter options
      const initialFilters = await fetchCascadedFilters({});
      setFilters(initialFilters);
    } catch (err) {
      console.error("Initial load failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      />

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Cascading Filter Bar */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
      </main>

      {/* Floating AI Workforce Decision Intelligence Copilot */}
      <WorkforceCopilot
        currentBundle={bundle}
        selectedMetricLabel={metricLabel}
      />
    </div>
  );
}
