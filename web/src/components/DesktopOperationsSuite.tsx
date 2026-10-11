"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Calendar,
  CreditCard,
  Download,
  Upload,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Printer,
  Sparkles,
} from "lucide-react";

export function DesktopOperationsSuite() {
  const [activeSubTab, setActiveSubTab] = useState<"time_leave" | "attendance_summary" | "id_cards">("time_leave");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);

  // ID card state
  const [selectedEmp, setSelectedEmp] = useState("Employee 101");
  const [cardDesign, setCardDesign] = useState<"Modern" | "Minimal">("Modern");

  const handleRunConsolidation = () => {
    setIsProcessing(true);
    setProcessMessage(null);
    setTimeout(() => {
      setIsProcessing(false);
      setProcessMessage("Consolidated 509 employee records across 5 Business Units into master attendance matrix.");
    }, 800);
  };

  return (
    <div className="bg-[#0b1017] border border-cyan-500/20 rounded-xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h2 className="text-lg font-bold tracking-wider text-slate-100 uppercase flex items-center gap-2 font-mono">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              Desktop Operations &amp; HR Tooling Suite
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Full web parity for legacy desktop modules: Time &amp; Leave Master consolidation, Attendance Summary, and ID Card Generator.
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex items-center gap-2 bg-[#06090e] p-1 rounded-lg border border-slate-800 self-start md:self-auto font-mono text-xs">
          <button
            onClick={() => setActiveSubTab("time_leave")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === "time_leave"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Time &amp; Leave Master
          </button>
          <button
            onClick={() => setActiveSubTab("attendance_summary")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === "attendance_summary"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Attendance Summary
          </button>
          <button
            onClick={() => setActiveSubTab("id_cards")}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === "id_cards"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            ID Card Generator
          </button>
        </div>
      </div>

      {/* MODULE 1: TIME & LEAVE MASTER */}
      {activeSubTab === "time_leave" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#070b10] border border-slate-800 p-4 rounded-lg">
              <span className="text-xs font-mono text-slate-400 block mb-2 uppercase font-bold">
                1. Performance Logs
              </span>
              <div className="border border-dashed border-slate-800 rounded p-4 text-center cursor-pointer hover:border-cyan-500/40 transition-colors">
                <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                <span className="text-[11px] font-mono text-slate-400 block">Drop performance raw files</span>
                <span className="text-[9px] text-emerald-400 mt-1 block">Live stream from Keka active</span>
              </div>
            </div>

            <div className="bg-[#070b10] border border-slate-800 p-4 rounded-lg">
              <span className="text-xs font-mono text-slate-400 block mb-2 uppercase font-bold">
                2. Leave &amp; WFH Records
              </span>
              <div className="border border-dashed border-slate-800 rounded p-4 text-center cursor-pointer hover:border-cyan-500/40 transition-colors">
                <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                <span className="text-[11px] font-mono text-slate-400 block">Drop leave active / inactive logs</span>
                <span className="text-[9px] text-emerald-400 mt-1 block">Synced with HRMS</span>
              </div>
            </div>

            <div className="bg-[#070b10] border border-slate-800 p-4 rounded-lg">
              <span className="text-xs font-mono text-slate-400 block mb-2 uppercase font-bold">
                3. Employee Master
              </span>
              <div className="border border-dashed border-slate-800 rounded p-4 text-center cursor-pointer hover:border-cyan-500/40 transition-colors">
                <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                <span className="text-[11px] font-mono text-slate-400 block">Directory roster</span>
                <span className="text-[9px] text-emerald-400 mt-1 block">509 profiles indexed</span>
              </div>
            </div>
          </div>

          {processMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded text-xs font-mono text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{processMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-900 pt-4">
            <span className="text-xs font-mono text-slate-400">
              Format: High-precision XLSX output with daily attendance status matrix.
            </span>
            <button
              onClick={handleRunConsolidation}
              disabled={isProcessing}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs font-mono transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Consolidate Time &amp; Leave Master
            </button>
          </div>
        </div>
      )}

      {/* MODULE 2: ATTENDANCE SUMMARY */}
      {activeSubTab === "attendance_summary" && (
        <div className="space-y-4">
          <div className="bg-[#070b10] border border-slate-800 rounded-lg p-4 font-mono text-xs">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Daily Attendance Status Distribution (Active Dataset)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="bg-[#04070a] p-3 rounded border border-slate-900 text-center">
                <span className="text-[10px] text-slate-500 block uppercase">Present (P)</span>
                <span className="text-base font-bold text-emerald-400">76.4%</span>
              </div>
              <div className="bg-[#04070a] p-3 rounded border border-slate-900 text-center">
                <span className="text-[10px] text-slate-500 block uppercase">Single Swipe (MS)</span>
                <span className="text-base font-bold text-rose-400">8.2%</span>
              </div>
              <div className="bg-[#04070a] p-3 rounded border border-slate-900 text-center">
                <span className="text-[10px] text-slate-500 block uppercase">Absent (A)</span>
                <span className="text-base font-bold text-amber-400">4.5%</span>
              </div>
              <div className="bg-[#04070a] p-3 rounded border border-slate-900 text-center">
                <span className="text-[10px] text-slate-500 block uppercase">Weekly Off (WO)</span>
                <span className="text-base font-bold text-cyan-400">9.1%</span>
              </div>
              <div className="bg-[#04070a] p-3 rounded border border-slate-900 text-center">
                <span className="text-[10px] text-slate-500 block uppercase">On-Duty / WFH</span>
                <span className="text-base font-bold text-purple-400">1.8%</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Aggregated continuously via Polars analytical facts table without disk locking.
            </p>
          </div>
        </div>
      )}

      {/* MODULE 3: ID CARD GENERATOR */}
      {activeSubTab === "id_cards" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 font-mono text-xs">
          {/* Controls */}
          <div className="md:col-span-5 space-y-4 bg-[#070b10] border border-slate-800 p-4 rounded-lg">
            <h3 className="font-bold text-slate-200 uppercase tracking-wider mb-2">
              ID Card Configuration
            </h3>

            <div>
              <label className="text-slate-400 block mb-1">Select Employee</label>
              <select
                value={selectedEmp}
                onChange={(e) => setSelectedEmp(e.target.value)}
                className="w-full bg-[#04070a] border border-slate-800 rounded p-2 text-slate-200 outline-none"
              >
                <option>Employee 101 (Lending)</option>
                <option>Employee 102 (Engineering)</option>
                <option>Employee 103 (Operations)</option>
                <option>Employee 105 (Product)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Design Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCardDesign("Modern")}
                  className={`flex-1 py-1.5 rounded border ${
                    cardDesign === "Modern"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                      : "bg-[#04070a] text-slate-400 border-slate-800"
                  }`}
                >
                  Modern
                </button>
                <button
                  onClick={() => setCardDesign("Minimal")}
                  className={`flex-1 py-1.5 rounded border ${
                    cardDesign === "Minimal"
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      : "bg-[#04070a] text-slate-400 border-slate-800"
                  }`}
                >
                  Minimal
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-900 space-y-2">
              <span className="text-[11px] text-slate-500 block">Avatar Photo Source</span>
              <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Slack Enterprise Workspace Avatar Synced
              </div>
            </div>

            <button className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded flex items-center justify-center gap-2 transition-all">
              <Printer className="w-4 h-4" />
              Generate Printable PDF Card
            </button>
          </div>

          {/* Interactive Card Mockup Preview */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-[#05080c] border border-slate-900 rounded-lg p-6">
            <div className="w-64 h-96 bg-gradient-to-b from-slate-900 via-[#0a0f18] to-slate-950 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl flex flex-col items-center justify-between relative overflow-hidden">
              {/* Lanyard cutout */}
              <div className="w-10 h-2 bg-slate-800 rounded-full mb-1 border border-slate-700" />

              {/* Logo / Org Header */}
              <div className="text-center">
                <span className="text-[11px] tracking-widest uppercase font-bold text-cyan-400">TRANSFORMERS</span>
                <span className="text-[9px] text-slate-500 block">MOSHPIT TECHNOLOGIES</span>
              </div>

              {/* Avatar circle */}
              <div className="w-24 h-24 rounded-full border-2 border-cyan-400 p-1 bg-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xl font-bold text-white">
                  {selectedEmp.slice(-3)}
                </div>
              </div>

              {/* Details */}
              <div className="text-center space-y-0.5">
                <h4 className="font-bold text-slate-100 text-sm">{selectedEmp}</h4>
                <p className="text-[11px] text-cyan-300">Software Engineer II</p>
                <p className="text-[10px] text-slate-400">Lending Operations Core</p>
              </div>

              {/* Barcode Mock */}
              <div className="w-full text-center border-t border-slate-800/80 pt-2">
                <div className="h-6 w-3/4 mx-auto bg-slate-800/60 rounded flex items-center justify-around px-2">
                  <div className="w-0.5 h-4 bg-slate-400" />
                  <div className="w-1 h-4 bg-slate-200" />
                  <div className="w-0.5 h-4 bg-slate-400" />
                  <div className="w-1.5 h-4 bg-slate-200" />
                  <div className="w-0.5 h-4 bg-slate-400" />
                  <div className="w-1 h-4 bg-slate-300" />
                  <div className="w-2 h-4 bg-slate-200" />
                </div>
                <span className="text-[9px] text-slate-500 mt-1 block">EMP-KEKA-10109</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
