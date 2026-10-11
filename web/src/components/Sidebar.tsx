"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Sparkles,
  Sliders,
  Plug,
  FileSpreadsheet,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Shield,
  Zap,
  UserCheck,
  ChevronDown,
  Building2,
  Lock,
} from "lucide-react";
import { UserPersona } from "../lib/types";
import { fetchCurrentUser, fetchAvailablePersonas, switchPersona } from "../lib/api";

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onPersonaChanged?: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
  onPersonaChanged,
}: SidebarProps) {
  const [currentUser, setCurrentUser] = useState<UserPersona | null>(null);
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const loadUserData = async () => {
    try {
      const [user, allPersonas] = await Promise.all([
        fetchCurrentUser(),
        fetchAvailablePersonas(),
      ]);
      setCurrentUser(user);
      setPersonas(allPersonas);
    } catch (err) {
      console.error("Failed to load user persona:", err);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const handleSelectPersona = async (personaId: string) => {
    setIsSwitching(true);
    setPersonaDropdownOpen(false);
    try {
      const updated = await switchPersona(personaId);
      setCurrentUser(updated);
      if (onPersonaChanged) onPersonaChanged();
    } catch (err) {
      console.error("Failed to switch persona:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const navItems = [
    {
      group: "INTELLIGENCE",
      items: [
        {
          id: "telemetry",
          label: "Telemetry & Trends",
          icon: Activity,
          color: "text-cyan-400",
          activeBg: theme === "dark" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border-cyan-300",
          badge: "Live",
          badgeColor: "bg-cyan-500/20 text-cyan-400",
        },
        {
          id: "predictive",
          label: "AI Predictive Signals",
          icon: Sparkles,
          color: "text-purple-400",
          activeBg: theme === "dark" ? "bg-purple-500/15 text-purple-300 border-purple-500/30" : "bg-purple-50 text-purple-700 border-purple-300",
          badge: "ML Sentinel",
          badgeColor: "bg-purple-500/20 text-purple-400",
        },
        {
          id: "simulation",
          label: "Policy Simulation",
          icon: Sliders,
          color: "text-blue-400",
          activeBg: theme === "dark" ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-300",
        },
      ],
    },
    {
      group: "PIPELINES & OPS",
      items: [
        {
          id: "connectors",
          label: "Connectors & CDC",
          icon: Plug,
          color: "text-emerald-400",
          activeBg: theme === "dark" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-300",
          badge: "Daemon",
          badgeColor: "bg-emerald-500/20 text-emerald-400",
        },
        {
          id: "operations",
          label: "Operations Suite",
          icon: FileSpreadsheet,
          color: "text-amber-400",
          activeBg: theme === "dark" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-300",
        },
      ],
    },
    {
      group: "EXECUTIVE",
      items: [
        {
          id: "all",
          label: "Executive War Room",
          icon: LayoutGrid,
          color: "text-rose-400",
          activeBg: theme === "dark" ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-50 text-rose-700 border-rose-300",
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out flex flex-col border-r ${
        theme === "dark"
          ? "bg-[#090d16] border-slate-800 text-slate-100"
          : "bg-white border-slate-200 text-slate-800 shadow-sm"
      } ${collapsed ? "w-[72px]" : "w-[250px]"}`}
    >
      {/* ── Brand Header ── */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-inherit shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
            <Zap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate animate-fadeIn">
              <span className="font-bold text-sm tracking-wider uppercase font-mono leading-tight">
                Transformers
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-semibold tracking-wide flex items-center gap-1">
                <span>v2.4 PRO</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg border transition-all text-xs ${
            theme === "dark"
              ? "border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60"
              : "border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Navigation Items ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
        {navItems.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!collapsed && (
              <div className="px-2 text-[10px] font-mono font-bold tracking-wider text-slate-400/80 uppercase">
                {group.group}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative border ${
                    isActive
                      ? `${item.activeBg} font-semibold shadow-sm`
                      : theme === "dark"
                      ? "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? item.color : "text-slate-400 group-hover:" + item.color}`} />
                  {!collapsed && (
                    <span className="truncate text-left flex-1">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Sidebar Footer: Theme, Persona & Engine ── */}
      <div className="p-3 border-t border-inherit shrink-0 space-y-2.5">
        {/* Dark / Light Mode Pill */}
        <div
          className={`flex items-center justify-between p-1 rounded-xl border ${
            theme === "dark" ? "bg-[#06090e] border-slate-800" : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            onClick={() => theme !== "light" && onToggleTheme()}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-medium transition-all ${
              theme === "light"
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Switch to Light Theme"
          >
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            {!collapsed && <span>Light</span>}
          </button>
          <button
            onClick={() => theme !== "dark" && onToggleTheme()}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-medium transition-all ${
              theme === "dark"
                ? "bg-slate-800 text-cyan-300 shadow-sm font-semibold"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title="Switch to Dark Theme"
          >
            <Moon className="h-3.5 w-3.5 text-cyan-400" />
            {!collapsed && <span>Dark</span>}
          </button>
        </div>

        {/* Persona Switcher Card */}
        <div className="relative">
          <button
            onClick={() => setPersonaDropdownOpen(!personaDropdownOpen)}
            disabled={isSwitching}
            className={`w-full flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
              theme === "dark"
                ? "bg-[#0b0f19] hover:bg-slate-800/60 border-slate-800 text-slate-200"
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
            }`}
            title={collapsed ? `${currentUser?.name} (${currentUser?.role_label})` : undefined}
          >
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {currentUser?.avatar_initials || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate leading-tight flex items-center gap-1">
                  <span>{currentUser?.name || "User"}</span>
                  {currentUser?.role === "SUPER_ADMIN" ? (
                    <Shield className="h-2.5 w-2.5 text-cyan-400" />
                  ) : (
                    <Lock className="h-2.5 w-2.5 text-amber-400" />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {currentUser?.role_label || "Active Role"}
                </div>
              </div>
            )}
            {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
          </button>

          {/* Persona Selection Dropdown Modal */}
          {personaDropdownOpen && (
            <div
              className={`absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-2xl border p-2 z-50 animate-fadeIn ${
                theme === "dark"
                  ? "bg-[#0d1322] border-slate-700 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="px-2 py-1 text-[10px] font-mono uppercase font-bold text-slate-400 border-b border-inherit pb-1.5 mb-1.5 flex items-center justify-between">
                <span>Select Enterprise Persona</span>
                <span className="text-cyan-400">RBAC / RLS</span>
              </div>
              <div className="space-y-1">
                {personas.map((p) => {
                  const isSelected = currentUser?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPersona(p.id)}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-cyan-500/15 text-cyan-300 font-semibold"
                          : theme === "dark"
                          ? "hover:bg-slate-800 text-slate-300"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="h-6 w-6 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        {p.avatar_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.role_label}</div>
                        <div className="text-[9px] text-emerald-400/90 font-mono mt-0.5">
                          Scope: {p.allowed_business_units.join(", ")}
                        </div>
                      </div>
                      {isSelected && <UserCheck className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Engine Latency Badge */}
        {!collapsed && (
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Polars OLAP Engine
            </span>
            <span className="text-cyan-400 font-semibold">&lt; 1.5ms</span>
          </div>
        )}
      </div>
    </aside>
  );
}
