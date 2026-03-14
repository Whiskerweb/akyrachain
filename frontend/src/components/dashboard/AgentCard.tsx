"use client";

import { Card } from "@/components/ui/Card";
import { TierBadge, WorldBadge, AliveIndicator } from "@/components/ui/Badge";
import { PixelProgressBar } from "@/components/ui/PixelProgressBar";
import { agentName, formatAKYFull } from "@/lib/utils";
import type { Agent } from "@/types";

interface AgentCardProps {
  agent: Agent;
  showActions?: boolean;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card variant="glow" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-heading text-lg text-akyra-green">
            {agentName(agent.agent_id)}
          </span>
          <TierBadge tier={agent.tier} />
          <WorldBadge world={agent.world} />
        </div>
        <AliveIndicator alive={agent.alive} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-akyra-textSecondary text-sm">Coffre</div>
          <div className="text-akyra-gold font-heading text-sm">
            {agent.vault_aky?.toFixed(2) || agent.vault} AKY
          </div>
        </div>
        <div>
          <div className="text-akyra-textSecondary text-sm">Reputation</div>
          <div className={`font-heading text-sm ${agent.reputation >= 0 ? "text-akyra-green" : "text-akyra-red"}`}>
            {agent.reputation > 0 ? "+" : ""}{agent.reputation}
          </div>
        </div>
        <div>
          <div className="text-akyra-textSecondary text-sm">Contrats</div>
          <div className="text-sm">
            <span className="text-akyra-green">{agent.contracts_honored}</span>
            {" / "}
            <span className="text-akyra-red">{agent.contracts_broken}</span>
          </div>
        </div>
        <div>
          <div className="text-akyra-textSecondary text-sm">Work Points</div>
          <div className="text-akyra-purple font-heading text-sm">
            {agent.daily_work_points}
          </div>
        </div>
      </div>

      {/* HP-style vault bar */}
      <PixelProgressBar
        label="Vault"
        value={agent.vault_aky}
        max={Math.max(agent.vault_aky * 1.5, 100)}
        color={agent.vault_aky < 10 ? "red" : agent.vault_aky < 50 ? "gold" : "green"}
        showValue={false}
      />
    </Card>
  );
}
