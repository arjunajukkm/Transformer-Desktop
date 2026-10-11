"use client";

import React, { useRef, useState } from "react";
import { Activity, Database, RefreshCw, Upload, Cpu, CheckCircle2, AlertCircle } from "lucide-react";
import { SnapshotMetadata } from "@/lib/types";
import { loadDemoDataset, uploadDataset } from "@/lib/api";

interface HeaderProps {
  metadata: SnapshotMetadata | null;
  gatewayStatus: string;
  onRefresh: () => void;
}

export function Header({ metadata, gatewayStatus, onRefresh }: HeaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadDemo = async () => {
    setIsLoading(true);
    try {
      await loadDemoDataset();
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadMessage("Processing dataset into OLAP hypercubes...");
    try {
      const res = await uploadDataset(file);
      setUploadMessage(res.message);
      onRefresh();
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || "Upload failed"}`);
      setTimeout(() => setUploadMessage(null), 5000);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <header className="border-b border-white/10 bg-[#06090e]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">TRANSFORMERS 2.0</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                ENTERPRISE
              </span>
            </div>
            <p className="text-xs text-slate-400">Palantir-Grade Workforce Decision Intelligence Platform</p>
          </div>
        </div>

        {/* Telemetry Status & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Gateway Heartbeat */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900/60 border border-white/5 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${gatewayStatus === "healthy" ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${gatewayStatus === "healthy" ? "bg-emerald-500" : "bg-amber-500"}`} />
            </span>
            <span className="font-mono text-[11px] text-slate-400">OLAP:</span>
            <span className="font-semibold text-emerald-400">&lt; 1 ms</span>
          </div>

          {/* Active Dataset Stats */}
          {metadata && metadata.is_loaded ? (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-slate-900/60 border border-white/5 text-xs text-slate-300">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              <span>
                <strong className="text-white font-mono">{metadata.row_count.toLocaleString()}</strong> events
              </span>
              <span className="text-slate-500">•</span>
              <span>
                <strong className="text-white font-mono">{metadata.employee_count}</strong> employees
              </span>
              {metadata.date_range && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 text-[11px]">{metadata.date_range}</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Awaiting dataset upload</span>
            </div>
          )}

          {/* Load Demo Button */}
          <button
            onClick={handleLoadDemo}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-medium text-slate-200 transition-all hover:border-cyan-500/30 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            <span>Load Demo Data</span>
          </button>

          {/* Upload Button */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Dataset</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.parquet"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Upload Feedback Toast */}
      {uploadMessage && (
        <div className="max-w-7xl mx-auto mt-2 text-xs py-1 px-3 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
          <span>{uploadMessage}</span>
        </div>
      )}
    </header>
  );
}
