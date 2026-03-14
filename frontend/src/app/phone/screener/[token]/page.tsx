"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { worldMapAPI, feedAPI } from "@/lib/api";
import type { GraphResponse, GraphToken } from "@/types/world";
import type { AkyraEvent } from "@/types";
import { agentName, timeAgo } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Sparkles, TrendingUp, Clock, Users, ArrowLeftRight } from "lucide-react";
import { motion } from "framer-motion";

/* ── Deterministic PRNG ──────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s % 1000) / 1000;
  };
}

/* ── Chart data generator (200 points) ───────────────────────── */

function generateChartData(seed: number, points: number = 200): number[] {
  const next = seededRandom(seed);
  const data: number[] = [];
  let value = 0.3 + next() * 0.4; // start between 0.3-0.7
  for (let i = 0; i < points; i++) {
    value += (next() - 0.45) * 0.06;
    value = Math.max(0.05, Math.min(0.95, value));
    data.push(value);
  }
  return data;
}

/* ── Deterministic market cap from seed ──────────────────────── */

function estimatedMarketCap(seed: number): string {
  const next = seededRandom(seed * 37 + 11);
  const base = 1000 + next() * 99000; // 1K - 100K
  if (base >= 10000) return `${(base / 1000).toFixed(1)}K`;
  return `${Math.round(base).toLocaleString()}`;
}

/* ── Determine trend direction (same logic as screener) ──────── */

function isPositive(t: GraphToken): boolean {
  const seed = t.creator_agent_id * 31 + (t.symbol?.charCodeAt(0) || 0);
  return seed % 3 !== 0;
}

/* ── Area Chart SVG ──────────────────────────────────────────── */

function AreaChart({
  seed,
  positive,
  width = 600,
  height = 200,
}: {
  seed: number;
  positive: boolean;
  width?: number;
  height?: number;
}) {
  const data = generateChartData(seed);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;

  const padding = { top: 8, bottom: 8, left: 48, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Build polyline coords
  const coords = data.map((v, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Area fill path
  const areaPath = `M${padding.left},${padding.top + chartH} ${coords
    .map((c) => `L${c.x},${c.y}`)
    .join(" ")} L${coords[coords.length - 1].x},${padding.top + chartH} Z`;

  const strokeColor = positive ? "#22c55e" : "#ef4444";
  const fillColor = positive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
  const gradientId = `grad-${seed}`;

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const frac = i / 4;
    const val = min + frac * range;
    const y = padding.top + chartH - frac * chartH;
    return { val, y };
  });

  // Format price label
  const formatPrice = (v: number) => {
    const price = v * 100; // scale to a readable price
    if (price >= 10) return price.toFixed(1);
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(3);
  };

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={tick.y}
          x2={width - padding.right}
          y2={tick.y}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((tick, i) => (
        <text
          key={i}
          x={padding.left - 6}
          y={tick.y + 3}
          textAnchor="end"
          fill="rgba(255,255,255,0.25)"
          fontSize={9}
          fontFamily="monospace"
        >
          {formatPrice(tick.val)}
        </text>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  const chartSeed = token
    ? token.creator_agent_id * 100 + (token.symbol?.charCodeAt(0) || 0)
    : 42;
  const positive = token ? isPositive(token) : true;
  const trendPct = token
    ? ((token.creator_agent_id * 7 + token.trade_count * 3) % 40) -
      (positive ? 0 : 20)
    : 0;

  const mcap = token ? estimatedMarketCap(token.creator_agent_id) : "---";
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

          {/* Trend badge */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold ${
              positive
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            <TrendingUp size={10} />
            {positive ? "+" : ""}
            {trendPct}%
          </div>
        </div>

        {/* ── Chart ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-0 overflow-hidden mb-4">
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Price Chart
              </span>
              <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
                200 points
              </span>
            </div>
            <AreaChart seed={chartSeed} positive={positive} />
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
              <TrendingUp size={12} className="text-akyra-purple" />
              <span className="text-[9px] text-akyra-textDisabled/60 font-mono uppercase tracking-wider">
                Est. MCap
              </span>
            </div>
            <p className="text-lg text-akyra-text font-mono font-bold">
              {mcap} AKY
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
