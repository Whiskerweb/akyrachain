"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CONTRACTS, SPONSOR_GATEWAY_ABI } from "@/lib/contracts";

interface DepositWithdrawProps {
  agentId: number;
}

export function DepositWithdraw({ agentId }: DepositWithdrawProps) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    writeContract({
      address: CONTRACTS.sponsorGateway,
      abi: SPONSOR_GATEWAY_ABI,
      functionName: "deposit",
      args: [agentId],
      value: parseEther(amount),
    }, {
      onSuccess: () => toast.success(`Depot de ${amount} AKY en cours...`),
      onError: (err) => toast.error(`Erreur: ${err.message.slice(0, 100)}`),
    });
  };

  const handleCommitWithdraw = () => {
    writeContract({
      address: CONTRACTS.sponsorGateway,
      abi: SPONSOR_GATEWAY_ABI,
      functionName: "commitWithdraw",
      args: [agentId],
    }, {
      onSuccess: () => toast.success("Retrait initie ! Executez dans 24h."),
      onError: (err) => toast.error(`Erreur: ${err.message.slice(0, 100)}`),
    });
  };

  return (
    <Card className="space-y-4">
      <h3 className="font-heading text-xs text-akyra-textSecondary uppercase tracking-wider">
        Actions
      </h3>

      {/* Mode tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("deposit")}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            mode === "deposit"
              ? "bg-akyra-green/20 text-akyra-green border border-akyra-green/30"
              : "bg-akyra-bg text-akyra-textSecondary hover:text-akyra-text"
          }`}
        >
          Deposer
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            mode === "withdraw"
              ? "bg-akyra-red/20 text-akyra-red border border-akyra-red/30"
              : "bg-akyra-bg text-akyra-textSecondary hover:text-akyra-text"
          }`}
        >
          Retirer
        </button>
      </div>

      {mode === "deposit" ? (
        <div className="space-y-3">
          <input
            type="number"
            placeholder="Montant en AKY"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-akyra"
            min="0"
            step="1"
          />
          <Button
            onClick={handleDeposit}
            loading={isPending || isConfirming}
            className="w-full"
          >
            {isConfirming ? "Confirmation..." : `Deposer ${amount || "0"} AKY`}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-akyra-textSecondary text-sm">
            Le retrait utilise un systeme commit-reveal. Initiez le retrait, puis
            executez-le apres 24h.
          </p>
          <Button
            variant="destructive"
            onClick={handleCommitWithdraw}
            loading={isPending || isConfirming}
            className="w-full"
          >
            Initier le retrait
          </Button>
        </div>
      )}

      {isSuccess && (
        <p className="text-akyra-green text-sm text-center">
          Transaction confirmee !
        </p>
      )}
    </Card>
  );
}
