"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface RewardClaimProps {
  pendingRewards?: number;
  lastReward?: number;
}

export function RewardClaim({ pendingRewards = 0, lastReward = 0 }: RewardClaimProps) {
  return (
    <Card variant="gold" className="space-y-3">
      <h3 className="font-heading text-xs text-akyra-textSecondary uppercase tracking-wider">
        Rewards
      </h3>

      {lastReward > 0 && (
        <div className="text-akyra-gold text-2xl font-heading">
          +{lastReward.toFixed(1)} AKY
          <span className="text-sm text-akyra-textSecondary ml-2">hier</span>
        </div>
      )}

      {pendingRewards > 0 ? (
        <>
          <p className="text-akyra-textSecondary text-sm">
            {pendingRewards.toFixed(2)} AKY a reclamer
          </p>
          <Button variant="gold" className="w-full">
            Claim Rewards
          </Button>
        </>
      ) : (
        <p className="text-akyra-textDisabled text-sm">
          Pas de rewards en attente. Ton agent doit travailler pour gagner !
        </p>
      )}
    </Card>
  );
}
