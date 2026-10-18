"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Upload,
  Database,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  ChevronDown,
  Calendar,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react";
import { SnapshotMetadata, AvailableSyncMonth } from "../lib/types";
import { uploadDataset, syncKekaPipeline, fetchAvailableSyncMonths } from "../lib/api";

interface TopBarProps {
  metadata: SnapshotMetadata | null;
  gatewayStatus: string;
  activeTabTitle: string;
  scopeLabel: string;
  theme?: "dark" | "light";
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onRefresh: () => void;
  onRealTimeSync?: (month?: string) => Promise<void>;
  onSyncAndRecalculate?: () => Promise<void>;
  onToggleCopilot?: () => void;
  copilotOpen?: boolean;
}

export function TopBar({
  metadata,
  gatewayStatus,
  activeTabTitle,
  scopeLabel,
  theme = "dark",
  selectedMonth: selectedMonthProp,
  onSelectMonth,
  onRefresh,
  onRealTimeSync,
  onSyncAndRecalculate,
  onToggleCopilot,
  copilotOpen,
}: TopBarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncMonths, setSyncMonths] = useState<AvailableSyncMonth[]>([
    { key: "all", label: "All Months", records: 41668, is_active: true },
    { key: "2026-10", label: "October 2026", records: 4347, is_active: false },
    { key: "2026-09", label: "September 2026", records: 11926, is_active: false },
    { key: "2026-08", label: "August 2026", records: 12678, is_active: false },
    { key: "2026-07", label: "July 2026", records: 12803, is_active: false },
  ]);
  const [internalMonth, setInternalMonth] = useState<string>("all");
  const selectedMonth = selectedMonthProp !== undefined ? selectedMonthProp : internalMonth;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSyncMonths = useCallback(async () => {
    try {
      const res: any = await fetchAvailableSyncMonths();
      if (res && res.months) {
        const allRecs = res.all_option?.record_count || res.all_option?.total_records || 41668;
        const normalized: AvailableSyncMonth[] = [
          {
            key: "all",
            label: "All Months",
            records: allRecs,
            is_active: res.active_synced_month === "all",
          },
          ...res.months.map((m: any) => ({
            key: m.month_key || m.key,
            label: m.display_name || m.label,
            records: m.record_count || m.records || 0,
            is_active: m.is_current || m.is_active || false,
          })),
        ];
        setSyncMonths(normalized);
        if (res.active_synced_month && selectedMonthProp === undefined) {
          setInternalMonth(res.active_synced_month);
        }
      }
    } catch (err) {
      console.log("Failed to load sync months:", err);
    }
  }, [selectedMonthProp]);

  useEffect(() => {
    loadSyncMonths();
  }, [loadSyncMonths]);

  const handleSyncAndRefresh = async (monthOverride?: string) => {
    const monthToSync = monthOverride || selectedMonth;
    setIsLoading(true);
    const monthObj = syncMonths.find((m) => m.key === monthToSync);
    const monthLabel = monthObj ? monthObj.label : monthToSync;
    setToastMessage(`Syncing ${monthLabel}...`);
    try {
      if (onRealTimeSync) {
        await onRealTimeSync(monthToSync);
      } else if (onSyncAndRecalculate) {
        await onSyncAndRecalculate();
      } else {
        const res = await syncKekaPipeline(monthToSync);
        setToastMessage("Live sync complete.");
        onRefresh();
      }
      await loadSyncMonths();
      setToastMessage("Data updated.");
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err: any) {
      setToastMessage(`Sync Error: ${err.message || "Failed to sync"}`);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setToastMessage("Uploading dataset...");
    try {
      const res = await uploadDataset(file);
      setToastMessage("Upload complete.");
      onRefresh();
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err: any) {
      setToastMessage(`Upload Error: ${err.message || "Failed"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header
      className={`h-13 border-b flex items-center justify-between px-6 shrink-0 transition-colors ${
        theme === "dark"
          ? "bg-[#090d16]/90 border-slate-800/80 backdrop-blur-md text-slate-100"
          : "bg-white/90 border-slate-200/90 backdrop-blur-md text-slate-800"
      }`}
    >
      {/* ── Left: Clean Section Title & Breadcrumb ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
          <span className="hover:text-slate-200 transition-colors">Transformers</span>
          <ChevronRight className="h-3 w-3 text-slate-500" />
          <span className={`font-semibold tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
            {activeTabTitle}
          </span>
        </div>

        {scopeLabel && scopeLabel !== "Global FinBox" && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
            <Shield className="h-3 w-3" />
            {scopeLabel}
          </span>
        )}
      </div>

      {/* ── Center: Sleek Ambient Toast Notification ── */}
      {toastMessage && (
        <div className="hidden lg:flex items-center gap-1.5 text-xs py-1 px-3 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-300 font-mono shadow-md backdrop-blur-md animate-fadeIn">
          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
          <span className="truncate max-w-xs text-[11px]">{toastMessage}</span>
        </div>
      )}

      {/* ── Right: Minimalist Controls ── */}
      <div className="flex items-center gap-2">
        {/* Minimalist Live Record Badge */}
        <div
          className={`hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition-all ${
            theme === "dark"
              ? "bg-[#0b1220] border-slate-800 text-slate-400"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
          title="In-Memory Precalculated Lakehouse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{metadata?.row_count ? `${Math.round(metadata.row_count / 1000)}k rows` : "Ready"}</span>
        </div>

        {/* Minimalist Month Selector */}
        <div className="relative">
          <select
            id="topbar-month-selector"
            value={selectedMonth}
            onChange={(e) => {
              const val = e.target.value;
              setInternalMonth(val);
              onSelectMonth?.(val);
            }}
            disabled={isLoading}
            className={`h-8 pl-7 pr-6 text-xs font-mono font-medium rounded-lg border appearance-none cursor-pointer transition-all outline-none ${
              theme === "dark"
                ? "bg-[#0b1220] border-slate-800 text-slate-200 hover:border-slate-700 focus:border-cyan-500"
                : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-cyan-600 shadow-xs"
            }`}
            title="Filter dashboard analytics by historical month or unified archive"
          >
            {syncMonths.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <Calendar className="h-3.5 w-3.5 text-cyan-400 absolute left-2 top-2.5 pointer-events-none" />
          <ChevronDown className="h-3 w-3 text-slate-400 absolute right-1.5 top-2.5 pointer-events-none" />
        </div>

        {/* Single, Minimalist Unified Sync Button */}
        <button
          id="topbar-sync-button"
          onClick={() => handleSyncAndRefresh()}
          disabled={isLoading}
          className={`flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer ${
            theme === "dark"
              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
          }`}
          title="Synchronize live HRMS stream and refresh precalculated cache"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Syncing..." : "Sync"}</span>
        </button>

        {/* Minimalist Quick Upload */}
        <label
          className={`flex items-center gap-1 px-2.5 h-8 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer ${
            theme === "dark"
              ? "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700"
              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
          }`}
          title="Upload Excel or CSV Dataset"
        >
          <Upload className="h-3 w-3 text-slate-400" />
          <span className="hidden sm:inline">Upload</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.parquet"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* AI Copilot Drawer Toggle */}
        {onToggleCopilot && (
          <button
            onClick={onToggleCopilot}
            className={`flex items-center gap-1 px-2.5 h-8 rounded-lg border font-mono text-xs font-medium transition-all cursor-pointer ${
              copilotOpen
                ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                : theme === "dark"
                ? "bg-slate-900/60 hover:bg-slate-800 text-purple-300 border-slate-800 hover:border-purple-700/50"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
            }`}
            title="Toggle AI Decision Copilot"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden md:inline">Copilot</span>
          </button>
        )}
      </div>
    </header>
  );
}
