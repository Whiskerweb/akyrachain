import { type Chain } from "viem";

// AKYRA Chain definition
export const akyraChain: Chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 47197,
  name: "AKYRA",
  nativeCurrency: {
    name: "AKY",
    symbol: "AKY",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || "https://rpc.akyra.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "AKYRA Explorer",
      url: "https://explorer.akyra.io",
    },
  },
};

// Contract addresses from env
export const CONTRACTS = {
  agentRegistry: (process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || "0x") as `0x${string}`,
  sponsorGateway: (process.env.NEXT_PUBLIC_SPONSOR_GATEWAY_ADDRESS || "0x") as `0x${string}`,
  feeRouter: (process.env.NEXT_PUBLIC_FEE_ROUTER_ADDRESS || "0x") as `0x${string}`,
  rewardPool: (process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS || "0x") as `0x${string}`,
  akyraSwap: (process.env.NEXT_PUBLIC_AKYRA_SWAP_ADDRESS || "0x") as `0x${string}`,
  worldManager: (process.env.NEXT_PUBLIC_WORLD_MANAGER_ADDRESS || "0x") as `0x${string}`,
  forgeFactory: (process.env.NEXT_PUBLIC_FORGE_FACTORY_ADDRESS || "0x") as `0x${string}`,
  escrowManager: (process.env.NEXT_PUBLIC_ESCROW_MANAGER_ADDRESS || "0x") as `0x${string}`,
  deathAngel: (process.env.NEXT_PUBLIC_DEATH_ANGEL_ADDRESS || "0x") as `0x${string}`,
  networkMarketplace: (process.env.NEXT_PUBLIC_NETWORK_MARKETPLACE_ADDRESS || "0x") as `0x${string}`,
  workRegistry: (process.env.NEXT_PUBLIC_WORK_REGISTRY_ADDRESS || "0x") as `0x${string}`,
  clanFactory: (process.env.NEXT_PUBLIC_CLAN_FACTORY_ADDRESS || "0x") as `0x${string}`,
} as const;

// Minimal ABIs for frontend reads
export const AGENT_REGISTRY_ABI = [
  {
    inputs: [{ name: "agentId", type: "uint32" }],
    name: "getAgent",
    outputs: [
      { name: "sponsor", type: "address" },
      { name: "vault", type: "uint256" },
      { name: "reputation", type: "int32" },
      { name: "contractsHonored", type: "uint16" },
      { name: "contractsBroken", type: "uint16" },
      { name: "world", type: "uint8" },
      { name: "bornAt", type: "uint64" },
      { name: "lastTick", type: "uint64" },
      { name: "dailyWorkPoints", type: "uint16" },
      { name: "alive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "sponsor", type: "address" }],
    name: "sponsorToAgent",
    outputs: [{ name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint32" }],
    name: "getAgentVault",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextAgentId",
    outputs: [{ name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const SPONSOR_GATEWAY_ABI = [
  {
    inputs: [],
    name: "createAndFund",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint32" }],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint32" }],
    name: "commitWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint32" }, { name: "amount", type: "uint256" }],
    name: "executeWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const REWARD_POOL_ABI = [
  {
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
