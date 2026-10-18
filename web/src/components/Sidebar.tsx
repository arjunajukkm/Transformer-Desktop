"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Sparkles,
  Sliders,
  Plug,
  FileSpreadsheet,
  LayoutGrid,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  UserCheck,
  ChevronDown,
  Building2,
  Lock,
  ArrowLeftRight,
} from "lucide-react";
import { UserPersona } from "../lib/types";
import { fetchCurrentUser, fetchAvailablePersonas, switchPersona } from "../lib/api";

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onPersonaChanged?: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
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
          id: "overview",
          label: "Executive Overview",
          icon: LayoutDashboard,
          color: "text-emerald-400",
          accentBorder: "border-l-emerald-400",
        },
        {
          id: "telemetry",
          label: "Telemetry & Trends",
          icon: Activity,
          color: "text-cyan-400",
          accentBorder: "border-l-cyan-400",
        },
        {
          id: "predictive",
          label: "AI Predictive Signals",
          icon: Sparkles,
          color: "text-purple-400",
          accentBorder: "border-l-purple-400",
        },
        {
          id: "simulation",
          label: "Policy Simulation",
          icon: Sliders,
          color: "text-blue-400",
          accentBorder: "border-l-blue-400",
        },
      ],
    },
    {
      group: "OPS COMMAND CENTER",
      items: [
        {
          id: "datasync",
          label: "Data Sync",
          icon: ArrowLeftRight,
          color: "text-cyan-400",
          accentBorder: "border-l-cyan-400",
        },
        {
          id: "connectors",
          label: "Connectors & CDC",
          icon: Plug,
          color: "text-emerald-400",
          accentBorder: "border-l-emerald-400",
        },
        {
          id: "operations",
          label: "Operations Suite",
          icon: FileSpreadsheet,
          color: "text-amber-400",
          accentBorder: "border-l-amber-400",
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out flex flex-col border-r bg-[#090d16] border-slate-800 text-slate-100 ${
        collapsed ? "w-[72px]" : "w-[250px]"
      }`}
    >
      {/* ── Brand Header ── */}
      {collapsed ? (
        <div className="h-16 flex items-center justify-center px-2 border-b border-slate-800/80 shrink-0">
          <button
            onClick={onToggleCollapse}
            className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all group relative cursor-pointer"
            title="Expand Menu"
          >
            <Zap className="h-5 w-5 text-white group-hover:opacity-0 transition-opacity" />
            <ChevronRight className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity absolute" />
          </button>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col truncate animate-fadeIn">
              <span className="font-bold text-sm tracking-wider uppercase font-mono leading-tight">
                Transformers
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-semibold tracking-wide flex items-center gap-1">
                <span>v2.4 PRO</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
            </div>
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all text-xs"
            title="Collapse Menu"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Navigation Items ── */}
      <nav
        className={`flex-1 overflow-y-auto ${
          collapsed ? "px-2" : "px-3"
        } py-4 space-y-5 scrollbar-thin`}
      >
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
                  className={`w-full flex items-center ${
                    collapsed ? "justify-center px-2" : "gap-3 px-3"
                  } py-2.5 rounded-lg text-xs font-medium transition-all group relative border ${
                    isActive
                      ? "bg-slate-800/70 text-white font-semibold border-slate-700/60 shadow-xs"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  {/* Subtle active left pill bar */}
                  {isActive && (
                    <span
                      className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${item.color.replace(
                        "text-",
                        "bg-"
                      )}`}
                    />
                  )}
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? item.color : "text-slate-400 group-hover:" + item.color
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate text-left flex-1 font-medium">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Sidebar Footer: Persona & Engine Status ── */}
      <div
        className={`${
          collapsed ? "p-2" : "p-3"
        } border-t border-slate-800/80 shrink-0 space-y-2`}
      >
        {/* Persona Switcher Card */}
        <div className="relative">
          <button
            onClick={() => setPersonaDropdownOpen(!personaDropdownOpen)}
            disabled={isSwitching}
            className={`w-full flex items-center ${
              collapsed ? "justify-center p-2" : "gap-2.5 p-2.5"
            } rounded-xl border border-slate-800/80 bg-[#0b0f19] hover:bg-slate-800/60 text-slate-200 transition-all text-left shadow-sm`}
            title={collapsed ? `${currentUser?.name} (${currentUser?.role_label})` : undefined}
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
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
              className={`absolute bottom-full ${
                collapsed ? "left-full ml-3" : "left-0"
              } mb-2 w-64 rounded-xl shadow-2xl border border-slate-700 bg-[#0d1322] text-slate-100 p-2 z-50 animate-fadeIn`}
            >
              <div className="px-2 py-1 text-[10px] font-mono uppercase font-bold text-slate-400 border-b border-slate-800 pb-1.5 mb-1.5 flex items-center justify-between">
                <span>Select Persona</span>
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
                          : "hover:bg-slate-800 text-slate-300"
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
                      {isSelected && (
                        <UserCheck className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      )}
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
              Polars Engine
            </span>
            <span className="text-cyan-400 font-semibold">&lt; 1.5ms</span>
          </div>
        )}
      </div>
    </aside>
  );
}
