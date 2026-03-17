"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CircuitMeander } from "@/components/ui/GreekMotifs";
import { EyeCreaturePreview } from "@/components/avatar/EyeCreaturePreview";
import { StepMorphe } from "@/components/avatar/steps/StepMorphe";
import { StepOnoma } from "@/components/avatar/steps/StepOnoma";
import { StepEidolon } from "@/components/avatar/steps/StepEidolon";
import { StepGenesis } from "@/components/avatar/steps/StepGenesis";
import { billingAPI, agentsAPI, customizeAPI } from "@/lib/api";
import { useAkyraStore } from "@/stores/akyraStore";
import { TIER_INFO, type TierKey } from "@/types";
import type { AvatarConfig, Specialization, SkinKey } from "@/types/avatar";

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pantheon-bg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-akyra-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAkyraStore((s) => s.token);
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState(0);
  const [tier, setTier] = useState<TierKey>(
    (searchParams.get("tier") as TierKey) || "wanderer",
  );
  const [agentName, setAgentName] = useState("");
  const [specialization, setSpecialization] = useState<Specialization>("builder");
  const [skin, setSkin] = useState<SkinKey>("default");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // DEV: temporarily skip login redirect for visual testing
  // useEffect(() => { if (mounted && !token) router.push("/login"); }, [mounted, token, router]);

  const tierInfo = TIER_INFO[tier];

  const config: AvatarConfig = {
    tier,
    specialization,
    skin,
    name: agentName,
  };

  const phase: "building" | "idle" | "awakening" =
    step === 3 && isDeployed
      ? "awakening"
      : step === 3
        ? "idle"
        : "building";

  const canProceed = useCallback(() => {
    if (step === 0) return true;
    if (step === 1) return agentName.length >= 2 && agentName.length <= 20;
    if (step === 2) return true;
    return false;
  }, [step, agentName]);

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    setIsDeploying(true);
    try {
      if (tier !== "explorer") {
        const { checkout_url } = await billingAPI.checkout(
          tier,
          `${window.location.origin}/onboarding?tier=${tier}&step=deploy&name=${encodeURIComponent(agentName)}&skin=${skin}&spec=${specialization}`,
          `${window.location.origin}/onboarding?tier=${tier}`,
        );
        window.location.href = checkout_url;
        return;
      }

      await agentsAPI.create();
      await customizeAPI.customize(agentName, skin);
      setIsDeployed(true);
      toast.success("Ton agent est ne !");
      setTimeout(() => router.push("/dashboard"), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      if (msg.includes("already")) {
        toast.info("Agent deja cree !");
        router.push("/dashboard");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsDeploying(false);
    }
  };

  // Handle Stripe return
  useEffect(() => {
    if (!mounted) return;
    const urlStep = searchParams.get("step");
    const urlName = searchParams.get("name");
    const urlSkin = searchParams.get("skin");
    const urlSpec = searchParams.get("spec");

    if (urlStep === "deploy") {
      if (urlName) setAgentName(decodeURIComponent(urlName));
      if (urlSkin) setSkin(urlSkin as SkinKey);
      if (urlSpec) setSpecialization(urlSpec as Specialization);
      setStep(3);

      (async () => {
        setIsDeploying(true);
        try {
          await agentsAPI.create();
          if (urlName)
            await customizeAPI.customize(
              decodeURIComponent(urlName),
              urlSkin || "default",
            );
          setIsDeployed(true);
          toast.success("Ton agent est ne !");
          setTimeout(() => router.push("/dashboard"), 4000);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("already")) router.push("/dashboard");
          else toast.error("Erreur de deploiement");
        } finally {
          setIsDeploying(false);
        }
      })();
    }
  }, [mounted, searchParams, router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen pantheon-bg relative overflow-hidden">
      {/* Grain texture for depth */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
      />

      {/* Ambient tier-colored background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: `radial-gradient(ellipse at 50% 20%, ${tierInfo.color}12 0%, ${tierInfo.color}04 30%, transparent 65%)`,
        }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />

      {/* Secondary ambient glow at bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(200,169,110,0.03) 0%, transparent 50%)",
        }}
      />

      {/* Split layout */}
      <div className="flex flex-col md:flex-row min-h-screen relative z-10">
        {/* LEFT: Creature preview */}
        <div className="w-full md:w-[55%] h-[40vh] md:h-auto flex items-center justify-center p-8 relative">
          <div className="w-full max-w-[420px] aspect-square">
            <EyeCreaturePreview config={config} phase={phase} className="w-full h-full" />
          </div>
        </div>

        {/* RIGHT: Panel */}
        <div className="w-full md:w-[45%] flex flex-col justify-center p-6 md:p-8 max-w-lg mx-auto md:mx-0">
          {/* Step indicator (4 dots) */}
          <div className="flex gap-2 justify-center mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i <= step ? "" : "bg-akyra-border"
                }`}
                style={i <= step ? { backgroundColor: tierInfo.color } : undefined}
              />
            ))}
          </div>

          {/* Step content card */}
          <motion.div
            className="bg-akyra-surface border border-akyra-border rounded-2xl p-6 relative overflow-hidden"
            animate={{
              boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 48px ${tierInfo.color}08, 0 0 0 1px ${tierInfo.color}08`,
            }}
            transition={{ duration: 0.8 }}
          >
            <div className="marble-veins absolute inset-0 pointer-events-none rounded-2xl" />

            <div className="relative z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  {step === 0 && (
                    <StepMorphe selected={tier} onSelect={setTier} />
                  )}
                  {step === 1 && (
                    <StepOnoma
                      name={agentName}
                      setName={setAgentName}
                      tier={tier}
                    />
                  )}
                  {step === 2 && (
                    <StepEidolon
                      specialization={specialization}
                      setSpecialization={setSpecialization}
                      skin={skin}
                      setSkin={setSkin}
                      tier={tier}
                    />
                  )}
                  {step === 3 && (
                    <StepGenesis
                      config={config}
                      isDeploying={isDeploying}
                      isDeployed={isDeployed}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Navigation buttons */}
          {!isDeployed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-5 flex items-center gap-3"
            >
              {step > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  className="flex-shrink-0"
                >
                  Retour
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isDeploying}
                loading={isDeploying}
                className="flex-1"
                size="lg"
                variant={step === 3 ? "gold" : "default"}
                style={step < 3 ? { backgroundColor: tierInfo.color } : undefined}
              >
                {step === 3 ? (
                  isDeploying ? (
                    "Rituel en cours..."
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {tier === "explorer"
                        ? "Eveiller"
                        : `Invoquer — ${tierInfo.price} EUR/mois`}
                    </>
                  )
                ) : (
                  <>
                    Continuer <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* BYOK link */}
          {step === 0 && (
            <p className="text-center mt-6 text-[10px] text-akyra-textDisabled">
              Tu as ta propre cle API ?{" "}
              <button
                onClick={() => router.push("/onboarding/advanced")}
                className="text-akyra-textSecondary hover:text-akyra-text underline transition-colors"
              >
                Onboarding avance
              </button>
            </p>
          )}

          {/* Bottom meander */}
          <div className="mt-8">
            <CircuitMeander color={tierInfo.color} />
          </div>
        </div>
      </div>
    </div>
  );
}
