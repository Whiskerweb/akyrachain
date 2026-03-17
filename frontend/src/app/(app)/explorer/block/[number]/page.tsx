"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import {
  DataRow,
  AddressLink,
  BlockLink,
  TxLink,
  CopyableText,
} from "@/components/explorer/DataRow";
import { Card } from "@/components/ui/Card";
import {
  getBlock,
  getNetworkStats,
  type BlockDetail,
  type NetworkStats,
} from "@/lib/explorer";
import { shortenAddress } from "@/lib/utils";
import {
  Box,
  Clock,
  Hash,
  Fuel,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Layers,
} from "lucide-react";
import Link from "next/link";

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function BlockDetailPage() {
  const params = useParams();
  const rawNum = params.number as string;

  // Fetch latest block number for "latest" route
  const { data: stats } = useQuery<NetworkStats>({
    queryKey: ["explorer", "stats"],
    queryFn: getNetworkStats,
    enabled: rawNum === "latest",
  });

  const blockNumber = rawNum === "latest"
    ? stats?.latestBlock
    : parseInt(rawNum, 10);

  const { data: block, isLoading, error } = useQuery<BlockDetail>({
    queryKey: ["explorer", "block", blockNumber],
    queryFn: () => getBlock(blockNumber!),
    enabled: blockNumber != null && !isNaN(blockNumber),
    retry: 1,
  });

  const gasUsedPct = block
    ? ((Number(block.gasUsed) / Number(block.gasLimit)) * 100).toFixed(1)
    : "0";

  return (
    <ExplorerLayout>
      {/* Header + navigation */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-lg text-akyra-text">Bloc</h1>
            <span className="font-heading text-lg text-akyra-green">
              #{blockNumber?.toLocaleString() || rawNum}
            </span>
          </div>
        </div>
        {blockNumber != null && (
          <div className="flex items-center gap-1">
            {blockNumber > 0 && (
              <Link
                href={`/explorer/block/${blockNumber - 1}`}
                className="p-2 rounded-lg bg-akyra-surface border border-akyra-border/30 text-akyra-textSecondary hover:text-akyra-green hover:border-akyra-green/40 transition-all"
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            <Link
              href={`/explorer/block/${blockNumber + 1}`}
              className="p-2 rounded-lg bg-akyra-surface border border-akyra-border/30 text-akyra-textSecondary hover:text-akyra-green hover:border-akyra-green/40 transition-all"
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {isLoading && (
        <Card className="bg-akyra-surface/40 p-8">
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-6 bg-akyra-surface/80 rounded animate-shimmer" />
            ))}
          </div>
        </Card>
      )}

      {error && (
        <Card className="bg-akyra-surface/40 p-8 text-center">
          <p className="text-akyra-red font-mono text-sm">Bloc non trouve</p>
          <p className="text-akyra-textDisabled text-xs mt-1">
            Verifiez le numero et reessayez.
          </p>
        </Card>
      )}

      {block && (
        <div className="space-y-4">
          {/* Block details */}
          <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-akyra-border/20">
              <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                <Box size={15} className="text-akyra-green" />
                Details du bloc
              </h2>
            </div>
            <div className="px-5 py-2">
              <DataRow label="Numero de bloc">
                {block.number.toLocaleString()}
              </DataRow>
              <DataRow label="Horodatage">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-akyra-textSecondary" />
                  {formatTimestamp(block.timestamp)}
                </span>
              </DataRow>
              <DataRow label="Hash">
                <CopyableText text={block.hash} />
              </DataRow>
              <DataRow label="Parent Hash">
                {block.number > 0 ? (
                  <Link
                    href={`/explorer/block/${block.number - 1}`}
                    className="text-akyra-blue hover:text-akyra-green font-mono text-sm transition-colors"
                  >
                    {block.parentHash}
                  </Link>
                ) : (
                  <span className="font-mono text-sm">{block.parentHash}</span>
                )}
              </DataRow>

              <div className="border-t border-akyra-border/30 my-2" />

              <DataRow label="Transactions">
                <span className="text-akyra-text font-bold">{block.transactionCount}</span>
                <span className="text-akyra-textDisabled text-xs ml-1">
                  transaction{block.transactionCount !== 1 ? "s" : ""} dans ce bloc
                </span>
              </DataRow>
              <DataRow label="Validateur">
                <AddressLink address={block.miner} />
              </DataRow>

              <div className="border-t border-akyra-border/30 my-2" />

              <DataRow label="Gas utilise">
                <span>
                  {Number(block.gasUsed).toLocaleString()}
                  <span className="text-akyra-textDisabled text-xs ml-1">
                    ({gasUsedPct}%)
                  </span>
                </span>
                <div className="w-24 h-1.5 bg-akyra-surface rounded-full ml-3 inline-block align-middle">
                  <div
                    className="h-full bg-akyra-green rounded-full"
                    style={{ width: `${Math.min(100, parseFloat(gasUsedPct))}%` }}
                  />
                </div>
              </DataRow>
              <DataRow label="Gas Limit">
                {Number(block.gasLimit).toLocaleString()}
              </DataRow>
              {block.baseFeePerGas && (
                <DataRow label="Base Fee">
                  {(Number(block.baseFeePerGas) / 1e9).toFixed(4)} Gwei
                </DataRow>
              )}
              <DataRow label="Taille">
                {Number(block.size).toLocaleString()} octets
              </DataRow>
              {block.extraData !== "0x" && (
                <DataRow label="Extra Data">
                  <span className="text-xs">{block.extraData}</span>
                </DataRow>
              )}
            </div>
          </Card>

          {/* Transactions list */}
          {block.transactions.length > 0 && (
            <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-akyra-border/20">
                <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                  <ArrowLeftRight size={15} className="text-akyra-gold" />
                  Transactions
                  <span className="text-[10px] px-1.5 py-0.5 bg-akyra-gold/10 text-akyra-gold rounded-full font-mono">
                    {block.transactionCount}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-akyra-border/20">
                      <th className="text-left px-5 py-2.5 text-akyra-textDisabled font-normal uppercase tracking-wider text-[10px]">Tx Hash</th>
                      <th className="text-left px-3 py-2.5 text-akyra-textDisabled font-normal uppercase tracking-wider text-[10px]">De</th>
                      <th className="text-center px-1 py-2.5"></th>
                      <th className="text-left px-3 py-2.5 text-akyra-textDisabled font-normal uppercase tracking-wider text-[10px]">Vers</th>
                      <th className="text-right px-5 py-2.5 text-akyra-textDisabled font-normal uppercase tracking-wider text-[10px]">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.transactions.map((tx) => (
                      <tr
                        key={tx.hash}
                        className="border-b border-akyra-border/10 hover:bg-akyra-surface/30 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <TxLink hash={tx.hash} short />
                        </td>
                        <td className="px-3 py-3">
                          <AddressLink address={tx.from} label={shortenAddress(tx.from)} />
                        </td>
                        <td className="px-1 py-3 text-center">
                          <ArrowRight size={12} className="text-akyra-textDisabled inline" />
                        </td>
                        <td className="px-3 py-3">
                          {tx.to ? (
                            <AddressLink address={tx.to} label={shortenAddress(tx.to)} />
                          ) : (
                            <span className="text-akyra-purple font-mono">Create</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={parseFloat(tx.value) > 0 ? "text-akyra-gold font-medium" : "text-akyra-textDisabled"}>
                            {parseFloat(tx.value).toFixed(4)} AKY
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </ExplorerLayout>
  );
}
