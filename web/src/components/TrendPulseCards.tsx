"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle, Info, Zap } from "lucide-react";
import { TrendPulse, TrendPulseCard } from "@/lib/types";

interface TrendPulseCardsProps {
  cards: TrendPulseCard[];
  pulse: TrendPulse;
  metricLabel: string;
}

export function TrendPulseCards({ cards, pulse, metricLabel }: TrendPulseCardsProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((card, idx) => {
        // Accent styles based on index and color
        let glowClass = "border-white/10 hover:border-white/20";
        let textAccent = "text-white";
        let icon = <Zap className="h-4 w-4 text-cyan-400" />;

        if (idx === 0) {
          glowClass = "border-cyan-500/30 glow-cyan bg-cyan-950/20";
          textAccent = "text-cyan-300";
        } else if (idx === 1) {
          if (pulse.mom_change !== null) {
            if (card.color === "green") {
              glowClass = "border-emerald-500/30 glow-emerald bg-emerald-950/20";
              textAccent = "text-emerald-400";
              icon = <TrendingDown className="h-4 w-4 text-emerald-400" />;
            } else if (card.color === "red") {
              glowClass = "border-rose-500/30 glow-rose bg-rose-950/20";
              textAccent = "text-rose-400";
              icon = <TrendingUp className="h-4 w-4 text-rose-400" />;
            }
          }
        } else if (idx === 2) {
          icon = <ActivityIcon direction={pulse.trend_direction} />;
        } else if (idx === 3) {
          textAccent = pulse.gap_vs_benchmark && pulse.gap_vs_benchmark > 0 ? "text-rose-400" : "text-emerald-400";
        } else if (idx === 4) {
          if (pulse.volume_status === "HIGH") {
            icon = <ShieldCheck className="h-4 w-4 text-emerald-400" />;
            textAccent = "text-emerald-300";
          } else if (pulse.volume_status === "MODERATE") {
            icon = <Info className="h-4 w-4 text-cyan-400" />;
            textAccent = "text-cyan-300";
          } else {
            icon = <AlertTriangle className="h-4 w-4 text-amber-400" />;
            textAccent = "text-amber-400";
          }
        }

        return (
          <div
            key={idx}
            className={`glass-panel p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group ${glowClass}`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className="p-1 rounded bg-slate-900/80 border border-white/5">{icon}</div>
            </div>

            {/* Middle: Prominent Value */}
            <div className="my-1">
              <span className={`text-2xl font-black font-mono tracking-tight ${textAccent}`}>
                {card.value}
              </span>
            </div>

            {/* Bottom: Context Subtitle & Annotation */}
            <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-slate-300 truncate">{card.sub}</span>
              <span className="text-[10px] text-slate-500 truncate">{card.note}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityIcon({ direction }: { direction: string }) {
  if (direction === "STABLE") return <Minus className="h-4 w-4 text-slate-400" />;
  if (direction === "WORSENING" || direction === "REGRESSING") return <TrendingUp className="h-4 w-4 text-rose-400" />;
  if (direction === "IMPROVING") return <TrendingDown className="h-4 w-4 text-emerald-400" />;
  return <Info className="h-4 w-4 text-cyan-400" />;
}
