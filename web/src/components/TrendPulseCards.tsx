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

export function TrendPulseCards({ cards, pulse, metricLabel, theme = "dark" }: TrendPulseCardsProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      {cards.map((card, idx) => {
        let accentBorder = theme === "dark" ? "border-slate-800" : "border-slate-200";
        let textAccent = theme === "dark" ? "text-white" : "text-slate-900";
        let bgClass = theme === "dark" ? "bg-[#0c121e]/90" : "bg-white";
        let icon = <Zap className="h-3.5 w-3.5 text-cyan-400" />;

        if (idx === 0) {
          accentBorder = theme === "dark" ? "border-cyan-500/40 glow-cyan" : "border-cyan-300 shadow-sm";
          textAccent = "text-cyan-400";
          bgClass = theme === "dark" ? "bg-cyan-950/20" : "bg-cyan-50/70";
        } else if (idx === 1) {
          if (card.color === "green") {
            accentBorder = theme === "dark" ? "border-emerald-500/40 glow-emerald" : "border-emerald-300";
            textAccent = "text-emerald-500";
            bgClass = theme === "dark" ? "bg-emerald-950/20" : "bg-emerald-50/70";
            icon = <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />;
          } else {
            accentBorder = theme === "dark" ? "border-rose-500/40 glow-rose" : "border-rose-300";
            textAccent = "text-rose-500";
            bgClass = theme === "dark" ? "bg-rose-950/20" : "bg-rose-50/70";
            icon = <TrendingUp className="h-3.5 w-3.5 text-rose-400" />;
          }
        } else if (idx === 2) {
          icon = <ActivityIcon direction={pulse.trend_direction} />;
        } else if (idx === 3) {
          const isNegative = pulse.gap_vs_benchmark && pulse.gap_vs_benchmark > 0;
          textAccent = isNegative ? "text-rose-400" : "text-emerald-400";
        } else if (idx === 4) {
          if (pulse.volume_status === "HIGH") {
            icon = <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />;
            textAccent = "text-emerald-400";
          } else {
            icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
            textAccent = "text-amber-400";
          }
        }

        return (
          <div
            key={idx}
            className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 shadow-sm ${bgClass} ${accentBorder}`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider truncate">
                {card.title}
              </span>
              <div
                className={`p-1 rounded-md ${
                  theme === "dark" ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200"
                }`}
              >
                {icon}
              </div>
            </div>

            {/* Middle: Value */}
            <div className="my-0.5">
              <span className={`text-xl font-bold font-mono tracking-tight ${textAccent}`}>
                {card.value}
              </span>
            </div>

            {/* Bottom: Subtitle */}
            <div className="mt-1 pt-1.5 border-t border-inherit flex flex-col">
              <span className="text-[10px] font-medium text-slate-300 truncate">{card.sub}</span>
              <span className="text-[9px] text-slate-500 truncate">{card.note}</span>
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
