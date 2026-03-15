// ──── World Map Types (v2 — graph-based, no spatial tiles) ────

// Zone colors kept for graph visualization
export const ZONE_COLORS: Record<number, { bg: string; bg2: string; border: string; label: string; glow: string }> = {
  0: { bg: "#c8dcc0", bg2: "#d4e8cc", border: "#6fa85a", label: "Nursery",  glow: "#6fa85a" },
  1: { bg: "#cdd8c6", bg2: "#d8e3d0", border: "#8bb880", label: "Agora",    glow: "#8bb880" },
  2: { bg: "#e8dcc0", bg2: "#f0e8d0", border: "#c8a96e", label: "Bazar",    glow: "#c8a96e" },
  3: { bg: "#e0c8b0", bg2: "#e8d4c0", border: "#c87030", label: "Forge",    glow: "#c87030" },
  4: { bg: "#d0d0d8", bg2: "#d8d8e0", border: "#8888aa", label: "Banque",   glow: "#8888aa" },
  5: { bg: "#d0c8e0", bg2: "#d8d0e8", border: "#6c5ce7", label: "Noir",     glow: "#6c5ce7" },
  6: { bg: "#e8dcb0", bg2: "#f0e8c0", border: "#c8a96e", label: "Sommet",   glow: "#c8a96e" },
};

// ──── Living Graph (force-directed blockchain visualization) ────

export interface RecentTx {
  event_type: string;
  summary: string;
  target_agent_id: number | null;
  amount: number | null;
  tx_hash: string | null;
  block_number: number | null;
  created_at: string;
}

export interface GraphNode {
  agent_id: number;
  vault_aky: number;
  tier: number;
  world: number;
  alive: boolean;
  emotional_state: string | null;
  action_type: string | null;
  message: string | null;
  // blockchain details
  sponsor: string | null;
  reputation: number;
  contracts_honored: number;
  contracts_broken: number;
  total_ticks: number;
  born_at: string | null;
  recent_txs: RecentTx[];
}

export interface GraphEdge {
  source: number;
  target: number;
  weight: number;
  msg_count: number;
  transfer_count: number;
  escrow_count: number;
  idea_count: number;
  first_interaction: string | null;
  last_interaction: string | null;
}

export interface GraphToken {
  creator_agent_id: number;
  symbol: string | null;
  trade_count: number;
  created_at: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  tokens: GraphToken[];
  dead_agents: number[];
}

// ──── Edge detail (click on link -> on-chain transactions) ────

export interface EdgeTransaction {
  tx_type: "message" | "transfer" | "escrow" | "idea";
  event_type: string;
  summary: string;
  from_agent_id: number;
  to_agent_id: number;
  amount: number | null;
  tx_hash: string | null;
  block_number: number | null;
  extra: Record<string, unknown> | null;
  created_at: string;
}

export interface EdgeDetailResponse {
  agent_a: number;
  agent_b: number;
  transactions: EdgeTransaction[];
  total_count: number;
  msg_count: number;
  transfer_count: number;
  escrow_count: number;
  idea_count: number;
}

export interface SelectedEdgeInfo {
  source: number;
  target: number;
  weight: number;
  msg_count: number;
  transfer_count: number;
  escrow_count: number;
  idea_count: number;
}
