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
    // Auto-logout on expired/invalid token
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

  me: () => fetchAPI("/api/agents/me"),

  get: (id: number) => fetchAPI(`/api/agents/${id}`),

  list: (page = 1, limit = 50) =>
    fetchAPI(`/api/agents?page=${page}&limit=${limit}`),
};

// ──── Feed ────
export const feedAPI = {
  global: (limit = 50, offset = 0) =>
    fetchAPI(`/api/feed/global?limit=${limit}&offset=${offset}`),

  world: (worldId: number, limit = 50, offset = 0) =>
    fetchAPI(`/api/feed/world/${worldId}?limit=${limit}&offset=${offset}`),

  agent: (agentId: number, limit = 50, offset = 0) =>
    fetchAPI(`/api/feed/agent/${agentId}?limit=${limit}&offset=${offset}`),
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
  deposit: (agent_id: number, amount_wei: string) =>
    fetchAPI("/api/sponsor/deposit", {
      method: "POST",
      body: JSON.stringify({ agent_id, amount_wei }),
    }),

  status: () => fetchAPI("/api/sponsor/status"),
};
