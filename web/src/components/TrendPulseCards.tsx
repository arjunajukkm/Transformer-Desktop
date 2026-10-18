"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  AlertTriangle,
  Info,
  Zap,
  HelpCircle,
  X,
  CheckCircle2,
} from "lucide-react";
import { TrendPulse, TrendPulseCard } from "@/lib/types";
import { formatToMMMYY } from "./BusinessUnitHeatmap";

interface TrendPulseCardsProps {
  cards: TrendPulseCard[];
  pulse: TrendPulse;
  metricLabel: string;
  theme?: "dark" | "light";
  metricId?: string;
  metricDirection?: "higher_is_better" | "lower_is_better" | "neutral" | string;
  benchmarkLabel?: string;
  entityLabel?: string;
}

interface TooltipState {
  x: number;
  y: number;
  placement: "top" | "bottom";
  title: string;
  subtitle?: string;
  stats: { label: string; value: string; highlight?: boolean; color?: string }[];
  statusBadge?: { text: string; favorable: boolean; neutral?: boolean };
  explanation: string;
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
  // Convert "Latest period: 2026-08" or "2026-08-01" to "Latest period: Aug, 26"
  s = s.replace(/(Latest period:\s*)(\d{4}-\d{2}(?:-\d{2})?)/gi, (_, p1, p2) => `${p1}${formatToMMMYY(p2)}`);
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

export function TrendPulseCards({
  cards,
  pulse,
  metricLabel,
  theme = "dark",
  metricId,
  metricDirection,
  benchmarkLabel,
  entityLabel,
}: TrendPulseCardsProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  if (!cards || cards.length === 0) return null;

  // Metric Semantics Identification
  const isArrivalMetric =
    metricId?.includes("arrival") || metricLabel.toLowerCase().includes("arrival");
  const isExitMetric =
    metricId?.includes("exit") || metricLabel.toLowerCase().includes("exit");
  const isComplianceTiming =
    metricId?.includes("compliance") || metricLabel.toLowerCase().includes("compliance");
  const isTurnaroundMetric =
    metricId?.includes("turnaround") || metricLabel.toLowerCase().includes("turnaround") || metricId?.includes("age");
  const isNeutralMetric =
    metricDirection === "neutral" || isExitMetric;

  const effectiveLowerIsBetter = isNeutralMetric
    ? false
    : isArrivalMetric
    ? true
    : (metricDirection === "lower_is_better" || metricDirection === undefined);

  // Direction Pill styling and descriptions
  let pillText = effectiveLowerIsBetter ? "↓ Lower is better" : "↑ Higher is better";
  let pillTitle = effectiveLowerIsBetter ? "Lower is Better" : "Higher is Better";
  let pillExplanation = effectiveLowerIsBetter
    ? `For ${metricLabel}, a lower value is favorable (e.g. fewer missing swipes or absences). 0 is ideal.`
    : `For ${metricLabel}, a higher value is favorable (e.g. higher compliance, productive hours, or attendance).`;
  let pillClasses = effectiveLowerIsBetter
    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
    : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/25";

  if (isNeutralMetric) {
    pillText = "— Distribution Metric (Neutral)";
    pillTitle = "Distribution Metric (Neutral)";
    pillExplanation = `For ${metricLabel}, this is an observational distribution metric tracking temporal patterns without an intrinsic corporate target.`;
    pillClasses = "bg-slate-800/60 text-slate-400 border border-slate-700/50";
  } else if (isArrivalMetric) {
    pillText = "↓ Earlier is better";
    pillTitle = "Earlier is Better (Punctual)";
    pillExplanation = `For ${metricLabel}, an earlier morning arrival time (lower minutes from midnight) is favorable and indicates promptness/punctuality. Late arrivals are adverse.`;
    pillClasses = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
  } else if (isComplianceTiming) {
    pillText = "↓ Earlier is better (Advance)";
    pillTitle = "Advance Application is Better";
    pillExplanation = `For ${metricLabel}, applying days in advance (negative value / earlier) is compliant; applying after start date (positive / later) is late.`;
    pillClasses = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
  } else if (isTurnaroundMetric) {
    pillText = "↓ Faster is better";
    pillTitle = "Faster Turnaround is Better";
    pillExplanation = `For ${metricLabel}, fewer turnaround days represents prompt processing and higher operational agility.`;
    pillClasses = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
  }

  const handlePillMouseEnter = (
    e: React.MouseEvent,
    title: string,
    subtitle: string,
    explanation: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearTop = rect.top < 220;
    setActiveTooltip({
      x: rect.left + rect.width / 2,
      y: isNearTop ? rect.bottom + 8 : rect.top - 8,
      placement: isNearTop ? "bottom" : "top",
      title,
      subtitle,
      stats: [],
      explanation,
    });
  };

  const handleCardMouseEnter = (e: React.MouseEvent, card: TrendPulseCard, idx: number) => {
    // Only show hint / tooltip for the last card (Data Confidence)
    if (idx !== cards.length - 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isNearTop = rect.top < 220;

    let cardTitle = card.title;
    let cardSubtitle = card.sub;
    let explanation = "";
    let stats: { label: string; value: string; highlight?: boolean; color?: string }[] = [];
    let badgeText = "";
    let isFavorable = card.color === "green";
    let isNeutral = card.color === "neutral" || isNeutralMetric || !card.color;

    if (idx === 0) {
      cardTitle = "Current Value";
      cardSubtitle = `Latest Observed Rate · ${entityLabel || "Selected Scope"}`;
      stats = [
        { label: "Current Value", value: card.value, highlight: true },
        { label: "Scope", value: entityLabel || "Selected Entity" },
        { label: "Reference Note", value: abbreviatePulseNote(card.note) || "Latest Period" },
      ];
      badgeText = "Latest Metric";
      explanation = `${card.value} is the current recorded performance for ${metricLabel} (${abbreviatePulseNote(card.note) || "Latest period"}).`;
    } else if (idx === 1) {
      cardTitle = "Month-over-Month Change";
      cardSubtitle = "Trailing 1-Month Trajectory";
      stats = [
        {
          label: "MoM Net Delta",
          value: card.value,
          highlight: true,
          color: card.color === "green" ? "#34d399" : card.color === "red" ? "#fb7185" : "#94a3b8",
        },
        { label: "Prior Period", value: abbreviatePulseNote(card.note) || "—" },
      ];
      badgeText =
        card.color === "green"
          ? "Favorable · Progress"
          : card.color === "red"
          ? "Adverse · Regression"
          : "Stable";
      if (isArrivalMetric) {
        explanation =
          card.color === "green"
            ? `Arrival time shifted earlier (favorable) by ${card.value} compared to last month.`
            : `Arrival time shifted later (adverse) by ${card.value} compared to last month.`;
      } else {
        explanation =
          card.color === "green"
            ? `Performance showed a favorable shift of ${card.value} vs the previous month (${card.note}).`
            : card.color === "red"
            ? `Performance regressed by ${card.value} vs the previous month (${card.note}).`
            : `Performance held steady vs the previous month.`;
      }
    } else if (idx === 2) {
      const isDeptComparison = card.title.toLowerCase().includes("department");
      cardTitle = isDeptComparison ? "vs Department" : "3-Month Trend (vs Self)";
      cardSubtitle = isDeptComparison ? "Department Benchmark Gap" : "Internal Momentum Trajectory";
      stats = [
        {
          label: isDeptComparison ? "Dept Gap" : "3M Momentum",
          value: card.value,
          highlight: true,
          color: card.color === "green" ? "#34d399" : card.color === "red" ? "#fb7185" : "#94a3b8",
        },
        { label: "Context", value: abbreviatePulseSub(card.sub) || card.note },
      ];
      badgeText = isDeptComparison
        ? card.color === "green"
          ? "Outperforming Dept"
          : "Lagging Dept"
        : `${card.value} (vs Self)`;
      explanation = isDeptComparison
        ? `Variance of ${card.value} against the Department baseline (${card.sub}).`
        : `Evaluates direction over 3 trailing months strictly compared to this unit's own past performance (${card.sub}). Identifies authentic internal momentum regardless of benchmark gaps.`;
    } else if (idx === 3) {
      const isBuComparison = card.title.toLowerCase().includes("business unit");
      cardTitle = isBuComparison ? "vs Business Unit" : "Benchmark Gap";
      cardSubtitle = isBuComparison ? "BU Baseline Gap" : `Cohort Standing vs ${benchmarkLabel || "Benchmark"}`;
      stats = [
        {
          label: "Benchmark Variance",
          value: card.value,
          highlight: true,
          color: card.color === "green" ? "#34d399" : card.color === "red" ? "#fb7185" : "#94a3b8",
        },
        { label: "Baseline Target", value: abbreviatePulseSub(card.sub) },
      ];
      badgeText =
        card.color === "green"
          ? "Beating Benchmark"
          : card.color === "red"
          ? "Lagging Benchmark"
          : "At Benchmark";
      explanation = `Variance of ${card.value} against ${card.sub || benchmarkLabel || "the benchmark"}. ${
        card.color === "green"
          ? "Outperforming the baseline (favorable standing)."
          : card.color === "red"
          ? "Lagging behind the baseline (opportunity for improvement)."
          : "Tracking on par with baseline."
      }`;
    } else if (idx === 4) {
      cardTitle = "Data Confidence & Sample Size";
      cardSubtitle = "Statistical Observation Volume";
      stats = [
        {
          label: "Confidence Tier",
          value: card.value,
          highlight: true,
          color:
            pulse?.volume_status === "HIGH"
              ? "#34d399"
              : pulse?.volume_status === "MODERATE"
              ? "#fbbf24"
              : "#f87171",
        },
        { label: "Evaluable Records", value: `${pulse?.valid_observations ?? card.sub}` },
        { label: "Evaluation Window", value: card.note || "Trailing Months" },
      ];
      badgeText =
        pulse?.volume_status === "HIGH"
          ? "Statistically Robust"
          : pulse?.volume_status === "MODERATE"
          ? "Moderate Sample"
          : "Low Volume Alert";
      explanation = `${card.value} based on ${pulse?.valid_observations ?? "evaluable"} records across observation window. ${
        pulse?.volume_status === "HIGH"
          ? "High statistical confidence for decision making."
          : pulse?.volume_status === "MODERATE"
          ? "Moderate sample size; good for direction monitoring."
          : "Caution: small sample size may exhibit higher month-to-month variance."
      }`;
    }

    setActiveTooltip({
      x: rect.left + rect.width / 2,
      y: isNearTop ? rect.bottom + 8 : rect.top - 8,
      placement: isNearTop ? "bottom" : "top",
      title: cardTitle,
      subtitle: cardSubtitle,
      stats,
      statusBadge: badgeText
        ? {
            text: badgeText,
            favorable: isFavorable,
            neutral: isNeutral,
          }
        : undefined,
      explanation,
    });
  };

  return (
    <div className="mb-5 space-y-2.5">
      {/* ── Top Header Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Left: Section Title + Metric Direction Micro-Pill */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Zap className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <h3 className="font-bold text-xs tracking-tight uppercase font-mono text-slate-200 whitespace-nowrap">
              Telemetry Pulse — {metricLabel}
            </h3>
          </div>
          {/* Self-explanatory direction micro-pill */}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-tight whitespace-nowrap cursor-help ${pillClasses}`}
            title={pillExplanation}
            onMouseEnter={(e) =>
              handlePillMouseEnter(e, metricLabel, pillTitle, pillExplanation)
            }
            onMouseLeave={() => setActiveTooltip(null)}
          >
            {pillText}
          </span>
        </div>

        {/* Right: Legend & Interactive Guide Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 font-semibold">Favorable</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span className="text-rose-400 font-semibold">Adverse</span>
            </span>
          </div>

          {/* Quick Guide Trigger Button */}
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              showGuide
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                : "bg-slate-800/50 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600"
            }`}
            title="Click to view/hide Telemetry Pulse interpretation guide"
          >
            <HelpCircle className="h-3 w-3 text-cyan-400" />
            <span>Guide</span>
          </button>
        </div>
      </div>

      {/* ── Expandable Quick Guide Card ── */}
      {showGuide && (
        <div className="p-3 rounded-lg bg-slate-900/95 border border-cyan-500/35 text-xs shadow-xl backdrop-blur-md transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 text-[11px] text-slate-300 w-full">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300 font-mono text-xs">
                <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>How to Read Telemetry Pulse Cards:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1 font-sans text-xs">
                {/* Card 1: Current Value */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-cyan-400 font-mono font-bold block text-[10px] uppercase">
                      1. Current Value
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-1 leading-snug">
                      Latest monthly performance recorded for {entityLabel || "the selected scope"}.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">LATEST STATUS</span>
                </div>

                {/* Card 2: MoM Change */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-emerald-400 font-mono font-bold block text-[10px] uppercase">
                      2. MoM Change
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-1 leading-snug">
                      Net movement vs previous month. <strong>Green</strong> = improvement, <strong>Red</strong> = regression.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">TRAILING 1-MONTH</span>
                </div>

                {/* Card 3: 3-Month Trend */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-blue-400 font-mono font-bold block text-[10px] uppercase">
                      3. Trend (vs Self)
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-1 leading-snug">
                      3-month trailing momentum (<em>Improving</em>, <em>Deteriorating</em>, or <em>Stable</em>) compared to own history.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">INTERNAL TRAJECTORY</span>
                </div>

                {/* Card 4: Benchmark Gap */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-purple-400 font-mono font-bold block text-[10px] uppercase">
                      4. Benchmark Gap
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-1 leading-snug">
                      Variance vs comparison cohort ({benchmarkLabel || "Organisation"}). Identifies if you lead or trail peers.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">COHORT STANDING</span>
                </div>

                {/* Card 5: Data Confidence */}
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-amber-400 font-mono font-bold block text-[10px] uppercase">
                      5. Data Confidence
                    </span>
                    <p className="text-slate-300 text-[10.5px] mt-1 leading-snug">
                      Sample volume: <strong>High</strong> (≥50), <strong>Moderate</strong> (10–49), <strong>Low</strong> (&lt;10). Prevents misinterpreting small-sample noise.
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">STATISTICAL VOLUME</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>
                  Key Rule: A team can be <em>Improving vs Self</em> (Card 3) while still <em>Lagging behind the company benchmark</em> (Card 4). Hover over any card for details.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer shrink-0"
              title="Close guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main 5 Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

          const isLastCard = idx === cards.length - 1;

          return (
            <div
              key={idx}
              onMouseEnter={isLastCard ? (e) => handleCardMouseEnter(e, card, idx) : undefined}
              onMouseLeave={isLastCard ? () => setActiveTooltip(null) : undefined}
              className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all duration-200 shadow-sm h-full min-h-[110px] relative group ${bgClass} ${accentBorder} ${
                isLastCard ? "cursor-help" : ""
              }`}
            >
              {/* Top row: Label & Icon */}
              <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider truncate ${
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    }`}
                    title={isLastCard ? card.title : undefined}
                  >
                    {card.title}
                  </span>
                  {isLastCard && (
                    <Info className="h-2.5 w-2.5 text-cyan-400/70 shrink-0" />
                  )}
                </div>
                <div
                  className={`p-1.5 rounded-lg shrink-0 transition-transform ${
                    isLastCard ? "group-hover:scale-105" : ""
                  } ${
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
                  title={isLastCard ? card.value : undefined}
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
                  title={isLastCard ? card.sub : undefined}
                >
                  {displaySub}
                </span>
                <span
                  className={`text-[9px] truncate ${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  }`}
                  title={isLastCard ? card.note : undefined}
                >
                  {displayNote}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Fixed Floating Tooltip ── */}
      {activeTooltip && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(
              Math.max(activeTooltip.x, 170),
              typeof window !== "undefined" ? window.innerWidth - 170 : 800
            )}px`,
            top: `${activeTooltip.y}px`,
            transform:
              activeTooltip.placement === "bottom"
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="w-80 p-3 rounded-lg bg-slate-950/95 border border-cyan-500/40 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-1.5 pb-2 mb-2 border-b border-slate-800">
            <div>
              <h4 className="font-bold text-xs text-white font-sans">
                {activeTooltip.title}
              </h4>
              {activeTooltip.subtitle && (
                <p className="text-[10px] text-cyan-400 font-mono">
                  {activeTooltip.subtitle}
                </p>
              )}
            </div>
            {activeTooltip.statusBadge && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border shrink-0 ${
                  activeTooltip.statusBadge.neutral
                    ? "text-slate-400 bg-slate-900 border-slate-700"
                    : activeTooltip.statusBadge.favorable
                    ? "text-emerald-300 bg-emerald-950/60 border-emerald-500/40"
                    : "text-rose-300 bg-rose-950/60 border-rose-500/40"
                }`}
              >
                {activeTooltip.statusBadge.text}
              </span>
            )}
          </div>

          {/* Stats Rows */}
          {activeTooltip.stats && activeTooltip.stats.length > 0 && (
            <div className="space-y-1 mb-2 font-mono text-xs">
              {activeTooltip.stats.map((st, sIdx) => (
                <div key={sIdx} className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">{st.label}:</span>
                  <span
                    className={`font-semibold ${
                      st.highlight ? "text-cyan-300 font-bold" : "text-slate-200"
                    }`}
                    style={st.color ? { color: st.color } : undefined}
                  >
                    {st.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Plain English Explanation */}
          <div className="pt-1.5 border-t border-slate-800/80 text-[11px] font-sans text-slate-300 leading-snug">
            {activeTooltip.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityIcon({ direction }: { direction: string }) {
  const d = (direction || "").toUpperCase();
  if (d === "STABLE") return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  if (d.includes("WORSEN") || d.includes("REGRESS") || d.includes("DETERIORAT")) {
    return <TrendingDown className="h-3.5 w-3.5 text-rose-400" />;
  }
  if (d.includes("IMPROV")) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  return <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />;
}
