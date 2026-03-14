"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CONTRACTS, SPONSOR_GATEWAY_ABI } from "@/lib/contracts";

export function DepositWithdraw() {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const queryClient = useQueryClient();

  const {
    writeContract,
    data: txHash,
    isPending,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Refresh agent data after TX confirms
  if (isSuccess) {
    queryClient.invalidateQueries({ queryKey: ["my-agent"] });
  }

  const handleDeposit = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast.error("Entre un montant valide");
      return;
    }
    reset();
    writeContract(
      {
        address: CONTRACTS.sponsorGateway,
        abi: SPONSOR_GATEWAY_ABI,
        functionName: "deposit",
        value: parseEther(amount),
      },
      {
        onSuccess: () => toast.success(`Depot de ${amount} AKY envoye !`),
        onError: (err) =>
          toast.error(`Erreur: ${err.message.slice(0, 120)}`),
      }
    );
  };

  const handleCommitWithdraw = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast.error("Entre un montant a retirer");
      return;
    }
    reset();
    writeContract(
      {
        address: CONTRACTS.sponsorGateway,
        abi: SPONSOR_GATEWAY_ABI,
        functionName: "commitWithdraw",
        args: [BigInt(parseEther(amount))],
      },
      {
        onSuccess: () =>
          toast.success("Retrait initie ! Tu pourras l'executer apres le cooldown."),
        onError: (err) =>
          toast.error(`Erreur: ${err.message.slice(0, 120)}`),
      }
    );
  };

  return (
    <Card className="space-y-4">
      <h3 className="font-heading text-xs text-akyra-textSecondary uppercase tracking-wider">
        Coffre-fort
      </h3>

      {/* Mode tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode("deposit"); reset(); }}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            mode === "deposit"
              ? "bg-akyra-green/20 text-akyra-green border border-akyra-green/30"
              : "bg-akyra-bg text-akyra-textSecondary hover:text-akyra-text"
          }`}
        >
          Deposer
        </button>
        <button
          onClick={() => { setMode("withdraw"); reset(); }}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            mode === "withdraw"
              ? "bg-akyra-red/20 text-akyra-red border border-akyra-red/30"
              : "bg-akyra-bg text-akyra-textSecondary hover:text-akyra-text"
          }`}
        >
          Retirer
        </button>
      </div>

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
        {mode === "deposit" ? (
          <Button
            onClick={handleDeposit}
            loading={isPending || isConfirming}
            className="w-full"
          >
            {isConfirming
              ? "Confirmation on-chain..."
              : `Deposer ${amount || "0"} AKY`}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-akyra-textSecondary text-xs">
              Le retrait utilise un systeme commit → cooldown → execute.
            </p>
            <Button
              variant="destructive"
              onClick={handleCommitWithdraw}
              loading={isPending || isConfirming}
              className="w-full"
            >
              {isConfirming
                ? "Confirmation on-chain..."
                : `Initier retrait de ${amount || "0"} AKY`}
            </Button>
          </div>
        )}
      </div>

      {isSuccess && (
        <div className="space-y-1">
          <p className="text-akyra-green text-sm text-center">
            Transaction confirmee on-chain !
          </p>
          {txHash && (
            <a
              href={`https://explorer.akyra.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-akyra-textSecondary text-xs text-center block hover:text-akyra-green transition-colors"
            >
              Voir sur l&apos;explorer →
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
