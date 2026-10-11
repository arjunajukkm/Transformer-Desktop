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
  UserPersona,
  ConnectorsStatusResponse,
  KekaConfigPayload,
  SlackConfigPayload,
  KekaSyncResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

let _activePersonaId = "admin";
export function setActivePersonaId(id: string) { _activePersonaId = id; }
export function getActivePersonaId(): string { return _activePersonaId; }

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

  const res = await fetch(`${API_BASE}/analytics/filters/cascaded?${searchParams.toString()}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
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
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
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

  const res = await fetch(`${API_BASE}/ml/anomalies?${params.toString()}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to load punch anomalies");
  return await res.json();
}

export async function fetchBurnoutRisks(bu?: string | null, dept?: string | null, limit: number = 30): Promise<BurnoutRiskResponse> {
  const params = new URLSearchParams();
  if (bu && bu !== "All Business Units") params.append("business_unit", bu);
  if (dept && dept !== "All Departments") params.append("department", dept);
  params.append("limit", limit.toString());

  const res = await fetch(`${API_BASE}/ml/burnout-risks?${params.toString()}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to load burnout risk indicators");
  return await res.json();
}

export async function runPolicySimulation(payload: SimulationRequest): Promise<SimulationOutcome> {
  const res = await fetch(`${API_BASE}/ml/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Simulation execution failed" }));
    throw new Error(err.detail || "Failed to execute policy simulation");
  }
  return await res.json();
}

/* ── Enterprise Governance & Persona APIs ─────────────────────────── */

export async function fetchCurrentUser(): Promise<UserPersona> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to load current persona");
  return await res.json();
}

export async function fetchAvailablePersonas(): Promise<UserPersona[]> {
  const res = await fetch(`${API_BASE}/auth/personas`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load personas");
  return await res.json();
}

export async function switchPersona(personaId: string): Promise<UserPersona> {
  _activePersonaId = personaId;
  const res = await fetch(`${API_BASE}/auth/switch/${personaId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to switch persona");
  return await res.json();
}

/* ── Data Connection Hub (Keka & Slack) APIs ──────────────────────── */

export async function fetchConnectorsStatus(): Promise<ConnectorsStatusResponse> {
  const res = await fetch(`${API_BASE}/connectors/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load connectors status");
  return await res.json();
}

export async function testKekaConnection(config: KekaConfigPayload): Promise<{ success: boolean; message: string; latency_ms: number }> {
  const res = await fetch(`${API_BASE}/connectors/keka/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Keka test failed" }));
    throw new Error(err.detail || "Keka connection test failed");
  }
  return await res.json();
}

export async function saveKekaConfig(config: KekaConfigPayload): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/connectors/keka/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to persist Keka configuration");
  return await res.json();
}

export async function syncKekaPipeline(): Promise<KekaSyncResponse> {
  const res = await fetch(`${API_BASE}/connectors/keka/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Keka sync pipeline failed" }));
    throw new Error(err.detail || "Failed to trigger Keka sync pipeline");
  }
  return await res.json();
}

export async function testSlackConnection(config: SlackConfigPayload): Promise<{ success: boolean; message: string; bot_user?: string; latency_ms: number }> {
  const res = await fetch(`${API_BASE}/connectors/slack/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Slack test handshake failed");
  return await res.json();
}

export async function saveSlackConfig(config: SlackConfigPayload): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/connectors/slack/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to persist Slack configuration");
  return await res.json();
}

export async function dispatchSlackAlert(
  channel: string,
  alertType: string,
  title: string,
  message: string
): Promise<{ status: string; channel: string; sent_to_live_api?: boolean; execution_time_ms: number }> {
  const res = await fetch(`${API_BASE}/connectors/slack/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({ channel, alert_type: alertType, title, message }),
  });
  if (!res.ok) throw new Error("Failed to dispatch alert to Slack");
  return await res.json();
}
