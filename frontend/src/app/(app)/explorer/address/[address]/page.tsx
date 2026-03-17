"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import {
  DataRow,
  CopyableText,
  TxLink,
  BlockLink,
  AddressLink,
} from "@/components/explorer/DataRow";
import { Card } from "@/components/ui/Card";
import {
  getAddressInfo,
  getContractLabel,
  type AddressInfo,
} from "@/lib/explorer";
import { CONTRACTS, AGENT_REGISTRY_ABI } from "@/lib/contracts";
import {
  Wallet,
  FileCode2,
  ArrowLeftRight,
  Copy,
  Check,
  Coins,
  Hash,
  Shield,
  User,
  Activity,
  Box,
} from "lucide-react";
import { useState, useCallback } from "react";
import Link from "next/link";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button onClick={handleCopy} className="p-1.5 rounded hover:bg-akyra-surface/80 transition-colors" title="Copier">
      {copied ? <Check size={14} className="text-akyra-green" /> : <Copy size={14} className="text-akyra-textSecondary" />}
    </button>
  );
}

function StatBox({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-akyra-surface/40 rounded-xl border border-akyra-border/20 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] text-akyra-textDisabled uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-heading ${color || "text-akyra-text"}`}>{value}</p>
    </div>
  );
}

export default function AddressPage() {
  const params = useParams();
  const address = params.address as string;
  const contractLabel = getContractLabel(address);

  const { data: info, isLoading, error } = useQuery<AddressInfo>({
    queryKey: ["explorer", "address", address],
    queryFn: () => getAddressInfo(address as `0x${string}`),
    enabled: !!address,
    retry: 1,
  });

  // Check if this address is a sponsor — try to get their agent ID
  const { data: agentId } = useReadContract({
    address: CONTRACTS.agentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "sponsorToAgent",
    args: [address as `0x${string}`],
  });

  // If we got an agent ID > 0, fetch agent data
  const hasAgent = agentId != null && Number(agentId) > 0;

  const { data: agentData } = useReadContract({
    address: CONTRACTS.agentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: hasAgent ? [Number(agentId)] : undefined,
    query: { enabled: hasAgent },
  });

  const agent = agentData as
    | {
        id: number;
        sponsor: string;
        vault: bigint;
        world: number;
        reputation: bigint;
        contractsHonored: number;
        contractsBroken: number;
        bornAt: bigint;
        lastTick: bigint;
        memoryRoot: string;
        alive: boolean;
        dailyWorkPoints: number;
      }
    | undefined;

  const WORLD_NAMES = ["Nursery", "Agora", "Bazar", "Forge", "Banque", "Noir", "Sommet"];

  return (
    <ExplorerLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-lg bg-akyra-surface border border-akyra-border/30">
            {info?.isContract ? (
              <FileCode2 size={20} className="text-akyra-purple" />
            ) : (
              <Wallet size={20} className="text-akyra-green" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-lg text-akyra-text">
                {info?.isContract ? "Contrat" : "Adresse"}
              </h1>
              {contractLabel && (
                <span className="text-[11px] px-2 py-0.5 bg-akyra-green/10 text-akyra-green rounded font-mono border border-akyra-green/20">
                  {contractLabel}
                </span>
              )}
              {hasAgent && (
                <Link
                  href={`/agent/${Number(agentId)}`}
                  className="text-[11px] px-2 py-0.5 bg-akyra-gold/10 text-akyra-gold rounded font-mono border border-akyra-gold/20 hover:bg-akyra-gold/20 transition-colors"
                >
                  Sponsor Agent AK-{String(Number(agentId)).padStart(4, "0")}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-akyra-textSecondary font-mono break-all">{address}</span>
          <CopyBtn text={address} />
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-akyra-surface/40 rounded-xl animate-shimmer border border-akyra-border/20" />
          ))}
        </div>
      )}

      {error && (
        <Card className="bg-akyra-surface/40 p-8 text-center">
          <p className="text-akyra-red font-mono text-sm">Adresse non trouvee</p>
        </Card>
      )}

      {info && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatBox
              label="Solde AKY"
              value={`${parseFloat(info.balance).toFixed(4)} AKY`}
              icon={<Coins size={14} className="text-akyra-gold" />}
              color="text-akyra-gold"
            />
            <StatBox
              label="Transactions"
              value={info.txCount.toLocaleString()}
              icon={<ArrowLeftRight size={14} className="text-akyra-blue" />}
              color="text-akyra-blue"
            />
            <StatBox
              label="Type"
              value={info.isContract ? "Smart Contract" : "EOA (Wallet)"}
              icon={info.isContract ? <FileCode2 size={14} className="text-akyra-purple" /> : <Wallet size={14} className="text-akyra-green" />}
              color={info.isContract ? "text-akyra-purple" : "text-akyra-green"}
            />
          </div>

          {/* Address details */}
          <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-akyra-border/20">
              <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                <Hash size={15} className="text-akyra-green" />
                Details
              </h2>
            </div>
            <div className="px-5 py-2">
              <DataRow label="Adresse">
                <CopyableText text={info.address} />
              </DataRow>
              <DataRow label="Solde">
                <span className="text-akyra-gold font-bold">{parseFloat(info.balance).toFixed(6)} AKY</span>
                {info.balanceRaw > BigInt(0) && (
                  <span className="text-akyra-textDisabled text-xs ml-2">
                    ({info.balanceRaw.toString()} Wei)
                  </span>
                )}
              </DataRow>
              <DataRow label="Nbre de transactions">{info.txCount.toLocaleString()}</DataRow>
              <DataRow label="Type">
                {info.isContract ? (
                  <span className="flex items-center gap-1.5">
                    <FileCode2 size={13} className="text-akyra-purple" />
                    Smart Contract
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Wallet size={13} className="text-akyra-green" />
                    Externally Owned Account
                  </span>
                )}
              </DataRow>
            </div>
          </Card>

          {/* AKYRA Agent Card (if sponsor) */}
          {hasAgent && agent && (
            <Card className="bg-akyra-surface/40 border-akyra-border/30 p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-akyra-border/20">
                <h2 className="font-heading text-sm text-akyra-text flex items-center gap-2">
                  <User size={15} className="text-akyra-gold" />
                  Agent AKYRA
                </h2>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">ID</p>
                    <p className="text-sm text-akyra-text font-heading">AK-{String(Number(agent.id)).padStart(4, "0")}</p>
                  </div>
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">Coffre</p>
                    <p className="text-sm text-akyra-gold font-heading">
                      {(Number(agent.vault) / 1e18).toFixed(2)} AKY
                    </p>
                  </div>
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">Monde</p>
                    <p className="text-sm text-akyra-text font-heading">
                      {WORLD_NAMES[Number(agent.world)] || `World ${agent.world}`}
                    </p>
                  </div>
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">Statut</p>
                    <p className={`text-sm font-heading ${agent.alive ? "text-akyra-green" : "text-akyra-red"}`}>
                      {agent.alive ? "Vivant" : "Mort"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">Reputation</p>
                    <p className="text-sm text-akyra-green font-mono">{Number(agent.reputation)}</p>
                  </div>
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">Contrats honores</p>
                    <p className="text-sm text-green-400 font-mono">{Number(agent.contractsHonored)}</p>
                  </div>
                  <div className="bg-akyra-bg/40 rounded-lg p-3 border border-akyra-border/10">
                    <p className="text-[9px] text-akyra-textDisabled uppercase tracking-wider mb-1">Contrats rompus</p>
                    <p className="text-sm text-red-400 font-mono">{Number(agent.contractsBroken)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/agent/${Number(agent.id)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider
                      bg-akyra-green/10 text-akyra-green border border-akyra-green/30 hover:bg-akyra-green/20 transition-all"
                  >
                    <Activity size={14} />
                    Voir le profil de l'agent
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </ExplorerLayout>
  );
}
