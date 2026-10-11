"use client";

import React, { useState, useEffect } from "react";
import { Shield, ChevronDown, UserCheck, ShieldAlert, Users, Check } from "lucide-react";
import { UserPersona } from "../lib/types";
import { fetchAvailablePersonas, fetchCurrentUser, switchPersona, setActivePersonaId } from "../lib/api";

interface PersonaSwitcherProps {
  onPersonaChanged?: (persona: UserPersona) => void;
}

export function PersonaSwitcher({ onPersonaChanged }: PersonaSwitcherProps) {
  const [currentUser, setCurrentUser] = useState<UserPersona | null>(null);
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchCurrentUser().catch(() => null),
      fetchAvailablePersonas().catch(() => []),
    ]).then(([curr, list]) => {
      if (curr) setCurrentUser(curr);
      if (list) setPersonas(list);
    });
  }, []);

  const handleSelectPersona = async (p: UserPersona) => {
    setLoading(true);
    setIsOpen(false);
    try {
      const switched = await switchPersona(p.id);
      setActivePersonaId(p.id);
      setCurrentUser(switched);
      if (onPersonaChanged) onPersonaChanged(switched);
    } catch (err) {
      console.error("Failed to switch persona:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-[#070b10] hover:bg-[#0c1219] border border-cyan-500/30 rounded-lg text-xs font-mono transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] group"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
          {currentUser.avatar_initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="font-bold text-slate-200 leading-none group-hover:text-cyan-300 transition-colors">
            {currentUser.name}
          </div>
          <div className="text-[10px] text-cyan-400/90 leading-tight mt-0.5">
            {currentUser.role_label}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#090e15] border border-cyan-500/30 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-slate-800 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Multi-Level Permission Switcher
            </span>
            <span className="text-[11px] text-slate-500">
              Test Row-Level Security &amp; role-based data boundaries in real time.
            </span>
          </div>

          <div className="space-y-1">
            {personas.map((p) => {
              const isSelected = p.id === currentUser.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPersona(p)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs font-mono transition-all flex items-start justify-between ${
                    isSelected
                      ? "bg-cyan-500/15 border border-cyan-500/40 text-slate-100 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                      : "hover:bg-slate-900/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                        p.role === "SUPER_ADMIN"
                          ? "bg-purple-600 text-white"
                          : p.role === "BU_HEAD"
                          ? "bg-cyan-600 text-white"
                          : p.role === "MANAGER"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-200"
                      }`}
                    >
                      {p.avatar_initials}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{p.name}</span>
                        <span className="text-[10px] text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800">
                          {p.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">{p.title}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Scope:{" "}
                        <span className="text-slate-300">
                          {p.allowed_business_units.join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Row-Level Security (RLS)</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
        </div>
      )}
    </div>
  );
}
