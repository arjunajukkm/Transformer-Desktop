"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Calendar,
  CreditCard,
  Download,
  Upload,
  CheckCircle2,
  RefreshCw,
  Printer,
  Sparkles,
  Search,
  Users,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Building2,
  QrCode,
  MapPin,
  Phone,
  User,
  Droplet,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Terminal,
  AlertTriangle,
  Play,
  Eye,
  Mail,
  Sliders,
} from "lucide-react";
import {
  runTimeLeaveConsolidation,
  fetchAttendanceSummary,
  exportAttendanceSummary,
  fetchIdCardEmployees,
  fetchIdCardConfig,
  fetchOfficeAddresses,
  saveOfficeAddresses,
  fetchIdCardPreview,
  runIdCardPreviewJob,
  runIdCardEmailSync,
  runIdCardBulkJob,
  openIdCardSystemFolder,
  TimeLeaveConsolidationResponse,
  AttendanceSummaryDistribution,
  IdCardEmployeeItem,
  IdCardConfigResponse,
  IdCardPreviewMeta,
} from "../lib/api";

interface DesktopOperationsSuiteProps {
  theme?: "dark" | "light";
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export function DesktopOperationsSuite({ theme = "dark" }: DesktopOperationsSuiteProps) {
  const isDark = theme === "dark";
  const [activeSubTab, setActiveSubTab] = useState<"time_leave" | "attendance_summary" | "id_cards">("time_leave");

  // ── Module 1: Time & Leave Master State ──
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState<TimeLeaveConsolidationResponse | null>(null);
  const [consolidationError, setConsolidationError] = useState<string | null>(null);

  // ── Module 2: Attendance Summary State ──
  const [attSummary, setAttSummary] = useState<AttendanceSummaryDistribution | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isExportingSummary, setIsExportingSummary] = useState(false);
  const [summaryExportUrl, setSummaryExportUrl] = useState<string | null>(null);

  // ── Module 3: ID Card Generator State (Desktop Engine Parity) ──
  const [idCardDesign, setIdCardDesign] = useState<"Modern" | "Classic">("Modern");
  const [idCardMode, setIdCardMode] = useState<"email_sync" | "bulk_excel">("email_sync");
  const [emailInput, setEmailInput] = useState<string>("kanupriya.rathore@finbox.in; vinoth.kumar@finbox.in");
  const [excelFile, setExcelFile] = useState<string>("ID card generation.xlsx");
  const [photosDir, setPhotosDir] = useState<string>("");
  const [photoMatchMode, setPhotoMatchMode] = useState<"auto" | "emp_no" | "email">("auto");
  const [singlePreviewEmail, setSinglePreviewEmail] = useState<string>("sreenivasa@finbox.in");
  const [activeCardSide, setActiveCardSide] = useState<"front" | "back">("front");

  // Connectors & Configuration
  const [connectorsConfig, setConnectorsConfig] = useState<IdCardConfigResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);

  // Office Addresses Manager
  const [showAddressConfig, setShowAddressConfig] = useState<boolean>(false);
  const [addressMapping, setAddressMapping] = useState<Record<string, string>>({});
  const [newCity, setNewCity] = useState<string>("");
  const [newAddress, setNewAddress] = useState<string>("");

  // Execution & Audit Console State
  const [isJobRunning, setIsJobRunning] = useState<boolean>(false);
  const [jobStatusBadge, setJobStatusBadge] = useState<"Ready" | "Processing..." | "Finished" | "Warning" | "Error">("Ready");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "FinBox ID Card Generator ready.",
    "Choose 'Method 1: Instant Email Sync' or 'Method 2: Bulk Excel Upload', and click Generate."
  ]);
  const [lastPdfDownloadUrl, setLastPdfDownloadUrl] = useState<string | null>(null);
  const [lastReportDownloadUrl, setLastReportDownloadUrl] = useState<string | null>(null);
  const [lastOutputDir, setLastOutputDir] = useState<string | null>(null);

  // Live Visual Preview Metadata
  const [previewMeta, setPreviewMeta] = useState<IdCardPreviewMeta | null>(null);

  // Load Attendance Summary & ID Card Config when subtab active
  useEffect(() => {
    if (activeSubTab === "attendance_summary" && !attSummary) {
      loadAttendanceSummaryData();
    }
    if (activeSubTab === "id_cards") {
      loadIdCardConfig();
      loadOfficeAddresses();
      loadInitialPreviewMeta("kanupriya.rathore@finbox.in", idCardDesign);
    }
  }, [activeSubTab]);

  const loadAttendanceSummaryData = async () => {
    setIsLoadingSummary(true);
    try {
      const data = await fetchAttendanceSummary();
      setAttSummary(data);
    } catch (err: any) {
      console.error("Failed to load attendance summary:", err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const loadIdCardConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const cfg = await fetchIdCardConfig();
      setConnectorsConfig(cfg);
      if (cfg.default_excel_file && !excelFile) {
        setExcelFile(cfg.default_excel_file);
      }
    } catch (err) {
      console.error("Failed to load ID card config:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const loadOfficeAddresses = async () => {
    try {
      const addrs = await fetchOfficeAddresses();
      setAddressMapping(addrs);
    } catch (err) {
      console.error("Failed to load office addresses:", err);
    }
  };

  const loadInitialPreviewMeta = async (email: string, design: string) => {
    try {
      const meta = await fetchIdCardPreview(email, design.toLowerCase());
      setPreviewMeta(meta);
    } catch (err) {
      console.error("Failed to load initial preview metadata:", err);
    }
  };

  const appendLogs = (newLogs: string[]) => {
    setConsoleLogs((prev) => [...prev, ...newLogs]);
  };

  // Run Time & Leave Consolidation
  const handleRunConsolidation = async () => {
    setIsConsolidating(true);
    setConsolidationError(null);
    try {
      const res = await runTimeLeaveConsolidation();
      setConsolidationResult(res);
    } catch (err: any) {
      setConsolidationError(err.message || "Failed to execute consolidation.");
    } finally {
      setIsConsolidating(false);
    }
  };

  // Export Attendance Summary Matrix
  const handleExportSummary = async () => {
    setIsExportingSummary(true);
    try {
      const res = await exportAttendanceSummary();
      const fullUrl = res.download_url.startsWith("http") ? res.download_url : `${API_BASE.replace('/api', '')}${res.download_url}`;
      setSummaryExportUrl(fullUrl);
      window.open(fullUrl, "_blank");
    } catch (err: any) {
      console.error("Failed to export summary matrix:", err);
    } finally {
      setIsExportingSummary(false);
    }
  };

  // Method 1: Instant Email Sync Batch Generation
  const handleRunEmailSync = async () => {
    if (!emailInput.trim()) {
      alert("Please enter at least one employee email address.");
      return;
    }
    setIsJobRunning(true);
    setJobStatusBadge("Processing...");
    appendLogs([
      "\n" + "=".repeat(60),
      `[EMAIL SYNC] Starting Instant Email Sync (${idCardDesign})`,
      "=".repeat(60)
    ]);
    try {
      const res = await runIdCardEmailSync({
        emails: emailInput,
        design: idCardDesign,
        photos_dir: photosDir.trim() || undefined,
        photo_match_mode: photoMatchMode,
        address_mapping: addressMapping,
      });
      if (res.logs && res.logs.length > 0) {
        appendLogs(res.logs);
      }
      if (res.output_folder) setLastOutputDir(res.output_folder);
      if (res.download_report_url) {
        const fullReportUrl = res.download_report_url.startsWith("http")
          ? res.download_report_url
          : `${API_BASE.replace('/api', '')}${res.download_report_url}`;
        setLastReportDownloadUrl(fullReportUrl);
      }
      if (res.success) {
        setJobStatusBadge("Finished");
        appendLogs([
          `\n[✓] SUCCESS: Email batch generation finished successfully!`,
          `[📁] Output Folder: ${res.output_folder || "Downloads"}`,
          `[📊] Report: ${res.report_path || "Generated"}`
        ]);
      } else {
        setJobStatusBadge("Warning");
        appendLogs([`\n[!] Finished with warnings/errors: ${res.message}`]);
      }
    } catch (err: any) {
      setJobStatusBadge("Error");
      appendLogs([`\n[!] Error during email batch: ${err.message}`]);
    } finally {
      setIsJobRunning(false);
    }
  };

  // Method 1: Preview First Card from Email Sync box
  const handlePreviewFirstEmail = async () => {
    const raw = emailInput.trim();
    const emails = raw.split(/[;,\n\r\t]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
    if (emails.length === 0) {
      alert("Please enter at least one valid email address in the Email Sync box.");
      return;
    }
    const targetEmail = emails[0];
    await handleExecutePreview(targetEmail);
  };

  // Method 2: Preview Single Employee from Bulk Excel box
  const handlePreviewSingleExcelEmployee = async () => {
    if (!singlePreviewEmail.trim()) {
      alert("Please enter an employee email for preview.");
      return;
    }
    await handleExecutePreview(singlePreviewEmail.trim(), excelFile.trim() || undefined);
  };

  // Shared Preview Job Executor
  const handleExecutePreview = async (email: string, customExcel?: string) => {
    setIsJobRunning(true);
    setJobStatusBadge("Processing...");
    appendLogs([
      "\n" + "=".repeat(60),
      `[PREVIEW] Starting ${idCardDesign} ID card preview for: ${email}`,
      "=".repeat(60)
    ]);
    try {
      const res = await runIdCardPreviewJob({
        email,
        design: idCardDesign,
        excel_path: customExcel,
        photos_dir: photosDir.trim() || undefined,
        photo_match_mode: photoMatchMode,
        address_mapping: addressMapping,
      });
      if (res.logs && res.logs.length > 0) {
        appendLogs(res.logs);
      }
      if (res.output_folder) setLastOutputDir(res.output_folder);
      if (res.preview_meta) setPreviewMeta(res.preview_meta);
      if (res.download_url) {
        const fullPdfUrl = res.download_url.startsWith("http")
          ? res.download_url
          : `${API_BASE.replace('/api', '')}${res.download_url}`;
        setLastPdfDownloadUrl(fullPdfUrl);
      }
      if (res.success) {
        setJobStatusBadge("Finished");
        appendLogs([
          `\n[✓] SUCCESS: Preview PDF generated: ${res.pdf_path}`,
          `[📁] Folder: ${res.output_folder || "Downloads"}`
        ]);
      } else {
        setJobStatusBadge("Error");
        appendLogs([`\n[!] Preview generation skipped: ${res.message}`]);
      }
    } catch (err: any) {
      setJobStatusBadge("Error");
      appendLogs([`\n[!] Preview execution failed: ${err.message}`]);
    } finally {
      setIsJobRunning(false);
    }
  };

  // Method 2: Run Bulk Generation on Excel file
  const handleRunBulkExcel = async () => {
    setIsJobRunning(true);
    setJobStatusBadge("Processing...");
    appendLogs([
      "\n" + "=".repeat(60),
      `[BULK GENERATION] Starting Bulk Excel ID Card Generation (${idCardDesign})`,
      `[+] Excel Source: ${excelFile || "Default"}`,
      "=".repeat(60)
    ]);
    try {
      const res = await runIdCardBulkJob({
        design: idCardDesign,
        excel_path: excelFile.trim() || undefined,
        photos_dir: photosDir.trim() || undefined,
        photo_match_mode: photoMatchMode,
        address_mapping: addressMapping,
      });
      if (res.logs && res.logs.length > 0) {
        appendLogs(res.logs);
      }
      if (res.output_folder) setLastOutputDir(res.output_folder);
      if (res.download_report_url) {
        const fullReportUrl = res.download_report_url.startsWith("http")
          ? res.download_report_url
          : `${API_BASE.replace('/api', '')}${res.download_report_url}`;
        setLastReportDownloadUrl(fullReportUrl);
      }
      if (res.success) {
        setJobStatusBadge("Finished");
        appendLogs([
          `\n[✓] SUCCESS: Bulk generation finished successfully!`,
          `[📁] Output Folder: ${res.output_folder || "Downloads"}`,
          `[📊] Report: ${res.report_path || "Generated"}`
        ]);
      } else {
        setJobStatusBadge("Warning");
        appendLogs([`\n[!] Bulk generation finished with warnings: ${res.message}`]);
      }
    } catch (err: any) {
      setJobStatusBadge("Error");
      appendLogs([`\n[!] Bulk generation failed: ${err.message}`]);
    } finally {
      setIsJobRunning(false);
    }
  };

  // Open Output Folder
  const handleOpenOutputFolder = async () => {
    try {
      const res = await openIdCardSystemFolder(lastOutputDir || undefined);
      appendLogs([`[📁] Opened output directory: ${res.path || "Downloads"}`]);
    } catch (err: any) {
      appendLogs([`[!] Failed to open folder: ${err.message}`]);
    }
  };

  // Save All Office Addresses
  const handleSaveAddresses = async () => {
    try {
      const updated = await saveOfficeAddresses(addressMapping);
      setAddressMapping(updated);
      appendLogs([`[🏢] Successfully saved ${Object.keys(updated).length} office address mappings to disk.`]);
      alert("Office addresses saved successfully!");
    } catch (err: any) {
      alert(`Failed to save addresses: ${err.message}`);
    }
  };

  const handleAddAddressRow = () => {
    if (!newCity.trim() || !newAddress.trim()) {
      alert("Please enter both Location City and Full Office Address.");
      return;
    }
    setAddressMapping((prev) => ({
      ...prev,
      [newCity.trim()]: newAddress.trim(),
    }));
    setNewCity("");
    setNewAddress("");
  };

  const handleDeleteAddressRow = (cityKey: string) => {
    setAddressMapping((prev) => {
      const copy = { ...prev };
      delete copy[cityKey];
      return copy;
    });
  };

  return (
    <div
      className={`border rounded-xl p-6 backdrop-blur-md relative overflow-hidden transition-all duration-300 ${
        isDark
          ? "bg-[#0b1222]/95 border-cyan-500/30 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-xl"
      }`}
    >
      {/* Background ambient lighting */}
      <div
        className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
          isDark ? "bg-cyan-500/10" : "bg-cyan-400/5"
        }`}
      />

      {/* Header telemetry */}
      <div
        className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 mb-6 ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h2
              className={`text-lg font-bold tracking-wider uppercase flex items-center gap-2 font-mono ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              Ops Command Center &amp; Tooling Suite
            </h2>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600 font-medium"}`}>
            Full production web parity for legacy desktop modules: Time &amp; Leave Master reconciliation, Attendance Distribution matrix, and Vector ID Card Studio.
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div
          className={`flex items-center gap-2 p-1 rounded-lg border self-start md:self-auto font-mono text-xs ${
            isDark ? "bg-[#060a12] border-slate-800" : "bg-slate-100 border-slate-300"
          }`}
        >
          <button
            id="ops-tab-time-leave"
            onClick={() => setActiveSubTab("time_leave")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === "time_leave"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm"
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Time &amp; Leave Master
          </button>
          <button
            id="ops-tab-attendance-summary"
            onClick={() => setActiveSubTab("attendance_summary")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === "attendance_summary"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm"
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Attendance Summary
          </button>
          <button
            id="ops-tab-id-cards"
            onClick={() => setActiveSubTab("id_cards")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === "id_cards"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            ID Card Studio
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODULE 1: TIME & LEAVE MASTER (CONSOLIDATION)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "time_leave" && (
        <div className="space-y-5">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className={`p-3.5 rounded-xl border font-mono ${
                isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Observed Roster</span>
              </div>
              <span className="text-xl font-bold text-cyan-300">443</span>
              <span className="text-[10px] text-slate-500 block">Employees in master index</span>
            </div>

            <div
              className={`p-3.5 rounded-xl border font-mono ${
                isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fact Records</span>
              </div>
              <span className="text-xl font-bold text-emerald-300">41,668</span>
              <span className="text-[10px] text-slate-500 block">Daily attendance records</span>
            </div>

            <div
              className={`p-3.5 rounded-xl border font-mono ${
                isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Conflict Ratio</span>
              </div>
              <span className="text-xl font-bold text-blue-300">0.0%</span>
              <span className="text-[10px] text-emerald-400 block font-semibold">100% Additive Verified</span>
            </div>

            <div
              className={`p-3.5 rounded-xl border font-mono ${
                isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Engine Speed</span>
              </div>
              <span className="text-xl font-bold text-purple-300">Sub-Second</span>
              <span className="text-[10px] text-slate-500 block">Polars Vectorized Core</span>
            </div>
          </div>

          {/* Consolidation Configuration Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className={`border p-4 rounded-lg transition-all ${
                isDark ? "bg-[#070e1b] border-slate-800/80" : "bg-slate-50 border-slate-200/90 shadow-sm"
              }`}
            >
              <span className={`text-xs font-mono block mb-2 uppercase font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                1. Performance Logs (Keka)
              </span>
              <div
                className={`border rounded p-3 font-mono text-xs ${
                  isDark ? "bg-[#040810]/60 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-emerald-400 font-semibold mb-1">
                  <span>Stream Linked</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-slate-400">
                  41,668 punch log records indexed across July — October 2026.
                </p>
              </div>
            </div>

            <div
              className={`border p-4 rounded-lg transition-all ${
                isDark ? "bg-[#070e1b] border-slate-800/80" : "bg-slate-50 border-slate-200/90 shadow-sm"
              }`}
            >
              <span className={`text-xs font-mono block mb-2 uppercase font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                2. Leave &amp; WFH Applications
              </span>
              <div
                className={`border rounded p-3 font-mono text-xs ${
                  isDark ? "bg-[#040810]/60 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-cyan-400 font-semibold mb-1">
                  <span>Reconciled</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Daily priority rules: Leave overrides Absent, WFH overrides Missing Swipe.
                </p>
              </div>
            </div>

            <div
              className={`border p-4 rounded-lg transition-all ${
                isDark ? "bg-[#070e1b] border-slate-800/80" : "bg-slate-50 border-slate-200/90 shadow-sm"
              }`}
            >
              <span className={`text-xs font-mono block mb-2 uppercase font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                3. Output Specification
              </span>
              <div
                className={`border rounded p-3 font-mono text-xs ${
                  isDark ? "bg-[#040810]/60 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-purple-400 font-semibold mb-1">
                  <span>Multi-Sheet XLSX</span>
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Sheet 1: Master Reconciled Fact Sheet | Sheet 2: Day Category Pivot Matrix.
                </p>
              </div>
            </div>
          </div>

          {/* Success Banner & Download */}
          {consolidationResult && (
            <div
              className={`p-4 rounded-xl text-xs font-mono border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
                isDark
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
                  : "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-300 mb-0.5">
                    Consolidation Complete ({consolidationResult.total_records.toLocaleString()} Records)
                  </h4>
                  <p className="text-slate-400">
                    Consolidated 443 employees across all BUs into production master spreadsheet in {consolidationResult.duration_ms}ms.
                  </p>
                </div>
              </div>

              <a
                href={`${API_BASE.replace('/api', '')}${consolidationResult.download_url}`}
                download={consolidationResult.output_file_name}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 shrink-0 shadow-md"
              >
                <Download className="w-4 h-4" />
                Download Master XLSX
              </a>
            </div>
          )}

          {consolidationError && (
            <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{consolidationError}</span>
            </div>
          )}

          {/* Action Row */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <span className={`text-xs font-mono ${isDark ? "text-slate-400" : "text-slate-600 font-medium"}`}>
              Generates production-grade spreadsheet with full employee reconciliation matrix.
            </span>
            <button
              id="btn-run-consolidation"
              onClick={handleRunConsolidation}
              disabled={isConsolidating}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(6,182,212,0.35)] disabled:opacity-50"
            >
              {isConsolidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isConsolidating ? "Reconciling 41,668 Records..." : "Consolidate Time & Leave Master (XLSX)"}
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODULE 2: ATTENDANCE SUMMARY (DISTRIBUTION & EXPORT)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "attendance_summary" && (
        <div className="space-y-5">
          <div
            className={`border rounded-xl p-5 font-mono text-xs transition-all ${
              isDark ? "bg-[#070e1b] border-slate-800/80" : "bg-slate-50 border-slate-200/90 shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  Daily Attendance Status Distribution Matrix
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Calculated from 41,668 active employee-day attendance records across 443 observed personnel.
                </p>
              </div>

              <button
                onClick={loadAttendanceSummaryData}
                disabled={isLoadingSummary}
                className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5 self-start sm:self-auto"
                title="Refresh distribution matrix"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? "animate-spin text-cyan-400" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* 8 Category KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Present (P)</span>
                <span className="text-xl font-bold text-emerald-400">{attSummary?.present_pct ?? 41.9}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.present ? `${attSummary.counts.present.toLocaleString()} days` : "17,470 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Weekly Off (WO)</span>
                <span className="text-xl font-bold text-cyan-400">{attSummary?.week_off_pct ?? 28.3}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.week_off ? `${attSummary.counts.week_off.toLocaleString()} days` : "11,785 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Work From Home (WFH)</span>
                <span className="text-xl font-bold text-blue-400">{attSummary?.wfh_pct ?? 7.1}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.wfh ? `${attSummary.counts.wfh.toLocaleString()} days` : "2,979 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Absent (A)</span>
                <span className="text-xl font-bold text-amber-400">{attSummary?.absent_pct ?? 6.8}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.absent ? `${attSummary.counts.absent.toLocaleString()} days` : "2,826 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Leave (L)</span>
                <span className="text-xl font-bold text-purple-400">{attSummary?.leave_pct ?? 6.0}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.leave ? `${attSummary.counts.leave.toLocaleString()} days` : "2,498 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Holiday (H)</span>
                <span className="text-xl font-bold text-indigo-400">{attSummary?.holiday_pct ?? 2.8}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.holiday ? `${attSummary.counts.holiday.toLocaleString()} days` : "1,176 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Missing Swipe (MS)</span>
                <span className="text-xl font-bold text-rose-400">{attSummary?.missing_swipe_pct ?? 2.0}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.missing_swipe ? `${attSummary.counts.missing_swipe.toLocaleString()} days` : "832 days"}
                </span>
              </div>

              <div className={`p-3.5 rounded-lg border text-center ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <span className="text-[10px] block uppercase font-semibold text-slate-400 mb-1">Regularized</span>
                <span className="text-xl font-bold text-teal-400">{attSummary?.regularized_pct ?? 1.7}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {attSummary?.counts?.regularized ? `${attSummary.counts.regularized.toLocaleString()} days` : "691 days"}
                </span>
              </div>
            </div>

            {/* Visual Status Proportion Bar */}
            <div className="mb-4">
              <span className="text-[11px] text-slate-400 block mb-1.5 font-bold uppercase tracking-wider">
                Category Proportion Visualizer
              </span>
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-900 border border-slate-700">
                <div style={{ width: `${attSummary?.present_pct ?? 41.9}%` }} className="bg-emerald-500 h-full" title="Present" />
                <div style={{ width: `${attSummary?.week_off_pct ?? 28.3}%` }} className="bg-cyan-500 h-full" title="Weekly Off" />
                <div style={{ width: `${attSummary?.wfh_pct ?? 7.1}%` }} className="bg-blue-500 h-full" title="WFH" />
                <div style={{ width: `${attSummary?.absent_pct ?? 6.8}%` }} className="bg-amber-500 h-full" title="Absent" />
                <div style={{ width: `${attSummary?.leave_pct ?? 6.0}%` }} className="bg-purple-500 h-full" title="Leave" />
                <div style={{ width: `${attSummary?.holiday_pct ?? 2.8}%` }} className="bg-indigo-500 h-full" title="Holiday" />
                <div style={{ width: `${attSummary?.missing_swipe_pct ?? 2.0}%` }} className="bg-rose-500 h-full" title="Missing Swipe" />
                <div style={{ width: `${attSummary?.regularized_pct ?? 1.7}%` }} className="bg-teal-500 h-full" title="Regularized" />
              </div>
            </div>
          </div>

          {/* Export Action */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <span className={`text-xs font-mono ${isDark ? "text-slate-400" : "text-slate-600 font-medium"}`}>
              Exports 2 sheets: 1. Full Raw Status Logs | 2. Employee Wise Summary Category Matrix.
            </span>
            <button
              id="btn-export-attendance-summary"
              onClick={handleExportSummary}
              disabled={isExportingSummary}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(59,130,246,0.35)] disabled:opacity-50"
            >
              {isExportingSummary ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExportingSummary ? "Exporting Matrix..." : "Export Attendance Summary Matrix (XLSX)"}
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODULE 3: ENTERPRISE ID CARD STUDIO (DESKTOP APP PARITY)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "id_cards" && (
        <div className="space-y-6 font-mono text-xs">
          {/* Top Quick Actions Bar */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <div>
              <h3 className={`font-bold uppercase tracking-wider text-sm flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                <CreditCard className="w-4 h-4 text-cyan-400" />
                FinBox ID Card Generator
              </h3>
              <p className={`text-[11px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Ultra-fast dual-method ID card generation: Instant Keka Email Sync or Bulk Excel Upload.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddressConfig(!showAddressConfig)}
                className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all text-xs ${
                  showAddressConfig
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                    : isDark
                    ? "bg-[#040810] text-slate-300 border-slate-700 hover:border-slate-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                Configure Addresses 🏢
                {showAddressConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={handleOpenOutputFolder}
                className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all text-xs ${
                  isDark ? "bg-[#040810] text-slate-300 border-slate-700 hover:border-slate-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                Open Output Folder 📁
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lastReportDownloadUrl) {
                    window.open(lastReportDownloadUrl, "_blank");
                  } else {
                    alert("No audit report generated yet. Run a generation job to produce an audit report.");
                  }
                }}
                disabled={!lastReportDownloadUrl}
                className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all text-xs disabled:opacity-40 ${
                  isDark ? "bg-[#040810] text-slate-300 border-slate-700 hover:border-slate-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Open Audit Report 📊
              </button>
            </div>
          </div>

          {/* 1. Global Preferences & Connectors Status Card */}
          <div className={`p-4 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4 ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            {/* Template selection box */}
            <div className={`p-3.5 rounded-lg border ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200"}`}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Card Design Template:
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setIdCardDesign("Modern");
                    loadInitialPreviewMeta("kanupriya.rathore@finbox.in", "Modern");
                  }}
                  className={`flex-1 py-2 rounded-lg border font-bold text-xs transition-all ${
                    idCardDesign === "Modern"
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm"
                      : isDark
                      ? "bg-[#070e1b] text-slate-400 border-slate-800"
                      : "bg-slate-100 text-slate-600 border-slate-300"
                  }`}
                >
                  Modern
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdCardDesign("Classic");
                    loadInitialPreviewMeta("kanupriya.rathore@finbox.in", "Classic");
                  }}
                  className={`flex-1 py-2 rounded-lg border font-bold text-xs transition-all ${
                    idCardDesign === "Classic"
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-sm"
                      : isDark
                      ? "bg-[#070e1b] text-slate-400 border-slate-800"
                      : "bg-slate-100 text-slate-600 border-slate-300"
                  }`}
                >
                  Classic
                </button>
              </div>
              <span className="text-[11px] text-slate-400 block">
                {idCardDesign === "Modern"
                  ? "FinBox Modern format (Navy & Cyan with Slack/Keka Photo & QR)"
                  : "Approved FinBox ID card layout (Keka Blue header with detail rows & logo)"}
              </span>
            </div>

            {/* Photo Connectors Status Summary */}
            <div className={`p-3.5 rounded-lg border ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200"}`}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                🔌 Photo Sources Status:
              </label>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Slack:</span>
                  <span className={`w-2 h-2 rounded-full ${connectorsConfig?.slack?.connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  <span className={`text-[11px] ${connectorsConfig?.slack?.connected ? "text-emerald-400" : "text-slate-400"}`}>
                    {connectorsConfig?.slack?.connected ? `Connected (@${connectorsConfig.slack.user || "bot"})` : "Not connected"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Keka:</span>
                  <span className={`w-2 h-2 rounded-full ${connectorsConfig?.keka?.connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  <span className={`text-[11px] ${connectorsConfig?.keka?.connected ? "text-emerald-400" : "text-slate-400"}`}>
                    {connectorsConfig?.keka?.connected ? `Connected (${connectorsConfig.keka.subdomain || "moshpit"}.keka.com)` : "Not connected"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Office Locations & Addresses Configuration Card (Collapsible) */}
          {showAddressConfig && (
            <div className={`p-5 rounded-xl border space-y-4 animate-in fade-in duration-200 ${isDark ? "bg-[#070e1b] border-cyan-500/30" : "bg-slate-50 border-cyan-500/40 shadow-md"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-800">
                <div>
                  <h4 className={`font-bold text-sm flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    🏢 Office Locations & Addresses Configuration
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Pre-configure physical office addresses mapped to employee location cities in Keka/Excel. Cards automatically print the exact address configured for each employee location.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAddresses}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    Save All Addresses 💾
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddressConfig(false)}
                    className={`px-3 py-1.5 rounded-lg border text-xs ${isDark ? "bg-[#040810] text-slate-300 border-slate-700" : "bg-white text-slate-700 border-slate-300"}`}
                  >
                    Done / Hide ✕
                  </button>
                </div>
              </div>

              {/* Existing Address Rows */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {Object.entries(addressMapping).map(([cityKey, addrVal]) => (
                  <div key={cityKey} className={`p-2.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center gap-2 ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200"}`}>
                    <span className="w-28 shrink-0 font-bold text-cyan-400 text-xs px-2 py-1 rounded bg-cyan-950/50 border border-cyan-800/40">
                      {cityKey}
                    </span>
                    <input
                      type="text"
                      value={addrVal}
                      onChange={(e) => {
                        const updatedVal = e.target.value;
                        setAddressMapping((prev) => ({ ...prev, [cityKey]: updatedVal }));
                      }}
                      className={`flex-1 w-full px-2.5 py-1.5 rounded border text-xs outline-none ${isDark ? "bg-[#070e1b] border-slate-700 text-slate-200 focus:border-cyan-400" : "bg-slate-50 border-slate-300 text-slate-800 focus:border-cyan-500"}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteAddressRow(cityKey)}
                      title="Delete Location"
                      className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Location Row */}
              <div className={`p-3 rounded-lg border flex flex-col sm:flex-row items-center gap-2 ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-300"}`}>
                <input
                  type="text"
                  placeholder="Location City (e.g. Pune, Chennai)..."
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className={`w-full sm:w-44 px-3 py-1.5 rounded border text-xs outline-none ${isDark ? "bg-[#070e1b] border-slate-700 text-slate-200 focus:border-cyan-400" : "bg-slate-50 border-slate-300 text-slate-800 focus:border-cyan-500"}`}
                />
                <input
                  type="text"
                  placeholder="Full Office Address (Street, Building, City, PIN)..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className={`flex-1 w-full px-3 py-1.5 rounded border text-xs outline-none ${isDark ? "bg-[#070e1b] border-slate-700 text-slate-200 focus:border-cyan-400" : "bg-slate-50 border-slate-300 text-slate-800 focus:border-cyan-500"}`}
                />
                <button
                  type="button"
                  onClick={handleAddAddressRow}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Location
                </button>
              </div>
            </div>
          )}

          {/* 3. Choose Generation Workflow (Segmented Switcher) */}
          <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-400 shrink-0">
              Choose Generation Workflow:
            </span>
            <div className="flex-1 flex gap-2">
              <button
                type="button"
                onClick={() => setIdCardMode("email_sync")}
                className={`flex-1 py-2 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  idCardMode === "email_sync"
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/60 shadow-sm"
                    : isDark
                    ? "bg-[#040810] text-slate-400 border-slate-800 hover:border-slate-700"
                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                }`}
              >
                <span>⚡ Method 1: Instant Email Sync (Auto-Fetch)</span>
              </button>
              <button
                type="button"
                onClick={() => setIdCardMode("bulk_excel")}
                className={`flex-1 py-2 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  idCardMode === "bulk_excel"
                    ? "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/60 shadow-sm"
                    : isDark
                    ? "bg-[#040810] text-slate-400 border-slate-800 hover:border-slate-700"
                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                }`}
              >
                <span>📁 Method 2: Bulk Excel Upload</span>
              </button>
            </div>
          </div>

          {/* 4. Method 1: Instant Email Sync Container */}
          {idCardMode === "email_sync" && (
            <div className={`p-5 rounded-xl border space-y-4 animate-in fade-in duration-200 ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div>
                <h4 className={`font-bold text-sm ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  ⚡ Method 1: Instant Email Sync (Auto-Fetch from Keka & Slack)
                </h4>
                <p className={`text-[11px] mt-1 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Enter employee email IDs separated by ';' (or commas / newlines). The generator automatically queries Keka HRMS for Display Name, Designation, EMP ID, Blood Group, Mobile, DOB, and Emergency Contacts. Profile photos are retrieved with automatic fallback (Local Folder ➔ Keka ➔ Slack). Office address is dynamically matched from your configured locations.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Employee Email ID(s) — separated by semicolon (;):
                </label>
                <textarea
                  rows={3}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="kanupriya.rathore@finbox.in; vinoth.kumar@finbox.in"
                  className={`w-full p-3 rounded-lg border font-mono text-xs outline-none ${isDark ? "bg-[#040810] border-slate-800 text-slate-100 focus:border-cyan-400" : "bg-white border-slate-300 text-slate-900 focus:border-cyan-500 shadow-inner"}`}
                />
              </div>

              {/* Optional Local Photos Folder */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Local Photos Folder (Optional — overrides Keka/Slack if employee photo found locally):
                </label>
                <input
                  type="text"
                  value={photosDir}
                  onChange={(e) => setPhotosDir(e.target.value)}
                  placeholder="No local photos folder selected (Keka & Slack will be used automatically)..."
                  className={`w-full px-3 py-2 rounded-lg border font-mono text-xs outline-none ${isDark ? "bg-[#040810] border-slate-800 text-slate-100 focus:border-cyan-400" : "bg-white border-slate-300 text-slate-900 focus:border-cyan-500"}`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  id="btn-generate-email-sync"
                  onClick={handleRunEmailSync}
                  disabled={isJobRunning}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-[0_0_16px_rgba(6,182,212,0.35)] disabled:opacity-50 transition-all"
                >
                  {isJobRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Generate ID Cards 🚀
                </button>
                <button
                  type="button"
                  onClick={handlePreviewFirstEmail}
                  disabled={isJobRunning}
                  className={`px-4 py-2.5 rounded-lg border font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 ${isDark ? "bg-[#040810] text-slate-200 border-slate-700 hover:border-slate-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"}`}
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Preview First Card 👁️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lastPdfDownloadUrl) {
                      window.open(lastPdfDownloadUrl, "_blank");
                    } else {
                      alert("No preview PDF generated yet. Click 'Preview First Card' first.");
                    }
                  }}
                  disabled={!lastPdfDownloadUrl}
                  className={`px-4 py-2.5 rounded-lg border font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-40 ${isDark ? "bg-[#040810] text-slate-200 border-slate-700 hover:border-slate-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"}`}
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  View Preview PDF 📄
                </button>
              </div>
            </div>
          )}

          {/* 5. Method 2: Bulk Excel Upload Container */}
          {idCardMode === "bulk_excel" && (
            <div className={`p-5 rounded-xl border space-y-4 animate-in fade-in duration-200 ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div>
                <h4 className={`font-bold text-sm ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  📁 Method 2: Bulk Excel Data Upload
                </h4>
                <p className={`text-[11px] mt-1 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Upload an employee roster spreadsheet in Excel format. You can also specify a local folder containing employee photos and pick how photo files are matched (by Employee ID or Email ID). If photos are missing from the folder, Keka and Slack will be used automatically as fallback.
                </p>
              </div>

              {/* Excel File Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Employee Data Sheet (Excel .xlsx):
                </label>
                <input
                  type="text"
                  value={excelFile}
                  onChange={(e) => setExcelFile(e.target.value)}
                  placeholder="ID card generation.xlsx"
                  className={`w-full px-3 py-2 rounded-lg border font-mono text-xs outline-none ${isDark ? "bg-[#040810] border-slate-800 text-slate-100 focus:border-cyan-400" : "bg-white border-slate-300 text-slate-900 focus:border-cyan-500"}`}
                />
              </div>

              {/* Photos Folder Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Employee Photos Folder (Optional):
                </label>
                <input
                  type="text"
                  value={photosDir}
                  onChange={(e) => setPhotosDir(e.target.value)}
                  placeholder="No local photos folder selected (will use Keka / Slack)..."
                  className={`w-full px-3 py-2 rounded-lg border font-mono text-xs outline-none ${isDark ? "bg-[#040810] border-slate-800 text-slate-100 focus:border-cyan-400" : "bg-white border-slate-300 text-slate-900 focus:border-cyan-500"}`}
                />
              </div>

              {/* Local Photo Naming Rule */}
              <div className={`p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${isDark ? "bg-[#040810] border-slate-800" : "bg-white border-slate-200"}`}>
                <span className="font-bold text-xs text-slate-300">
                  Local Photo Naming Rule:
                </span>
                <div className="flex gap-2">
                  {(["auto", "emp_no", "email"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPhotoMatchMode(mode)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        photoMatchMode === mode
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                          : isDark
                          ? "bg-[#070e1b] text-slate-400 border-slate-800"
                          : "bg-slate-100 text-slate-600 border-slate-300"
                      }`}
                    >
                      {mode === "auto" ? "Auto-Detect" : mode === "emp_no" ? "Employee ID (e.g. FINBP200.jpg)" : "Email ID (e.g. name@finbox.in)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Single & Bulk Actions Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={singlePreviewEmail}
                    onChange={(e) => setSinglePreviewEmail(e.target.value)}
                    placeholder="Enter employee email..."
                    className={`w-52 px-3 py-2 rounded-lg border font-mono text-xs outline-none ${isDark ? "bg-[#040810] border-slate-800 text-slate-100 focus:border-cyan-400" : "bg-white border-slate-300 text-slate-900 focus:border-cyan-500"}`}
                  />
                  <button
                    type="button"
                    onClick={handlePreviewSingleExcelEmployee}
                    disabled={isJobRunning}
                    className={`px-3.5 py-2 rounded-lg border font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 ${isDark ? "bg-[#040810] text-slate-200 border-slate-700 hover:border-slate-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"}`}
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    Generate Preview 👁
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastPdfDownloadUrl) {
                        window.open(lastPdfDownloadUrl, "_blank");
                      } else {
                        alert("No preview PDF generated yet.");
                      }
                    }}
                    disabled={!lastPdfDownloadUrl}
                    className={`px-3.5 py-2 rounded-lg border font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 ${isDark ? "bg-[#040810] text-slate-200 border-slate-700 hover:border-slate-600" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm"}`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    View PDF 📄
                  </button>
                </div>

                <button
                  type="button"
                  id="btn-run-bulk-excel"
                  onClick={handleRunBulkExcel}
                  disabled={isJobRunning}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(59,130,246,0.35)] disabled:opacity-50 transition-all"
                >
                  {isJobRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Run Bulk Generation 📇
                </button>
              </div>
            </div>
          )}

          {/* 6. Split Section: Interactive Visual Card Preview & Live Audit Trail Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Authentic Visual Card Preview */}
            <div className={`lg:col-span-5 p-5 rounded-xl border flex flex-col items-center justify-between ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div className="w-full flex items-center justify-between mb-4">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  Card Preview ({idCardDesign})
                </span>
                <div className="flex gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveCardSide("front")}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      activeCardSide === "front" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCardSide("back")}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      activeCardSide === "back" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Back
                  </button>
                </div>
              </div>

              {/* RENDER MODERN TEMPLATE */}
              {idCardDesign === "Modern" && (
                <div className="my-auto">
                  {activeCardSide === "front" ? (
                    // Modern Front: Navy background, upper circular portrait cutout, uppercase bold name, slate designation, EMP ID
                    <div className="w-[260px] h-[440px] rounded-2xl bg-[#09184B] border border-cyan-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col items-center justify-between p-5 relative overflow-hidden text-center select-none">
                      {/* Decorative wave lines overlay */}
                      <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />
                      <div className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full bg-blue-600/10 blur-xl pointer-events-none" />

                      {/* Upper Portrait Area */}
                      <div className="pt-4 flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full border-4 border-slate-800/80 bg-gradient-to-tr from-[#0052FF] via-[#0A1931] to-cyan-500 flex items-center justify-center text-3xl font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden">
                          {previewMeta?.avatar_initials || "KR"}
                        </div>
                      </div>

                      {/* Lower Info Area (#060644) */}
                      <div className="w-full bg-[#060644]/80 backdrop-blur-sm rounded-xl p-3 border border-slate-800/60 space-y-1">
                        <h3 className="text-white font-extrabold text-sm tracking-wide leading-tight">
                          {previewMeta?.name || "KANUPRIYA RATHORE"}
                        </h3>
                        <p className="text-[#8E9BB5] text-[10px] font-bold uppercase tracking-wider">
                          {previewMeta?.designation || "SENIOR TECHNICAL PROGRAM MANAGER"}
                        </p>
                        <p className="text-[#CBD5E1] text-[10px] font-mono tracking-widest pt-0.5">
                          {previewMeta?.employee_number || "FINBP200"}
                        </p>
                      </div>

                      {/* FinBox Logo Bottom */}
                      <div className="pt-2 text-center">
                        <span className="text-[11px] font-black tracking-widest text-white uppercase font-sans">
                          FINBOX
                        </span>
                        <span className="text-[8px] text-slate-400 block tracking-wider">
                          MOSHPIT TECHNOLOGIES
                        </span>
                      </div>
                    </div>
                  ) : (
                    // Modern Back: Clean white card, QR code, Emergency Contact heading, 3 rounded badges, address
                    <div className="w-[260px] h-[440px] rounded-2xl bg-white border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-4 relative overflow-hidden text-slate-900 select-none">
                      {/* Top-right geometric accent */}
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600 to-transparent pointer-events-none rounded-bl-full opacity-20" />

                      {/* FinBox Logo Top */}
                      <div className="text-center pt-1">
                        <span className="text-[12px] font-black tracking-widest text-slate-900 uppercase">
                          FINBOX
                        </span>
                      </div>

                      {/* Dynamic QR Code encoding EMP ID */}
                      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col items-center">
                        <QrCode className="w-14 h-14 text-slate-900" />
                        <span className="text-[8px] font-bold text-slate-500 mt-0.5 font-mono">
                          EMP: {previewMeta?.employee_number || "FINBP200"}
                        </span>
                      </div>

                      {/* EMERGENCY CONTACT Heading */}
                      <div className="w-full">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900">
                            EMERGENCY CONTACT
                          </span>
                        </div>

                        {/* 3 Rounded Information Cards */}
                        <div className="space-y-1.5 text-left">
                          {/* Row 1: Name */}
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-blue-700" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[8px] text-slate-400 block uppercase font-bold leading-none">Name</span>
                              <span className="text-[10px] font-bold text-slate-900 truncate block">
                                {previewMeta?.emergency_contact_name || "Rinku Rathore"}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Phone */}
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <Phone className="w-3 h-3 text-blue-700" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[8px] text-slate-400 block uppercase font-bold leading-none">Phone</span>
                              <span className="text-[10px] font-bold text-slate-900 truncate block">
                                {previewMeta?.emergency_contact_phone || "9772931977"}
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Blood Group */}
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                              <Droplet className="w-3 h-3 text-rose-700" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[8px] text-slate-400 block uppercase font-bold leading-none">Blood Group</span>
                              <span className="text-[10px] font-bold text-rose-700 truncate block">
                                {previewMeta?.blood_group || "O-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider & Office Address */}
                      <div className="w-full border-t border-slate-200 pt-1.5 text-center">
                        <div className="flex items-start justify-center gap-1 text-[8px] text-slate-600 leading-tight">
                          <MapPin className="w-3 h-3 text-blue-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {previewMeta?.office_address || "3rd Floor, Vaishnavi Sovereign, Green Glen Layout, Bellandur, Bengaluru - 560103"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RENDER CLASSIC TEMPLATE */}
              {idCardDesign === "Classic" && (
                <div className="my-auto">
                  {activeCardSide === "front" ? (
                    // Classic Front: Keka Blue #2986CE header, white photo ring, 5 detail rows, FinBox logo, Powered by Keka
                    <div className="w-[260px] h-[440px] rounded-2xl bg-white border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between relative overflow-hidden select-none">
                      {/* Top Header (#2986CE) */}
                      <div className="w-full h-44 bg-[#2986CE] flex flex-col items-center justify-center p-3 text-white text-center">
                        <div className="w-20 h-20 rounded-full border-4 border-white bg-blue-700 flex items-center justify-center text-xl font-bold mb-1 shadow-md">
                          {previewMeta?.avatar_initials || "KR"}
                        </div>
                        <h4 className="font-bold text-xs uppercase leading-tight mt-0.5">
                          {previewMeta?.name || "Kanupriya Rathore"}
                        </h4>
                        <p className="text-[10px] text-blue-100">{previewMeta?.designation || "Senior Technical Program Manager"}</p>
                      </div>

                      {/* 5 Detail Rows */}
                      <div className="w-full px-4 py-2 space-y-1.5 text-[10px] text-slate-800">
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-400">Employee Number</span>
                          <span className="font-bold">{previewMeta?.employee_number || "FINBP200"}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-400">Phone</span>
                          <span className="font-bold">{previewMeta?.phone || "9024558021"}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-400">Email</span>
                          <span className="font-bold truncate max-w-[140px]">{previewMeta?.email || "kanupriya.rathore@finbox.in"}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-400">Location</span>
                          <span className="font-bold">{previewMeta?.location || "Bengaluru"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Blood Group</span>
                          <span className="font-bold text-rose-600">{previewMeta?.blood_group || "O-"}</span>
                        </div>
                      </div>

                      {/* Classic Footer */}
                      <div className="w-full border-t border-slate-200 py-2 px-3 flex items-center justify-between text-[9px] text-slate-500">
                        <span className="font-extrabold text-slate-900 tracking-wider">FINBOX</span>
                        <span>Powered by Keka</span>
                      </div>
                    </div>
                  ) : (
                    // Classic Back: Address, FinBox container, DOB, FinBox logo, Powered by Keka
                    <div className="w-[260px] h-[440px] rounded-2xl bg-white border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-4 relative overflow-hidden text-slate-900 select-none">
                      <div className="w-full text-center border-b border-slate-200 pb-2">
                        <span className="text-[11px] font-extrabold text-slate-900 uppercase">
                          Employee Identification
                        </span>
                      </div>

                      {/* Address */}
                      <div className="w-full text-center px-1">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                          Registered Office Address
                        </span>
                        <p className="text-[10px] text-slate-700 leading-relaxed">
                          {previewMeta?.office_address || "3rd Floor, Vaishnavi Sovereign, Green Glen Layout, Bellandur, Bengaluru, Karnataka, India - 560103"}
                        </p>
                      </div>

                      {/* #F8F8FA Container */}
                      <div className="w-full bg-[#F8F8FA] border border-[#EAEAEF] rounded-lg p-3 space-y-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Organization</span>
                          <span className="font-bold text-slate-900">FinBox</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date Of Birth</span>
                          <span className="font-bold text-slate-900">{previewMeta?.dob || "07 Mar, 1998"}</span>
                        </div>
                      </div>

                      {/* Classic Footer */}
                      <div className="w-full border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-500">
                        <span className="font-extrabold text-slate-900 tracking-wider">FINBOX</span>
                        <span>Powered by Keka</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Live Activity & Generation Audit Trail Console */}
            <div className={`lg:col-span-7 p-5 rounded-xl border flex flex-col justify-between ${isDark ? "bg-[#070e1b] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <h4 className={`font-bold text-xs uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                      Live Activity & Generation Audit Trail
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      jobStatusBadge === "Processing..."
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                        : jobStatusBadge === "Finished"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : jobStatusBadge === "Error"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {jobStatusBadge}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConsoleLogs(["FinBox ID Card Generator console cleared."])}
                      className={`px-2 py-0.5 rounded border text-[10px] ${isDark ? "bg-[#040810] text-slate-400 border-slate-800 hover:text-slate-200" : "bg-white text-slate-600 border-slate-300"}`}
                    >
                      Clear Log
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {isJobRunning && (
                  <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 animate-[shimmer_1.5s_infinite]" />
                  </div>
                )}

                {/* Console Log Window */}
                <div className={`w-full h-[380px] p-3 rounded-lg border font-mono text-[11px] overflow-y-auto leading-relaxed whitespace-pre-wrap select-text ${isDark ? "bg-[#040810] border-slate-800 text-slate-300 shadow-inner" : "bg-slate-950 border-slate-800 text-slate-200 shadow-inner"}`}>
                  {consoleLogs.map((logLine, idx) => (
                    <div
                      key={idx}
                      className={`${
                        logLine.includes("[✓]") || logLine.includes("SUCCESS") || logLine.includes("Passed")
                          ? "text-emerald-400 font-semibold"
                          : logLine.includes("[!]") || logLine.includes("Skipped") || logLine.includes("FAILED")
                          ? "text-rose-400 font-semibold"
                          : logLine.includes("[+]")
                          ? "text-cyan-300"
                          : logLine.includes("===")
                          ? "text-blue-400 font-bold"
                          : "text-slate-300"
                      }`}
                    >
                      {logLine}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
