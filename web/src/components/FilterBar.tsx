"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Filter,
  Layers,
  ChevronDown,
  RotateCcw,
  Building2,
  Briefcase,
  Users2,
  User,
  Search,
  X,
  Check,
  GitCompare,
} from "lucide-react";
import { CascadedFilters, MetricMetadata } from "@/lib/types";

interface FilterBarProps {
  metrics: MetricMetadata[];
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
  benchmarkType?: string;
  onSelectBenchmarkType?: (type: string) => void;
  filters: CascadedFilters;
  allBusinessUnits?: string[];
  allDepartments?: string[];
  selectedBU: string;
  onSelectBU: (bu: string) => void;
  selectedDept: string;
  onSelectDept: (dept: string) => void;
  selectedManager: string;
  onSelectManager: (mgr: string) => void;
  selectedEmployee: string;
  onSelectEmployee: (emp: string) => void;
  selectedPeerBU?: string | null;
  selectedPeerDept?: string | null;
  onSelectPeer?: (type: "bu" | "dept" | "none", name: string) => void;
  theme?: "dark" | "light";
  hideMetricSelector?: boolean;
}

interface SearchableFilterSelectProps {
  id?: string;
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  allOptionLabel: string;
  theme?: "dark" | "light";
  colorScheme: "cyan" | "indigo" | "purple" | "emerald";
  icon: React.ComponentType<{ className?: string }>;
  searchPlaceholder?: string;
  align?: "left" | "right";
}

function SearchableFilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  allOptionLabel,
  theme = "dark",
  colorScheme,
  icon: Icon,
  searchPlaceholder = "Search...",
  align = "left",
}: SearchableFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSelected = value !== allOptionLabel;

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, search]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  // Color scheme mappings
  const colorMap = {
    cyan: {
      activeBgDark: "bg-cyan-950/50 border-cyan-500/50 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.15)]",
      activeBgLight: "bg-cyan-50 border-cyan-300 text-cyan-900 shadow-xs",
      iconActive: "text-cyan-400",
      itemActiveDark: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      itemActiveLight: "bg-cyan-100 text-cyan-900 border-cyan-300",
      focusBorderDark: "focus:border-cyan-400",
      focusBorderLight: "focus:border-cyan-600",
    },
    indigo: {
      activeBgDark: "bg-indigo-950/50 border-indigo-500/50 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
      activeBgLight: "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs",
      iconActive: "text-indigo-400",
      itemActiveDark: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
      itemActiveLight: "bg-indigo-100 text-indigo-900 border-indigo-300",
      focusBorderDark: "focus:border-indigo-400",
      focusBorderLight: "focus:border-indigo-600",
    },
    purple: {
      activeBgDark: "bg-purple-950/50 border-purple-500/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
      activeBgLight: "bg-purple-50 border-purple-300 text-purple-900 shadow-xs",
      iconActive: "text-purple-400",
      itemActiveDark: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      itemActiveLight: "bg-purple-100 text-purple-900 border-purple-300",
      focusBorderDark: "focus:border-purple-400",
      focusBorderLight: "focus:border-purple-600",
    },
    emerald: {
      activeBgDark: "bg-emerald-950/50 border-emerald-500/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
      activeBgLight: "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs",
      iconActive: "text-emerald-400",
      itemActiveDark: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      itemActiveLight: "bg-emerald-100 text-emerald-900 border-emerald-300",
      focusBorderDark: "focus:border-emerald-400",
      focusBorderLight: "focus:border-emerald-600",
    },
  }[colorScheme];

  return (
    <div ref={dropdownRef} className={`relative inline-block ${isOpen ? "z-50" : "z-10"}`} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 px-2.5 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-all outline-none cursor-pointer max-w-[190px] sm:max-w-[220px] ${
          isSelected
            ? theme === "dark"
              ? colorMap.activeBgDark
              : colorMap.activeBgLight
            : theme === "dark"
            ? "bg-[#0c101a] border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900"
        } ${isOpen ? "ring-1 ring-cyan-500/60" : ""}`}
        title={`${label}: ${value}`}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? colorMap.iconActive : "text-slate-400"}`} />
        <span className="truncate flex-1 text-left">{value}</span>

        {/* Clear selection button */}
        {isSelected ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(allOptionLabel);
              setIsOpen(false);
            }}
            className="p-0.5 rounded hover:bg-black/20 text-slate-400 hover:text-rose-400 transition-colors"
            title={`Clear ${label}`}
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown
            className={`h-3 w-3 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {/* Popover Dropdown - Fully Opaque with Elevated Z-Index */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 ${
            align === "right" ? "right-0" : "left-0"
          } z-50 w-72 sm:w-80 rounded-xl border p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            theme === "dark"
              ? "bg-[#0b1326] border-slate-700 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
              : "bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
          }`}
          style={{ backgroundColor: theme === "dark" ? "#0b1326" : "#ffffff" }}
        >
          {/* Header & Item Count */}
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] font-mono text-slate-400">
            <span className="uppercase tracking-wider font-semibold flex items-center gap-1">
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 font-mono">
              {filteredOptions.length} of {options.length}
            </span>
          </div>

          {/* Search Input Bar */}
          <div className="relative mb-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full pl-8 pr-7 py-1.5 rounded-lg text-xs font-mono outline-none border transition-colors ${
                theme === "dark"
                  ? `bg-[#060a14] border-slate-700/80 text-slate-100 placeholder-slate-500 ${colorMap.focusBorderDark}`
                  : `bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 ${colorMap.focusBorderLight}`
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs font-mono text-slate-400">
                No matching results
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isItemActive = opt === value;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                      isItemActive
                        ? theme === "dark"
                          ? `${colorMap.itemActiveDark} font-bold border`
                          : `${colorMap.itemActiveLight} font-bold border`
                        : theme === "dark"
                        ? "hover:bg-slate-800/70 text-slate-300 hover:text-white"
                        : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    <span className="truncate flex-1">{opt}</span>
                    {isItemActive && <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 ml-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableMetricSelect({
  metrics,
  selectedMetricId,
  onSelectMetric,
  theme,
}: {
  metrics: MetricMetadata[];
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
  theme: "dark" | "light";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMetric = metrics.find((m) => m.id === selectedMetricId);
  const categories = ["Attendance", "Working Time", "Compliance", "Approval"] as const;

  const filteredMetrics = useMemo(() => {
    if (!search.trim()) return metrics;
    const q = search.trim().toLowerCase();
    return metrics.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.format.toLowerCase().includes(q)
    );
  }, [metrics, search]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block min-w-[200px] ${isOpen ? "z-50" : "z-10"}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-8 px-2.5 rounded-lg border text-xs font-mono font-medium flex items-center justify-between gap-1.5 transition-all outline-none cursor-pointer ${
          theme === "dark"
            ? "bg-[#0c101a] border-slate-700/80 text-cyan-300 hover:border-cyan-500/60"
            : "bg-slate-50 border-slate-300 text-cyan-800 hover:border-cyan-600"
        } ${isOpen ? "ring-1 ring-cyan-500" : ""}`}
        title={`Selected Metric: ${currentMetric?.label || selectedMetricId}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{currentMetric?.label || selectedMetricId}</span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-cyan-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 left-0 z-50 w-72 sm:w-80 rounded-xl border p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            theme === "dark"
              ? "bg-[#0b1326] border-slate-700 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
              : "bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
          }`}
          style={{ backgroundColor: theme === "dark" ? "#0b1326" : "#ffffff" }}
        >
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] font-mono text-slate-400">
            <span className="uppercase tracking-wider font-semibold flex items-center gap-1">
              <Layers className="h-3 w-3 text-cyan-400" />
              <span>Telemetry Metrics</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 font-mono">
              {filteredMetrics.length} of {metrics.length}
            </span>
          </div>

          <div className="relative mb-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metric name, format..."
              className={`w-full pl-8 pr-7 py-1.5 rounded-lg text-xs font-mono outline-none border transition-colors ${
                theme === "dark"
                  ? "bg-[#060a14] border-slate-700/80 text-slate-100 placeholder-slate-500 focus:border-cyan-400"
                  : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600"
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
            {filteredMetrics.length === 0 ? (
              <div className="py-4 text-center text-xs font-mono text-slate-400">
                No matching metrics
              </div>
            ) : (
              categories.map((cat) => {
                const catMetrics = filteredMetrics.filter((m) => m.category === cat);
                if (catMetrics.length === 0) return null;
                return (
                  <div key={cat} className="space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                      ── {cat} ──
                    </div>
                    {catMetrics.map((m) => {
                      const isItemActive = m.id === selectedMetricId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onSelectMetric(m.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                            isItemActive
                              ? theme === "dark"
                                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                                : "bg-cyan-100 text-cyan-900 font-bold border border-cyan-300"
                              : theme === "dark"
                              ? "hover:bg-slate-800/70 text-slate-300 hover:text-white"
                              : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                          }`}
                        >
                          <div className="truncate flex-1">
                            <span>{m.label}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">({m.format})</span>
                          </div>
                          {isItemActive && <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 ml-1.5" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparePeerSelect({
  selectedPeerBU,
  selectedPeerDept,
  onSelectPeer,
  allBusinessUnits = [],
  allDepartments = [],
  currentBU,
  currentDept,
  theme = "dark",
}: {
  selectedPeerBU?: string | null;
  selectedPeerDept?: string | null;
  onSelectPeer: (type: "bu" | "dept" | "none", name: string) => void;
  allBusinessUnits: string[];
  allDepartments: string[];
  currentBU?: string;
  currentDept?: string;
  theme?: "dark" | "light";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPeer = Boolean(selectedPeerBU || selectedPeerDept);
  const activePeerLabel = selectedPeerBU
    ? `Peer: ${selectedPeerBU}`
    : selectedPeerDept
    ? `Peer: ${selectedPeerDept}`
    : "Compare Peer";

  // Filter out currently scoped entities and "All ..." placeholders
  const cleanBUs = useMemo(() => {
    return allBusinessUnits.filter(
      (b) => b && b !== "All Business Units" && b !== currentBU
    );
  }, [allBusinessUnits, currentBU]);

  const cleanDepts = useMemo(() => {
    return allDepartments.filter(
      (d) => d && d !== "All Departments" && d !== currentDept
    );
  }, [allDepartments, currentDept]);

  const filteredBUs = useMemo(() => {
    if (!search.trim()) return cleanBUs;
    const q = search.trim().toLowerCase();
    return cleanBUs.filter((b) => b.toLowerCase().includes(q));
  }, [cleanBUs, search]);

  const filteredDepts = useMemo(() => {
    if (!search.trim()) return cleanDepts;
    const q = search.trim().toLowerCase();
    return cleanDepts.filter((d) => d.toLowerCase().includes(q));
  }, [cleanDepts, search]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block ${isOpen ? "z-50" : "z-10"}`} id="filter-peer-compare">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 px-2.5 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-all outline-none cursor-pointer max-w-[210px] ${
          hasPeer
            ? theme === "dark"
              ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.2)]"
              : "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs"
            : theme === "dark"
            ? "bg-[#0c101a] border-slate-700/60 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-900"
        } ${isOpen ? "ring-1 ring-emerald-500" : ""}`}
        title={hasPeer ? activePeerLabel : "Compare against another Business Unit or Department"}
      >
        <GitCompare className={`h-3.5 w-3.5 shrink-0 ${hasPeer ? "text-emerald-400" : "text-slate-400"}`} />
        <span className="truncate flex-1 text-left">{activePeerLabel}</span>

        {hasPeer ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPeer("none", "");
              setIsOpen(false);
            }}
            className="p-0.5 rounded hover:bg-black/20 text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear peer comparison"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown
            className={`h-3 w-3 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 left-0 z-50 w-72 sm:w-80 rounded-xl border p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            theme === "dark"
              ? "bg-[#0b1326] border-slate-700 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
              : "bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
          }`}
          style={{ backgroundColor: theme === "dark" ? "#0b1326" : "#ffffff" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] font-mono text-slate-400">
            <span className="uppercase tracking-wider font-semibold flex items-center gap-1 text-emerald-400">
              <GitCompare className="h-3 w-3" />
              <span>Compare Peer Benchmark</span>
            </span>
            {hasPeer && (
              <button
                type="button"
                onClick={() => {
                  onSelectPeer("none", "");
                  setIsOpen(false);
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <p className="px-1 text-[10px] text-slate-400 font-sans mb-1.5 leading-tight">
            Select a peer entity to overlay an emerald comparison trend against the organisation baseline.
          </p>

          {/* Search Input Bar */}
          <div className="relative mb-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search peer BU or Department..."
              className={`w-full pl-8 pr-7 py-1.5 rounded-lg text-xs font-mono outline-none border transition-colors ${
                theme === "dark"
                  ? "bg-[#060a14] border-slate-700/80 text-slate-100 placeholder-slate-500 focus:border-emerald-400"
                  : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600"
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
            {/* None / Reset Option */}
            <button
              type="button"
              onClick={() => {
                onSelectPeer("none", "");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                !hasPeer
                  ? theme === "dark"
                    ? "bg-slate-800/80 text-white font-bold border border-slate-700"
                    : "bg-slate-200 text-slate-900 font-bold border border-slate-300"
                  : theme === "dark"
                  ? "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                  : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
              }`}
            >
              <span className="truncate flex-1">None (Default Org Only)</span>
              {!hasPeer && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-1.5" />}
            </button>

            {/* Business Units Section */}
            {filteredBUs.length > 0 && (
              <div className="space-y-0.5 pt-1">
                <div className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-cyan-400" />
                  <span>Peer Business Units</span>
                </div>
                {filteredBUs.map((bu) => {
                  const isActive = selectedPeerBU === bu;
                  return (
                    <button
                      key={bu}
                      type="button"
                      onClick={() => {
                        onSelectPeer("bu", bu);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                        isActive
                          ? theme === "dark"
                            ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                            : "bg-emerald-100 text-emerald-900 font-bold border border-emerald-300"
                          : theme === "dark"
                          ? "hover:bg-slate-800/70 text-slate-300 hover:text-white"
                          : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      <span className="truncate flex-1">{bu}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-1.5" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Departments Section */}
            {filteredDepts.length > 0 && (
              <div className="space-y-0.5 pt-1">
                <div className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-indigo-400" />
                  <span>Peer Departments</span>
                </div>
                {filteredDepts.map((dept) => {
                  const isActive = selectedPeerDept === dept;
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        onSelectPeer("dept", dept);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                        isActive
                          ? theme === "dark"
                            ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                            : "bg-emerald-100 text-emerald-900 font-bold border border-emerald-300"
                          : theme === "dark"
                          ? "hover:bg-slate-800/70 text-slate-300 hover:text-white"
                          : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      <span className="truncate flex-1">{dept}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-1.5" />}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredBUs.length === 0 && filteredDepts.length === 0 && (
              <div className="py-4 text-center text-xs font-mono text-slate-400">
                No matching peer entities
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  metrics,
  selectedMetricId,
  onSelectMetric,
  benchmarkType,
  onSelectBenchmarkType,
  filters,
  allBusinessUnits,
  allDepartments,
  selectedBU,
  onSelectBU,
  selectedDept,
  onSelectDept,
  selectedManager,
  onSelectManager,
  selectedEmployee,
  onSelectEmployee,
  selectedPeerBU,
  selectedPeerDept,
  onSelectPeer,
  theme = "dark",
  hideMetricSelector = false,
}: FilterBarProps) {
  const isFiltered =
    selectedBU !== "All Business Units" ||
    selectedDept !== "All Departments" ||
    selectedManager !== "All Reporting Managers" ||
    selectedEmployee !== "All Employees" ||
    Boolean(selectedPeerBU || selectedPeerDept);

  const handleResetFilters = () => {
    onSelectBU("All Business Units");
    onSelectDept("All Departments");
    onSelectManager("All Reporting Managers");
    onSelectEmployee("All Employees");
    if (onSelectPeer) {
      onSelectPeer("none", "");
    }
  };

  return (
    <div
      className={`relative z-30 rounded-xl border px-3 py-2 mb-4 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        theme === "dark"
          ? "bg-[#090d16] border-slate-800 text-slate-100 shadow-md"
          : "bg-white border-slate-200 text-slate-800 shadow-xs"
      }`}
    >
      {/* ── Left Section: Metric & Benchmark Controls (Telemetry mode) OR Label (Overview mode) ── */}
      <div className="flex flex-wrap items-center gap-2">
        {!hideMetricSelector ? (
          <>
            {/* Searchable Metric Dropdown Pill */}
            <SearchableMetricSelect
              metrics={metrics}
              selectedMetricId={selectedMetricId}
              onSelectMetric={onSelectMetric}
              theme={theme}
            />

            {/* User-Selectable Peer Comparison Pill */}
            {onSelectPeer && (
              <ComparePeerSelect
                selectedPeerBU={selectedPeerBU}
                selectedPeerDept={selectedPeerDept}
                onSelectPeer={onSelectPeer}
                allBusinessUnits={allBusinessUnits || filters.business_units}
                allDepartments={allDepartments || filters.departments}
                currentBU={selectedBU}
                currentDept={selectedDept}
                theme={theme}
              />
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Filter className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-300">Filter Scope:</span>
          </div>
        )}
      </div>

      {/* ── Right Section: Dimensional Cascading Searchable Pills Strip ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Business Unit Pill */}
        <SearchableFilterSelect
          id="filter-bu"
          label="Business Unit"
          value={selectedBU}
          options={filters.business_units}
          onChange={onSelectBU}
          allOptionLabel="All Business Units"
          theme={theme}
          colorScheme="cyan"
          icon={Building2}
          searchPlaceholder="Search business unit..."
          align="left"
        />

        {/* Department Pill */}
        <SearchableFilterSelect
          id="filter-dept"
          label="Department"
          value={selectedDept}
          options={filters.departments}
          onChange={onSelectDept}
          allOptionLabel="All Departments"
          theme={theme}
          colorScheme="indigo"
          icon={Briefcase}
          searchPlaceholder="Search department..."
          align="left"
        />

        {/* Manager Pill */}
        <SearchableFilterSelect
          id="filter-manager"
          label="Reporting Manager"
          value={selectedManager}
          options={filters.managers}
          onChange={onSelectManager}
          allOptionLabel="All Reporting Managers"
          theme={theme}
          colorScheme="purple"
          icon={Users2}
          searchPlaceholder="Search manager name..."
          align="right"
        />

        {/* Individual Employee Pill */}
        <SearchableFilterSelect
          id="filter-employee"
          label="Employee"
          value={selectedEmployee}
          options={filters.employees}
          onChange={onSelectEmployee}
          allOptionLabel="All Employees"
          theme={theme}
          colorScheme="emerald"
          icon={User}
          searchPlaceholder="Search employee name or ID..."
          align="right"
        />

        {/* Reset Button (only shown when filtered) */}
        {isFiltered && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
            title="Reset all filters to organization scope"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
