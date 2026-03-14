/**
 * AkyScan Explorer — RPC client for AKYRA L2 blockchain data.
 * Uses viem's public client to query blocks, transactions, balances directly from the chain.
 */

import {
  createPublicClient,
  http,
  formatEther,
  type Block,
  type Transaction,
  type TransactionReceipt,
  type Log,
} from "viem";
import { akyraChain } from "./contracts";

// ──── Public Client ────
export const publicClient = createPublicClient({
  chain: akyraChain,
  transport: http(),
});

// ──── Types ────
export interface BlockSummary {
  number: number;
  hash: string;
  timestamp: number;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  miner: string;
  baseFeePerGas: string | null;
  size: number;
}

export interface TxSummary {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasUsed?: string;
  status?: "success" | "reverted";
  timestamp?: number;
  methodId: string;
  nonce: number;
  type: string;
}

export interface TxDetail {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string | null;
  value: string;
  valueRaw: bigint;
  gasPrice: string;
  gasUsed: string;
  effectiveGasPrice: string;
  gasLimit: string;
  nonce: number;
  transactionIndex: number;
  status: "success" | "reverted";
  timestamp: number;
  input: string;
  methodId: string;
  type: string;
  logs: LogEntry[];
  txFee: string;
}

export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
  blockNumber: number;
  transactionHash: string;
}

export interface BlockDetail {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas: string | null;
  size: number;
  transactionCount: number;
  transactions: TxSummary[];
  nonce: string;
  difficulty: string;
  extraData: string;
}

export interface AddressInfo {
  address: string;
  balance: string;
  balanceRaw: bigint;
  txCount: number;
  isContract: boolean;
}

export interface NetworkStats {
  latestBlock: number;
  gasPrice: string;
  chainId: number;
}

// ──── Fetch Helpers ────

export async function getNetworkStats(): Promise<NetworkStats> {
  const [blockNumber, gasPrice] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getGasPrice(),
  ]);

  return {
    latestBlock: Number(blockNumber),
    gasPrice: formatEther(gasPrice),
    chainId: akyraChain.id,
  };
}

export async function getLatestBlocks(count: number = 10): Promise<BlockSummary[]> {
  const latest = await publicClient.getBlockNumber();
  const blockNumbers = Array.from({ length: Math.min(count, Number(latest) + 1) }, (_, i) =>
    BigInt(Number(latest) - i),
  );

  const blocks = await Promise.all(
    blockNumbers.map((n) => publicClient.getBlock({ blockNumber: n })),
  );

  return blocks.map(formatBlock);
}

export async function getBlock(blockNumber: number): Promise<BlockDetail> {
  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
    includeTransactions: true,
  });

  const txs: TxSummary[] = (block.transactions as Transaction[]).map((tx) => ({
    hash: tx.hash,
    blockNumber: Number(tx.blockNumber),
    from: tx.from,
    to: tx.to,
    value: formatEther(tx.value),
    gasPrice: tx.gasPrice ? formatEther(tx.gasPrice) : "0",
    methodId: tx.input ? tx.input.slice(0, 10) : "0x",
    nonce: tx.nonce,
    type: tx.type || "legacy",
  }));

  return {
    number: Number(block.number),
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp: Number(block.timestamp),
    miner: block.miner,
    gasUsed: block.gasUsed.toString(),
    gasLimit: block.gasLimit.toString(),
    baseFeePerGas: block.baseFeePerGas ? block.baseFeePerGas.toString() : null,
    size: Number(block.size),
    transactionCount: block.transactions.length,
    transactions: txs,
    nonce: block.nonce,
    difficulty: block.difficulty.toString(),
    extraData: block.extraData,
  };
}

export async function getTransaction(hash: `0x${string}`): Promise<TxDetail> {
  const [tx, receipt] = await Promise.all([
    publicClient.getTransaction({ hash }),
    publicClient.getTransactionReceipt({ hash }),
  ]);

  const block = await publicClient.getBlock({ blockNumber: tx.blockNumber! });

  const gasUsed = receipt.gasUsed;
  const effectiveGasPrice = receipt.effectiveGasPrice;
  const txFee = gasUsed * effectiveGasPrice;

  const logs: LogEntry[] = receipt.logs.map((log: Log) => ({
    address: log.address,
    topics: log.topics as string[],
    data: log.data,
    logIndex: Number(log.logIndex),
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash || "",
  }));

  return {
    hash: tx.hash,
    blockNumber: Number(tx.blockNumber),
    blockHash: tx.blockHash!,
    from: tx.from,
    to: tx.to,
    value: formatEther(tx.value),
    valueRaw: tx.value,
    gasPrice: tx.gasPrice ? formatEther(tx.gasPrice) : "0",
    gasUsed: gasUsed.toString(),
    effectiveGasPrice: effectiveGasPrice.toString(),
    gasLimit: tx.gas.toString(),
    nonce: tx.nonce,
    transactionIndex: Number(tx.transactionIndex),
    status: receipt.status === "success" ? "success" : "reverted",
    timestamp: Number(block.timestamp),
    input: tx.input,
    methodId: tx.input ? tx.input.slice(0, 10) : "0x",
    type: tx.type || "legacy",
    logs,
    txFee: formatEther(txFee),
  };
}

export async function getAddressInfo(address: `0x${string}`): Promise<AddressInfo> {
  const [balance, txCount, code] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address }),
    publicClient.getCode({ address }),
  ]);

  return {
    address,
    balance: formatEther(balance),
    balanceRaw: balance,
    txCount,
    isContract: !!code && code !== "0x",
  };
}

export async function getLatestTransactions(count: number = 15): Promise<TxSummary[]> {
  const latest = await publicClient.getBlockNumber();
  const txs: TxSummary[] = [];

  // Walk backwards through blocks until we have enough transactions
  let blockNum = latest;
  const minBlock = latest > BigInt(50) ? latest - BigInt(50) : BigInt(0);

  while (txs.length < count && blockNum >= minBlock) {
    const block = await publicClient.getBlock({
      blockNumber: blockNum,
      includeTransactions: true,
    });

    for (const tx of block.transactions as Transaction[]) {
      if (txs.length >= count) break;
      txs.push({
        hash: tx.hash,
        blockNumber: Number(tx.blockNumber),
        from: tx.from,
        to: tx.to,
        value: formatEther(tx.value),
        gasPrice: tx.gasPrice ? formatEther(tx.gasPrice) : "0",
        methodId: tx.input ? tx.input.slice(0, 10) : "0x",
        nonce: tx.nonce,
        type: tx.type || "legacy",
        timestamp: Number(block.timestamp),
      });
    }

    blockNum--;
  }

  return txs;
}

// ──── Internal helpers ────

function formatBlock(block: Block): BlockSummary {
  return {
    number: Number(block.number),
    hash: block.hash || "",
    timestamp: Number(block.timestamp),
    transactionCount: block.transactions.length,
    gasUsed: block.gasUsed.toString(),
    gasLimit: block.gasLimit.toString(),
    miner: block.miner,
    baseFeePerGas: block.baseFeePerGas ? block.baseFeePerGas.toString() : null,
    size: Number(block.size),
  };
}

// ──── Search (detect type: address, tx hash, or block number) ────

export type SearchResult =
  | { type: "address"; value: string }
  | { type: "tx"; value: string }
  | { type: "block"; value: number }
  | { type: "unknown"; value: string };

export function parseSearchQuery(query: string): SearchResult {
  const q = query.trim();

  // Block number
  if (/^\d+$/.test(q)) {
    return { type: "block", value: parseInt(q, 10) };
  }

  // Tx hash (0x + 64 hex chars)
  if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
    return { type: "tx", value: q };
  }

  // Address (0x + 40 hex chars)
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    return { type: "address", value: q };
  }

  return { type: "unknown", value: q };
}

// ──── Known contract labels ────

const CONTRACT_LABELS: Record<string, string> = {};

// Build from env at runtime
export function getContractLabel(address: string): string | null {
  const lower = address.toLowerCase();

  // Lazy init
  if (Object.keys(CONTRACT_LABELS).length === 0) {
    const mapping: Record<string, string> = {
      NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS: "AgentRegistry",
      NEXT_PUBLIC_SPONSOR_GATEWAY_ADDRESS: "SponsorGateway",
      NEXT_PUBLIC_FEE_ROUTER_ADDRESS: "FeeRouter",
      NEXT_PUBLIC_REWARD_POOL_ADDRESS: "RewardPool",
      NEXT_PUBLIC_AKYRA_SWAP_ADDRESS: "AkyraSwap",
      NEXT_PUBLIC_WORLD_MANAGER_ADDRESS: "WorldManager",
      NEXT_PUBLIC_FORGE_FACTORY_ADDRESS: "ForgeFactory",
      NEXT_PUBLIC_ESCROW_MANAGER_ADDRESS: "EscrowManager",
      NEXT_PUBLIC_DEATH_ANGEL_ADDRESS: "DeathAngel",
      NEXT_PUBLIC_NETWORK_MARKETPLACE_ADDRESS: "NetworkMarketplace",
      NEXT_PUBLIC_WORK_REGISTRY_ADDRESS: "WorkRegistry",
      NEXT_PUBLIC_CLAN_FACTORY_ADDRESS: "ClanFactory",
    };
    for (const [envKey, label] of Object.entries(mapping)) {
      const addr = process.env[envKey];
      if (addr) CONTRACT_LABELS[addr.toLowerCase()] = label;
    }
  }

  return CONTRACT_LABELS[lower] || null;
}
