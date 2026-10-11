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
} from "lucide-react";
import {
  ConnectorsStatusResponse,
  KekaConfigPayload,
  SlackConfigPayload,
  SchedulerStatusResponse,
  SchedulerConfigPayload,
} from "../lib/types";
import {
  fetchConnectorsStatus,
  testKekaConnection,
  saveKekaConfig,
  syncKekaPipeline,
  testSlackConnection,
  saveSlackConfig,
  dispatchSlackAlert,
  fetchSchedulerStatus,
  updateSchedulerConfig,
  triggerSchedulerSync,
  triggerSchedulerDigest,
} from "../lib/api";

interface ConnectorsHubProps {
  onSyncCompleted?: () => void;
}

export function ConnectorsHub({ onSyncCompleted }: ConnectorsHubProps) {
  const [status, setStatus] = useState<ConnectorsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Keka form state
  const [kekaSubdomain, setKekaSubdomain] = useState("moshpit");
  const [kekaClientId, setKekaClientId] = useState("");
  const [kekaClientSecret, setKekaClientSecret] = useState("");
  const [kekaApiKey, setKekaApiKey] = useState("");
  const [kekaTestResult, setKekaTestResult] = useState<string | null>(null);
  const [kekaTesting, setKekaTesting] = useState(false);
  const [kekaSyncing, setKekaSyncing] = useState(false);
  const [kekaSyncMessage, setKekaSyncMessage] = useState<string | null>(null);

  // Slack form state
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackBotId, setSlackBotId] = useState("");
  const [slackChannel, setSlackChannel] = useState("#workforce-alerts");
  const [slackTestResult, setSlackTestResult] = useState<string | null>(null);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackDispatching, setSlackDispatching] = useState(false);
  const [slackDispatchMessage, setSlackDispatchMessage] = useState<string | null>(null);

  // Audit Lineage Logs
  const [auditLogs, setAuditLogs] = useState<string[]>([
    "Lineage Engine: Ready to ingest streams from Keka HRMS & Slack Enterprise Grid.",
  ]);

  // Background Scheduler & Slack Digest state
  const [scheduler, setScheduler] = useState<SchedulerStatusResponse | null>(null);
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedInterval, setSchedInterval] = useState(60);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestTime, setDigestTime] = useState("09:00");
  const [digestChannel, setDigestChannel] = useState("#workforce-alerts");
  const [savingSched, setSavingSched] = useState(false);
  const [triggeringDigest, setTriggeringDigest] = useState(false);
  const [digestFeedback, setDigestFeedback] = useState<string | null>(null);

  const loadStatus = async () => {
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

  const handleSaveScheduler = async () => {
    setSavingSched(true);
    try {
      const res = await updateSchedulerConfig({
        enabled: schedEnabled,
        sync_interval_minutes: Number(schedInterval),
        digest_enabled: digestEnabled,
        digest_target_time: digestTime,
        slack_channel: digestChannel,
      });
      setScheduler(res);
      addLog(`Scheduler Rules Saved: sync every ${res.sync_interval_minutes}m, digest @ ${res.digest_target_time}`);
    } catch (err: any) {
      addLog(`Scheduler Save Error: ${err.message}`);
    } finally {
      setSavingSched(false);
    }
  };

  const handleTriggerDigestNow = async () => {
    setTriggeringDigest(true);
    setDigestFeedback(null);
    try {
      const res = await triggerSchedulerDigest(digestChannel);
      setDigestFeedback(`✓ Morning Digest dispatched to ${res.channel} (${res.digest?.execution_time_ms || 12} ms)`);
      addLog(`Morning Digest Sent: Dispatched executive summary to ${res.channel}`);
      loadScheduler();
    } catch (err: any) {
      setDigestFeedback(`✕ Digest Failed: ${err.message}`);
      addLog(`Digest Error: ${err.message}`);
    } finally {
      setTriggeringDigest(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadScheduler();
  }, []);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  };

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
      setKekaTestResult(`✓ ${res.message} (${res.latency_ms} ms)`);
      addLog(`Keka Handshake: ${res.message} (${res.latency_ms}ms)`);
      loadStatus();
    } catch (err: any) {
      setKekaTestResult(`✕ Connection Failed: ${err.message}`);
      addLog(`Keka Error: ${err.message}`);
    } finally {
      setKekaTesting(false);
    }
  };

  const handleSaveKeka = async () => {
    try {
      await saveKekaConfig({
        subdomain: kekaSubdomain,
        client_id: kekaClientId,
        client_secret: kekaClientSecret,
        api_key: kekaApiKey,
      });
      addLog(`Keka credentials saved for '${kekaSubdomain}.keka.com'.`);
      setKekaTestResult("Credentials persisted to secure vault.");
      loadStatus();
    } catch (err: any) {
      setKekaTestResult(`Failed to save: ${err.message}`);
    }
  };

  const handleSyncKeka = async () => {
    setKekaSyncing(true);
    setKekaSyncMessage(null);
    addLog(`Initiating Keka Data Sync pipeline for '${kekaSubdomain}'...`);
    try {
      const res = await syncKekaPipeline();
      setKekaSyncMessage(`✓ ${res.message} (${res.execution_time_ms} ms)`);
      addLog(`Sync Complete: Ingested ${res.records_synced} records across ${res.business_units.length} BUs. Materialized in ${res.execution_time_ms}ms.`);
      loadStatus();
      if (onSyncCompleted) onSyncCompleted();
    } catch (err: any) {
      setKekaSyncMessage(`✕ Sync failed: ${err.message}`);
      addLog(`Sync Error: ${err.message}`);
    } finally {
      setKekaSyncing(false);
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
      setSlackTestResult(`✓ ${res.message} (${res.latency_ms} ms)`);
      addLog(`Slack Auth Test: ${res.message} (${res.latency_ms}ms)`);
      loadStatus();
    } catch (err: any) {
      setSlackTestResult(`✕ Slack test failed: ${err.message}`);
      addLog(`Slack Error: ${err.message}`);
    } finally {
      setSlackTesting(false);
    }
  };

  const handleSaveSlack = async () => {
    try {
      await saveSlackConfig({
        bot_token: slackBotToken,
        bot_id: slackBotId,
        alert_channel: slackChannel,
      });
      addLog(`Slack configuration saved. Target: ${slackChannel}`);
      setSlackTestResult("Slack configuration persisted.");
      loadStatus();
    } catch (err: any) {
      setSlackTestResult(`Failed to save: ${err.message}`);
    }
  };

  const handleDispatchSlackAlert = async () => {
    setSlackDispatching(true);
    setSlackDispatchMessage(null);
    try {
      const res = await dispatchSlackAlert(
        slackChannel,
        "CRITICAL_ANOMALY",
        "Isolation Forest Shift Outlier Detected",
        "High variance recorded in Lending Operations: Employee KEKA-105 deviated by 60 mins from typical arrival."
      );
      setSlackDispatchMessage(`✓ Alert dispatched to ${res.channel} (${res.execution_time_ms} ms)`);
      addLog(`Alert Dispatched: Sent Critical Anomaly Alert to ${res.channel}.`);
      loadStatus();
    } catch (err: any) {
      setSlackDispatchMessage(`✕ Failed to dispatch: ${err.message}`);
      addLog(`Dispatch Error: ${err.message}`);
    } finally {
      setSlackDispatching(false);
    }
  };

  return (
    <div className="bg-[#0b1017] border border-cyan-500/20 rounded-xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <h2 className="text-lg font-bold tracking-wider text-slate-100 uppercase flex items-center gap-2 font-mono">
              <Plug className="w-5 h-5 text-cyan-400" />
              Data Connection Hub &amp; Foundry Pipeline Lineage
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Connect enterprise HRMS and messaging platforms to stream attendance facts, profile photos, and automated alert dispatchers.
          </p>
        </div>

        <button
          onClick={loadStatus}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300 transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Lineage Status
        </button>
      </div>

      {/* Top 3 Live Status Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Keka Status */}
          <div className="bg-[#070b10] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase">Keka HRMS Pipeline</span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  status.keka.connected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.2)]"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {status.keka.connected ? "CONNECTED" : "STANDBY"}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-mono mb-2">{status.keka.status_message}</div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500 border-t border-slate-900 pt-2">
              <span>Last Sync: {status.keka.last_sync}</span>
              <span className="text-cyan-400">{status.keka.total_records_synced} rows</span>
            </div>
          </div>

          {/* Slack Status */}
          <div className="bg-[#070b10] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase">Slack Enterprise Grid</span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  status.slack.connected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.2)]"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {status.slack.connected ? "ACTIVE" : "STANDBY"}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-mono mb-2">{status.slack.status_message}</div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500 border-t border-slate-900 pt-2">
              <span>Channel: {status.slack.alert_channel}</span>
              <span className="text-purple-400">{status.slack.bot_id || "No Bot ID"}</span>
            </div>
          </div>

          {/* Analytical Lakehouse */}
          <div className="bg-[#070b10] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase">OLAP Hypercube Lakehouse</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                IN-MEMORY
              </span>
            </div>
            <div className="text-xs text-slate-300 font-mono mb-2 truncate">
              Dataset: {status.lakehouse.active_dataset}
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500 border-t border-slate-900 pt-2">
              <span>Live Fact Records</span>
              <span className="text-emerald-400 font-bold">{status.lakehouse.active_row_count} rows</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Grids: KEKA & SLACK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* CARD 1: KEKA HRMS PIPELINE */}
        <div className="bg-[#070c12] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                Keka HRMS Connector
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Connect to your organization&apos;s Keka tenant. Ingests Employee Master, OD/WFH requests, and attendance status codes into the Polars engine.
            </p>

            <div className="space-y-3 font-mono text-xs mb-4">
              <div>
                <label className="text-slate-400 block mb-1">Subdomain Slug</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={kekaSubdomain}
                    onChange={(e) => setKekaSubdomain(e.target.value)}
                    placeholder="e.g. moshpit or finbox"
                    className="w-full bg-[#04070a] border border-slate-800 rounded-l px-3 py-1.5 text-slate-200 focus:border-cyan-500 outline-none"
                  />
                  <span className="bg-slate-900 border border-l-0 border-slate-800 px-3 py-1.5 text-slate-500 rounded-r text-[11px]">
                    .keka.com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Client ID</label>
                  <input
                    type="text"
                    value={kekaClientId}
                    onChange={(e) => setKekaClientId(e.target.value)}
                    placeholder="OAuth2 Client ID"
                    className="w-full bg-[#04070a] border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Client Secret</label>
                  <input
                    type="password"
                    value={kekaClientSecret}
                    onChange={(e) => setKekaClientSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-[#04070a] border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">REST API Key (Optional)</label>
                <input
                  type="password"
                  value={kekaApiKey}
                  onChange={(e) => setKekaApiKey(e.target.value)}
                  placeholder="Keka API Key"
                  className="w-full bg-[#04070a] border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {kekaTestResult && (
              <div className="mb-3 p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300">
                {kekaTestResult}
              </div>
            )}

            {kekaSyncMessage && (
              <div className="mb-3 p-2.5 rounded bg-emerald-950/40 border border-emerald-800 text-[11px] font-mono text-emerald-300">
                {kekaSyncMessage}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-900">
            <button
              onClick={handleTestKeka}
              disabled={kekaTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 transition-colors disabled:opacity-50"
            >
              {kekaTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-cyan-400" />}
              Test Handshake
            </button>
            <button
              onClick={handleSaveKeka}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Credentials
            </button>
            <button
              onClick={handleSyncKeka}
              disabled={kekaSyncing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs font-mono transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(6,182,212,0.3)] ml-auto"
            >
              {kekaSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync Live Pipeline Now
            </button>
          </div>
        </div>

        {/* CARD 2: SLACK ENTERPRISE GRID */}
        <div className="bg-[#070c12] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                Slack Enterprise Grid
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Integrate Slack to sync profile avatars and dispatch automated alerts when Isolation Forest detects severe anomalies or burnout risks.
            </p>

            <div className="space-y-3 font-mono text-xs mb-4">
              <div>
                <label className="text-slate-400 block mb-1">Bot User OAuth Token</label>
                <input
                  type="password"
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                  placeholder="xoxb-your-slack-bot-token"
                  className="w-full bg-[#04070a] border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Bot ID</label>
                  <input
                    type="text"
                    value={slackBotId}
                    onChange={(e) => setSlackBotId(e.target.value)}
                    placeholder="B0BE6TGNB09"
                    className="w-full bg-[#04070a] border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target Channel</label>
                  <input
                    type="text"
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#workforce-alerts"
                    className="w-full bg-[#04070a] border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {slackTestResult && (
              <div className="mb-3 p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-purple-300">
                {slackTestResult}
              </div>
            )}

            {slackDispatchMessage && (
              <div className="mb-3 p-2.5 rounded bg-purple-950/40 border border-purple-800 text-[11px] font-mono text-purple-300">
                {slackDispatchMessage}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-900">
            <button
              onClick={handleTestSlack}
              disabled={slackTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 transition-colors disabled:opacity-50"
            >
              {slackTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-purple-400" />}
              Test Handshake
            </button>
            <button
              onClick={handleSaveSlack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Config
            </button>
            <button
              onClick={handleDispatchSlackAlert}
              disabled={slackDispatching}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs font-mono transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(168,85,247,0.3)] ml-auto"
            >
              {slackDispatching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Dispatch Test Alert
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2.5: AUTOMATED BACKGROUND PIPELINE & MORNING SLACK DIGEST */}
      <div className="bg-[#070b10] border border-cyan-500/30 rounded-xl p-5 mb-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-40 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-mono tracking-wider text-slate-100 uppercase">
                  Automated Background Ingestion &amp; Morning Executive Slack Digest
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold">
                  {scheduler?.is_running ? "DAEMON ACTIVE" : "STANDBY"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Continuously synchronizes Keka attendance logs into OLAP hypercubes and delivers daily morning workforce readiness digests to Slack.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerDigestNow}
              disabled={triggeringDigest}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold rounded text-xs transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] disabled:opacity-50"
            >
              {triggeringDigest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Dispatch Morning Digest Now
            </button>
            <button
              onClick={handleSaveScheduler}
              disabled={savingSched}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold rounded text-xs transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Cadence
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {digestFeedback && (
          <div className="mb-4 p-2.5 rounded bg-purple-950/40 border border-purple-800 text-xs font-mono text-purple-300 flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-400" />
            <span>{digestFeedback}</span>
          </div>
        )}

        {/* Configuration Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Automated Ingestion Cadence */}
          <div className="bg-[#05080c] border border-slate-800/80 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Automated Ingestion (CDC)
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
            <div className="space-y-2 mt-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Sync Cadence</label>
                <select
                  value={schedInterval}
                  onChange={(e) => setSchedInterval(Number(e.target.value))}
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 mt-1 focus:border-cyan-500 focus:outline-none font-mono"
                >
                  <option value={15}>Every 15 Minutes (Real-Time)</option>
                  <option value={30}>Every 30 Minutes</option>
                  <option value={60}>Every 60 Minutes (Hourly)</option>
                  <option value={180}>Every 3 Hours</option>
                  <option value={360}>Every 6 Hours</option>
                  <option value={1440}>Daily (Every 24 Hours)</option>
                </select>
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1">
                <span className="text-slate-500">Next Ingestion:</span>{" "}
                <span className="text-cyan-300">
                  {scheduler?.next_sync_time ? new Date(scheduler.next_sync_time).toLocaleTimeString() : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Morning Slack Digest */}
          <div className="bg-[#05080c] border border-slate-800/80 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-purple-400" />
                Morning Slack Digest
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
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Target Time</label>
                <input
                  type="text"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  placeholder="09:00"
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 mt-1 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Channel</label>
                <input
                  type="text"
                  value={digestChannel}
                  onChange={(e) => setDigestChannel(e.target.value)}
                  placeholder="#workforce-alerts"
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 mt-1 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 pt-2">
              <span className="text-slate-500">Next Scheduled:</span>{" "}
              <span className="text-purple-300">
                {scheduler?.next_digest_time ? new Date(scheduler.next_digest_time).toLocaleString() : "Tomorrow 09:00"}
              </span>
            </div>
          </div>

          {/* Last Execution Telemetry */}
          <div className="bg-[#05080c] border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Live Engine Telemetry
              </div>
              <div className="text-[11px] font-mono text-slate-400 space-y-1">
                <div>
                  <span className="text-slate-500">Last Sync:</span>{" "}
                  <span className="text-slate-200">{scheduler?.last_sync_status || "None"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Last Digest:</span>{" "}
                  <span className="text-slate-200">{scheduler?.last_digest_status || "None"}</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-900 text-[10px] font-mono text-slate-500">
              Polars Vectorized Lakehouse Cache: Instantaneous Warm Up
            </div>
          </div>
        </div>

        {/* Execution History Table */}
        {scheduler?.execution_history && scheduler.execution_history.length > 0 && (
          <div className="mt-3 bg-[#030507] border border-slate-800/80 rounded-lg p-3 font-mono">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold mb-2 uppercase">
              <span>Recent Automated Daemon Executions</span>
              <span className="text-[10px] text-slate-500">Auto-Refreshed by Engine</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {scheduler.execution_history.slice(-5).reverse().map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 text-xs p-1.5 rounded bg-slate-900/40 border border-slate-800/50 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        item.status === "SUCCESS"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {item.action}
                    </span>
                    <span className="text-slate-300 truncate text-[11px]">{item.details}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    <span className="text-cyan-400/80">{item.execution_time_ms} ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: LINEAGE & AUDIT LOG TERMINAL */}
      <div className="bg-[#05080c] border border-slate-900 rounded-lg p-4 font-mono">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Data Lineage &amp; Pipeline Execution Audit Stream
        </div>
        <div className="bg-[#030507] p-3 rounded border border-slate-900/90 text-xs text-slate-400 space-y-1 max-h-40 overflow-y-auto">
          {auditLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-emerald-500/80">›</span>
              <span className={idx === 0 ? "text-cyan-300 font-bold" : "text-slate-400"}>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
