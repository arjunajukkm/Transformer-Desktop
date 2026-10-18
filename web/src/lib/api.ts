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
  SchedulerStatusResponse,
  SchedulerConfigPayload,
  ExecutiveOverviewBundle,
  AvailableSyncMonthsResponse,
  DiffSummary,
  DiffRecord,
  DiffPayload,
  SyncJobStatus,
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

export async function fetchAvailableSyncMonths(): Promise<AvailableSyncMonthsResponse> {
  const res = await fetch(`${API_BASE}/connectors/keka/months`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch available sync months");
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
  clearClientAnalyticsCache();
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

// ── In-Memory Fast Client Cache ──
const overviewCache = new Map<string, ExecutiveOverviewBundle>();
const trendCache = new Map<string, TrendBundle>();

export function clearClientAnalyticsCache() {
  overviewCache.clear();
  trendCache.clear();
}

export async function queryTrendIntelligence(payload: {
  metric_id: string;
  benchmark_type?: string;
  business_unit?: string | null;
  department?: string | null;
  manager?: string | null;
  employee?: string | null;
  month?: string | null;
  peer_bu?: string | null;
  peer_department?: string | null;
}): Promise<TrendBundle> {
  const bu = payload.business_unit === "All Business Units" ? null : payload.business_unit;
  const dept = payload.department === "All Departments" ? null : payload.department;
  const mgr = payload.manager === "All Reporting Managers" ? null : payload.manager;
  const emp = payload.employee === "All Employees" ? null : payload.employee;
  const mo = payload.month && payload.month !== "all" ? payload.month : null;
  const peerBu = payload.peer_bu && payload.peer_bu !== "None" ? payload.peer_bu : null;
  const peerDept = payload.peer_department && payload.peer_department !== "None" ? payload.peer_department : null;

  const res = await fetch(`${API_BASE}/analytics/trends`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({
      metric_id: payload.metric_id,
      benchmark_type: payload.benchmark_type || "ORGANIZATION",
      business_unit: bu,
      department: dept,
      manager: mgr,
      employee: emp,
      month: mo,
      peer_bu: peerBu,
      peer_department: peerDept,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Calculation failed" }));
    throw new Error(err.detail || "Failed to query trend intelligence");
  }
  return await res.json();
}

export async function fetchExecutiveOverview(params: {
  business_unit?: string | null;
  department?: string | null;
  manager?: string | null;
  employee?: string | null;
  month?: string | null;
}): Promise<ExecutiveOverviewBundle> {
  const bu = params.business_unit === "All Business Units" ? null : params.business_unit;
  const dept = params.department === "All Departments" ? null : params.department;
  const mgr = params.manager === "All Reporting Managers" ? null : params.manager;
  const emp = params.employee === "All Employees" ? null : params.employee;
  const mo = params.month && params.month !== "all" ? params.month : null;

  const query = new URLSearchParams();
  if (bu) query.append("business_unit", bu);
  if (dept) query.append("department", dept);
  if (mgr) query.append("manager", mgr);
  if (emp) query.append("employee", emp);
  if (mo) query.append("month", mo);

  const res = await fetch(`${API_BASE}/analytics/overview?${query.toString()}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load executive overview" }));
    throw new Error(err.detail || "Failed to load executive overview");
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

export async function syncKekaPipeline(month: string = "all"): Promise<KekaSyncResponse> {
  const res = await fetch(`${API_BASE}/connectors/keka/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({ month }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Keka sync pipeline failed" }));
    throw new Error(err.detail || "Failed to trigger Keka sync pipeline");
  }
  clearClientAnalyticsCache();
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

/* ── Automated Background Pipeline & Digest APIs ─────────────────── */

export async function fetchSchedulerStatus(): Promise<SchedulerStatusResponse> {
  const res = await fetch(`${API_BASE}/connectors/scheduler/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load scheduler status");
  return await res.json();
}

export async function updateSchedulerConfig(config: SchedulerConfigPayload): Promise<SchedulerStatusResponse> {
  const res = await fetch(`${API_BASE}/connectors/scheduler/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update scheduler configuration");
  return await res.json();
}

export async function triggerSchedulerSync(): Promise<any> {
  const res = await fetch(`${API_BASE}/connectors/scheduler/trigger-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to trigger automated sync pipeline");
  return await res.json();
}

export async function triggerSchedulerDigest(channel?: string): Promise<any> {
  const url = channel
    ? `${API_BASE}/connectors/scheduler/trigger-digest?channel=${encodeURIComponent(channel)}`
    : `${API_BASE}/connectors/scheduler/trigger-digest`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to trigger morning Slack digest");
  return await res.json();
}

/* ── Daily Materialized Synchronization & Recalculation ─────────── */

export async function syncAndRecalculatePipeline(): Promise<{
  status: string;
  message: string;
  dataset_id: string;
  row_count: number;
  precalculation: any;
}> {
  clearClientAnalyticsCache();
  const res = await fetch(`${API_BASE}/snapshots/sync-and-recalculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Sync and recalculation failed" }));
    throw new Error(err.detail || "Sync and recalculation failed");
  }
  return await res.json();
}

/* ── Operations Suite & HR Tooling APIs ─────────────────────────── */

export interface TimeLeaveConsolidationResponse {
  status: string;
  message: string;
  total_records: number;
  unique_employees: number;
  conflicts_resolved: number;
  unclassified_records: number;
  duration_ms: number;
  output_file_name: string;
  download_url: string;
}

export async function runTimeLeaveConsolidation(): Promise<TimeLeaveConsolidationResponse> {
  const res = await fetch(`${API_BASE}/operations/time-leave/consolidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Consolidation failed" }));
    throw new Error(err.detail || "Consolidation failed");
  }
  return await res.json();
}

export interface AttendanceSummaryDistribution {
  total_records: number;
  unique_employees: number;
  present_pct: number;
  missing_swipe_pct: number;
  wfh_pct: number;
  leave_pct: number;
  absent_pct: number;
  week_off_pct: number;
  holiday_pct: number;
  regularized_pct: number;
  counts: {
    present: number;
    missing_swipe: number;
    wfh: number;
    leave: number;
    absent: number;
    week_off: number;
    holiday: number;
    regularized: number;
  };
}

export async function fetchAttendanceSummary(): Promise<AttendanceSummaryDistribution> {
  const res = await fetch(`${API_BASE}/operations/attendance-summary`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to fetch attendance summary distribution");
  return await res.json();
}

export async function exportAttendanceSummary(): Promise<{ status: string; message: string; file_name: string; download_url: string }> {
  const res = await fetch(`${API_BASE}/operations/attendance-summary/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to export attendance summary matrix");
  return await res.json();
}

export interface IdCardEmployeeItem {
  employee_number: string;
  name: string;
  designation: string;
  department: string;
  business_unit: string;
  email: string;
  phone?: string;
  location?: string;
  blood_group?: string;
  dob?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  office_address?: string;
}

export interface IdCardConfigResponse {
  slack: {
    connected: boolean;
    message: string;
    user: string;
    bot_id: string;
  };
  keka: {
    connected: boolean;
    message: string;
    subdomain: string;
  };
  default_excel_file: string;
  default_emails: string;
  latest_output_dir: string;
}

export interface IdCardPreviewMeta {
  design: "modern" | "classic";
  name: string;
  designation: string;
  employee_number: string;
  qr_code_value?: string;
  phone?: string;
  email?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  blood_group: string;
  dob?: string;
  location: string;
  office_address: string;
  organization_name: string;
  avatar_initials: string;
}

export interface IdCardJobResult {
  status: string;
  success: boolean;
  message: string;
  pdf_path?: string;
  report_path?: string;
  output_folder?: string;
  logs: string[];
  download_url?: string;
  download_report_url?: string;
  preview_meta?: IdCardPreviewMeta;
}

export async function fetchIdCardConfig(): Promise<IdCardConfigResponse> {
  const res = await fetch(`${API_BASE}/operations/id-cards/config`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to load ID card configuration");
  return await res.json();
}

export async function fetchOfficeAddresses(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/operations/id-cards/addresses`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to fetch office addresses");
  const data = await res.json();
  return data.addresses || {};
}

export async function saveOfficeAddresses(mapping: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/operations/id-cards/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({ mapping }),
  });
  if (!res.ok) throw new Error("Failed to save office addresses");
  const data = await res.json();
  return data.addresses || {};
}

export async function fetchIdCardEmployees(): Promise<{ count: number; employees: IdCardEmployeeItem[] }> {
  const res = await fetch(`${API_BASE}/operations/id-cards/employees`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to load employee roster for ID cards");
  return await res.json();
}

export async function fetchIdCardPreview(employeeCode: string, design: string = "modern"): Promise<IdCardPreviewMeta> {
  const res = await fetch(`${API_BASE}/operations/id-cards/preview/${encodeURIComponent(employeeCode)}?design=${encodeURIComponent(design)}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to load ID card preview");
  return await res.json();
}

export async function runIdCardPreviewJob(payload: {
  email: string;
  design: string;
  excel_path?: string;
  photos_dir?: string;
  photo_match_mode?: string;
  address_mapping?: Record<string, string>;
}): Promise<IdCardJobResult> {
  const res = await fetch(`${API_BASE}/operations/id-cards/preview-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Preview job failed" }));
    throw new Error(err.detail || "Preview job failed");
  }
  return await res.json();
}

export async function runIdCardEmailSync(payload: {
  emails: string;
  design: string;
  photos_dir?: string;
  photo_match_mode?: string;
  address_mapping?: Record<string, string>;
}): Promise<IdCardJobResult> {
  const res = await fetch(`${API_BASE}/operations/id-cards/email-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Email sync job failed" }));
    throw new Error(err.detail || "Email sync job failed");
  }
  return await res.json();
}

export async function runIdCardBulkJob(payload: {
  design: string;
  excel_path?: string;
  photos_dir?: string;
  photo_match_mode?: string;
  address_mapping?: Record<string, string>;
}): Promise<IdCardJobResult> {
  const res = await fetch(`${API_BASE}/operations/id-cards/bulk-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Bulk job failed" }));
    throw new Error(err.detail || "Bulk job failed");
  }
  return await res.json();
}

export async function openIdCardSystemFolder(path?: string): Promise<{ status: string; message: string; path?: string }> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await fetch(`${API_BASE}/operations/id-cards/open-system-folder${q}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) throw new Error("Failed to open output directory");
  return await res.json();
}

export async function generateIdCardPdf(payload: { employee_code: string; design?: string; download?: boolean }): Promise<{ status: string; download_url?: string }> {
  return { status: "success", download_url: `/api/operations/id-cards/download-file?filename=preview_${payload.employee_code}.pdf` };
}

export async function startKekaSyncJob(
  month: string = "all",
  includePriorMonth: boolean = true
): Promise<{ status: string; job_id: string; month: string }> {
  const res = await fetch(`${API_BASE}/connectors/keka/sync-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Persona-Id": _activePersonaId,
    },
    body: JSON.stringify({ month, include_prior_month: includePriorMonth }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to initiate sync job" }));
    throw new Error(err.detail || "Failed to initiate sync job");
  }
  return await res.json();
}

export async function fetchKekaSyncJobStatus(jobId: string): Promise<SyncJobStatus> {
  const res = await fetch(`${API_BASE}/connectors/keka/sync-job/${jobId}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) {
    throw new Error("Failed to check sync job status");
  }
  return await res.json();
}

export async function fetchMonthLatestDiff(month: string): Promise<DiffPayload> {
  const res = await fetch(`${API_BASE}/connectors/keka/diff/${encodeURIComponent(month)}`, {
    cache: "no-store",
    headers: { "X-Persona-Id": _activePersonaId },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch differential report");
  }
  return await res.json();
}

export async function syncKekaWithFile(file: File, month?: string): Promise<{
  status: string;
  message: string;
  imported_months: string[];
  total_records: number;
  diff_summary: DiffSummary | null;
  diff_records: DiffRecord[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  if (month) formData.append("month", month);

  const res = await fetch(`${API_BASE}/connectors/keka/sync-file`, {
    method: "POST",
    headers: {
      "X-Persona-Id": _activePersonaId,
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "File sync failed" }));
    throw new Error(err.detail || "File sync failed");
  }
  return await res.json();
}
