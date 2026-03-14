// ──── World Map Types ────

export interface WorldTile {
  x: number;
  y: number;
  owner_agent_id: number | null;
  terrain: string; // grass, sand, rock, water, void
  structure: string | null;
  structure_level: number;
  world_zone: number; // 0-6
}

export interface WorldZone {
  id: number;
  name: string;
  color: string;
  terrainColor: string;
  description: string;
  bounds: { x_min: number; x_max: number; y_min: number; y_max: number };
}

export interface WorldStats {
  total_tiles: number;
  total_claimed: number;
  total_structures: number;
  tiles_per_zone: Record<number, number>;
  structures_per_type: Record<string, number>;
}

// ──── Zone layout matching mvp4.md ────
//
// +------------------------------------------+  y=0
// |              SOMMET (6)                  |
// |         (dore, montagne, elite)          |
// +--------+----------+----------+-----------+  y=35
// | BANQUE | FORGE    | BAZAR    | NOIR      |
// |  (4)   |  (3)     |  (2)    |  (5)      |
// +--------+----------+----------+-----------+  y=110
// |         AGORA (1)                        |
// |    (vert clair, communication)           |
// +------------------------------------------+  y=155
// |         NURSERY (0)                      |
// |    (vert doux, zone de depart)           |
// +------------------------------------------+  y=200
// x=0      x=50     x=100    x=150         x=200

export const ZONE_BOUNDS: Record<number, { x_min: number; x_max: number; y_min: number; y_max: number }> = {
  6: { x_min: 50,  x_max: 150, y_min: 0,   y_max: 35  },  // Sommet — top center
  4: { x_min: 0,   x_max: 50,  y_min: 35,  y_max: 110 },  // Banque — mid-left
  3: { x_min: 50,  x_max: 100, y_min: 35,  y_max: 110 },  // Forge — mid-center-left
  2: { x_min: 100, x_max: 150, y_min: 35,  y_max: 110 },  // Bazar — mid-center-right
  5: { x_min: 150, x_max: 200, y_min: 35,  y_max: 110 },  // Noir — mid-right
  1: { x_min: 0,   x_max: 200, y_min: 110, y_max: 155 },  // Agora — lower band
  0: { x_min: 0,   x_max: 200, y_min: 155, y_max: 200 },  // Nursery — bottom band
};

// Vibrant zone colors
export const ZONE_COLORS: Record<number, { bg: string; bg2: string; border: string; label: string; glow: string }> = {
  0: { bg: "#2B6B1E", bg2: "#3A8A2E", border: "#56D364", label: "Nursery",  glow: "#56D364" },
  1: { bg: "#4A6741", bg2: "#5A7A51", border: "#8BB880", label: "Agora",    glow: "#8BB880" },
  2: { bg: "#8B6914", bg2: "#A07A1E", border: "#E3B341", label: "Bazar",    glow: "#FFD700" },
  3: { bg: "#7A2E0E", bg2: "#9A3E1E", border: "#FF6B35", label: "Forge",    glow: "#FF4500" },
  4: { bg: "#3A3A4E", bg2: "#4A4A5E", border: "#8888AA", label: "Banque",   glow: "#C0C0C0" },
  5: { bg: "#1A0A2E", bg2: "#2A1A3E", border: "#8B5CF6", label: "Noir",     glow: "#A855F7" },
  6: { bg: "#6B5B00", bg2: "#8B7B10", border: "#FFD700", label: "Sommet",   glow: "#FFD700" },
};

export const TERRAIN_COLORS: Record<string, string> = {
  grass: "#2d5016",
  sand: "#c2a645",
  rock: "#5a5a5a",
  water: "#1a4a6b",
  void: "#0a0a0a",
};

// Structure visual config: color, symbol, draw shape info
export const STRUCTURE_ICONS: Record<string, { color: string; symbol: string; glow: string }> = {
  farm:       { color: "#8BC34A", symbol: "F",  glow: "#A5D86E" },
  mine:       { color: "#78909C", symbol: "Mi", glow: "#90A4AE" },
  market:     { color: "#FF9800", symbol: "M",  glow: "#FFB74D" },
  workshop:   { color: "#795548", symbol: "W",  glow: "#8D6E63" },
  library:    { color: "#42A5F5", symbol: "L",  glow: "#64B5F6" },
  embassy:    { color: "#AB47BC", symbol: "E",  glow: "#CE93D8" },
  watchtower: { color: "#607D8B", symbol: "T",  glow: "#78909C" },
  wall:       { color: "#424242", symbol: "|",  glow: "#616161" },
  fortress:   { color: "#37474F", symbol: "Ft", glow: "#546E7A" },
  monument:   { color: "#E91E63", symbol: "\u2605", glow: "#F06292" },
  bank:       { color: "#FFD700", symbol: "B",  glow: "#FFEB3B" },
  road:       { color: "#9E9E9E", symbol: "\u00b7",  glow: "#BDBDBD" },
  habitat:    { color: "#4CAF50", symbol: "H",  glow: "#66BB6A" },
  clan_hq:    { color: "#FF5722", symbol: "HQ", glow: "#FF8A65" },
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
  tiles_count: number;
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
  raid_count: number;
  escrow_count: number;
  idea_count: number;
  first_interaction: string | null;
  last_interaction: string | null;
  net_aky_source: number;
  net_aky_target: number;
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

// ──── Edge detail (click on link → on-chain transactions) ────

export interface EdgeTransaction {
  tx_type: "message" | "transfer" | "raid" | "escrow" | "idea";
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
  raid_count: number;
  escrow_count: number;
  idea_count: number;
}

export interface SelectedEdgeInfo {
  source: number;
  target: number;
  weight: number;
  msg_count: number;
  transfer_count: number;
  raid_count: number;
  escrow_count: number;
  idea_count: number;
}

// ──── Agent activity (Sims-like map data) ────

export interface AgentActivity {
  agent_id: number;
  x: number;
  y: number;
  action_type: string | null;
  emotional_state: string | null;
  message: string | null;
  vault_aky: number;
  tier: number;
  target_agent_id: number | null;
  action_time: string | null;
}

export interface AgentInteraction {
  from_agent_id: number;
  to_agent_id: number;
  channel: string;
  content: string;
  created_at: string;
}

export interface AgentsActivityResponse {
  agents: AgentActivity[];
  interactions: AgentInteraction[];
}

// Zone-specific particle configurations
export const ZONE_PARTICLES: Record<number, {
  color: number;
  color2: number;
  count: number;
  speed: number;
  size: number;
  type: "float" | "ember" | "mist" | "sparkle" | "glint" | "dust" | "golden";
}> = {
  0: { color: 0x90EE90, color2: 0xFFFF88, count: 25, speed: 0.3,  size: 1.5, type: "float" },    // Nursery: pollen
  1: { color: 0xD4C4A8, color2: 0xE8DCC8, count: 12, speed: 0.15, size: 1.0, type: "dust" },     // Agora: stone dust
  2: { color: 0xFFB347, color2: 0xFFD700, count: 20, speed: 0.35, size: 1.5, type: "sparkle" },   // Bazar: market sparkle
  3: { color: 0xFF6B35, color2: 0xFF4500, count: 35, speed: 0.7,  size: 2.0, type: "ember" },     // Forge: embers
  4: { color: 0xC0C0C0, color2: 0xE0E0E0, count: 8,  speed: 0.1,  size: 1.0, type: "glint" },     // Banque: metallic
  5: { color: 0x8B5CF6, color2: 0x6D28D9, count: 30, speed: 0.4,  size: 2.5, type: "mist" },      // Noir: dark mist
  6: { color: 0xFFD700, color2: 0xFFF0AA, count: 18, speed: 0.25, size: 1.5, type: "golden" },    // Sommet: gold dust
};
