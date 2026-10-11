"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  RefreshCw,
  Database,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  Shield,
} from "lucide-react";
import { SnapshotMetadata } from "../lib/types";
import { loadDemoDataset, uploadDataset } from "../lib/api";

interface TopBarProps {
  metadata: SnapshotMetadata | null;
  gatewayStatus: string;
  activeTabTitle: string;
  scopeLabel: string;
  theme: "dark" | "light";
  onRefresh: () => void;
  onToggleCopilot?: () => void;
  copilotOpen?: boolean;
}

export function TopBar({
  metadata,
  gatewayStatus,
  activeTabTitle,
  scopeLabel,
  theme,
  onRefresh,
  onToggleCopilot,
  copilotOpen,
}: TopBarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadDemo = async () => {
    setIsLoading(true);
    setToastMessage("Pre-warming multi-month enterprise lakehouse dataset...");
    try {
      await loadDemoDataset();
      setToastMessage("Enterprise dataset active (450 rows across 5 BUs).");
      onRefresh();
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      setToastMessage(`Error: ${err.message || "Failed to load demo data"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setToastMessage("Compiling dataset into in-memory Polars hypercubes...");
    try {
      const res = await uploadDataset(file);
      setToastMessage(res.message);
      onRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage(`Upload Error: ${err.message || "Failed"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header
      className={`h-14 border-b flex items-center justify-between px-6 shrink-0 transition-colors ${
        theme === "dark"
          ? "bg-[#090d16]/90 border-slate-800/80 backdrop-blur-md text-slate-100"
          : "bg-white/90 border-slate-200/90 backdrop-blur-md text-slate-800"
      }`}
    >
      {/* ── Left: Section Title & Breadcrumb ── */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
          <span>Transformers</span>
          <ChevronRight className="h-3 w-3 text-slate-500" />
          <span className={`font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
            {activeTabTitle}
          </span>
        </div>

        {scopeLabel && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium">
            <Shield className="h-3 w-3" />
            {scopeLabel}
          </span>
        )}
      </div>

      {/* ── Center: Floating Toast Notification ── */}
      {toastMessage && (
        <div className="hidden md:flex items-center gap-2 text-xs py-1 px-3 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 font-mono shadow-md animate-fadeIn">
          <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
          <span className="truncate max-w-sm">{toastMessage}</span>
        </div>
      )}

      {/* ── Right: Dataset Badge & Quick Actions ── */}
      <div className="flex items-center gap-2">
        {/* Active Lakehouse Dataset Badge */}
        <div
          className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-mono ${
            theme === "dark"
              ? "bg-[#06090e] border-slate-800/80 text-slate-300"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
          title="Active In-Memory Lakehouse"
        >
          <Database className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[11px] text-emerald-400 font-semibold font-mono">
            {metadata ? `${metadata.row_count} rows` : "Ready"}
          </span>
        </div>

        {/* Quick Demo Reload */}
        <button
          onClick={handleLoadDemo}
          disabled={isLoading}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${
            theme === "dark"
              ? "bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white"
              : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
          }`}
          title="Reload Demo Dataset"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          <span className="hidden sm:inline">Demo Data</span>
        </button>

        {/* Quick Upload */}
        <label
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer ${
            theme === "dark"
              ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              : "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200"
          }`}
          title="Upload Excel or CSV Dataset"
        >
          <Upload className="h-3 w-3" />
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-xs font-medium transition-all ${
              copilotOpen
                ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                : theme === "dark"
                ? "bg-purple-950/30 hover:bg-purple-900/40 text-purple-300 border-purple-700/40"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
            }`}
            title="Toggle AI Decision Copilot"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden md:inline">AI Copilot</span>
          </button>
        )}
      </div>
    </header>
  );
}
