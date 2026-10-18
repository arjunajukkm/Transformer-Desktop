"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle, Info, Zap } from "lucide-react";
import { TrendPulse, TrendPulseCard } from "@/lib/types";

interface TrendPulseCardsProps {
  cards: TrendPulseCard[];
  pulse: TrendPulse;
  metricLabel: string;
  theme?: "dark" | "light";
}

function abbreviatePulseValue(raw: string): string {
  if (!raw) return "—";
  let s = raw.trim();
  // Applied X days before leave/WFH
  s = s.replace(/Applied\s+([\d.]+)\s+days?\s+before\s+(leave|wfh)/gi, "$1d in adv.");
  // Applied X days after leave/WFH
  s = s.replace(/Applied\s+([\d.]+)\s+days?\s+after\s+(leave|wfh)/gi, "$1d retro");
  // Applied on same day
  s = s.replace(/Applied\s+on\s+same\s+day/gi, "Same day");
  // Insufficient Data
  if (s.toLowerCase() === "insufficient data") return "Insuff. Data";
  return s;
}

function abbreviatePulseNote(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/Previous:\s*Applied\s+([\d.]+)\s+days?\s+before\s+(leave|wfh)/gi, "Prev: $1d in adv.");
  s = s.replace(/Previous:\s*Applied\s+([\d.]+)\s+days?\s+after\s+(leave|wfh)/gi, "Prev: $1d retro");
  s = s.replace(/Previous:\s*/gi, "Prev: ");
  return s;
}

function abbreviatePulseSub(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/Organisation/gi, "Org");
  s = s.replace(/Department/gi, "Dept");
  s = s.replace(/Business Unit/gi, "BU");
  s = s.replace(/Applied\s+([\d.]+)\s+days?\s+before\s+(leave|wfh)/gi, "$1d in adv.");
  s = s.replace(/Applied\s+([\d.]+)\s+days?\s+after\s+(leave|wfh)/gi, "$1d retro");
  s = s.replace(/Applied\s+on\s+same\s+day/gi, "Same day");
  return s;
}

export function TrendPulseCards({ cards, pulse, metricLabel, theme = "dark" }: TrendPulseCardsProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      {cards.map((card, idx) => {
        let accentBorder = theme === "dark" ? "border-slate-800/80" : "border-slate-200/90";
        let textAccent = theme === "dark" ? "text-white" : "text-slate-900";
        let bgClass = theme === "dark" ? "bg-[#0c1324]/90" : "bg-white/95";
        let icon = <Zap className="h-3.5 w-3.5 text-cyan-400" />;

        if (idx === 0) {
          accentBorder = theme === "dark" ? "border-cyan-500/50 glow-cyan" : "border-cyan-300 shadow-sm";
          textAccent = theme === "dark" ? "text-cyan-300" : "text-cyan-700";
          bgClass = theme === "dark" ? "bg-cyan-950/30" : "bg-cyan-50/80";
        } else if (idx === 1) {
          if (card.color === "green") {
            accentBorder = theme === "dark" ? "border-emerald-500/50 glow-emerald" : "border-emerald-300 shadow-sm";
            textAccent = theme === "dark" ? "text-emerald-400" : "text-emerald-700";
            bgClass = theme === "dark" ? "bg-emerald-950/30" : "bg-emerald-50/80";
            icon = <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />;
          } else {
            accentBorder = theme === "dark" ? "border-rose-500/50 glow-rose" : "border-rose-300 shadow-sm";
            textAccent = theme === "dark" ? "text-rose-400" : "text-rose-700";
            bgClass = theme === "dark" ? "bg-rose-950/30" : "bg-rose-50/80";
            icon = <TrendingUp className="h-3.5 w-3.5 text-rose-400" />;
          }
        } else if (idx === 2) {
          accentBorder = theme === "dark" ? "border-blue-500/40 glow-indigo" : "border-blue-200 shadow-sm";
          bgClass = theme === "dark" ? "bg-blue-950/25" : "bg-blue-50/70";
          textAccent = theme === "dark" ? "text-blue-300" : "text-blue-800";
          icon = <ActivityIcon direction={pulse.trend_direction} />;
        } else if (idx === 3) {
          const isNegative = pulse.gap_vs_benchmark && pulse.gap_vs_benchmark > 0;
          accentBorder = isNegative
            ? theme === "dark" ? "border-rose-500/40 glow-rose" : "border-rose-200 shadow-sm"
            : theme === "dark" ? "border-emerald-500/40 glow-emerald" : "border-emerald-200 shadow-sm";
          bgClass = isNegative
            ? theme === "dark" ? "bg-rose-950/25" : "bg-rose-50/70"
            : theme === "dark" ? "bg-emerald-950/25" : "bg-emerald-50/70";
          textAccent = isNegative
            ? theme === "dark" ? "text-rose-400" : "text-rose-700"
            : theme === "dark" ? "text-emerald-400" : "text-emerald-700";
        } else if (idx === 4) {
          if (pulse.volume_status === "HIGH") {
            accentBorder = theme === "dark" ? "border-emerald-500/40 glow-emerald" : "border-emerald-200 shadow-sm";
            bgClass = theme === "dark" ? "bg-emerald-950/25" : "bg-emerald-50/70";
            icon = <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />;
            textAccent = theme === "dark" ? "text-emerald-400" : "text-emerald-700";
          } else {
            accentBorder = theme === "dark" ? "border-amber-500/40 glow-amber" : "border-amber-200 shadow-sm";
            bgClass = theme === "dark" ? "bg-amber-950/25" : "bg-amber-50/70";
            icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
            textAccent = theme === "dark" ? "text-amber-400" : "text-amber-700";
          }
        }

        const displayVal = abbreviatePulseValue(card.value);
        const displaySub = abbreviatePulseSub(card.sub);
        const displayNote = abbreviatePulseNote(card.note);
        const valLen = displayVal.length;
        const fontClass =
          valLen > 16
            ? "text-base sm:text-lg"
            : valLen > 11
            ? "text-lg sm:text-xl"
            : "text-xl sm:text-2xl";

        return (
          <div
            key={idx}
            className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all duration-200 shadow-sm h-full min-h-[110px] ${bgClass} ${accentBorder}`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider truncate ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
                title={card.title}
              >
                {card.title}
              </span>
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  theme === "dark"
                    ? "bg-slate-900/90 border border-slate-800"
                    : "bg-white border border-slate-200 shadow-xs"
                }`}
              >
                {icon}
              </div>
            </div>

            {/* Middle: Value with adaptive font scaling and smart abbreviation */}
            <div className="my-0.5 min-w-0 overflow-hidden">
              <span
                className={`font-bold font-mono tracking-tight truncate block ${fontClass} ${textAccent}`}
                title={card.value}
              >
                {displayVal}
              </span>
            </div>

            {/* Bottom: Subtitle & Note */}
            <div className="mt-1.5 pt-1.5 border-t border-inherit flex flex-col min-w-0">
              <span
                className={`text-[10px] font-medium truncate ${
                  theme === "dark" ? "text-slate-300" : "text-slate-700"
                }`}
                title={card.sub}
              >
                {displaySub}
              </span>
              <span
                className={`text-[9px] truncate ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
                title={card.note}
              >
                {displayNote}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityIcon({ direction }: { direction: string }) {
  if (direction === "STABLE") return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  if (direction === "WORSENING" || direction === "REGRESSING") return <TrendingUp className="h-3.5 w-3.5 text-rose-400" />;
  if (direction === "IMPROVING") return <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />;
  return <Info className="h-3.5 w-3.5 text-cyan-400" />;
}
