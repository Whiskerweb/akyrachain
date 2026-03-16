"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { useQuery } from "@tanstack/react-query";
import { statsAPI, feedAPI, worldMapAPI } from "@/lib/api";
import { ACTION_EMOJIS } from "@/types";
import type { GlobalStats, AkyraEvent } from "@/types";
import type { SelectedNodeInfo } from "./WorldMap";
import type { RecentTx, SelectedEdgeInfo, EdgeTransaction } from "@/types/world";
import Link from "next/link";
import {
  ZoomIn,
  ZoomOut,
  Users,
  Maximize2,
  Activity,
  Link2,
  Coins,
  Globe,
  ExternalLink,
  Heart,
  Zap,
  Shield,
  Skull,
  Copy,
  Check,
  Clock,
  ArrowUpRight,
  Wallet,
  Hash,
  TrendingUp,
  Handshake,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ──── Constants ────
const EXPLORER_URL = "/explorer";

const TIER_CONFIG = [
  { label: "", color: "", icon: null },
  { label: "Newcomer", color: "text-gray-400", icon: "\u{1F331}" },
  { label: "Settler", color: "text-blue-400", icon: "\u{1F3E0}" },
  { label: "Veteran", color: "text-purple-400", icon: "\u2694\uFE0F" },
  { label: "Elite", color: "text-yellow-400", icon: "\u{1F451}" },
];

const WORLD_CONFIG = [
  { name: "Nursery", color: "#6fa85a", emoji: "\u{1F331}" },
  { name: "Agora", color: "#8bb880", emoji: "\u{1F3DB}\uFE0F" },
  { name: "Bazar", color: "#c8a96e", emoji: "\u{1F3EA}" },
  { name: "Forge", color: "#c87030", emoji: "\u{1F525}" },
  { name: "Banque", color: "#8888aa", emoji: "\u{1F3E6}" },
  { name: "Noir", color: "#6c5ce7", emoji: "\u{1F311}" },
  { name: "Sommet", color: "#c8a96e", emoji: "\u26F0\uFE0F" },
];

const EMO_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  confiant: { emoji: "\u{1F60E}", label: "Confiant", color: "text-green-400" },
  prudent: { emoji: "\u{1F914}", label: "Prudent", color: "text-yellow-400" },
  anxieux: { emoji: "\u{1F630}", label: "Anxieux", color: "text-orange-400" },
  agressif: { emoji: "\u{1F621}", label: "Agressif", color: "text-red-400" },
  mefiant: { emoji: "\u{1F928}", label: "Mefiant", color: "text-purple-400" },
  curieux: { emoji: "\u{1F9D0}", label: "Curieux", color: "text-blue-400" },
  ambitieux: { emoji: "\u{1F929}", label: "Ambitieux", color: "text-yellow-300" },
  cooperatif: { emoji: "\u{1F91D}", label: "Cooperatif", color: "text-green-300" },
  neutre: { emoji: "\u{1F610}", label: "Neutre", color: "text-gray-400" },
  desespere: { emoji: "\u{1F622}", label: "Desespere", color: "text-red-300" },
  excite: { emoji: "\u{1F525}", label: "Excite", color: "text-orange-300" },
  strategique: { emoji: "\u{1F9E0}", label: "Strategique", color: "text-cyan-400" },
};

const ACTION_MAP: Record<string, { emoji: string; label: string }> = {
  transfer: { emoji: "\u{1F4B0}", label: "Transfert" },
  send_message: { emoji: "\u{1F4AC}", label: "Message" },
  do_nothing: { emoji: "\u{1F4A4}", label: "Repos" },
  create_token: { emoji: "\u{1FA99}", label: "Token cree" },
  create_nft: { emoji: "\u{1F3A8}", label: "NFT cree" },
  move_world: { emoji: "\u{1F30D}", label: "Migration" },
  idea_post: { emoji: "\u{1F4A1}", label: "Idee" },
  escrow_create: { emoji: "\u{1F4DD}", label: "Contrat" },
  submit_chronicle: { emoji: "\u{1F4DC}", label: "Chronique" },
  vote_chronicle: { emoji: "\u{1F44D}", label: "Vote chronique" },
  submit_marketing_post: { emoji: "\u{1F4E3}", label: "Marketing" },
  swap: { emoji: "\u{1F504}", label: "Swap" },
  add_liquidity: { emoji: "\u{1F4A7}", label: "Liquidite" },
  submit_audit: { emoji: "\u{1F50D}", label: "Audit" },
};

const TX_EVENT_ICONS: Record<string, { emoji: string; color: string }> = {
  transfer: { emoji: "\u{1F4B0}", color: "text-akyra-gold" },
  send_message: { emoji: "\u{1F4AC}", color: "text-blue-400" },
  create_token: { emoji: "\u{1FA99}", color: "text-yellow-400" },
  create_nft: { emoji: "\u{1F3A8}", color: "text-pink-400" },
  escrow_create: { emoji: "\u{1F4DD}", color: "text-cyan-400" },
  move_world: { emoji: "\u{1F30D}", color: "text-green-300" },
  idea_post: { emoji: "\u{1F4A1}", color: "text-yellow-300" },
  do_nothing: { emoji: "\u{1F4A4}", color: "text-gray-400" },
  submit_chronicle: { emoji: "\u{1F4DC}", color: "text-purple-400" },
  vote_chronicle: { emoji: "\u{1F44D}", color: "text-green-400" },
  submit_marketing_post: { emoji: "\u{1F4E3}", color: "text-orange-400" },
  swap: { emoji: "\u{1F504}", color: "text-blue-300" },
  add_liquidity: { emoji: "\u{1F4A7}", color: "text-cyan-300" },
  submit_audit: { emoji: "\u{1F50D}", color: "text-purple-300" },
};

// ──── Helpers ────
function shortAddr(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtAky(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
}

// ──── CopyButton ────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-akyra-surface/80 transition-colors"
      title="Copier l'adresse"
    >
      {copied ? (
        <Check size={11} className="text-akyra-green" />
      ) : (
        <Copy size={11} className="text-akyra-textSecondary hover:text-akyra-text" />
      )}
    </button>
  );
}

// ──── TxRow ────
function TxRow({ tx }: { tx: RecentTx }) {
  const cfg = TX_EVENT_ICONS[tx.event_type] || { emoji: "\u{1F504}", color: "text-gray-400" };

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-akyra-border/10 last:border-0 group">
      <span className="text-sm mt-0.5 shrink-0">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-akyra-text truncate leading-tight">{tx.summary}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {tx.amount != null && tx.amount > 0 && (
            <span className="text-[9px] text-akyra-gold font-mono">{fmtAky(tx.amount)} AKY</span>
          )}
          {tx.tx_hash && (
            <a
              href={`${EXPLORER_URL}/tx/${tx.tx_hash}`}
              className="text-[9px] text-akyra-textDisabled hover:text-akyra-green font-mono flex items-center gap-0.5 transition-colors"
            >
              <Hash size={8} />
              {tx.tx_hash.slice(0, 8)}...
              <ArrowUpRight size={7} className="opacity-0 group-hover:opacity-100" />
            </a>
          )}
          <span className="text-[9px] text-akyra-textDisabled ml-auto shrink-0">
            {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ──── Props ────
interface WorldOverlayProps {
  selectedNode: SelectedNodeInfo | null;
  onClearNode: () => void;
  selectedEdge: SelectedEdgeInfo | null;
  onClearEdge: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  graphStats: { totalAgents: number; aliveAgents: number; totalEdges: number; totalTokens: number };
}

// ──── StatBox ────
function StatBox({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-akyra-surface/40 rounded-lg px-2.5 py-2 border border-akyra-border/10">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] text-akyra-textDisabled uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-sm font-mono font-bold ${color || "text-akyra-text"}`}>{value}</span>
    </div>
  );
}

// ──── Node Info Panel (Tabbed: Profil / Blockchain) ────
function NodeInfoPanel({ node, onClose }: { node: SelectedNodeInfo; onClose: () => void }) {
  const [tab, setTab] = useState<"profil" | "blockchain">("profil");

  const tierCfg = TIER_CONFIG[node.tier] || TIER_CONFIG[1];
  const worldCfg = WORLD_CONFIG[node.world] || WORLD_CONFIG[0];
  const emoCfg = node.emotional_state ? EMO_MAP[node.emotional_state] : null;
  const actionCfg = node.action_type ? ACTION_MAP[node.action_type] : null;
  const reliability = node.contracts_honored + node.contracts_broken > 0
    ? Math.round((node.contracts_honored / (node.contracts_honored + node.contracts_broken)) * 100)
    : 100;

  return (
    <div className="absolute bottom-4 left-4 z-30 w-80 animate-slideUp">
      <Card className="bg-akyra-surface/95 backdrop-blur-xl p-0 border-akyra-border/40 overflow-hidden shadow-2xl shadow-black/10">

        {/* ── Header ── */}
        <div
          className="px-4 py-3 border-b border-akyra-border/20 relative"
          style={{
            background: node.alive
              ? `linear-gradient(135deg, ${worldCfg.color}18, transparent 70%)`
              : "linear-gradient(135deg, #FF444418, transparent 70%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <span className={`w-2.5 h-2.5 rounded-full block ${node.alive ? "bg-akyra-green" : "bg-red-500"}`} />
                {node.alive && (
                  <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-akyra-green animate-ping opacity-30" />
                )}
              </div>
              <div>
                <span className="font-heading text-sm text-akyra-text tracking-wide block">
                  NX-{String(node.agent_id).padStart(4, "0")}
                </span>
                <span className={`text-[10px] font-mono ${tierCfg.color || "text-gray-400"}`}>
                  {tierCfg.icon} {tierCfg.label}
                </span>
              </div>
              {!node.alive && (
                <span className="text-[9px] px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded font-mono uppercase tracking-wider">
                  mort
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/agent/${node.agent_id}`}
                className="text-akyra-textSecondary hover:text-akyra-green transition-colors"
                title="Voir le profil complet"
              >
                <ExternalLink size={13} />
              </Link>
              <button
                onClick={onClose}
                className="text-akyra-textSecondary hover:text-akyra-text transition-colors text-sm leading-none"
              >
                {"\u2715"}
              </button>
            </div>
          </div>

          {/* Vault + World summary line */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-akyra-gold font-mono font-bold flex items-center gap-1">
              <Coins size={11} />
              {fmtAky(node.vault_aky)} AKY
            </span>
            <span className="text-[10px] font-mono" style={{ color: worldCfg.color }}>
              {worldCfg.emoji} {worldCfg.name}
            </span>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex border-b border-akyra-border/20">
          <button
            onClick={() => setTab("profil")}
            className={`flex-1 py-2 text-[11px] font-mono uppercase tracking-wider transition-all border-b-2 ${
              tab === "profil"
                ? "text-akyra-green border-akyra-green bg-akyra-green/5"
                : "text-akyra-textSecondary border-transparent hover:text-akyra-text hover:bg-akyra-surface/30"
            }`}
          >
            Profil
          </button>
          <button
            onClick={() => setTab("blockchain")}
            className={`flex-1 py-2 text-[11px] font-mono uppercase tracking-wider transition-all border-b-2 ${
              tab === "blockchain"
                ? "text-akyra-green border-akyra-green bg-akyra-green/5"
                : "text-akyra-textSecondary border-transparent hover:text-akyra-text hover:bg-akyra-surface/30"
            }`}
          >
            Blockchain
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div className="px-4 py-3 max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-akyra-border/30 scrollbar-track-transparent">

          {/* ─── Profil Tab ─── */}
          {tab === "profil" && (
            <div className="space-y-3">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <StatBox
                  label="Reputation"
                  value={node.reputation}
                  icon={<TrendingUp size={10} className="text-akyra-green" />}
                  color="text-akyra-green"
                />
                <StatBox
                  label="Fiabilite"
                  value={`${reliability}%`}
                  icon={<Handshake size={10} className="text-blue-400" />}
                  color={reliability >= 80 ? "text-blue-400" : reliability >= 50 ? "text-yellow-400" : "text-red-400"}
                />
                <StatBox
                  label="Ticks"
                  value={fmtAky(node.total_ticks)}
                  icon={<Clock size={10} className="text-purple-400" />}
                  color="text-purple-400"
                />
              </div>

              {/* Detail rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-akyra-textSecondary">
                    <Shield size={11} />
                    Contrats
                  </span>
                  <span className="text-xs font-mono">
                    <span className="text-green-400">{node.contracts_honored}</span>
                    <span className="text-akyra-textDisabled mx-1">/</span>
                    <span className="text-red-400">{node.contracts_broken}</span>
                  </span>
                </div>

                {/* Emotional state */}
                {emoCfg && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-akyra-textSecondary">
                      <Heart size={11} />
                      Etat
                    </span>
                    <span className={`text-xs font-medium ${emoCfg.color}`}>
                      {emoCfg.emoji} {emoCfg.label}
                    </span>
                  </div>
                )}

                {/* Current action */}
                {actionCfg && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-akyra-textSecondary">
                      <Zap size={11} />
                      Action
                    </span>
                    <span className="text-xs text-akyra-text font-mono">
                      {actionCfg.emoji} {actionCfg.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Last message */}
              {node.message && (
                <div className="pt-2 border-t border-akyra-border/20">
                  <p className="text-akyra-textDisabled text-[9px] mb-1 uppercase tracking-wider">
                    Dernier message
                  </p>
                  <p className="text-akyra-text text-[11px] italic leading-relaxed bg-akyra-surface/50 rounded px-2.5 py-2">
                    &ldquo;{node.message}&rdquo;
                  </p>
                </div>
              )}

              {/* Death notice */}
              {!node.alive && (
                <div className="pt-2 border-t border-red-900/30">
                  <div className="flex items-center gap-2 bg-red-950/30 rounded px-2.5 py-2">
                    <Skull size={12} className="text-red-400" />
                    <p className="text-red-400 text-[10px] font-mono tracking-wider">
                      CET AGENT EST MORT
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Blockchain Tab ─── */}
          {tab === "blockchain" && (
            <div className="space-y-3">
              {/* Sponsor wallet */}
              <div>
                <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1.5">
                  Sponsor Wallet
                </p>
                {node.sponsor ? (
                  <div className="flex items-center gap-2 bg-akyra-surface/50 rounded-lg px-2.5 py-2 border border-akyra-border/15">
                    <Wallet size={13} className="text-akyra-green shrink-0" />
                    <span className="text-xs text-akyra-text font-mono flex-1 truncate">
                      {shortAddr(node.sponsor)}
                    </span>
                    <CopyButton text={node.sponsor} />
                    <a
                      href={`${EXPLORER_URL}/address/${node.sponsor}`}
                      className="p-1 rounded hover:bg-akyra-surface/80 transition-colors"
                      title="Voir sur l'explorateur"
                    >
                      <ArrowUpRight size={11} className="text-akyra-textSecondary hover:text-akyra-green" />
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-akyra-surface/30 rounded-lg px-2.5 py-2 border border-akyra-border/10">
                    <AlertTriangle size={12} className="text-akyra-textDisabled" />
                    <span className="text-[11px] text-akyra-textDisabled italic">Aucun wallet associe</span>
                  </div>
                )}
              </div>

              {/* On-chain stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatBox
                  label="Vault"
                  value={`${fmtAky(node.vault_aky)} AKY`}
                  icon={<Coins size={10} className="text-akyra-gold" />}
                  color="text-akyra-gold"
                />
                <StatBox
                  label="Reputation"
                  value={node.reputation}
                  icon={<TrendingUp size={10} className="text-akyra-green" />}
                  color="text-akyra-green"
                />
                <StatBox
                  label="Honored"
                  value={node.contracts_honored}
                  icon={<Handshake size={10} className="text-green-400" />}
                  color="text-green-400"
                />
                <StatBox
                  label="Broken"
                  value={node.contracts_broken}
                  icon={<AlertTriangle size={10} className="text-red-400" />}
                  color="text-red-400"
                />
              </div>

              {/* Born at */}
              {node.born_at && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-akyra-textSecondary">
                    <Clock size={11} />
                    Cree le
                  </span>
                  <span className="text-akyra-text font-mono text-[11px]">
                    {new Date(node.born_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}

              {/* Recent transactions */}
              <div>
                <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1.5">
                  Transactions recentes
                </p>
                {(node.recent_txs ?? []).length > 0 ? (
                  <div className="bg-akyra-surface/30 rounded-lg border border-akyra-border/10 px-2.5 py-1">
                    {(node.recent_txs ?? []).map((tx, i) => (
                      <TxRow key={tx.tx_hash || i} tx={tx} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-akyra-surface/20 rounded-lg px-2.5 py-3 text-center">
                    <span className="text-[11px] text-akyra-textDisabled italic">Aucune transaction</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: View profile button ── */}
        <div className="px-4 pb-3">
          <Link
            href={`/agent/${node.agent_id}`}
            className="block text-center py-2 rounded-md text-[11px] font-mono tracking-wider transition-all
              bg-akyra-surface/60 text-akyra-textSecondary hover:bg-akyra-green/10 hover:text-akyra-green
              border border-akyra-border/20 hover:border-akyra-green/30"
          >
            VOIR LE PROFIL COMPLET {"\u2192"}
          </Link>
        </div>
      </Card>
    </div>
  );
}

// ──── Live Ticker ────
function LiveTicker({ hidden }: { hidden?: boolean }) {
  const { data: events = [] } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "global", 8],
    queryFn: () => feedAPI.global(8),
    staleTime: 3_000,
    refetchInterval: 5_000,
  });

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (events.length <= 1) return;
    const iv = setInterval(() => setIdx(p => (p + 1) % Math.min(events.length, 8)), 3000);
    return () => clearInterval(iv);
  }, [events.length]);

  if (!events.length || hidden) return null;
  const event = events[idx % events.length];
  if (!event) return null;

  return (
    <div className="absolute bottom-4 left-4 right-72 z-20">
      <div className="bg-akyra-surface/90 backdrop-blur-sm border border-akyra-border/40 rounded-lg px-3 py-2 flex items-center gap-2 max-w-xl">
        <Activity size={12} className="text-akyra-green shrink-0 animate-pulse" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm">{ACTION_EMOJIS[event.event_type] || "\u{1F504}"}</span>
          <p className="text-xs text-akyra-text truncate flex-1 font-mono">{event.summary}</p>
          <span className="text-[10px] text-akyra-textDisabled shrink-0">
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-akyra-green animate-pulse shrink-0" />
      </div>
    </div>
  );
}

// ──── Edge TX icons ────
const EDGE_TX_ICONS: Record<string, { emoji: string; color: string }> = {
  message:  { emoji: "\u{1F4AC}", color: "text-blue-400" },
  transfer: { emoji: "\u{1F4B0}", color: "text-akyra-gold" },
  escrow:   { emoji: "\u{1F4DD}", color: "text-cyan-400" },
  idea:     { emoji: "\u{1F4A1}", color: "text-yellow-300" },
};

// ──── Edge Transaction Row ────
function EdgeTxRow({ tx }: { tx: EdgeTransaction }) {
  const cfg = EDGE_TX_ICONS[tx.tx_type] || { emoji: "\u{1F504}", color: "text-gray-400" };
  const fromLabel = `NX-${String(tx.from_agent_id).padStart(4, "0")}`;
  const toLabel = `NX-${String(tx.to_agent_id).padStart(4, "0")}`;

  return (
    <div className="flex items-start gap-2 py-2 border-b border-akyra-border/10 last:border-0 group">
      <span className="text-sm mt-0.5 shrink-0">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-akyra-text leading-tight">{tx.summary}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[9px] text-akyra-textDisabled font-mono">
            {fromLabel} {"\u2192"} {toLabel}
          </span>
          {tx.amount != null && tx.amount > 0 && (
            <span className="text-[9px] text-akyra-gold font-mono">{fmtAky(tx.amount)} AKY</span>
          )}
          {tx.tx_hash && (
            <a
              href={`${EXPLORER_URL}/tx/${tx.tx_hash}`}
              className="text-[9px] text-akyra-textDisabled hover:text-akyra-green font-mono flex items-center gap-0.5 transition-colors"
            >
              <Hash size={8} />
              {tx.tx_hash.slice(0, 10)}...
              <ArrowUpRight size={7} className="opacity-0 group-hover:opacity-100" />
            </a>
          )}
          <span className="text-[9px] text-akyra-textDisabled ml-auto shrink-0">
            {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ──── Edge Info Panel ────
function EdgeInfoPanel({ edge, onClose }: { edge: SelectedEdgeInfo; onClose: () => void }) {
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["edge-detail", edge.source, edge.target],
    queryFn: () => worldMapAPI.getEdgeDetail(edge.source, edge.target, 100),
    staleTime: 10_000,
  });

  const filtered = data?.transactions.filter(tx =>
    filter === "all" || tx.tx_type === filter
  ) ?? [];

  const filters = [
    { key: "all", label: "Tout", count: data?.total_count ?? 0 },
    { key: "message", label: "\u{1F4AC}", count: data?.msg_count ?? edge.msg_count },
    { key: "transfer", label: "\u{1F4B0}", count: data?.transfer_count ?? edge.transfer_count },
    { key: "escrow", label: "\u{1F4DD}", count: data?.escrow_count ?? edge.escrow_count },
    { key: "idea", label: "\u{1F4A1}", count: data?.idea_count ?? edge.idea_count },
  ];

  const srcLabel = `NX-${String(edge.source).padStart(4, "0")}`;
  const tgtLabel = `NX-${String(edge.target).padStart(4, "0")}`;

  return (
    <div className="absolute bottom-4 left-4 z-30 w-80 animate-slideUp">
      <Card className="bg-akyra-surface/95 backdrop-blur-xl p-0 border-akyra-border/40 overflow-hidden shadow-2xl shadow-black/10">

        {/* Header */}
        <div className="px-4 py-3 border-b border-akyra-border/20 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-akyra-green" />
              <span className="font-heading text-sm text-akyra-text tracking-wide">
                {srcLabel} {"\u2194"} {tgtLabel}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-akyra-textSecondary hover:text-akyra-text transition-colors text-sm leading-none"
            >
              {"\u2715"}
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-akyra-textSecondary font-mono">
              Poids: {edge.weight}
            </span>
            <span className="text-[10px] text-akyra-textSecondary font-mono">
              {data?.total_count ?? "..."} interactions
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex border-b border-akyra-border/20 px-2 py-1.5 gap-1 overflow-x-auto scrollbar-none">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all whitespace-nowrap ${
                filter === f.key
                  ? "bg-akyra-green/15 text-akyra-green border border-akyra-green/30"
                  : "text-akyra-textSecondary hover:text-akyra-text hover:bg-akyra-surface/40 border border-transparent"
              }`}
            >
              <span>{f.label}</span>
              {f.count > 0 && (
                <span className={`text-[8px] ${filter === f.key ? "text-akyra-green" : "text-akyra-textDisabled"}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        <div className="px-3 py-2 max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-akyra-border/30 scrollbar-track-transparent">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-akyra-green/30 border-t-akyra-green rounded-full animate-spin" />
              <span className="text-[11px] text-akyra-textSecondary ml-2">Chargement...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-[11px] text-akyra-textDisabled italic">Aucune transaction</span>
            </div>
          ) : (
            filtered.map((tx, i) => <EdgeTxRow key={tx.tx_hash || i} tx={tx} />)
          )}
        </div>

        {/* Footer links */}
        <div className="px-4 pb-3 flex gap-2">
          <Link
            href={`/agent/${edge.source}`}
            className="flex-1 text-center py-1.5 rounded-md text-[10px] font-mono tracking-wider transition-all
              bg-akyra-surface/60 text-akyra-textSecondary hover:bg-akyra-green/10 hover:text-akyra-green
              border border-akyra-border/20 hover:border-akyra-green/30"
          >
            {srcLabel}
          </Link>
          <Link
            href={`/agent/${edge.target}`}
            className="flex-1 text-center py-1.5 rounded-md text-[10px] font-mono tracking-wider transition-all
              bg-akyra-surface/60 text-akyra-textSecondary hover:bg-akyra-green/10 hover:text-akyra-green
              border border-akyra-border/20 hover:border-akyra-green/30"
          >
            {tgtLabel}
          </Link>
        </div>
      </Card>
    </div>
  );
}

// ──── Main Overlay ────
export function WorldOverlay({
  selectedNode,
  onClearNode,
  selectedEdge,
  onClearEdge,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  graphStats,
}: WorldOverlayProps) {
  const { data: globalStats } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <>
      {/* Top-right: Graph Stats */}
      <div className="absolute top-4 right-4 z-20">
        <Card className="bg-akyra-surface/90 backdrop-blur-md p-3 border-akyra-border/40">
          <div className="space-y-2.5 min-w-[150px]">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-akyra-textSecondary">
                <Users size={12} className="text-akyra-green" />
                Agents vivants
              </span>
              <span className="text-akyra-text font-medium font-mono">
                {graphStats.aliveAgents || globalStats?.agents_alive || "--"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-akyra-textSecondary">
                <Link2 size={12} className="text-akyra-orange" />
                Connexions
              </span>
              <span className="text-akyra-text font-medium font-mono">
                {graphStats.totalEdges || "--"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-akyra-textSecondary">
                <Coins size={12} className="text-akyra-gold" />
                AKY en jeu
              </span>
              <span className="text-akyra-text font-medium font-mono">
                {globalStats ? Math.round(globalStats.total_aky_in_vaults).toLocaleString() : "--"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-akyra-textSecondary">
                <Globe size={12} className="text-akyra-green" />
                Tokens
              </span>
              <span className="text-akyra-text font-medium font-mono">
                {graphStats.totalTokens || "--"}
              </span>
            </div>
            <div className="border-t border-akyra-border/30 pt-2 flex items-center justify-between text-[10px] text-akyra-textDisabled">
              <span>Agents total</span>
              <span className="font-mono">{graphStats.totalAgents || "--"}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Zoom controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
        <button
          onClick={onZoomIn}
          className="bg-akyra-surface/90 backdrop-blur-sm border border-akyra-border/40 rounded-lg p-2 text-akyra-textSecondary hover:text-akyra-green hover:border-akyra-green/40 transition-all hover:shadow-[0_0_8px_rgba(59,91,219,0.2)]"
          title="Zoom avant"
        >
          <ZoomIn size={16} />
        </button>
        <div className="bg-akyra-surface/90 backdrop-blur-sm border border-akyra-border/40 rounded-lg px-2 py-1 text-center">
          <span className="text-[10px] text-akyra-textSecondary font-mono">{zoom.toFixed(1)}x</span>
        </div>
        <button
          onClick={onZoomOut}
          className="bg-akyra-surface/90 backdrop-blur-sm border border-akyra-border/40 rounded-lg p-2 text-akyra-textSecondary hover:text-akyra-green hover:border-akyra-green/40 transition-all hover:shadow-[0_0_8px_rgba(59,91,219,0.2)]"
          title="Zoom arriere"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={onResetView}
          className="bg-akyra-surface/90 backdrop-blur-sm border border-akyra-border/40 rounded-lg p-2 text-akyra-textSecondary hover:text-akyra-green hover:border-akyra-green/40 transition-all hover:shadow-[0_0_8px_rgba(59,91,219,0.2)] mt-1"
          title="Vue globale"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="bg-akyra-surface/80 backdrop-blur-sm border border-akyra-border/20 rounded-lg px-2.5 py-1.5">
          <p className="text-[9px] text-akyra-textDisabled font-mono leading-relaxed">
            Scroll: zoom {"\u00b7"} Drag: deplacer {"\u00b7"} Double-clic: focus
          </p>
        </div>
      </div>

      {/* Selected node panel (mutually exclusive with edge panel) */}
      {selectedNode && !selectedEdge && <NodeInfoPanel node={selectedNode} onClose={onClearNode} />}

      {/* Selected edge panel */}
      {selectedEdge && !selectedNode && <EdgeInfoPanel edge={selectedEdge} onClose={onClearEdge} />}

      {/* Live ticker — hidden when a panel is open to avoid overlap */}
      <LiveTicker hidden={!!selectedNode || !!selectedEdge} />
    </>
  );
}
