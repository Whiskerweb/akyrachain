"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import {
  DataRow,
  StatusBadge,
  AddressLink,
  BlockLink,
  CopyableText,
} from "@/components/explorer/DataRow";
import { Card } from "@/components/ui/Card";
import { getTransaction, getContractLabel, type TxDetail } from "@/lib/explorer";
import { shortenAddress } from "@/lib/utils";
import {
  ArrowRight,
  Clock,
  Fuel,
  Hash,
  FileCode2,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react";
import { useState } from "react";

// ──── Known method signatures ────
const METHOD_NAMES: Record<string, string> = {
  "0x": "Transfer (native)",
  "0xa9059cbb": "transfer(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0x40c10f19": "mint(address,uint256)",
  "0x42842e0e": "safeTransferFrom(address,address,uint256)",
  "0x70a08231": "balanceOf(address)",
  "0x18160ddd": "totalSupply()",
  "0x313ce567": "decimals()",
  "0x06fdde03": "name()",
  "0x95d89b41": "symbol()",
  // AKYRA-specific
  "0xefc81a8c": "createAgent()",
  "0xd0e30db0": "deposit()",
  "0x3ccfd60b": "withdraw()",
  "0x8456cb59": "pause()",
  "0x3f4ba83a": "unpause()",
};

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

function formatGwei(wei: string): string {
  const gwei = Number(wei) / 1e9;
  if (gwei < 0.001) return `${(Number(wei)).toLocaleString()} Wei`;
  return `${gwei.toFixed(4)} Gwei`;
}

export default function TxDetailPage() {
  const params = useParams();
  const hash = params.hash as string;
  const [showInput, setShowInput] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const { data: tx, isLoading, error } = useQuery<TxDetail>({
    queryKey: ["explorer", "tx", hash],
    queryFn: () => getTransaction(hash as `0x${string}`),
    enabled: !!hash,
    retry: 1,
  });

  const methodName = tx ? METHOD_NAMES[tx.methodId] || null : null;
  const toLabel = tx?.to ? getContractLabel(tx.to) : null;
  const fromLabel = tx?.from ? getContractLabel(tx.from) : null;

  return (
    <ExplorerLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-heading text-lg text-akyra-text">Transaction</h1>
          {tx && <StatusBadge status={tx.status} />}
        </div>
        <p className="text-xs text-akyra-textDisabled font-mono break-all">{hash}</p>
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
          <p className="text-akyra-red font-mono text-sm">Transaction non trouvee</p>
          <p className="text-akyra-textDisabled text-xs mt-1">
            Verifiez le hash et reessayez.
          </p>
        </Card>
      )}

      {tx && (
        <div className="space-y-4">
          {/* Main details card */}
          <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-akyra-border/20">
              <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                <Hash size={15} className="text-akyra-green" />
                Details
              </h2>
            </div>
            <div className="px-5 py-2">
              <DataRow label="Hash de transaction">
                <CopyableText text={tx.hash} />
              </DataRow>
              <DataRow label="Statut">
                <StatusBadge status={tx.status} />
              </DataRow>
              <DataRow label="Bloc">
                <BlockLink number={tx.blockNumber} />
                <span className="text-akyra-textDisabled text-xs ml-2">
                  (index: {tx.transactionIndex})
                </span>
              </DataRow>
              <DataRow label="Horodatage">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-akyra-textSecondary" />
                  {formatTimestamp(tx.timestamp)}
                </span>
              </DataRow>

              {/* Separator */}
              <div className="border-t border-akyra-border/30 my-2" />

              <DataRow label="De">
                <div className="flex items-center gap-2">
                  <AddressLink address={tx.from} />
                  {fromLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-akyra-green/10 text-akyra-green rounded font-mono">
                      {fromLabel}
                    </span>
                  )}
                </div>
              </DataRow>
              <DataRow label="Vers">
                {tx.to ? (
                  <div className="flex items-center gap-2">
                    <AddressLink address={tx.to} />
                    {toLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-akyra-green/10 text-akyra-green rounded font-mono">
                        {toLabel}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-akyra-purple font-mono">
                    Contract Creation
                  </span>
                )}
              </DataRow>

              {/* Separator */}
              <div className="border-t border-akyra-border/30 my-2" />

              <DataRow label="Valeur">
                <span className="text-akyra-gold font-bold">
                  {parseFloat(tx.value).toFixed(6)} AKY
                </span>
                {tx.valueRaw > BigInt(0) && (
                  <span className="text-akyra-textDisabled text-xs ml-2">
                    ({tx.valueRaw.toString()} Wei)
                  </span>
                )}
              </DataRow>
              <DataRow label="Frais de transaction">
                <span className="text-akyra-text">
                  {parseFloat(tx.txFee).toFixed(8)} AKY
                </span>
              </DataRow>
              <DataRow label="Gas utilise">
                <span>
                  {Number(tx.gasUsed).toLocaleString()}
                  <span className="text-akyra-textDisabled text-xs ml-1">
                    / {Number(tx.gasLimit).toLocaleString()}
                  </span>
                </span>
                {/* Gas usage bar */}
                <div className="w-24 h-1.5 bg-akyra-surface rounded-full ml-3 inline-block align-middle">
                  <div
                    className="h-full bg-akyra-green rounded-full"
                    style={{
                      width: `${Math.min(100, (Number(tx.gasUsed) / Number(tx.gasLimit)) * 100)}%`,
                    }}
                  />
                </div>
              </DataRow>
              <DataRow label="Gas Price">
                {formatGwei(tx.effectiveGasPrice)}
              </DataRow>
              <DataRow label="Nonce">
                {tx.nonce}
              </DataRow>
              <DataRow label="Type">
                <span className="text-xs px-2 py-0.5 bg-akyra-surface rounded font-mono">
                  {tx.type}
                </span>
              </DataRow>

              {/* Method */}
              {tx.methodId !== "0x" && (
                <DataRow label="Methode">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-akyra-blue/10 text-akyra-blue rounded font-mono border border-akyra-blue/20">
                      {tx.methodId}
                    </span>
                    {methodName && (
                      <span className="text-xs text-akyra-textSecondary">
                        {methodName}
                      </span>
                    )}
                  </div>
                </DataRow>
              )}
            </div>
          </Card>

          {/* Input data */}
          {tx.input && tx.input !== "0x" && (
            <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
              <button
                onClick={() => setShowInput(!showInput)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-akyra-surface/30 transition-colors"
              >
                <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                  <FileCode2 size={15} className="text-akyra-purple" />
                  Input Data
                  <span className="text-[10px] text-akyra-textDisabled font-mono ml-1">
                    ({tx.input.length} octets)
                  </span>
                </h2>
                {showInput ? <ChevronUp size={16} className="text-akyra-textSecondary" /> : <ChevronDown size={16} className="text-akyra-textSecondary" />}
              </button>
              {showInput && (
                <div className="px-5 pb-4">
                  <pre className="text-[11px] text-akyra-textSecondary font-mono bg-akyra-bg/50 rounded-lg p-3 overflow-x-auto break-all whitespace-pre-wrap border border-akyra-border/20">
                    {tx.input}
                  </pre>
                </div>
              )}
            </Card>
          )}

          {/* Event Logs */}
          {tx.logs.length > 0 && (
            <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-akyra-surface/30 transition-colors"
              >
                <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                  <Layers size={15} className="text-akyra-gold" />
                  Logs d'evenements
                  <span className="text-[10px] px-1.5 py-0.5 bg-akyra-gold/10 text-akyra-gold rounded-full font-mono">
                    {tx.logs.length}
                  </span>
                </h2>
                {showLogs ? <ChevronUp size={16} className="text-akyra-textSecondary" /> : <ChevronDown size={16} className="text-akyra-textSecondary" />}
              </button>
              {showLogs && (
                <div className="px-5 pb-4 space-y-3">
                  {tx.logs.map((log, i) => {
                    const logLabel = getContractLabel(log.address);
                    return (
                      <div
                        key={i}
                        className="bg-akyra-bg/40 rounded-lg border border-akyra-border/15 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-akyra-surface rounded font-mono text-akyra-textDisabled">
                            #{log.logIndex}
                          </span>
                          <AddressLink address={log.address} label={logLabel || shortenAddress(log.address)} />
                        </div>
                        <div className="space-y-1.5">
                          {log.topics.map((topic, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <span className="text-[9px] text-akyra-textDisabled font-mono w-16 shrink-0 pt-0.5">
                                Topic {j}
                              </span>
                              <span className="text-[11px] text-akyra-textSecondary font-mono break-all">
                                {topic}
                              </span>
                            </div>
                          ))}
                          {log.data !== "0x" && (
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] text-akyra-textDisabled font-mono w-16 shrink-0 pt-0.5">
                                Data
                              </span>
                              <span className="text-[11px] text-akyra-textSecondary font-mono break-all">
                                {log.data}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </ExplorerLayout>
  );
}
