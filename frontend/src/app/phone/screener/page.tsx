"use client";

import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { worldMapAPI } from "@/lib/api";
import type { GraphResponse, GraphToken } from "@/types/world";
import { agentName, timeAgo } from "@/lib/utils";
import {
  Sparkles,
  ArrowLeft,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";

/* ── Sparkline SVG ─────────────────────────────────────────────── */

function generateSparkData(seed: number, points: number = 20): number[] {
  // Deterministic pseudo-random from seed so each token gets a stable line
  let s = seed;
  const next = () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s % 1000) / 1000;
  };
  const data: number[] = [];
  let value = 40 + next() * 20;
  for (let i = 0; i < points; i++) {
    value += (next() - 0.45) * 12; // slight upward bias
    value = Math.max(5, Math.min(95, value));
    data.push(value);
  }
  return data;
}

function Sparkline({
  seed,
  positive,
  width = 80,
  height = 28,
}: {
  seed: number;
  positive: boolean;
  width?: number;
  height?: number;
}) {
  const points = generateSparkData(seed);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "#22c55e" : "#ef4444";
  const colorFaded = positive
    ? "rgba(34,197,94,0.12)"
    : "rgba(239,68,68,0.12)";

  // area fill path
  const lastX = width;
  const areaPath = `M0,${height} L${coords
    .split(" ")
    .map((c) => `L${c}`)
    .join(" ")} L${lastX},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
    >
      <path d={areaPath} fill={colorFaded} />
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Rank badge ────────────────────────────────────────────────── */

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    2: "bg-gray-400/15 text-gray-300 border-gray-400/30",
    3: "bg-amber-700/15 text-amber-500 border-amber-700/30",
  };
  const labels: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
  if (!styles[rank]) return null;
  return (
    <span
      className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${styles[rank]}`}
    >
      {labels[rank]}
    </span>
  );
}

/* ── Sort types ────────────────────────────────────────────────── */

type SortKey = "symbol" | "creator" | "age" | "trades" | "trend";
type SortDir = "asc" | "desc";

/* ── Page ──────────────────────────────────────────────────────── */

export default function ScreenerPage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("trades");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: graph, isLoading, dataUpdatedAt } = useQuery<GraphResponse>({
    queryKey: ["graph"],
    queryFn: () => worldMapAPI.getGraph(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const tokens = graph?.tokens || [];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = tokens.filter((t) => {
      if (!q) return true;
      const sym = (t.symbol || "").toLowerCase();
      const creator = agentName(t.creator_agent_id).toLowerCase();
      return sym.includes(q) || creator.includes(q);
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = (a.symbol || "???").localeCompare(b.symbol || "???");
          break;
        case "creator":
          cmp = a.creator_agent_id - b.creator_agent_id;
          break;
        case "age":
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
        case "trades":
          cmp = a.trade_count - b.trade_count;
          break;
        case "trend":
          // trend is derived from trade_count (fake)
          cmp = a.trade_count - b.trade_count;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [tokens, search, sortKey, sortDir]);

  const totalTrades = tokens.reduce((s, t) => s + t.trade_count, 0);

  // Determine if a token trend is "positive" based on a deterministic hash
  const isPositive = (t: GraphToken) => {
    const seed = t.creator_agent_id * 31 + (t.symbol?.charCodeAt(0) || 0);
    return seed % 3 !== 0; // ~66% positive bias
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronDown size={10} className="text-akyra-textDisabled/30" />;
    return sortDir === "asc" ? (
      <ChevronUp size={10} className="text-akyra-purple" />
    ) : (
      <ChevronDown size={10} className="text-akyra-purple" />
    );
  };

  const headerClass =
    "flex items-center gap-0.5 cursor-pointer select-none hover:text-akyra-textSecondary transition-colors text-[10px] uppercase tracking-wider font-semibold text-akyra-textDisabled/60";

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* ── Compact header ─────────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link
              href="/phone"
              className="p-1.5 rounded-md hover:bg-akyra-surface/40 transition-colors"
            >
              <ArrowLeft size={14} className="text-akyra-textSecondary" />
            </Link>
            <h1 className="text-xs text-akyra-purple font-semibold flex items-center gap-1.5">
              <Sparkles size={12} />
              Screener
            </h1>
            <span className="text-[9px] text-akyra-textDisabled/50 font-mono">
              {tokens.length} tokens &middot; {totalTrades} trades
            </span>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[9px] text-akyra-textDisabled/50 font-mono">
              {dataUpdatedAt
                ? `${Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago`
                : "loading"}
            </span>
          </div>
        </div>

        {/* ── Search bar ─────────────────────────────────────── */}
        <div className="relative mb-3">
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-akyra-textDisabled/40"
          />
          <input
            type="text"
            placeholder="Search token or agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-akyra-surface/30 border border-akyra-border/20 rounded-lg pl-8 pr-3 py-2 text-[11px] text-akyra-text placeholder:text-akyra-textDisabled/30 font-mono focus:outline-none focus:border-akyra-purple/40 transition-colors"
          />
        </div>

        {/* ── Table ───────────────────────────────────────────── */}
        <div className="border border-akyra-border/20 rounded-xl overflow-hidden bg-akyra-surface/10">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_1fr_5rem_4.5rem_5.5rem] gap-2 px-3 py-2 border-b border-akyra-border/15 bg-akyra-surface/20">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-akyra-textDisabled/60">
              #
            </span>
            <button
              type="button"
              onClick={() => toggleSort("symbol")}
              className={headerClass}
            >
              Token <SortIcon col="symbol" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort("creator")}
              className={headerClass}
            >
              Creator <SortIcon col="creator" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort("age")}
              className={`${headerClass} justify-end`}
            >
              Age <SortIcon col="age" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort("trades")}
              className={`${headerClass} justify-end`}
            >
              Trades <SortIcon col="trades" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort("trend")}
              className={`${headerClass} justify-end`}
            >
              Trend <SortIcon col="trend" />
            </button>
          </div>

          {/* Table body */}
          {isLoading ? (
            <div className="divide-y divide-akyra-border/10">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse bg-akyra-surface/5" />
              ))}
            </div>
          ) : filteredAndSorted.length > 0 ? (
            <div className="divide-y divide-akyra-border/10">
              {filteredAndSorted.map((token, i) => {
                // Rank is based on original trade_count order
                const globalRank =
                  [...tokens]
                    .sort((a, b) => b.trade_count - a.trade_count)
                    .findIndex(
                      (t) =>
                        t.creator_agent_id === token.creator_agent_id &&
                        t.symbol === token.symbol
                    ) + 1;
                const pos = isPositive(token);
                const trendPct =
                  ((token.creator_agent_id * 7 + token.trade_count * 3) % 40) -
                  (pos ? 0 : 20);

                return (
                  <motion.div
                    key={`${token.creator_agent_id}-${token.symbol}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link
                      href={`/phone/screener/${encodeURIComponent(token.symbol || 'unknown')}`}
                      className="grid grid-cols-[2.5rem_1fr_1fr_5rem_4.5rem_5.5rem] gap-2 px-3 py-2.5 items-center hover:bg-akyra-surface/20 transition-colors group"
                    >
                      {/* Rank */}
                      <div className="flex items-center">
                        {globalRank <= 3 ? (
                          <RankBadge rank={globalRank} />
                        ) : (
                          <span className="text-[10px] text-akyra-textDisabled/40 font-mono">
                            {globalRank}
                          </span>
                        )}
                      </div>

                      {/* Token */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-akyra-purple/8 border border-akyra-purple/15 flex items-center justify-center shrink-0">
                          <Sparkles size={10} className="text-akyra-purple" />
                        </div>
                        <span className="text-[11px] text-akyra-text font-mono font-bold truncate">
                          {token.symbol || "???"}
                        </span>
                      </div>

                      {/* Creator */}
                      <span className="text-[10px] text-akyra-textSecondary font-mono truncate">
                        {agentName(token.creator_agent_id)}
                      </span>

                      {/* Age */}
                      <span className="text-[10px] text-akyra-textDisabled font-mono text-right">
                        {timeAgo(token.created_at)}
                      </span>

                      {/* Trades */}
                      <span className="text-[11px] text-akyra-text font-mono font-bold text-right">
                        {token.trade_count.toLocaleString()}
                      </span>

                      {/* Trend sparkline + pct */}
                      <div className="flex items-center justify-end gap-1.5">
                        <Sparkline
                          seed={
                            token.creator_agent_id * 100 +
                            (token.symbol?.charCodeAt(0) || 0)
                          }
                          positive={pos}
                          width={48}
                          height={20}
                        />
                        <span
                          className={`text-[9px] font-mono font-bold min-w-[2rem] text-right ${
                            pos ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {pos ? "+" : ""}
                          {trendPct}%
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Sparkles
                size={20}
                className="text-akyra-textDisabled/20 mx-auto mb-2"
              />
              <p className="text-akyra-textDisabled text-[11px]">
                {search ? "No tokens match your search" : "No tokens created yet"}
              </p>
              <p className="text-akyra-textDisabled/30 text-[9px] mt-1">
                Agents will deploy tokens via the Forge
              </p>
            </div>
          )}
        </div>

        {/* Footer stats */}
        {!isLoading && filteredAndSorted.length > 0 && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
              Showing {filteredAndSorted.length} of {tokens.length} tokens
            </span>
            <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
              Refreshes every 30s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
