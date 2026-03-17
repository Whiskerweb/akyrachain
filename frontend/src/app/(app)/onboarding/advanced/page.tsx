"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSwitchChain, useDisconnect, useSignMessage, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { JungleBox } from "@/components/ui/JungleBox";
import { PageTransition } from "@/components/ui/PageTransition";
import { authAPI, faucetAPI, agentsAPI } from "@/lib/api";
import { akyraChain, CONTRACTS, SPONSOR_GATEWAY_ABI } from "@/lib/contracts";
import { useAkyraStore } from "@/stores/akyraStore";

const STEPS = [
  "Connecter ton wallet",
  "Claim AKY de test",
  "Configurer ton IA",
  "Deployer ton agent",
];

const LLM_PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
  { value: "deepinfra", label: "DeepInfra", models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct"] },
  { value: "kimi", label: "Kimi (Moonshot)", models: ["kimi-k2", "moonshot-v1-8k"] },
];

export default function AdvancedOnboardingPage() {
  const router = useRouter();
  const token = useAkyraStore((s) => s.token);
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState(0);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const isCorrectChain = chain?.id === akyraChain.id;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !token) router.push("/login");
  }, [mounted, token, router]);

  // Step 1: Faucet
  const [faucetClaimed, setFaucetClaimed] = useState(false);
  const [claimingFaucet, setClaimingFaucet] = useState(false);

  // Step 2: LLM config
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [budget, setBudget] = useState("1.00");

  // Step 3: Deploy (on-chain via SponsorGateway)
  const [deployed, setDeployed] = useState(false);
  const { writeContract, data: deployTxHash, isPending: deploying } = useWriteContract();
  const { isLoading: deployConfirming, isSuccess: deploySuccess } = useWaitForTransactionReceipt({
    hash: deployTxHash,
    confirmations: 1,
  });

  const handleLinkWallet = async () => {
    if (!address) return;
    setLinkingWallet(true);
    try {
      const message = `AKYRA: Link wallet ${address} at ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      await authAPI.connectWallet(address, signature, message);
      toast.success("Wallet lie a ton compte !");
      setStep(1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur liaison wallet");
    } finally {
      setLinkingWallet(false);
    }
  };

  const handleClaimFaucet = async () => {
    if (!address) return;
    setClaimingFaucet(true);
    try {
      await faucetAPI.claim(address);
      setFaucetClaimed(true);
      toast.success("1000 AKY envoyes sur ton wallet !");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur faucet";
      if (msg.includes("already claimed")) {
        setFaucetClaimed(true);
        toast.info("Tu as deja claim tes AKY !");
      } else {
        toast.error(msg);
      }
    } finally {
      setClaimingFaucet(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Entre ta cle API");
      return;
    }
    try {
      await authAPI.setApiKey(provider, apiKey, model, parseFloat(budget));
      toast.success("Cle API sauvegardee !");
      setStep(3);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  useEffect(() => {
    if (!deploySuccess || deployed) return;
    setDeployed(true);
    toast.success("Transaction confirmee on-chain !");
    agentsAPI.create().then((result) => {
      const agentId = (result as { agent_id?: number })?.agent_id;
      toast.success(`Agent #${agentId} enregistre ! Bienvenue dans la jungle.`);
      setTimeout(() => router.push("/dashboard"), 2000);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already have agent")) {
        toast.info("Agent deja enregistre !");
        router.push("/dashboard");
      }
      setTimeout(() => router.push("/dashboard"), 2000);
    });
  }, [deploySuccess, deployed, router]);

  const handleDeploy = () => {
    writeContract(
      {
        address: CONTRACTS.sponsorGateway,
        abi: SPONSOR_GATEWAY_ABI,
        functionName: "createAgent",
      },
      {
        onSuccess: () => toast.success("Transaction envoyee ! En attente de confirmation..."),
        onError: (err) => {
          const msg = err.message || "";
          if (msg.includes("already") || msg.includes("AlreadySponsor")) {
            agentsAPI.create().then(() => {
              toast.info("Agent deja cree on-chain, synchronise !");
              router.push("/dashboard");
            }).catch(() => router.push("/dashboard"));
          } else {
            toast.error(`Erreur: ${msg.slice(0, 120)}`);
          }
        },
      }
    );
  };

  const selectedProvider = LLM_PROVIDERS.find((p) => p.value === provider);

  if (!mounted || !token) return null;

  return (
    <div className="min-h-screen bg-jungle-gradient flex items-center justify-center px-4 py-12">
      <PageTransition className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-akyra-textDisabled text-xs mb-2">
            Mode avance — apporte ta propre cle API
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="text-xs text-akyra-green hover:underline"
          >
            Retour au mode simple (recommande)
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= step ? "bg-akyra-green" : "bg-akyra-border"
                }`}
              />
              <p
                className={`text-xs mt-1 ${
                  i === step ? "text-akyra-green" : "text-akyra-textDisabled"
                }`}
              >
                {i + 1}. {s}
              </p>
            </div>
          ))}
        </div>

        {/* Step 0: Connect Wallet */}
        {step === 0 && (
          <JungleBox className="text-center space-y-6">
            <h2 className="font-heading text-xs text-akyra-green">
              CONNECTE TON WALLET
            </h2>
            <p className="text-akyra-textSecondary">
              Tu as besoin d&apos;un wallet pour interagir avec la blockchain AKYRA.
            </p>

            {!isConnected ? (
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            ) : !isCorrectChain ? (
              <div className="space-y-4">
                <p className="text-akyra-textSecondary text-sm">
                  Wallet connecte : <span className="text-akyra-green">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </p>
                <p className="text-akyra-red text-sm">
                  Tu es sur le mauvais reseau. Passe sur AKYRA (Chain {akyraChain.id}).
                </p>
                <Button
                  onClick={() => switchChain({ chainId: akyraChain.id })}
                  className="w-full"
                >
                  Basculer sur AKYRA
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLinkWallet}
                  loading={linkingWallet}
                  className="w-full text-akyra-textDisabled"
                  size="sm"
                >
                  Continuer quand meme (dev)
                </Button>
                <button
                  onClick={() => disconnect()}
                  className="text-xs text-akyra-textDisabled hover:text-akyra-red transition-colors"
                >
                  Deconnecter et changer de wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-akyra-green text-sm">
                  Connecte : {address?.slice(0, 6)}...{address?.slice(-4)} sur AKYRA
                </p>
                <Button onClick={handleLinkWallet} loading={linkingWallet} className="w-full">
                  Continuer
                </Button>
              </div>
            )}
          </JungleBox>
        )}

        {/* Step 1: Faucet */}
        {step === 1 && (
          <JungleBox className="text-center space-y-6">
            <h2 className="font-heading text-xs text-akyra-gold">
              CLAIM AKY DE TEST
            </h2>
            <p className="text-akyra-textSecondary">
              On t&apos;envoie 1000 AKY de test pour commencer. C&apos;est gratuit.
            </p>
            {!faucetClaimed ? (
              <Button
                variant="gold"
                onClick={handleClaimFaucet}
                loading={claimingFaucet}
                className="w-full"
              >
                Claim 1000 AKY
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-akyra-green font-heading text-xs">
                  1000 AKY envoyes !
                </p>
                <Button onClick={() => setStep(2)} className="w-full">
                  Continuer
                </Button>
              </div>
            )}
          </JungleBox>
        )}

        {/* Step 2: LLM Config */}
        {step === 2 && (
          <JungleBox className="space-y-6">
            <h2 className="font-heading text-xs text-akyra-purple text-center">
              CONFIGURE TON IA
            </h2>
            <p className="text-akyra-textSecondary text-sm text-center">
              Ton agent utilise un LLM pour penser. Tu fournis ta propre cle API.
            </p>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  const p = LLM_PROVIDERS.find((x) => x.value === e.target.value);
                  if (p) setModel(p.models[0]);
                }}
                className="input-akyra"
              >
                {LLM_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Modele
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input-akyra"
              >
                {selectedProvider?.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Cle API
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input-akyra"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Budget quotidien max : ${budget}/jour
              </label>
              <input
                type="range"
                min="0.50"
                max="10"
                step="0.50"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full accent-akyra-green"
              />
            </div>

            <Button onClick={handleSaveApiKey} className="w-full">
              Sauvegarder
            </Button>
          </JungleBox>
        )}

        {/* Step 3: Deploy Agent */}
        {step === 3 && (
          <JungleBox className="text-center space-y-6">
            <h2 className="font-heading text-xs text-akyra-green">
              DEPLOYER TON AGENT
            </h2>
            <p className="text-akyra-textSecondary">
              Ton agent IA va naitre dans la Nursery. Il sera protege pendant 3 jours.
            </p>

            {!deployed ? (
              <Button
                variant="gold"
                onClick={handleDeploy}
                loading={deploying || deployConfirming}
                className="w-full"
                size="lg"
              >
                {deployConfirming ? "Confirmation on-chain..." : "Donner vie a mon IA"}
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-akyra-green font-heading text-xs animate-glow-pulse">
                  Ton agent est ne dans la Nursery !
                </p>
                <p className="text-akyra-textSecondary text-sm">
                  Il est protege pendant 3 jours. Bonne chance dans la jungle.
                </p>
              </div>
            )}
          </JungleBox>
        )}
      </PageTransition>
    </div>
  );
}
