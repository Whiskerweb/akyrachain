"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { worldMapAPI, feedAPI } from "@/lib/api";
import type { GraphResponse } from "@/types/world";
import type { AkyraEvent } from "@/types";
import { agentName, timeAgo } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Sparkles, Clock, Users, ArrowLeftRight, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";


/* ── Activity item ───────────────────────────────────────────── */

function ActivityItem({ event }: { event: AkyraEvent }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 border-b border-akyra-border/10 last:border-0">
      <div className="w-6 h-6 rounded-md bg-akyra-purple/8 border border-akyra-purple/15 flex items-center justify-center shrink-0 mt-0.5">
        <ArrowLeftRight size={10} className="text-akyra-purple" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-akyra-text font-mono leading-relaxed truncate">
          {event.summary}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {event.agent_id !== null && (
            <Link
              href={`/agent/${event.agent_id}`}
              className="text-[9px] text-akyra-purple hover:underline font-mono"
            >
              {agentName(event.agent_id)}
            </Link>
          )}
          <span className="text-[9px] text-akyra-textDisabled/50 font-mono">
            {timeAgo(event.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function TokenDetailPage() {
  const params = useParams<{ token: string }>();
  const decodedSymbol = decodeURIComponent(params.token || "");

  const { data: graph, isLoading: graphLoading } = useQuery<GraphResponse>({
    queryKey: ["graph"],
    queryFn: () => worldMapAPI.getGraph(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<AkyraEvent[]>({
    queryKey: ["feed-global-50"],
    queryFn: () => feedAPI.global(50),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  // Find token in graph
  const token = graph?.tokens.find(
    (t) => (t.symbol || "").toLowerCase() === decodedSymbol.toLowerCase()
  );

  // Filter events related to this token (match symbol in data or summary)
  const tokenEvents = (events || []).filter((e) => {
    if (!token) return false;
    const sym = token.symbol || "";
    // Check summary
    if (e.summary.includes(sym)) return true;
    // Check data fields
    if (e.data) {
      const dataStr = JSON.stringify(e.data);
      if (dataStr.includes(sym)) return true;
    }
    // Match by creator agent trades
    if (
      e.event_type === "trade" ||
      e.event_type === "swap" ||
      e.event_type === "create_token"
    ) {
      if (
        e.agent_id === token.creator_agent_id ||
        e.target_agent_id === token.creator_agent_id
      ) {
        return true;
      }
    }
    return false;
  });

  const hasTrades = token ? token.trade_count > 0 : false;
  const age = token ? timeAgo(token.created_at) : "---";

  // Loading skeleton
  if (graphLoading) {
    return (
      <div className="min-h-screen bg-akyra-bg">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/phone/screener"
              className="p-1.5 rounded-md hover:bg-akyra-surface/40 transition-colors"
            >
              <ArrowLeft size={14} className="text-akyra-textSecondary" />
            </Link>
            <div className="h-4 w-32 bg-akyra-surface/30 rounded animate-pulse" />
          </div>
          <div className="h-[200px] bg-akyra-surface/10 rounded-xl animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-akyra-surface/10 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Token not found
  if (!token) {
    return (
      <div className="min-h-screen bg-akyra-bg">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <Link
            href="/phone/screener"
            className="inline-flex items-center gap-1.5 text-[11px] text-akyra-textSecondary hover:text-akyra-text font-mono mb-6"
          >
            <ArrowLeft size={12} />
            Back to Screener
          </Link>
          <Sparkles
            size={24}
            className="text-akyra-textDisabled/20 mx-auto mb-3"
          />
          <p className="text-akyra-textDisabled text-sm">
            Token &quot;{decodedSymbol}&quot; not found
          </p>
          <p className="text-akyra-textDisabled/40 text-[10px] mt-1 font-mono">
            It may have been removed or hasn&apos;t been created yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* ── Back + Token Header ────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link
              href="/phone/screener"
              className="p-1.5 rounded-md hover:bg-akyra-surface/40 transition-colors"
            >
              <ArrowLeft size={14} className="text-akyra-textSecondary" />
            </Link>
            <div className="w-7 h-7 rounded-lg bg-akyra-purple/10 border border-akyra-purple/20 flex items-center justify-center">
              <Sparkles size={12} className="text-akyra-purple" />
            </div>
            <div>
              <h1 className="text-sm text-akyra-text font-mono font-bold">
                {token.symbol || "???"}
              </h1>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/agent/${token.creator_agent_id}`}
                  className="text-[9px] text-akyra-purple hover:underline font-mono"
                >
                  {agentName(token.creator_agent_id)}
                </Link>
                <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
                  {age} ago
                </span>
              </div>
            </div>
          </div>

          {/* Trades badge */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold ${
              hasTrades
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-akyra-surface/30 text-akyra-textDisabled/60 border border-akyra-border/20"
            }`}
          >
            <ArrowLeftRight size={10} />
            {hasTrades ? `${token.trade_count} trades` : "No trades"}
          </div>
        </div>

        {/* ── Chart placeholder ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-0 overflow-hidden mb-4">
            <div className="py-10 text-center">
              <BarChart3 size={20} className="text-akyra-textDisabled/20 mx-auto mb-2" />
              <p className="text-akyra-textDisabled text-[11px] font-mono">
                {hasTrades ? "Données de prix bientôt disponibles" : "Aucun trade enregistré"}
              </p>
              <p className="text-akyra-textDisabled/30 text-[9px] mt-1 font-mono">
                {hasTrades ? "Le graphique sera disponible quand les pools auront de la liquidité" : "Ce token n'a pas encore été échangé"}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* ── Stats Grid ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowLeftRight size={12} className="text-akyra-purple" />
              <span className="text-[9px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Trades
              </span>
            </div>
            <p className="text-lg text-akyra-text font-mono font-bold">
              {token.trade_count.toLocaleString()}
            </p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 size={12} className="text-akyra-purple" />
              <span className="text-[9px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Liquidité
              </span>
            </div>
            <p className="text-lg text-akyra-textDisabled/60 font-mono font-bold">
              N/A
            </p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Users size={12} className="text-akyra-purple" />
              <span className="text-[9px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Creator
              </span>
            </div>
            <Link
              href={`/agent/${token.creator_agent_id}`}
              className="text-sm text-akyra-purple hover:underline font-mono font-bold"
            >
              {agentName(token.creator_agent_id)}
            </Link>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock size={12} className="text-akyra-purple" />
              <span className="text-[9px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Age
              </span>
            </div>
            <p className="text-lg text-akyra-text font-mono font-bold">
              {age}
            </p>
          </Card>
        </motion.div>

        {/* ── Trade Button ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mb-4"
        >
          <Link
            href={`/swap?token=${encodeURIComponent(token.symbol || "")}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-akyra-purple/15 border border-akyra-purple/30 text-akyra-purple font-mono font-bold text-sm hover:bg-akyra-purple/25 hover:border-akyra-purple/50 transition-all"
          >
            <ArrowLeftRight size={14} />
            Trade {token.symbol || "Token"}
          </Link>
          {!hasTrades && (
            <p className="text-[9px] text-akyra-textDisabled/40 font-mono text-center mt-1.5">
              Liquidité potentiellement absente — le pool peut ne pas exister
            </p>
          )}
        </motion.div>

        {/* ── Live Activity ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="p-0 overflow-hidden">
            <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-akyra-border/10">
              <span className="text-[10px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Live Activity
              </span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
                  {tokenEvents.length} events
                </span>
              </div>
            </div>

            {eventsLoading ? (
              <div className="divide-y divide-akyra-border/10">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse bg-akyra-surface/5"
                  />
                ))}
              </div>
            ) : tokenEvents.length > 0 ? (
              <div>
                {tokenEvents.slice(0, 10).map((event) => (
                  <ActivityItem key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <ArrowLeftRight
                  size={16}
                  className="text-akyra-textDisabled/20 mx-auto mb-2"
                />
                <p className="text-akyra-textDisabled text-[11px] font-mono">
                  No recent activity for this token
                </p>
                <p className="text-akyra-textDisabled/30 text-[9px] mt-1 font-mono">
                  Trades will appear here in real-time
                </p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
