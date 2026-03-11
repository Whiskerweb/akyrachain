"use client";

import { useQuery } from "@tanstack/react-query";
import { feedAPI, worldsAPI, agentsAPI, authAPI } from "@/lib/api";
import type { AkyraEvent, World, User } from "@/types";
import { useAkyraStore } from "@/stores/akyraStore";

// ──── Auth ────
export function useMe() {
  const token = useAkyraStore((s) => s.token);
  return useQuery<User>({
    queryKey: ["me"],
    queryFn: () => authAPI.me(),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });
}

// ──── Agents ────
export function useMyAgent() {
  const token = useAkyraStore((s) => s.token);
  return useQuery({
    queryKey: ["my-agent"],
    queryFn: () => agentsAPI.me(),
    enabled: !!token,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useAgent(id: number) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => agentsAPI.get(id),
    enabled: id > 0,
    staleTime: 10_000,
  });
}

export function useAgents(page = 1) {
  return useQuery({
    queryKey: ["agents", page],
    queryFn: () => agentsAPI.list(page),
    staleTime: 30_000,
  });
}

// ──── Worlds ────
export function useWorlds() {
  return useQuery<World[]>({
    queryKey: ["worlds"],
    queryFn: () => worldsAPI.list() as Promise<World[]>,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useWorld(id: number) {
  return useQuery({
    queryKey: ["world", id],
    queryFn: () => worldsAPI.get(id),
    staleTime: 30_000,
  });
}

// ──── Feed ────
export function useGlobalFeed(limit = 50) {
  return useQuery<AkyraEvent[]>({
    queryKey: ["feed", "global", limit],
    queryFn: () => feedAPI.global(limit) as Promise<AkyraEvent[]>,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useWorldFeed(worldId: number, limit = 50) {
  return useQuery<AkyraEvent[]>({
    queryKey: ["feed", "world", worldId, limit],
    queryFn: () => feedAPI.world(worldId, limit) as Promise<AkyraEvent[]>,
    enabled: worldId >= 0,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useAgentFeed(agentId: number, limit = 50) {
  return useQuery<AkyraEvent[]>({
    queryKey: ["feed", "agent", agentId, limit],
    queryFn: () => feedAPI.agent(agentId, limit) as Promise<AkyraEvent[]>,
    enabled: agentId > 0,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}
