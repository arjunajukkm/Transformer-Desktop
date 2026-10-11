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
} from "lucide-react";
import { ConnectorsStatusResponse, KekaConfigPayload, SlackConfigPayload } from "../lib/types";
import {
  fetchConnectorsStatus,
  testKekaConnection,
  saveKekaConfig,
  syncKekaPipeline,
  testSlackConnection,
  saveSlackConfig,
  dispatchSlackAlert,
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

  useEffect(() => {
    loadStatus();
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
