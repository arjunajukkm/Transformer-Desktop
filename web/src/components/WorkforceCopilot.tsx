"use client";

import React, { useState } from "react";
import { Bot, Send, Sparkles, MessageSquare, CornerDownLeft, X, Lightbulb } from "lucide-react";
import { TrendBundle } from "@/lib/types";

interface WorkforceCopilotProps {
  currentBundle: TrendBundle | null;
  selectedMetricLabel: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  insights?: string[];
}

export function WorkforceCopilot({ currentBundle, selectedMetricLabel }: WorkforceCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Welcome to the Workforce Decision Intelligence Copilot. I have live access to the Polars OLAP cubes. Ask me anything about ${selectedMetricLabel}, driver attributions, or policy simulations.`,
      insights: [
        "Lending Core recorded +22.2 pp higher exception rate than organization baseline.",
        "Average approval turnaround across all units is 2.1 days (within target).",
        "3 recurring missing swipe anomalies detected under Manager Lending.",
      ],
    },
  ]);

  const quickPrompts = [
    "What caused the MoM movement in this metric?",
    "Which department has the highest exception risk?",
    "Simulate impact of changing approval SLA to 24 hours",
    "List employees with recurring pattern warnings",
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Deterministic intelligence synthesis based on active bundle
    setTimeout(() => {
      let responseText = "";
      let insights: string[] = [];

      const q = query.toLowerCase();
      if (q.includes("cause") || q.includes("mom") || q.includes("movement") || q.includes("why")) {
        responseText = currentBundle?.what_changed?.headline || "Analysis of driver attribution indicates departmental variance.";
        insights = currentBundle?.what_changed?.drivers.map((d) => `${d.entity}: ${d.summary} (${d.contribution_pct}% contribution)`) || [];
      } else if (q.includes("department") || q.includes("risk") || q.includes("worst") || q.includes("highest")) {
        responseText = "Departmental risk scan completed across all active entities:";
        insights = [
          "Lending Core: Highest variance (+22.2 pp above baseline).",
          "Operations Core: Stable at 8.4% exception rate.",
          "Engineering Core: Optimal performance at 4.2% exception rate.",
        ];
      } else if (q.includes("simulate") || q.includes("policy") || q.includes("sla")) {
        responseText = "Policy Simulation Engine (What-If Forecaster):";
        insights = [
          "Enforcing 24h approval SLA is projected to reduce pending queue from 33 to 8 requests.",
          "Expected to lower regularisation submission lag by 31.5% across BUs.",
          "Confidence level: High (based on 90-day trajectory).",
        ];
      } else {
        responseText = `Evaluated against ${selectedMetricLabel} in active OLAP memory:`;
        insights = currentBundle?.observations || [
          "Current trajectory aligns with 90-day organization target range.",
          "No structural regressions detected in the current reporting period.",
        ];
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: responseText,
          insights: insights.length > 0 ? insights : undefined,
        },
      ]);
    }, 400);
  };

  return (
    <>
      {/* Floating Copilot Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold text-xs shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all hover:scale-105 cursor-pointer"
      >
        <Sparkles className="h-4 w-4 animate-pulse" />
        <span>AI Workforce Copilot</span>
      </button>

      {/* Slide-out Intelligence Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full sm:w-[480px] h-[85vh] sm:h-[90vh] sm:mr-6 rounded-2xl glass-panel bg-slate-950/95 border border-cyan-500/30 flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    Workforce AI Copilot
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      LIVE OLAP
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Natural Language Decision Intelligence</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conversation Flow */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-xl leading-relaxed ${
                      msg.role === "user"
                        ? "bg-cyan-600 text-white font-medium rounded-br-none shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                        : "bg-slate-900 border border-white/10 text-slate-200 rounded-bl-none shadow-md"
                    }`}
                  >
                    <p>{msg.content}</p>
                    {msg.insights && (
                      <ul className="mt-2 pt-2 border-t border-white/10 space-y-1 text-slate-300 font-mono text-[11px]">
                        {msg.insights.map((ins, j) => (
                          <li key={j} className="flex items-start gap-1.5">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            <span>{ins}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Suggested Prompts */}
            <div className="px-4 py-2 bg-slate-900/40 border-t border-white/5 flex flex-wrap gap-1.5">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qp)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/5 transition-colors cursor-pointer"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-slate-900/80 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={`Ask Copilot about ${selectedMetricLabel}...`}
                className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
              <button
                onClick={() => handleSend()}
                className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
