"use client";

import React from "react";
import { Zap, X } from "lucide-react";

/**
 * TopLaserProgressBar
 * Ultra-fast, sleek laser stream along the absolute top edge of the screen,
 * indicating active background data fetching.
 */
export function TopLaserProgressBar({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-[9999] pointer-events-none overflow-hidden bg-slate-900/10">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-cyan-400 to-emerald-400 animate-laser shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
    </div>
  );
}

/**
 * CyberneticOrbitalCore
 * Minimalist glowing dual-ring orbital spinner with a centered pulsing node.
 */
export function CyberneticOrbitalCore({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
  theme?: "dark" | "light";
}) {
  const sizeMap = {
    sm: { box: "w-8 h-8", outer: "w-8 h-8", inner: "w-5 h-5", core: "w-3 h-3", icon: "w-2 h-2" },
    md: { box: "w-14 h-14", outer: "w-14 h-14", inner: "w-10 h-10", core: "w-6 h-6", icon: "w-3 h-3" },
    lg: { box: "w-20 h-20", outer: "w-20 h-20", inner: "w-14 h-14", core: "w-8 h-8", icon: "w-4 h-4" },
  }[size];

  return (
    <div className={`relative flex items-center justify-center ${sizeMap.box}`}>
      {/* Outer Rotating Ring */}
      <div
        className={`absolute inset-0 rounded-full border border-dashed border-emerald-400/50 animate-orbit ${sizeMap.outer}`}
        style={{ animationDuration: "3s" }}
      >
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
      </div>

      {/* Middle Counter-Rotating Ring */}
      <div
        className={`absolute rounded-full border border-cyan-400/60 border-t-transparent border-b-transparent animate-orbit-reverse ${sizeMap.inner}`}
        style={{ animationDuration: "2s" }}
      >
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_4px_rgba(6,182,212,0.8)]" />
      </div>

      {/* Pulsing Energy Core */}
      <div
        className={`relative rounded-lg flex items-center justify-center animate-pulse-core ${sizeMap.core} bg-cyan-500/20 border border-cyan-400/40 text-cyan-300`}
      >
        <Zap className={`${sizeMap.icon} fill-current`} />
      </div>
    </div>
  );
}

/**
 * WorkforceLoadingOverlay
 * Minimalist, clean floating loading modal during active data synchronization.
 * Stripped of technical jargon and clutter.
 */
export function WorkforceLoadingOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  theme?: "dark" | "light";
  onClose?: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/60 animate-fadeIn">
      <div className="relative px-8 py-6 rounded-2xl border shadow-xl transition-all flex flex-col items-center text-center bg-[#090e1a]/95 border-emerald-500/25 text-slate-100 shadow-[0_0_35px_rgba(16,185,129,0.12)]">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="mb-3">
          <CyberneticOrbitalCore size="md" />
        </div>

        <span className="text-xs font-mono font-medium tracking-wide text-slate-300">
          Syncing data...
        </span>

        {/* Minimalist Indeterminate Progress Bar */}
        <div className="w-36 h-1 mt-3 rounded-full overflow-hidden bg-slate-800/60">
          <div className="h-full w-1/2 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full animate-laser" />
        </div>
      </div>
    </div>
  );
}

/**
 * ExecutiveOverviewSkeleton
 * Shimmering glassmorphic skeleton that matches the structure of ExecutiveOverview.
 * Pure visual layout without verbose text banners.
 */
export function ExecutiveOverviewSkeleton({ theme = "dark" }: { theme?: "dark" | "light" }) {
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 5 Shimmering Glass Pulse Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl border skeleton-shimmer flex flex-col justify-between h-24 bg-slate-900/40 border-slate-800/70"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-slate-700/40" />
              <div className="h-4 w-4 rounded-full bg-slate-700/30" />
            </div>
            <div className="space-y-1.5">
              <div className="h-6 w-24 rounded bg-slate-700/50" />
              <div className="h-2.5 w-16 rounded bg-slate-700/30" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Analytical Cards (Reconciliation & Composition) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Reconciliation Card */}
        <div className="lg:col-span-7 p-4 rounded-xl border skeleton-shimmer space-y-3.5 bg-slate-900/40 border-slate-800/70">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-36 rounded bg-slate-700/40" />
            <div className="h-4 w-20 rounded-full bg-slate-700/30" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-slate-800/30 space-y-1">
                <div className="h-2.5 w-12 rounded bg-slate-700/40" />
                <div className="h-5 w-14 rounded bg-slate-700/50" />
              </div>
            ))}
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800/40" />
        </div>

        {/* Composition Card */}
        <div className="lg:col-span-5 p-4 rounded-xl border skeleton-shimmer space-y-3.5 bg-slate-900/40 border-slate-800/70">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-40 rounded bg-slate-700/40" />
            <div className="h-4 w-16 rounded-full bg-slate-700/30" />
          </div>
          <div className="h-6 w-full rounded-lg bg-slate-800/40" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-3 rounded bg-slate-700/30" />
            ))}
          </div>
        </div>
      </div>

      {/* Table Shimmer */}
      <div className="p-4 rounded-xl border skeleton-shimmer space-y-3 bg-slate-900/40 border-slate-800/70">
        <div className="flex items-center justify-between">
          <div className="h-4 w-44 rounded bg-slate-700/40" />
          <div className="h-7 w-32 rounded-lg bg-slate-700/30" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-9 w-full rounded-lg bg-slate-800/20 flex items-center justify-between px-3">
              <div className="h-3 w-28 rounded bg-slate-700/30" />
              <div className="h-3 w-16 rounded bg-slate-700/30" />
              <div className="h-3 w-12 rounded bg-slate-700/30" />
              <div className="h-3 w-16 rounded bg-slate-700/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ChartLoadingOverlay
 * Minimalist glassmorphic spinner for chart panels during metric toggles.
 */
export function ChartLoadingOverlay({
  active,
}: {
  active: boolean;
  theme?: "dark" | "light";
}) {
  if (!active) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 backdrop-blur-xs bg-slate-950/30 rounded-xl transition-all animate-fadeIn">
      <CyberneticOrbitalCore size="sm" />
    </div>
  );
}
