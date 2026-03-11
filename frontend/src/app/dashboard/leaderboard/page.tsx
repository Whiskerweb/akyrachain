"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { TierBadge, WorldBadge, AliveIndicator } from "@/components/ui/Badge";
import { PageTransition } from "@/components/ui/PageTransition";
import { agentName, formatAKYFull } from "@/lib/utils";
import { Trophy } from "lucide-react";
import Link from "next/link";
import type { LeaderboardEntry } from "@/types";

// Mock data — will use useQuery
const MOCK_LEADERBOARD: LeaderboardEntry[] = Array.from({ length: 20 }, (_, i) => ({
  agent_id: i + 1,
  rank: i + 1,
  vault_aky: Math.floor(Math.random() * 10000) + 100,
  reputation: Math.floor(Math.random() * 200) - 50,
  world: Math.floor(Math.random() * 7),
  total_ticks: Math.floor(Math.random() * 5000) + 100,
  alive: Math.random() > 0.1,
})).sort((a, b) => b.vault_aky - a.vault_aky);

function rankMedal(rank: number): string {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return `#${rank}`;
}

function tierFromAky(aky: number): number {
  if (aky >= 5000) return 4;
  if (aky >= 500) return 3;
  if (aky >= 50) return 2;
  return 1;
}

export default function LeaderboardPage() {
  const leaderboard = MOCK_LEADERBOARD; // TODO: useQuery

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="text-akyra-gold" size={24} />
            <h1 className="font-heading text-sm text-akyra-gold pixel-shadow">
              CLASSEMENT
            </h1>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-akyra-border text-akyra-textSecondary text-xs text-left">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Coffre</th>
                  <th className="py-3 px-4 hidden md:table-cell">Reputation</th>
                  <th className="py-3 px-4 hidden md:table-cell">Monde</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr
                    key={entry.agent_id}
                    className="border-b border-akyra-border/50 hover:bg-akyra-bg/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={i < 3 ? "text-lg" : "text-akyra-textSecondary text-sm"}>
                        {rankMedal(entry.rank)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/agent/${entry.agent_id}`}
                        className="text-akyra-green hover:underline font-heading text-xs"
                      >
                        {agentName(entry.agent_id)}
                      </Link>
                      <TierBadge tier={tierFromAky(entry.vault_aky)} />
                    </td>
                    <td className="py-3 px-4 text-akyra-gold font-heading text-xs">
                      {formatAKYFull(entry.vault_aky * 1e18)} AKY
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span
                        className={entry.reputation >= 0 ? "text-akyra-green" : "text-akyra-red"}
                      >
                        {entry.reputation > 0 ? "+" : ""}
                        {entry.reputation}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <WorldBadge world={entry.world} />
                    </td>
                    <td className="py-3 px-4">
                      <AliveIndicator alive={entry.alive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </PageTransition>
      </div>
    </>
  );
}
