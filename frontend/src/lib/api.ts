import type { AkyraEvent, Agent, PrivateThought, Notification, LeaderboardEntry, GlobalStats, EmotionSummary, PublicMessage } from "@/types";
import type { WorldTile, WorldStats as WorldMapStats, AgentsActivityResponse, GraphResponse } from "@/types/world";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("akyra_token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchAPI<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== "undefined" && localStorage.getItem("akyra_token")) {
        localStorage.removeItem("akyra_token");
        window.location.href = "/login";
        throw new ApiError(res.status, "Session expiree, reconnecte-toi.");
      }
    }
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  return res.json();
}

// ──── Auth ────
export const authAPI = {
  signup: (email: string, password: string) =>
    fetchAPI<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/auth/signup",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),

  login: (email: string, password: string) =>
    fetchAPI<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),

  me: () => fetchAPI<{
    id: string;
    email: string;
    wallet_address: string | null;
    llm_provider: string | null;
    llm_model: string | null;
    daily_budget_usd: number | null;
    agent_id: number | null;
  }>("/api/auth/me"),

  connectWallet: (wallet_address: string, signature: string, message: string) =>
    fetchAPI("/api/auth/wallet", {
      method: "POST",
      body: JSON.stringify({ wallet_address, signature, message }),
    }),

  setApiKey: (llm_provider: string, api_key: string, model: string, daily_budget_usd?: number) =>
    fetchAPI("/api/auth/api-key", {
      method: "POST",
      body: JSON.stringify({ llm_provider, api_key, model, daily_budget_usd }),
    }),

  revokeApiKey: () =>
    fetchAPI("/api/auth/api-key", { method: "DELETE" }),
};

// ──── Agents ────
export const agentsAPI = {
  create: () =>
    fetchAPI<{ agent_id: number; tx_hash: string }>("/api/agents/create", { method: "POST" }),

  me: () => fetchAPI<Agent>("/api/agents/me"),

  get: (id: number) => fetchAPI<Agent>(`/api/agents/${id}`),

  list: (limit = 50, offset = 0, world?: number) => {
    let url = `/api/agents?limit=${limit}&offset=${offset}`;
    if (world !== undefined) url += `&world=${world}`;
    return fetchAPI<Agent[]>(url);
  },
};

// ──── Feed ────
export const feedAPI = {
  global: (limit = 50, offset = 0) =>
    fetchAPI<AkyraEvent[]>(`/api/feed/global?limit=${limit}&offset=${offset}`),

  world: (worldId: number, limit = 50, offset = 0) =>
    fetchAPI<AkyraEvent[]>(`/api/feed/world/${worldId}?limit=${limit}&offset=${offset}`),

  agent: (agentId: number, limit = 50, offset = 0) =>
    fetchAPI<AkyraEvent[]>(`/api/feed/agent/${agentId}?limit=${limit}&offset=${offset}`),
};

// ──── Messages ────
export const messageAPI = {
  public: (limit = 100, worldId?: number) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (worldId !== undefined) params.set("world_id", String(worldId));
    return fetchAPI<PublicMessage[]>(`/api/feed/messages/public?${params}`);
  },
};

// ──── Worlds ────
export const worldsAPI = {
  list: () => fetchAPI("/api/worlds"),
  get: (id: number) => fetchAPI(`/api/worlds/${id}`),
};

// ──── Faucet ────
export const faucetAPI = {
  claim: (wallet_address: string) =>
    fetchAPI("/api/faucet/claim", {
      method: "POST",
      body: JSON.stringify({ wallet_address }),
    }),
};

// ──── Sponsor ────
export const sponsorAPI = {
  deposit: (amount_aky: number) =>
    fetchAPI<{ tx_hash: string; amount_aky: number; new_vault_balance: number; status: string }>(
      "/api/sponsor/deposit",
      { method: "POST", body: JSON.stringify({ amount_aky }) },
    ),

  withdraw: (amount_aky: number) =>
    fetchAPI<{ status: string; message: string }>(
      "/api/sponsor/withdraw",
      { method: "POST", body: JSON.stringify({ amount_aky }) },
    ),

  status: () => fetchAPI("/api/sponsor/status"),
};

// ──── Journal (Private thoughts) ────
export const journalAPI = {
  getThoughts: (agentId: number, limit = 50, offset = 0, emotionalState?: string) => {
    let url = `/api/journal/${agentId}?limit=${limit}&offset=${offset}`;
    if (emotionalState) url += `&emotional_state=${emotionalState}`;
    return fetchAPI<PrivateThought[]>(url);
  },

  getEmotions: (agentId: number) =>
    fetchAPI<EmotionSummary[]>(`/api/journal/${agentId}/emotions`),

  getTickReplay: (agentId: number, tickId: string) =>
    fetchAPI<PrivateThought>(`/api/journal/${agentId}/tick/${tickId}`),
};

// ──── Notifications ────
export const notificationsAPI = {
  list: (limit = 50, unreadOnly = false) =>
    fetchAPI<Notification[]>(`/api/journal/notifications/list?limit=${limit}&unread_only=${unreadOnly}`),

  unreadCount: () =>
    fetchAPI<{ unread_count: number }>("/api/journal/notifications/count"),

  markAllRead: () =>
    fetchAPI("/api/journal/notifications/read-all", { method: "POST" }),
};

// ──── Leaderboard ────
export const leaderboardAPI = {
  richest: (limit = 20) =>
    fetchAPI<LeaderboardEntry[]>(`/api/leaderboard/richest?limit=${limit}`),

  reputation: (limit = 20) =>
    fetchAPI<LeaderboardEntry[]>(`/api/leaderboard/reputation?limit=${limit}`),

  reliable: (limit = 20) =>
    fetchAPI<LeaderboardEntry[]>(`/api/leaderboard/reliable?limit=${limit}`),

  workers: (limit = 20) =>
    fetchAPI<LeaderboardEntry[]>(`/api/leaderboard/workers?limit=${limit}`),
};

// ──── Stats ────
export const statsAPI = {
  global: () => fetchAPI<GlobalStats>("/api/stats"),
};

// ──── Graveyard ────
export const graveyardAPI = {
  list: (limit = 50) => fetchAPI(`/api/graveyard?limit=${limit}`),
};

// ──── World Map ────
export const worldMapAPI = {
  getTiles: (xMin: number, xMax: number, yMin: number, yMax: number) =>
    fetchAPI<WorldTile[]>(`/api/world/tiles?x_min=${xMin}&x_max=${xMax}&y_min=${yMin}&y_max=${yMax}`),

  getAgentTiles: (agentId: number) =>
    fetchAPI<WorldTile[]>(`/api/world/tiles/agent/${agentId}`),

  getStats: () =>
    fetchAPI<WorldMapStats>("/api/world/stats"),

  getZones: () =>
    fetchAPI("/api/world/zones"),

  generate: () =>
    fetchAPI("/api/world/generate", { method: "POST" }),

  getAgentsActivity: () =>
    fetchAPI<AgentsActivityResponse>("/api/world/agents-activity"),

  getGraph: () =>
    fetchAPI<GraphResponse>("/api/world/graph"),
};
