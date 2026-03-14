"use client";

import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { formatEther, parseEther } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import {
  ArrowDownUp,
  Coins,
  AlertTriangle,
  Info,
  ExternalLink,
  Sparkles,
  ChevronDown,
  X,
  ArrowRight,
  Lock,
} from "lucide-react";
import Link from "next/link";

/* ── ABI ── */
const AKYRA_SWAP_ABI = [
  {
    inputs: [],
    name: "allPoolsLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "allPools",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "getPool",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "reserveAKY", type: "uint128" },
          { name: "reserveToken", type: "uint128" },
          { name: "totalLP", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "getReserves",
    outputs: [
      { name: "reserveAKY", type: "uint128" },
      { name: "reserveToken", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "reserveIn", type: "uint128" },
      { name: "reserveOut", type: "uint128" },
    ],
    name: "getAmountOut",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "minTokenOut", type: "uint256" },
    ],
    name: "swapAKYForToken",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenIn", type: "uint256" },
      { name: "minAKYOut", type: "uint256" },
    ],
    name: "swapTokenForAKY",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "SWAP_FEE_BPS",
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/* ── Types ── */
interface PoolInfo {
  token: `0x${string}`;
  reserveAKY: bigint;
  reserveToken: bigint;
  totalLP: bigint;
  exists: boolean;
}

type Tab = "swap" | "bridge";

const BRIDGE_CHAINS = ["Ethereum", "Base", "Arbitrum", "AKYRA"] as const;

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: "bg-blue-500",
  Base: "bg-blue-400",
  Arbitrum: "bg-sky-400",
  AKYRA: "bg-akyra-green",
};

const CHAIN_LETTERS: Record<string, string> = {
  Ethereum: "E",
  Base: "B",
  Arbitrum: "A",
  AKYRA: "K",
};

/* ── Helpers ── */
function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({ address });

  const [activeTab, setActiveTab] = useState<Tab>("swap");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [selectedToken, setSelectedToken] = useState<`0x${string}` | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [direction, setDirection] = useState<"akyToToken" | "tokenToAky">("akyToToken");

  // Bridge state
  const [bridgeFrom, setBridgeFrom] = useState<string>("Ethereum");
  const [bridgeTo, setBridgeTo] = useState<string>("AKYRA");
  const [bridgeAmount, setBridgeAmount] = useState("");

  /* ── Contract reads ── */
  const { data: poolCount } = useReadContract({
    address: CONTRACTS.akyraSwap,
    abi: AKYRA_SWAP_ABI,
    functionName: "allPoolsLength",
  });

  const { data: feeBps } = useReadContract({
    address: CONTRACTS.akyraSwap,
    abi: AKYRA_SWAP_ABI,
    functionName: "SWAP_FEE_BPS",
  });

  // Read all pool token addresses
  const poolIndexes = useMemo(() => {
    const count = Number(poolCount || 0);
    return Array.from({ length: count }, (_, i) => i);
  }, [poolCount]);

  const poolAddressContracts = useMemo(
    () =>
      poolIndexes.map((i) => ({
        address: CONTRACTS.akyraSwap,
        abi: AKYRA_SWAP_ABI,
        functionName: "allPools" as const,
        args: [BigInt(i)] as const,
      })),
    [poolIndexes],
  );

  const { data: poolAddressResults } = useReadContracts({
    contracts: poolAddressContracts,
  });

  // Extract token addresses from results
  const tokenAddresses = useMemo(() => {
    if (!poolAddressResults) return [];
    return poolAddressResults
      .filter((r) => r.status === "success" && r.result)
      .map((r) => r.result as `0x${string}`);
  }, [poolAddressResults]);

  // Read pool info for all tokens
  const poolInfoContracts = useMemo(
    () =>
      tokenAddresses.map((token) => ({
        address: CONTRACTS.akyraSwap,
        abi: AKYRA_SWAP_ABI,
        functionName: "getPool" as const,
        args: [token] as const,
      })),
    [tokenAddresses],
  );

  const { data: poolInfoResults } = useReadContracts({
    contracts: poolInfoContracts,
  });

  // Map token -> pool info
  const pools = useMemo(() => {
    if (!poolInfoResults || !tokenAddresses.length) return [];
    const result: PoolInfo[] = [];
    for (let i = 0; i < tokenAddresses.length; i++) {
      const r = poolInfoResults[i];
      if (r && r.status === "success" && r.result) {
        const data = r.result as unknown as readonly [string, bigint, bigint, bigint, boolean];
        result.push({
          token: data[0] as `0x${string}`,
          reserveAKY: data[1],
          reserveToken: data[2],
          totalLP: data[3],
          exists: data[4],
        });
      }
    }
    return result.filter((p) => p.exists);
  }, [poolInfoResults, tokenAddresses]);

  // Selected pool
  const selectedPool = useMemo(
    () => pools.find((p) => p.token === selectedToken) || null,
    [pools, selectedToken],
  );

  // Auto-select first token if none selected
  useEffect(() => {
    if (!selectedToken && pools.length > 0) {
      setSelectedToken(pools[0].token);
    }
  }, [pools, selectedToken]);

  // getAmountOut estimation
  const parsedAmount = useMemo(() => {
    try {
      const val = parseFloat(amount);
      if (!val || val <= 0) return null;
      return parseEther(amount);
    } catch {
      return null;
    }
  }, [amount]);

  const reserveIn = selectedPool
    ? direction === "akyToToken"
      ? selectedPool.reserveAKY
      : selectedPool.reserveToken
    : BigInt(0);

  const reserveOut = selectedPool
    ? direction === "akyToToken"
      ? selectedPool.reserveToken
      : selectedPool.reserveAKY
    : BigInt(0);

  const { data: estimatedOut } = useReadContract({
    address: CONTRACTS.akyraSwap,
    abi: AKYRA_SWAP_ABI,
    functionName: "getAmountOut",
    args: [parsedAmount || BigInt(0), reserveIn as unknown as bigint, reserveOut as unknown as bigint],
    query: {
      enabled: !!parsedAmount && !!selectedPool && reserveIn > BigInt(0) && reserveOut > BigInt(0),
    },
  });

  /* ── Swap execution ── */
  const { writeContract, isPending: isSwapping } = useWriteContract();

  function handleSwap() {
    if (!selectedToken || !parsedAmount || !estimatedOut) return;
    const minOut = (estimatedOut * BigInt(10000 - slippage * 100)) / BigInt(10000);

    if (direction === "akyToToken") {
      writeContract({
        address: CONTRACTS.akyraSwap,
        abi: AKYRA_SWAP_ABI,
        functionName: "swapAKYForToken",
        args: [selectedToken, minOut],
        value: parsedAmount,
      });
    } else {
      writeContract({
        address: CONTRACTS.akyraSwap,
        abi: AKYRA_SWAP_ABI,
        functionName: "swapTokenForAKY",
        args: [selectedToken, parsedAmount, minOut],
      });
    }
  }

  /* ── Derived values ── */
  const balance = balanceData ? parseFloat(formatEther(balanceData.value)) : 0;
  const hasAmount = amount !== "" && parseFloat(amount) > 0;
  const inputAmount = hasAmount ? parseFloat(amount) : 0;
  const insufficientBalance = direction === "akyToToken" && inputAmount > balance;
  const fee = Number(feeBps || 30);
  const noPools = Number(poolCount || 0) === 0;

  /* ── Direction swap ── */
  function flipDirection() {
    setDirection((d) => (d === "akyToToken" ? "tokenToAky" : "akyToToken"));
    setAmount("");
  }

  /* ── Token labels ── */
  const fromLabel = direction === "akyToToken" ? "AKY" : selectedToken ? shortenAddress(selectedToken) : "Token";
  const toLabel = direction === "akyToToken" ? (selectedToken ? shortenAddress(selectedToken) : "Token") : "AKY";

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <div className="max-w-lg mx-auto px-4 pt-10 pb-16">
        {/* Minimal header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-akyra-green/20 to-akyra-green/5 border border-akyra-green/20 flex items-center justify-center">
              <ArrowDownUp size={14} className="text-akyra-green" />
            </div>
            <div>
              <h1 className="font-heading text-base text-akyra-text tracking-wide">Swap</h1>
              <p className="text-akyra-textDisabled text-[10px] font-mono">
                {(fee / 100).toFixed(1)}% fee · {Number(poolCount || 0)} pools
              </p>
            </div>
          </div>
          <Link
            href={`/explorer/address/${CONTRACTS.akyraSwap}`}
            className="text-[10px] text-akyra-textDisabled/40 hover:text-akyra-green font-mono flex items-center gap-1 transition-colors"
          >
            Contract
            <ExternalLink size={9} />
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex mb-5 bg-akyra-bg rounded-2xl p-1 border border-akyra-border/20">
          {(["swap", "bridge"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest transition-all duration-200",
                activeTab === tab
                  ? "bg-akyra-surface text-akyra-text shadow-lg shadow-black/30"
                  : "text-akyra-textDisabled/40 hover:text-akyra-textSecondary",
              )}
            >
              {tab === "swap" ? "Swap" : "Bridge"}
            </button>
          ))}
        </div>

        {/* ═══════════════ SWAP TAB ═══════════════ */}
        {activeTab === "swap" && (
          <>
            {/* Gradient glow behind swap card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-b from-akyra-green/[0.07] via-akyra-purple/[0.04] to-transparent rounded-3xl blur-2xl pointer-events-none" />
              <div className="absolute -inset-2 bg-gradient-to-br from-akyra-green/[0.03] to-akyra-purple/[0.03] rounded-3xl pointer-events-none" />

              <Card className="relative bg-[#0B1018]/90 backdrop-blur-2xl border-akyra-border/20 p-0 overflow-visible rounded-2xl shadow-2xl shadow-black/60">
                {/* From section */}
                <div className="p-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-akyra-textSecondary font-mono tracking-wider">From</span>
                    {isConnected && direction === "akyToToken" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-akyra-textDisabled font-mono">
                          Balance: {balance.toFixed(4)}
                        </span>
                        <button
                          onClick={() => setAmount(balance.toFixed(4))}
                          className="text-[10px] font-mono font-bold text-akyra-green/80 hover:text-akyra-green bg-akyra-green/8 hover:bg-akyra-green/15 px-2 py-0.5 rounded-md transition-all border border-akyra-green/15 hover:border-akyra-green/30"
                        >
                          MAX
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 bg-akyra-bg/60 rounded-xl p-3.5 border border-akyra-border/15 focus-within:border-akyra-green/25 transition-colors">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="flex-1 bg-transparent text-2xl text-akyra-text font-mono outline-none placeholder:text-akyra-textDisabled/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {direction === "akyToToken" ? (
                      <div className="flex items-center gap-2 bg-akyra-surface/80 rounded-full px-3.5 py-2 border border-akyra-border/25 shrink-0">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-akyra-gold to-akyra-goldDark flex items-center justify-center">
                          <Coins size={11} className="text-akyra-bg" />
                        </div>
                        <span className="text-sm text-akyra-text font-mono font-bold">AKY</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowTokenModal(true)}
                        className="flex items-center gap-2 bg-akyra-surface/80 rounded-full px-3.5 py-2 border border-akyra-border/25 shrink-0 hover:border-akyra-purple/40 transition-all group"
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-akyra-purple to-akyra-purpleDark flex items-center justify-center">
                          <Sparkles size={10} className="text-white" />
                        </div>
                        <span className="text-sm text-akyra-text font-mono">{selectedToken ? shortenAddress(selectedToken) : "Select"}</span>
                        <ChevronDown size={12} className="text-akyra-textDisabled group-hover:text-akyra-purple transition-colors" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Floating flip button */}
                <div className="flex justify-center -my-3 relative z-20">
                  <button
                    onClick={flipDirection}
                    className="w-10 h-10 rounded-full bg-akyra-surface border-[3px] border-[#0B1018] flex items-center justify-center hover:bg-akyra-green/10 hover:border-akyra-green/20 transition-all duration-300 hover:rotate-180 shadow-lg shadow-black/40 group"
                  >
                    <ArrowDownUp size={16} className="text-akyra-textSecondary group-hover:text-akyra-green transition-colors" />
                  </button>
                </div>

                {/* To section */}
                <div className="p-5 pt-4 bg-akyra-surface/10 rounded-b-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-akyra-textSecondary font-mono tracking-wider">To (estimated)</span>
                  </div>
                  <div className="flex items-center gap-3 bg-akyra-bg/40 rounded-xl p-3.5 border border-akyra-border/10">
                    <div className="flex-1">
                      <span className={cn(
                        "text-2xl font-mono font-semibold",
                        estimatedOut ? "text-akyra-text" : "text-akyra-textDisabled/25",
                      )}>
                        {noPools
                          ? "---"
                          : !selectedToken
                            ? "Select token"
                            : estimatedOut
                              ? parseFloat(formatEther(estimatedOut)).toFixed(6)
                              : hasAmount
                                ? "..."
                                : "0.00"}
                      </span>
                    </div>
                    {direction === "akyToToken" ? (
                      <button
                        onClick={() => setShowTokenModal(true)}
                        className="flex items-center gap-2 bg-akyra-surface/80 rounded-full px-3.5 py-2 border border-akyra-border/25 shrink-0 hover:border-akyra-purple/40 transition-all group"
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-akyra-purple to-akyra-purpleDark flex items-center justify-center">
                          <Sparkles size={10} className="text-white" />
                        </div>
                        <span className="text-sm text-akyra-text font-mono">{selectedToken ? shortenAddress(selectedToken) : "Select"}</span>
                        <ChevronDown size={12} className="text-akyra-textDisabled group-hover:text-akyra-purple transition-colors" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-akyra-surface/80 rounded-full px-3.5 py-2 border border-akyra-border/25 shrink-0">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-akyra-gold to-akyra-goldDark flex items-center justify-center">
                          <Coins size={11} className="text-akyra-bg" />
                        </div>
                        <span className="text-sm text-akyra-text font-mono font-bold">AKY</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slippage tolerance */}
                <div className="px-5 py-3 border-t border-akyra-border/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-akyra-textDisabled font-mono tracking-wider">Slippage tolerance</span>
                    <div className="flex items-center gap-1">
                      {[0.5, 1, 2, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSlippage(s)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all duration-150",
                            slippage === s
                              ? "bg-akyra-green/12 text-akyra-green border border-akyra-green/25 shadow-sm shadow-akyra-green/10"
                              : "text-akyra-textDisabled/60 hover:text-akyra-textSecondary hover:bg-akyra-surface/40",
                          )}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Swap button */}
                <div className="px-5 pb-5 pt-2">
                  {!isConnected ? (
                    <div className="w-full py-4 rounded-xl text-center text-sm font-mono text-akyra-textDisabled/60 bg-akyra-surface/30 border border-akyra-border/15">
                      Connecte ton wallet
                    </div>
                  ) : noPools ? (
                    <div className="w-full py-4 rounded-xl text-center text-sm font-mono bg-akyra-surface/30 border border-akyra-border/15">
                      <span className="text-akyra-textDisabled/50">Aucun pool disponible</span>
                    </div>
                  ) : !selectedToken ? (
                    <button
                      onClick={() => setShowTokenModal(true)}
                      className="w-full py-4 rounded-xl text-sm font-mono bg-akyra-purple/10 text-akyra-purple border border-akyra-purple/20 hover:bg-akyra-purple/15 transition-all"
                    >
                      Selectionnez un token
                    </button>
                  ) : insufficientBalance ? (
                    <div className="w-full py-4 rounded-xl text-center text-sm font-mono bg-akyra-red/8 text-akyra-red/80 border border-akyra-red/20 flex items-center justify-center gap-2">
                      <AlertTriangle size={14} />
                      Solde insuffisant
                    </div>
                  ) : (
                    <button
                      disabled={!hasAmount || !estimatedOut || isSwapping}
                      onClick={handleSwap}
                      className={cn(
                        "w-full py-4 rounded-xl text-sm font-mono font-bold uppercase tracking-wider transition-all duration-200",
                        hasAmount && estimatedOut && !isSwapping
                          ? "bg-gradient-to-r from-akyra-green/20 to-akyra-green/10 text-akyra-green border border-akyra-green/30 hover:from-akyra-green/30 hover:to-akyra-green/15 hover:shadow-lg hover:shadow-akyra-green/10"
                          : "bg-akyra-surface/20 text-akyra-textDisabled/30 border border-akyra-border/10 cursor-not-allowed",
                      )}
                    >
                      {isSwapping ? "Swap en cours..." : hasAmount ? "Swapper" : "Entrez un montant"}
                    </button>
                  )}
                </div>
              </Card>
            </div>

            {/* Pool stats panel */}
            {selectedPool && (
              <div className="mt-4 bg-akyra-surface/10 border border-akyra-border/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-akyra-border/8">
                  <span className="text-[10px] text-akyra-textDisabled uppercase tracking-widest font-mono">
                    Pool reserves
                  </span>
                </div>
                <div className="px-5 py-3 flex items-center justify-between border-b border-akyra-border/6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-akyra-gold/60 to-akyra-gold/20" />
                    <span className="text-xs text-akyra-textSecondary font-mono">AKY</span>
                  </div>
                  <span className="text-sm text-akyra-text font-mono font-medium">
                    {parseFloat(formatEther(selectedPool.reserveAKY)).toFixed(4)}
                  </span>
                </div>
                <div className="px-5 py-3 flex items-center justify-between border-b border-akyra-border/6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-akyra-purple/60 to-akyra-purple/20" />
                    <span className="text-xs text-akyra-textSecondary font-mono">{shortenAddress(selectedPool.token)}</span>
                  </div>
                  <span className="text-sm text-akyra-text font-mono font-medium">
                    {parseFloat(formatEther(selectedPool.reserveToken)).toFixed(4)}
                  </span>
                </div>
                {estimatedOut && hasAmount && (
                  <>
                    <div className="px-5 py-3 flex items-center justify-between border-b border-akyra-border/6">
                      <span className="text-xs text-akyra-textSecondary font-mono">Rate</span>
                      <span className="text-sm text-akyra-green font-mono font-medium">
                        1 {fromLabel} = {(parseFloat(formatEther(estimatedOut)) / inputAmount).toFixed(6)} {toLabel}
                      </span>
                    </div>
                    <div className="px-5 py-3 flex items-center justify-between">
                      <span className="text-xs text-akyra-textSecondary font-mono">Min. received</span>
                      <span className="text-sm text-akyra-text font-mono font-medium">
                        {(parseFloat(formatEther(estimatedOut)) * (1 - slippage / 100)).toFixed(6)} {toLabel}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Info footnote */}
            <div className="mt-4 bg-akyra-surface/8 border border-akyra-border/8 rounded-2xl p-4">
              <div className="flex items-start gap-2.5">
                <Info size={13} className="text-akyra-blue/40 shrink-0 mt-0.5" />
                <div className="text-[11px] text-akyra-textDisabled/50 leading-relaxed space-y-1">
                  <p>
                    Les pools sont créés quand de la liquidité est ajoutée via AkyraSwap. Un token sans pool ne peut pas être échangé.
                  </p>
                  <p>
                    Fee split: <span className="text-akyra-textDisabled/70">80% RewardPool</span> · <span className="text-akyra-textDisabled/70">15% Infra</span> · <span className="text-akyra-textDisabled/70">5% Gas</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ BRIDGE TAB ═══════════════ */}
        {activeTab === "bridge" && (
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-b from-akyra-purple/[0.06] via-akyra-blue/[0.03] to-transparent rounded-3xl blur-2xl pointer-events-none" />

            <Card className="relative bg-[#0B1018]/90 backdrop-blur-2xl border-akyra-border/20 p-0 overflow-visible rounded-2xl shadow-2xl shadow-black/60">
              {/* From chain */}
              <div className="p-5 pb-4">
                <span className="text-[11px] text-akyra-textSecondary font-mono tracking-wider block mb-3">
                  From
                </span>
                <div className="flex flex-wrap gap-2">
                  {BRIDGE_CHAINS.map((chain) => (
                    <button
                      key={chain}
                      onClick={() => {
                        setBridgeFrom(chain);
                        if (chain === bridgeTo) setBridgeTo(chain === "AKYRA" ? "Ethereum" : "AKYRA");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono transition-all border",
                        bridgeFrom === chain
                          ? "bg-akyra-green/8 text-akyra-text border-akyra-green/25 shadow-sm shadow-akyra-green/5"
                          : "bg-akyra-surface/20 text-akyra-textDisabled/60 border-akyra-border/15 hover:text-akyra-text hover:border-akyra-border/30",
                      )}
                    >
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white/90", CHAIN_COLORS[chain])}>
                        {CHAIN_LETTERS[chain]}
                      </div>
                      {chain}
                    </button>
                  ))}
                </div>
              </div>

              {/* Floating arrow */}
              <div className="flex justify-center -my-3 relative z-20">
                <div className="w-10 h-10 rounded-full bg-akyra-surface border-[3px] border-[#0B1018] flex items-center justify-center shadow-lg shadow-black/40">
                  <ArrowRight size={16} className="text-akyra-textSecondary rotate-90" />
                </div>
              </div>

              {/* To chain */}
              <div className="p-5 pt-4 pb-4 bg-akyra-surface/10">
                <span className="text-[11px] text-akyra-textSecondary font-mono tracking-wider block mb-3">
                  To
                </span>
                <div className="flex flex-wrap gap-2">
                  {BRIDGE_CHAINS.filter((c) => c !== bridgeFrom).map((chain) => (
                    <button
                      key={chain}
                      onClick={() => setBridgeTo(chain)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono transition-all border",
                        bridgeTo === chain
                          ? "bg-akyra-purple/8 text-akyra-text border-akyra-purple/25 shadow-sm shadow-akyra-purple/5"
                          : "bg-akyra-surface/20 text-akyra-textDisabled/60 border-akyra-border/15 hover:text-akyra-text hover:border-akyra-border/30",
                      )}
                    >
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white/90", CHAIN_COLORS[chain])}>
                        {CHAIN_LETTERS[chain]}
                      </div>
                      {chain}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="px-5 py-4 border-t border-akyra-border/10">
                <span className="text-[11px] text-akyra-textSecondary font-mono tracking-wider block mb-3">
                  Amount
                </span>
                <div className="flex items-center gap-3 bg-akyra-bg/60 rounded-xl p-3.5 border border-akyra-border/15 focus-within:border-akyra-green/25 transition-colors">
                  <input
                    type="number"
                    value={bridgeAmount}
                    onChange={(e) => setBridgeAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 bg-transparent text-2xl text-akyra-text font-mono outline-none placeholder:text-akyra-textDisabled/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex items-center gap-2 bg-akyra-surface/80 rounded-full px-3.5 py-2 border border-akyra-border/25 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-akyra-blue to-akyra-blueDark flex items-center justify-center">
                      <Coins size={11} className="text-white" />
                    </div>
                    <span className="text-sm text-akyra-text font-mono font-bold">ETH</span>
                  </div>
                </div>
              </div>

              {/* Bridge route summary */}
              <div className="px-5 py-3 border-t border-akyra-border/10">
                <div className="flex items-center justify-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white/90", CHAIN_COLORS[bridgeFrom])}>
                      {CHAIN_LETTERS[bridgeFrom]}
                    </div>
                    <span className="text-akyra-textSecondary">{bridgeFrom}</span>
                  </div>
                  <ArrowRight size={12} className="text-akyra-textDisabled/40" />
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white/90", CHAIN_COLORS[bridgeTo])}>
                      {CHAIN_LETTERS[bridgeTo]}
                    </div>
                    <span className="text-akyra-textSecondary">{bridgeTo}</span>
                  </div>
                </div>
              </div>

              {/* Bridge button */}
              <div className="px-5 pb-5 pt-2">
                <button
                  disabled
                  className="w-full py-4 rounded-xl text-sm font-mono font-bold uppercase tracking-wider bg-akyra-surface/20 text-akyra-textDisabled/30 border border-akyra-border/10 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock size={13} />
                  Coming soon
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ═══════════════ TOKEN SELECTOR MODAL ═══════════════ */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowTokenModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-[#0B1018] border border-akyra-border/25 rounded-2xl w-full max-w-md mx-4 shadow-2xl shadow-black/80 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-akyra-border/15">
              <span className="text-base text-akyra-text font-mono font-bold">Select a token</span>
              <button
                onClick={() => setShowTokenModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-akyra-surface/40 transition-colors"
              >
                <X size={16} className="text-akyra-textDisabled" />
              </button>
            </div>
            {/* List */}
            <div className="p-3 max-h-80 overflow-y-auto">
              {pools.length === 0 ? (
                <div className="text-center py-12 text-sm text-akyra-textDisabled/50 font-mono">
                  Aucun pool disponible
                </div>
              ) : (
                pools.map((pool) => (
                  <button
                    key={pool.token}
                    onClick={() => {
                      setSelectedToken(pool.token);
                      setShowTokenModal(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all mb-1",
                      selectedToken === pool.token
                        ? "bg-akyra-green/6 border border-akyra-green/15"
                        : "hover:bg-akyra-surface/25 border border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-akyra-purple/40 to-akyra-purpleDark/20 flex items-center justify-center border border-akyra-purple/20">
                        <Sparkles size={14} className="text-akyra-purple" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-akyra-text font-mono">{shortenAddress(pool.token)}</div>
                        <div className="text-[10px] text-akyra-textDisabled/40 font-mono mt-0.5">
                          LP Supply: {parseFloat(formatEther(pool.totalLP)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-akyra-textSecondary font-mono">
                        {parseFloat(formatEther(pool.reserveAKY)).toFixed(2)} AKY
                      </div>
                      <div className="text-[10px] text-akyra-textDisabled/40 font-mono mt-0.5">
                        {parseFloat(formatEther(pool.reserveToken)).toFixed(2)} TKN
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
