/**
 * web/src/lib/api.ts
 * ──────────────────
 * Type-safe HTTP client connecting to the FastAPI Analytical Gateway.
 * Features sub-millisecond local routing and resilient fallbacks.
 */

import {
  CascadedFilters,
  MetricMetadata,
  SnapshotMetadata,
  TrendBundle,
  AnomalyResponse,
  BurnoutRiskResponse,
  SimulationRequest,
  SimulationOutcome,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function fetchHealth(): Promise<{ status: string; engine: string; dataset_loaded: string; dataset_id: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch (err) {
    return { status: "offline", engine: "Unknown", dataset_loaded: "false", dataset_id: "None" };
  }
}

export async function fetchMetrics(): Promise<MetricMetadata[]> {
  const res = await fetch(`${API_BASE}/analytics/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load metrics");
  return await res.json();
}

export async function fetchSnapshotMetadata(): Promise<SnapshotMetadata> {
  const res = await fetch(`${API_BASE}/snapshots/active`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load snapshot metadata");
  return await res.json();
}

export async function loadDemoDataset(): Promise<{ status: string; message: string; row_count: number }> {
  const res = await fetch(`${API_BASE}/snapshots/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load demo dataset");
  return await res.json();
}

export async function uploadDataset(file: File): Promise<{ status: string; dataset_id: string; row_count: number; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/snapshots/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return await res.json();
}

export async function fetchCascadedFilters(params: {
  business_unit?: string | null;
  department?: string | null;
  manager?: string | null;
}): Promise<CascadedFilters> {
  const searchParams = new URLSearchParams();
  if (params.business_unit && params.business_unit !== "All Business Units") {
    searchParams.append("business_unit", params.business_unit);
  }
  if (params.department && params.department !== "All Departments") {
    searchParams.append("department", params.department);
  }
  if (params.manager && params.manager !== "All Reporting Managers") {
    searchParams.append("manager", params.manager);
  }

  const res = await fetch(`${API_BASE}/analytics/filters/cascaded?${searchParams.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load cascaded filter options");
  return await res.json();
}

export async function queryTrendIntelligence(payload: {
  metric_id: string;
  benchmark_type?: string;
  business_unit?: string | null;
  department?: string | null;
  manager?: string | null;
  employee?: string | null;
}): Promise<TrendBundle> {
  const res = await fetch(`${API_BASE}/analytics/trends`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metric_id: payload.metric_id,
      benchmark_type: payload.benchmark_type || "ORGANIZATION",
      business_unit: payload.business_unit === "All Business Units" ? null : payload.business_unit,
      department: payload.department === "All Departments" ? null : payload.department,
      manager: payload.manager === "All Reporting Managers" ? null : payload.manager,
      employee: payload.employee === "All Employees" ? null : payload.employee,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Calculation failed" }));
    throw new Error(err.detail || "Failed to query trend intelligence");
  }
  return await res.json();
}

export async function fetchPunchAnomalies(bu?: string | null, dept?: string | null, limit: number = 40): Promise<AnomalyResponse> {
  const params = new URLSearchParams();
  if (bu && bu !== "All Business Units") params.append("business_unit", bu);
  if (dept && dept !== "All Departments") params.append("department", dept);
  params.append("limit", limit.toString());

  const res = await fetch(`${API_BASE}/ml/anomalies?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load punch anomalies");
  return await res.json();
}

export async function fetchBurnoutRisks(bu?: string | null, dept?: string | null, limit: number = 30): Promise<BurnoutRiskResponse> {
  const params = new URLSearchParams();
  if (bu && bu !== "All Business Units") params.append("business_unit", bu);
  if (dept && dept !== "All Departments") params.append("department", dept);
  params.append("limit", limit.toString());

  const res = await fetch(`${API_BASE}/ml/burnout-risks?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load burnout risk indicators");
  return await res.json();
}

export async function runPolicySimulation(payload: SimulationRequest): Promise<SimulationOutcome> {
  const res = await fetch(`${API_BASE}/ml/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Simulation execution failed" }));
    throw new Error(err.detail || "Failed to execute policy simulation");
  }
  return await res.json();
}
