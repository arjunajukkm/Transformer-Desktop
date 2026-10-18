"use client";

import React, { useState, useEffect } from "react";
import {
  Plug,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  Server,
  Activity,
  Zap,
  Shield,
  Layers,
  Database,
  Terminal,
  Clock,
  Sparkles,
  Bell,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sliders,
} from "lucide-react";
import {
  ConnectorsStatusResponse,
  SchedulerStatusResponse,
} from "../lib/types";
import {
  fetchConnectorsStatus,
  testKekaConnection,
  saveKekaConfig,
  testSlackConnection,
  saveSlackConfig,
  dispatchSlackAlert,
  fetchSchedulerStatus,
  updateSchedulerConfig,
  triggerSchedulerDigest,
} from "../lib/api";
import { CyberneticOrbitalCore } from "./WorkforceLoadingExperience";

interface ConnectorsHubProps {
  onSyncCompleted?: () => void;
  theme?: "dark" | "light";
}

export function ConnectorsHub({ onSyncCompleted, theme = "dark" }: ConnectorsHubProps) {
  const isDark = theme === "dark";

  const [status, setStatus] = useState<ConnectorsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Keka form state
  const [kekaSubdomain, setKekaSubdomain] = useState("moshpit");
  const [kekaClientId, setKekaClientId] = useState("");
  const [kekaClientSecret, setKekaClientSecret] = useState("");
  const [kekaApiKey, setKekaApiKey] = useState("");
  const [showKekaSecret, setShowKekaSecret] = useState(false);
  const [kekaTestResult, setKekaTestResult] = useState<{ msg: string; success: boolean } | null>(null);
  const [kekaTesting, setKekaTesting] = useState(false);
  const [kekaSaving, setKekaSaving] = useState(false);

  // Slack form state
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackBotId, setSlackBotId] = useState("");
  const [slackChannel, setSlackChannel] = useState("#workforce-alerts");
  const [showSlackToken, setShowSlackToken] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{ msg: string; success: boolean } | null>(null);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackDispatching, setSlackDispatching] = useState(false);
  const [slackDispatchResult, setSlackDispatchResult] = useState<{ msg: string; success: boolean } | null>(null);

  // Scheduler state
  const [scheduler, setScheduler] = useState<SchedulerStatusResponse | null>(null);
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedInterval, setSchedInterval] = useState(60);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestTime, setDigestTime] = useState("09:00");
  const [digestChannel, setDigestChannel] = useState("#workforce-alerts");
  const [savingSched, setSavingSched] = useState(false);
  const [triggeringDigest, setTriggeringDigest] = useState(false);
  const [schedFeedback, setSchedFeedback] = useState<{ msg: string; success: boolean } | null>(null);

  // Collapsible Logs & Advanced
  const [showLogs, setShowLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([
    "Lineage Engine: Ready to ingest streams from Keka HRMS & Slack Enterprise Grid.",
  ]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetchConnectorsStatus();
      setStatus(res);
      if (res.keka.subdomain) setKekaSubdomain(res.keka.subdomain);
      if (res.slack.alert_channel) setSlackChannel(res.slack.alert_channel);
    } catch (err) {
      console.error("Failed to load connector status:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadScheduler = async () => {
    try {
      const res = await fetchSchedulerStatus();
      setScheduler(res);
      setSchedEnabled(res.enabled);
      setSchedInterval(res.sync_interval_minutes);
      setDigestEnabled(res.digest_enabled);
      setDigestTime(res.digest_target_time);
      if (res.slack_channel) setDigestChannel(res.slack_channel);
    } catch (err) {
      console.error("Failed to load scheduler:", err);
    }
  };

  useEffect(() => {
    loadStatus();
    loadScheduler();
  }, []);

  // Handlers
  const handleTestKeka = async () => {
    setKekaTesting(true);
    setKekaTestResult(null);
    try {
      const res = await testKekaConnection({
        subdomain: kekaSubdomain,
        client_id: kekaClientId,
        client_secret: kekaClientSecret,
        api_key: kekaApiKey,
      });
      setKekaTestResult({ msg: `${res.message} (${res.latency_ms} ms)`, success: true });
      addLog(`Keka Handshake: ${res.message} (${res.latency_ms}ms)`);
      loadStatus();
    } catch (err: any) {
      setKekaTestResult({ msg: `Connection failed: ${err.message}`, success: false });
      addLog(`Keka Error: ${err.message}`);
    } finally {
      setKekaTesting(false);
    }
  };

  const handleSaveKeka = async () => {
    setKekaSaving(true);
    try {
      await saveKekaConfig({
        subdomain: kekaSubdomain,
        client_id: kekaClientId,
        client_secret: kekaClientSecret,
        api_key: kekaApiKey,
      });
      setKekaTestResult({ msg: "Credentials saved securely.", success: true });
      addLog(`Keka credentials saved for '${kekaSubdomain}.keka.com'.`);
      loadStatus();
    } catch (err: any) {
      setKekaTestResult({ msg: `Failed to save: ${err.message}`, success: false });
    } finally {
      setKekaSaving(false);
    }
  };

  const handleTestSlack = async () => {
    setSlackTesting(true);
    setSlackTestResult(null);
    try {
      const res = await testSlackConnection({
        bot_token: slackBotToken,
        bot_id: slackBotId,
        alert_channel: slackChannel,
      });
      setSlackTestResult({ msg: `${res.message} (${res.latency_ms} ms)`, success: true });
      addLog(`Slack Handshake: ${res.message} (${res.latency_ms}ms)`);
      loadStatus();
    } catch (err: any) {
      setSlackTestResult({ msg: `Slack test failed: ${err.message}`, success: false });
      addLog(`Slack Error: ${err.message}`);
    } finally {
      setSlackTesting(false);
    }
  };

  const handleSaveSlack = async () => {
    setSlackSaving(true);
    try {
      await saveSlackConfig({
        bot_token: slackBotToken,
        bot_id: slackBotId,
        alert_channel: slackChannel,
      });
      setSlackTestResult({ msg: "Slack configuration persisted.", success: true });
      addLog(`Slack configuration saved for ${slackChannel}.`);
      loadStatus();
    } catch (err: any) {
      setSlackTestResult({ msg: `Failed to save: ${err.message}`, success: false });
    } finally {
      setSlackSaving(false);
    }
  };

  const handleDispatchSlackAlert = async () => {
    setSlackDispatching(true);
    setSlackDispatchResult(null);
    try {
      const res = await dispatchSlackAlert(
        slackChannel,
        "CRITICAL_ANOMALY",
        "Isolation Forest Shift Outlier Detected",
        "High variance recorded in Lending Operations: Employee KEKA-105 deviated by 60 mins from typical arrival."
      );
      setSlackDispatchResult({ msg: `Dispatched to ${res.channel} (${res.execution_time_ms} ms)`, success: true });
      addLog(`Alert Dispatched: Sent Critical Anomaly Alert to ${res.channel}.`);
      loadStatus();
    } catch (err: any) {
      setSlackDispatchResult({ msg: `Failed to dispatch: ${err.message}`, success: false });
      addLog(`Dispatch Error: ${err.message}`);
    } finally {
      setSlackDispatching(false);
    }
  };

  const handleSaveScheduler = async () => {
    setSavingSched(true);
    setSchedFeedback(null);
    try {
      const res = await updateSchedulerConfig({
        enabled: schedEnabled,
        sync_interval_minutes: Number(schedInterval),
        digest_enabled: digestEnabled,
        digest_target_time: digestTime,
        slack_channel: digestChannel,
      });
      setScheduler(res);
      setSchedFeedback({
        msg: `Rules updated: CDC every ${res.sync_interval_minutes}m, digest @ ${res.digest_target_time}`,
        success: true,
      });
      addLog(`Scheduler Rules Saved: sync every ${res.sync_interval_minutes}m, digest @ ${res.digest_target_time}`);
    } catch (err: any) {
      setSchedFeedback({ msg: `Scheduler save error: ${err.message}`, success: false });
      addLog(`Scheduler Save Error: ${err.message}`);
    } finally {
      setSavingSched(false);
    }
  };

  const handleTriggerDigestNow = async () => {
    setTriggeringDigest(true);
    setSchedFeedback(null);
    try {
      const res = await triggerSchedulerDigest(digestChannel);
      setSchedFeedback({
        msg: `Morning Digest sent to ${res.channel} (${res.digest?.execution_time_ms || 12} ms)`,
        success: true,
      });
      addLog(`Morning Digest Sent to ${res.channel}`);
      loadScheduler();
    } catch (err: any) {
      setSchedFeedback({ msg: `Digest failed: ${err.message}`, success: false });
      addLog(`Digest Error: ${err.message}`);
    } finally {
      setTriggeringDigest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <h2 className={`text-base font-bold font-mono tracking-wide uppercase ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Connectors &amp; CDC Engine
            </h2>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Manage HRMS credentials, messaging endpoints, and background change-data-capture cadences.
          </p>
        </div>

        <button
          onClick={() => {
            loadStatus();
            loadScheduler();
          }}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all self-start sm:self-auto border ${
            isDark
              ? "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/80"
              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* ── Minimalist Status Bar ── */}
      {loading && !status ? (
        <div className="h-44 flex flex-col items-center justify-center gap-3 text-slate-400">
          <CyberneticOrbitalCore size="md" />
          <span className="text-xs font-mono tracking-wider">Establishing connection pipeline with active endpoints...</span>
        </div>
      ) : status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Keka */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              isDark ? "bg-[#0b1222]/80 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  status.keka.connected
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : isDark
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Keka HRMS
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold border ${
                      status.keka.connected
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {status.keka.connected ? "CONNECTED" : "STANDBY"}
                  </span>
                </div>
                <div className={`text-[11px] font-mono truncate max-w-[170px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {status.keka.subdomain ? `${status.keka.subdomain}.keka.com` : "Not configured"}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold font-mono text-cyan-400">
                {status.keka.total_records_synced.toLocaleString()}
              </div>
              <div className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Records
              </div>
            </div>
          </div>

          {/* Slack */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              isDark ? "bg-[#0b1222]/80 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  status.slack.connected
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    : isDark
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Slack Grid
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold border ${
                      status.slack.connected
                        ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {status.slack.connected ? "ACTIVE" : "STANDBY"}
                  </span>
                </div>
                <div className={`text-[11px] font-mono truncate max-w-[170px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {status.slack.alert_channel || "#workforce-alerts"}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold font-mono text-purple-400">
                {status.slack.bot_id || "Bot Ready"}
              </div>
              <div className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Dispatch Bot
              </div>
            </div>
          </div>

          {/* Lakehouse */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              isDark ? "bg-[#0b1222]/80 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    OLAP Engine
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    IN-MEMORY
                  </span>
                </div>
                <div className={`text-[11px] font-mono truncate max-w-[170px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Polars Hypercube
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold font-mono text-emerald-400">
                {status.lakehouse.active_row_count.toLocaleString()}
              </div>
              <div className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Live Rows
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2 Main Connector Configuration Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 1: KEKA HRMS PIPELINE */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
            isDark
              ? "bg-[#090f1e] border-slate-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                  Keka HRMS Pipeline
                </h3>
              </div>
              <span className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                OAuth2 / REST API
              </span>
            </div>

            <div className="space-y-3.5 text-xs font-mono mb-4">
              {/* Subdomain */}
              <div>
                <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Tenant Subdomain
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={kekaSubdomain}
                    onChange={(e) => setKekaSubdomain(e.target.value)}
                    placeholder="moshpit"
                    className={`w-full border rounded-l-lg px-3 py-2 text-xs font-mono focus:border-cyan-500 focus:outline-none transition-colors ${
                      isDark
                        ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                  <span
                    className={`border border-l-0 px-3 py-2 rounded-r-lg text-xs font-mono select-none ${
                      isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-300 text-slate-600 font-semibold"
                    }`}
                  >
                    .keka.com
                  </span>
                </div>
              </div>

              {/* Client ID & Secret in 2-cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={kekaClientId}
                    onChange={(e) => setKekaClientId(e.target.value)}
                    placeholder="OAuth2 Client ID"
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:border-cyan-500 focus:outline-none transition-colors ${
                      isDark
                        ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showKekaSecret ? "text" : "password"}
                      value={kekaClientSecret}
                      onChange={(e) => setKekaClientSecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className={`w-full border rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:border-cyan-500 focus:outline-none transition-colors ${
                        isDark
                          ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                          : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKekaSecret(!showKekaSecret)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showKekaSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional API Key */}
              <div>
                <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  REST API Key <span className="text-slate-500 font-normal">(Optional Token)</span>
                </label>
                <input
                  type="password"
                  value={kekaApiKey}
                  onChange={(e) => setKekaApiKey(e.target.value)}
                  placeholder="Keka API Key / Bearer"
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:border-cyan-500 focus:outline-none transition-colors ${
                    isDark
                      ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>
            </div>

            {/* Inline Feedback */}
            {kekaTestResult && (
              <div
                className={`mb-3 p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                  kekaTestResult.success
                    ? isDark
                      ? "bg-cyan-950/30 border-cyan-800/80 text-cyan-300"
                      : "bg-cyan-50 border-cyan-200 text-cyan-800"
                    : isDark
                    ? "bg-rose-950/30 border-rose-800/80 text-rose-300"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {kekaTestResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{kekaTestResult.msg}</span>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
            <button
              onClick={handleTestKeka}
              disabled={kekaTesting}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-mono transition-all disabled:opacity-50 ${
                isDark
                  ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200"
                  : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-sm"
              }`}
            >
              {kekaTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              )}
              Test Connection
            </button>

            <button
              onClick={handleSaveKeka}
              disabled={kekaSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
            >
              <Save className="w-3.5 h-3.5" />
              {kekaSaving ? "Saving..." : "Save Credentials"}
            </button>
          </div>
        </div>

        {/* CARD 2: SLACK ENTERPRISE BOT */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
            isDark
              ? "bg-[#090f1e] border-slate-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                  Slack Enterprise Bot &amp; Webhooks
                </h3>
              </div>
              <span className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Alert Dispatcher
              </span>
            </div>

            <div className="space-y-3.5 text-xs font-mono mb-4">
              {/* Bot User OAuth Token */}
              <div>
                <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Bot User OAuth Token
                </label>
                <div className="relative">
                  <input
                    type={showSlackToken ? "text" : "password"}
                    value={slackBotToken}
                    onChange={(e) => setSlackBotToken(e.target.value)}
                    placeholder="xoxb-your-bot-token"
                    className={`w-full border rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:border-purple-500 focus:outline-none transition-colors ${
                      isDark
                        ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSlackToken(!showSlackToken)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showSlackToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Bot ID & Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Bot ID
                  </label>
                  <input
                    type="text"
                    value={slackBotId}
                    onChange={(e) => setSlackBotId(e.target.value)}
                    placeholder="B0BE6TGNB09"
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:border-purple-500 focus:outline-none transition-colors ${
                      isDark
                        ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Alert Channel
                  </label>
                  <input
                    type="text"
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#workforce-alerts"
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:border-purple-500 focus:outline-none transition-colors ${
                      isDark
                        ? "bg-[#040810] border-slate-800 text-slate-100 placeholder-slate-600"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              {/* Status Note */}
              <div className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                isDark ? "bg-[#040810] border-slate-800/80 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                Slack bot dispatches critical anomaly alerts and automated daily morning digests directly to target channels.
              </div>
            </div>

            {/* Inline Feedback */}
            {(slackTestResult || slackDispatchResult) && (
              <div
                className={`mb-3 p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                  (slackTestResult?.success ?? slackDispatchResult?.success)
                    ? isDark
                      ? "bg-purple-950/30 border-purple-800/80 text-purple-300"
                      : "bg-purple-50 border-purple-200 text-purple-800"
                    : isDark
                    ? "bg-rose-950/30 border-rose-800/80 text-rose-300"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {(slackTestResult?.success ?? slackDispatchResult?.success) ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{slackTestResult?.msg || slackDispatchResult?.msg}</span>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestSlack}
                disabled={slackTesting}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-mono transition-all disabled:opacity-50 ${
                  isDark
                    ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200"
                    : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-sm"
                }`}
              >
                {slackTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                )}
                Test Bot
              </button>
              <button
                onClick={handleDispatchSlackAlert}
                disabled={slackDispatching}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-mono transition-all disabled:opacity-50 ${
                  isDark
                    ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200"
                    : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-sm"
                }`}
              >
                {slackDispatching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-purple-400" />
                )}
                Send Test Alert
              </button>
            </div>

            <button
              onClick={handleSaveSlack}
              disabled={slackSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs font-mono transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
            >
              <Save className="w-3.5 h-3.5" />
              {slackSaving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </div>
      </div>

      {/* ── CARD 3: AUTOMATED CDC & MORNING DIGEST CADENCE ── */}
      <div
        className={`rounded-2xl border p-5 transition-all ${
          isDark
            ? "bg-[#090f1e] border-slate-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                  Automated CDC Engine &amp; Executive Digest
                </h3>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    scheduler?.is_running
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {scheduler?.is_running ? "DAEMON ACTIVE" : "STANDBY"}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Continuous change data capture from Keka into OLAP hypercubes with daily morning executive briefings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerDigestNow}
              disabled={triggeringDigest}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-50 ${
                isDark
                  ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-purple-300"
                  : "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800"
              }`}
            >
              {triggeringDigest ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              )}
              Send Digest Now
            </button>
            <button
              onClick={handleSaveScheduler}
              disabled={savingSched}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            >
              <Save className="w-3.5 h-3.5" />
              Save CDC Policy
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {schedFeedback && (
          <div
            className={`mb-4 p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
              schedFeedback.success
                ? isDark
                  ? "bg-emerald-950/30 border-emerald-800/80 text-emerald-300"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : isDark
                ? "bg-rose-950/30 border-rose-800/80 text-rose-300"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{schedFeedback.msg}</span>
          </div>
        )}

        {/* 2 Control Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column A: Automated CDC Ingestion */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isDark ? "bg-[#040810]/70 border-slate-800/80" : "bg-slate-50 border-slate-200/90"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-mono font-bold flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Automated CDC Ingestion
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedEnabled}
                  onChange={(e) => setSchedEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className={`block text-[11px] mb-1 font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Sync Cadence
                </label>
                <select
                  value={schedInterval}
                  onChange={(e) => setSchedInterval(Number(e.target.value))}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-cyan-500 focus:outline-none ${
                    isDark
                      ? "bg-[#080d19] border-slate-700 text-slate-200"
                      : "bg-white border-slate-300 text-slate-800 shadow-sm"
                  }`}
                >
                  <option value={15}>Every 15 Minutes (Real-Time)</option>
                  <option value={30}>Every 30 Minutes</option>
                  <option value={60}>Every 60 Minutes (Hourly)</option>
                  <option value={180}>Every 3 Hours</option>
                  <option value={360}>Every 6 Hours</option>
                  <option value={1440}>Daily (Every 24 Hours)</option>
                </select>
              </div>

              <div className={`flex items-center justify-between pt-1 text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                <span>Next Ingestion:</span>
                <span className="text-cyan-400 font-bold font-mono">
                  {scheduler?.next_sync_time ? new Date(scheduler.next_sync_time).toLocaleTimeString() : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Column B: Morning Slack Digest */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isDark ? "bg-[#040810]/70 border-slate-800/80" : "bg-slate-50 border-slate-200/90"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-mono font-bold flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <Send className="w-3.5 h-3.5 text-purple-400" />
                Executive Morning Digest
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={digestEnabled}
                  onChange={(e) => setDigestEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div>
                <label className={`block text-[11px] mb-1 font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Time (IST)
                </label>
                <input
                  type="text"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  placeholder="09:00"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-purple-500 focus:outline-none ${
                    isDark
                      ? "bg-[#080d19] border-slate-700 text-slate-200"
                      : "bg-white border-slate-300 text-slate-800 shadow-sm"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[11px] mb-1 font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Channel
                </label>
                <input
                  type="text"
                  value={digestChannel}
                  onChange={(e) => setDigestChannel(e.target.value)}
                  placeholder="#workforce-alerts"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-purple-500 focus:outline-none ${
                    isDark
                      ? "bg-[#080d19] border-slate-700 text-slate-200"
                      : "bg-white border-slate-300 text-slate-800 shadow-sm"
                  }`}
                />
              </div>
            </div>

            <div className={`flex items-center justify-between pt-3 text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              <span>Next Scheduled Digest:</span>
              <span className="text-purple-400 font-bold font-mono">
                {scheduler?.next_digest_time ? new Date(scheduler.next_digest_time).toLocaleTimeString() : "Tomorrow 09:00"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Collapsible Audit & Pipeline Execution History ── */}
      <div
        className={`rounded-2xl border transition-all ${
          isDark ? "bg-[#090f1e] border-slate-800/90" : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={`w-full p-4 flex items-center justify-between text-left font-mono text-xs transition-colors rounded-2xl ${
            isDark ? "hover:bg-slate-800/40 text-slate-300" : "hover:bg-slate-50 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">Pipeline Execution Audit Stream &amp; History</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}>
              {auditLogs.length} events
            </span>
          </div>
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLogs && (
          <div className="p-4 pt-0 border-t border-slate-800/50 space-y-3 font-mono">
            {scheduler?.execution_history && scheduler.execution_history.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {scheduler.execution_history.slice(-6).reverse().map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 text-xs p-2 rounded-lg border ${
                      isDark
                        ? "bg-[#040810] border-slate-800/60"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          item.status === "SUCCESS"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {item.action}
                      </span>
                      <span className={`truncate text-[11px] ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {item.details}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      <span className="text-cyan-400 font-bold">{item.execution_time_ms} ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={`p-3 rounded-lg text-xs space-y-1 max-h-36 overflow-y-auto ${
              isDark ? "bg-[#02050b] border border-slate-900 text-slate-400" : "bg-slate-900 text-slate-300"
            }`}>
              {auditLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">›</span>
                  <span className={idx === 0 ? "text-cyan-300 font-semibold" : ""}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
