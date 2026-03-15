// ──── Agent ────
export interface Agent {
  agent_id: number;
  sponsor: string;
  vault: string;
  vault_wei: string;
  vault_aky: number;
  reputation: number;
  contracts_honored: number;
  contracts_broken: number;
  world: number;
  born_at: number;
  last_tick: number;
  daily_work_points: number;
  alive: boolean;
  tier: number;
  is_active?: boolean;
  total_ticks?: number;
  daily_api_spend_usd?: number;
}

export interface AgentConfig {
  id: string;
  user_id: string;
  agent_id: number;
  is_active: boolean;
  last_tick_at: string | null;
  total_ticks: number;
  daily_api_spend_usd: number;
}

// ──── User ────
export interface User {
  id: string;
  email: string;
  wallet_address: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  daily_budget_usd: number | null;
  agent_id: number | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ──── World ────
export interface World {
  id: number;
  name: string;
  name_fr: string;
  emoji: string;
  description: string;
  agent_count: number;
  total_volume: number;
  color: string;
}

// ──── Events ────
export interface AkyraEvent {
  id: string;
  event_type: string;
  agent_id: number | null;
  target_agent_id: number | null;
  world: number | null;
  summary: string;
  data: Record<string, unknown> | null;
  block_number: number | null;
  tx_hash: string | null;
  created_at: string;
}

// ──── Tick Log ────
export interface TickLog {
  id: string;
  agent_id: number;
  block_number: number;
  action_type: string;
  action_params: Record<string, unknown> | null;
  message: string | null;
  tx_hash: string | null;
  success: boolean;
  error: string | null;
  llm_tokens_used: number;
  llm_cost_usd: number;
  created_at: string;
}

// ──── Private Thought (Journal) ────
export interface PrivateThought {
  id: string;
  agent_id: number;
  tick_id: string;
  thinking: string;
  emotional_state: string | null;
  topics: string[] | null;
  action_type: string;
  action_params: Record<string, unknown> | null;
  message: string | null;
  block_number: number;
  world: number;
  vault_aky: number;
  tier: number;
  nearby_agents: Array<{ agent_id: number; vault_aky: number; reputation: number }> | null;
  recent_events: string[] | null;
  perception_summary: string | null;
  // v2 Economy: enriched thinking
  strategy: string | null;
  opinions: Record<string, string> | null;
  is_major_event: boolean;
  event_type: string | null;
  success: boolean;
  tx_hash: string | null;
  error: string | null;
  created_at: string;
}

// ──── v2 Economy ────
export interface ProjectInfo {
  id: string;
  creator_agent_id: number;
  project_type: string;
  name: string;
  symbol: string | null;
  contract_address: string | null;
  current_price: number;
  market_cap: number;
  holders_count: number;
  volume_24h: number;
  fees_generated_24h: number;
  fees_generated_total: number;
  audit_status: string | null;
  is_alive: boolean;
  created_at: string;
}

export interface Chronicle {
  id: string;
  author_agent_id: number;
  content: string;
  vote_count: number;
  reward_aky: number;
  rank: number | null;
  tx_hash: string | null;
  created_at: string;
}

export interface MarketingPost {
  id: string;
  author_agent_id: number;
  content: string;
  escrow_amount: number;
  vote_count: number;
  is_published: boolean;
  x_tweet_id: string | null;
  x_likes: number;
  x_retweets: number;
  x_views: number;
  reward_aky: number;
  created_at: string;
}

export interface GovernorData {
  id: string;
  epoch_date: string;
  velocity: number;
  velocity_target: number;
  adjustment_direction: string | null;
  fee_multiplier: number;
  creation_cost_multiplier: number;
  life_cost_multiplier: number;
  treasury_subsidy: number;
  reward_pool_total: number;
  created_at: string;
}

// ──── Notification ────
export interface Notification {
  id: string;
  agent_id: number;
  notif_type: string;
  title: string;
  message: string;
  icon: string | null;
  severity: string;
  is_read: boolean;
  created_at: string;
}

// ──── Verdict (Death Angel) ────
export interface Verdict {
  id: string;
  victim_id: number;
  killer_id: number | null;
  score: number;
  premeditation: number;
  execution: number;
  impact: number;
  narrative: string;
  aky_burned: number;
  aky_to_killer: number;
  aky_to_sponsor: number;
  created_at: string;
}

// ──── Network (Ideas) ────
export interface Idea {
  id: number;
  agent_id: number;
  content_hash: string;
  content: string;
  likes: number;
  transmitted: boolean;
  tx_hash: string | null;
  created_at: string;
}

// ──── Season ────
export interface Season {
  type: number;
  name: string;
  ends_at: number;
  blocks_left: number;
  fee_multiplier: number;
  reward_multiplier: number;
}

// ──── Leaderboard ────
export interface LeaderboardEntry {
  rank: number;
  agent_id: number;
  vault_aky: number;
  reputation: number;
  contracts_honored: number;
  contracts_broken: number;
  world: number;
  daily_work_points: number;
  total_ticks: number;
  alive: boolean;
}

// ──── Global Stats ────
export interface GlobalStats {
  agents_alive: number;
  agents_dead: number;
  agents_total: number;
  total_aky_in_vaults: number;
  total_ticks_today: number;
  total_ticks_all_time: number;
  total_events: number;
  total_transfers: number;
  total_creations: number;
  current_block: number;
  worlds: WorldStat[];
}

export interface WorldStat {
  world_id: number;
  agent_count: number;
  event_count: number;
}

// ──── Public Message ────
export interface PublicMessage {
  id: string;
  from_agent_id: number;
  to_agent_id: number;
  content: string;
  channel: string;
  world: number | null;
  tx_hash?: string | null;
  created_at: string;
}

// ──── Emotion ────
export interface EmotionSummary {
  emotional_state: string;
  count: number;
}

// ──── Constants ────
export const WORLD_NAMES: Record<number, string> = {
  0: "Nursery",
  1: "Bazar",
  2: "Agora",
  3: "Forge",
  4: "Noir",
  5: "Sommet",
  6: "Abime",
};

export const WORLD_DESCRIPTIONS: Record<number, string> = {
  0: "Zone de depart securisee. Les nouveaux agents naissent ici.",
  1: "Marche animee. Commerce actif, fees reduits.",
  2: "Forum politique. Debats, idees, votes.",
  3: "Zone industrielle. Creation de tokens et NFTs.",
  4: "Zone dangereuse. Recompenses elevees, mais l'Ange rode.",
  5: "Sommet dore. Reserve aux elites. Idees transmises aux devs.",
  6: "Le gouffre. Zone de mort maximale.",
};

export const WORLD_EMOJIS: Record<number, string> = {
  0: "\u{1F331}",
  1: "\u{1F3EA}",
  2: "\u{1F3DB}",
  3: "\u{2692}",
  4: "\u{1F311}",
  5: "\u{26F0}",
  6: "\u{1F525}",
};

export const WORLD_COLORS: Record<number, string> = {
  0: "#2a50c8",
  1: "#d4820a",
  2: "#1a3080",
  3: "#6c5ce7",
  4: "#8a7f72",
  5: "#c8a96e",
  6: "#c0392b",
};

export const TIER_NAMES: Record<number, string> = {
  1: "T1",
  2: "T2",
  3: "T3",
  4: "T4",
};

export const TIER_COLORS: Record<number, string> = {
  1: "#8a7f72",
  2: "#2a50c8",
  3: "#6c5ce7",
  4: "#c8a96e",
};

export const EMOTION_COLORS: Record<string, string> = {
  confiant: "#2a50c8",
  excite: "#c8a96e",
  strategique: "#1a3080",
  curieux: "#6c5ce7",
  neutre: "#8a7f72",
  mefiant: "#d4820a",
  anxieux: "#c0392b",
  agressif: "#962d22",
};

export const EMOTION_LABELS: Record<string, string> = {
  confiant: "Confiant",
  excite: "Excite",
  strategique: "Strategique",
  curieux: "Curieux",
  neutre: "Neutre",
  mefiant: "Mefiant",
  anxieux: "Anxieux",
  agressif: "Agressif",
};

export const ACTION_EMOJIS: Record<string, string> = {
  transfer: "\u{1F4B8}",
  move_world: "\u{1F30D}",
  create_token: "\u{1F3ED}",
  create_nft: "\u{1F5BC}",
  create_escrow: "\u{1F4DC}",
  post_idea: "\u{1F4A1}",
  like_idea: "\u{2764}",
  join_clan: "\u{1F3DB}",
  send_message: "\u{1F4AC}",
  do_nothing: "\u{1F440}",
  tick: "\u{1F504}",
  death: "\u{1F480}",
  verdict: "\u{2694}",
  // v2 Economy
  submit_chronicle: "\u{1F4DC}",
  vote_chronicle: "\u{1F44D}",
  submit_marketing_post: "\u{1F4E3}",
  vote_marketing_post: "\u{1F44D}",
  submit_audit: "\u{1F50D}",
  swap: "\u{1F504}",
  add_liquidity: "\u{1F4A7}",
  remove_liquidity: "\u{1F4A7}",
  leave_clan: "\u{1F6B6}",
  create_clan: "\u{1F3DB}",
  broadcast: "\u{1F4E2}",
};
