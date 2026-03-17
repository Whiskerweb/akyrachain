"use client";

import { useQuery } from "@tanstack/react-query";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { ExplorerSearch } from "@/components/explorer/ExplorerSearch";
import { BlockLink, TxLink, AddressLink } from "@/components/explorer/DataRow";
import { Card } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import {
  getNetworkStats,
  getLatestBlocks,
  getLatestTransactions,
  type BlockSummary,
  type TxSummary,
  type NetworkStats,
} from "@/lib/explorer";
import { shortenAddress } from "@/lib/utils";
import {
  Blocks,
  ArrowLeftRight,
  Fuel,
  Hash,
  Clock,
  ArrowRight,
  Box,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ──── Network Stat Card ────
function NetStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="bg-akyra-surface/60 border-akyra-border/30 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg bg-akyra-surface border border-akyra-border/20 ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] text-akyra-textDisabled uppercase tracking-wider">{label}</p>
          <p className="text-lg font-heading text-akyra-text mt-0.5">{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ──── Block Row ────
function BlockRow({ block }: { block: BlockSummary }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-akyra-border/15 last:border-0 hover:bg-akyra-surface/30 px-3 -mx-3 rounded transition-colors">
      <div className="p-2 rounded-lg bg-akyra-surface/80 border border-akyra-border/20 shrink-0">
        <Box size={16} className="text-akyra-textSecondary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <BlockLink number={block.number} />
          <span className="text-[10px] text-akyra-textDisabled">
            {formatDistanceToNow(block.timestamp * 1000, { addSuffix: true, locale: fr })}
          </span>
        </div>
        <p className="text-[11px] text-akyra-textSecondary mt-0.5 font-mono truncate">
          Validateur <AddressLink address={block.miner} label={shortenAddress(block.miner)} />
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-xs text-akyra-text font-mono">
          {block.transactionCount} tx{block.transactionCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ──── Transaction Row ────
function TxRow({ tx }: { tx: TxSummary }) {
  const hasValue = parseFloat(tx.value) > 0;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-akyra-border/15 last:border-0 hover:bg-akyra-surface/30 px-3 -mx-3 rounded transition-colors">
      <div className="p-2 rounded-lg bg-akyra-surface/80 border border-akyra-border/20 shrink-0">
        <ArrowLeftRight size={16} className="text-akyra-textSecondary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TxLink hash={tx.hash} short />
          {tx.timestamp && (
            <span className="text-[10px] text-akyra-textDisabled">
              {formatDistanceToNow(tx.timestamp * 1000, { addSuffix: true, locale: fr })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
          <AddressLink address={tx.from} label={shortenAddress(tx.from)} />
          <ArrowRight size={10} className="text-akyra-textDisabled shrink-0" />
          {tx.to ? (
            <AddressLink address={tx.to} label={shortenAddress(tx.to)} />
          ) : (
            <span className="text-akyra-purple font-mono text-[11px]">Contract Create</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {hasValue ? (
          <span className="text-xs text-akyra-gold font-mono font-medium">
            {parseFloat(tx.value).toFixed(4)} AKY
          </span>
        ) : (
          <span className="text-xs text-akyra-textDisabled font-mono">0 AKY</span>
        )}
      </div>
    </div>
  );
}

// ──── Main Page ────
export default function ExplorerPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<NetworkStats>({
    queryKey: ["explorer", "stats"],
    queryFn: getNetworkStats,
    refetchInterval: 5_000,
  });

  const { data: blocks, isLoading: blocksLoading } = useQuery<BlockSummary[]>({
    queryKey: ["explorer", "blocks"],
    queryFn: () => getLatestBlocks(12),
    refetchInterval: 6_000,
  });

  const { data: txs, isLoading: txsLoading } = useQuery<TxSummary[]>({
    queryKey: ["explorer", "txs"],
    queryFn: () => getLatestTransactions(12),
    refetchInterval: 6_000,
  });

  return (
    <ExplorerLayout>
      {/* Hero search */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-2xl text-akyra-green mb-1">AKYSCAN</h1>
        <p className="text-akyra-textSecondary text-sm mb-6">
          Explorateur blockchain AKYRA L2 — Chain ID {stats?.chainId || 47197}
        </p>
        <ExplorerSearch size="lg" className="max-w-2xl mx-auto" />
      </div>

      {/* Network stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <NetStat
              icon={<Blocks size={18} />}
              label="Dernier bloc"
              value={stats?.latestBlock?.toLocaleString() || "--"}
              color="text-akyra-green"
            />
            <NetStat
              icon={<Fuel size={18} />}
              label="Gas Price"
              value={stats ? `${(parseFloat(stats.gasPrice) * 1e9).toFixed(2)} Gwei` : "--"}
              color="text-akyra-gold"
            />
            <NetStat
              icon={<Zap size={18} />}
              label="Chain ID"
              value={stats?.chainId || "--"}
              color="text-akyra-purple"
            />
          </>
        )}
      </div>

      {/* Latest blocks + txs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Blocks */}
        <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-akyra-border/20">
            <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
              <Blocks size={16} className="text-akyra-green" />
              Derniers Blocs
            </h2>
            <a
              href="/explorer/block/latest"
              className="text-[10px] text-akyra-textSecondary hover:text-akyra-green font-mono uppercase tracking-wider transition-colors"
            >
              Voir tout
            </a>
          </div>
          <div className="px-4 py-2 max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-akyra-border/30">
            {blocksLoading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 bg-akyra-surface/50 rounded animate-shimmer" />
                ))}
              </div>
            ) : (
              blocks?.map((block) => <BlockRow key={block.number} block={block} />)
            )}
          </div>
        </Card>

        {/* Latest Transactions */}
        <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-akyra-border/20">
            <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-akyra-gold" />
              Dernieres Transactions
            </h2>
          </div>
          <div className="px-4 py-2 max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-akyra-border/30">
            {txsLoading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 bg-akyra-surface/50 rounded animate-shimmer" />
                ))}
              </div>
            ) : txs && txs.length > 0 ? (
              txs.map((tx) => <TxRow key={tx.hash} tx={tx} />)
            ) : (
              <div className="py-12 text-center">
                <p className="text-akyra-textDisabled text-sm">Aucune transaction recente</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </ExplorerLayout>
  );
}
