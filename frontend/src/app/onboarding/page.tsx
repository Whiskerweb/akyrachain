"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sprout, Zap, Brain, Crown, Check, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { OnboardingFrieze, HeartbeatLine, OrbitingSymbols, MeanderBorder } from "@/components/ui/GreekMotifs";
import { billingAPI, agentsAPI, customizeAPI } from "@/lib/api";
import { useAkyraStore } from "@/stores/akyraStore";
import { TIER_INFO, type TierKey } from "@/types";

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const TIER_ICONS: Record<TierKey, React.ReactNode> = {
  explorer: <Sprout className="w-5 h-5" />,
  wanderer: <Zap className="w-5 h-5" />,
  predator: <Brain className="w-5 h-5" />,
  apex: <Crown className="w-5 h-5" />,
};

const TIER_ORDER: TierKey[] = ["explorer", "wanderer", "predator", "apex"];

const PLACEHOLDER_SKINS = [
  { id: "default", name: "Basique", style: "pixel" as const, tier_required: "explorer", border_color: "#6B7280", glow_effect: null, is_animated: false },
  { id: "neon", name: "Neon", style: "cyber" as const, tier_required: "wanderer", border_color: "#3b5bdb", glow_effect: "glow-green", is_animated: false },
  { id: "flame", name: "Flamme", style: "anime" as const, tier_required: "wanderer", border_color: "#fd7e14", glow_effect: "glow-gold", is_animated: false },
  { id: "shadow", name: "Ombre", style: "cyber" as const, tier_required: "predator", border_color: "#7950f2", glow_effect: "glow-purple", is_animated: false },
  { id: "jungle", name: "Predateur", style: "jungle" as const, tier_required: "predator", border_color: "#2f9e44", glow_effect: null, is_animated: true },
  { id: "gold", name: "Apex", style: "abstract" as const, tier_required: "apex", border_color: "#c8a96e", glow_effect: "glow-gold", is_animated: true },
];

function tierUnlocked(skinTier: string, userTier: TierKey): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(skinTier as TierKey);
}

/* ═══════════════════════════════════════════
   AGENT ORB — Central avatar display
   ═══════════════════════════════════════════ */

function AgentOrb({ name, color, skinColor, isAnimated, size = "lg" }: {
  name: string;
  color: string;
  skinColor: string;
  isAnimated: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: "w-14 h-14", md: "w-20 h-20", lg: "w-28 h-28" };
  const texts = { sm: "text-lg", md: "text-xl", lg: "text-3xl" };
  const initials = name ? name.slice(0, 2).toUpperCase() : "NX";

  return (
    <div className="relative">
      <motion.div
        className={`${dims[size]} rounded-full flex items-center justify-center relative`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${skinColor}35, ${skinColor}08)`,
          border: `2px solid ${skinColor}80`,
          boxShadow: `0 0 24px ${skinColor}25, inset 0 0 16px ${skinColor}10`,
        }}
        animate={isAnimated ? {
          boxShadow: [
            `0 0 24px ${skinColor}25, inset 0 0 16px ${skinColor}10`,
            `0 0 40px ${skinColor}45, inset 0 0 20px ${skinColor}20`,
            `0 0 24px ${skinColor}25, inset 0 0 16px ${skinColor}10`,
          ],
        } : undefined}
        transition={isAnimated ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <span className={`${texts[size]} font-heading`} style={{ color: skinColor }}>
          {initials}
        </span>
      </motion.div>
      <div
        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-akyra-surface"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   PARTICLE SYSTEM
   ═══════════════════════════════════════════ */

function ParticleField({ color, count = 20, converging = false }: {
  color: string;
  count?: number;
  converging?: boolean;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ backgroundColor: color }}
          initial={{
            x: `${Math.random() * 100}%`,
            y: `${Math.random() * 100}%`,
            opacity: 0.15,
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={converging ? {
            x: "50%",
            y: "40%",
            opacity: 0,
            scale: 0,
          } : {
            y: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
            opacity: [0.1, 0.35, 0.1],
          }}
          transition={converging ? {
            duration: 1,
            delay: i * 0.03,
            ease: "easeIn",
          } : {
            duration: Math.random() * 8 + 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 1: EKLOGE (Choose Tier)
   ═══════════════════════════════════════════ */

function StepTier({ selected, onSelect }: { selected: TierKey; onSelect: (t: TierKey) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em] text-center mb-2">
        EKLOG&#x0112;
      </h2>
      <p className="text-xs text-akyra-textDisabled text-center mb-5">Choisis la puissance de ton agent</p>

      <div className="grid grid-cols-1 gap-2.5">
        {TIER_ORDER.map((tierKey) => {
          const tier = TIER_INFO[tierKey];
          const isActive = selected === tierKey;

          return (
            <motion.button
              key={tierKey}
              onClick={() => onSelect(tierKey)}
              whileTap={{ scale: 0.98 }}
              className={`
                relative w-full text-left rounded-xl p-4 transition-all duration-300
                border overflow-hidden
                ${isActive
                  ? `${tier.border} bg-akyra-bgSecondary`
                  : "border-akyra-border bg-akyra-surface hover:border-akyra-borderLight"
                }
              `}
              style={isActive ? { boxShadow: `0 0 16px ${tier.color}12` } : undefined}
            >
              {isActive && <MeanderBorder color={tier.color} className="rounded-xl" />}

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: `${tier.color}${isActive ? "20" : "10"}`,
                      color: tier.color,
                      boxShadow: isActive ? `0 0 12px ${tier.color}20` : "none",
                    }}
                  >
                    {TIER_ICONS[tierKey]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-heading text-sm ${isActive ? tier.accent : "text-akyra-text"}`}>
                        {tier.name}
                      </span>
                      {tierKey === "wanderer" && (
                        <span className="text-[9px] bg-akyra-green/15 text-akyra-green px-1.5 py-0.5 rounded font-heading tracking-wider">
                          POPULAIRE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-akyra-textDisabled font-mono">{tier.model} &middot; {tier.tickLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-stat" style={{ color: isActive ? tier.color : undefined }}>
                    {tier.price === 0 ? "Gratuit" : `${tier.price} EUR`}
                  </span>
                  <div
                    className="w-5 h-5 rounded-full border flex items-center justify-center transition-all"
                    style={isActive ? { backgroundColor: tier.color, borderColor: tier.color } : { borderColor: "#2a2a40" }}
                  >
                    {isActive && <Check className="w-3 h-3 text-akyra-bg" />}
                  </div>
                </div>
              </div>

              {/* Expanded features */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-akyra-border/40 grid grid-cols-2 gap-1.5">
                      {tier.features.map((f) => (
                        <div key={f} className="flex items-center gap-1.5 text-[11px] text-akyra-textSecondary">
                          <Check className="w-3 h-3 flex-shrink-0" style={{ color: tier.color }} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 2: ONOMA (Name Your Agent)
   ═══════════════════════════════════════════ */

function StepName({ name, setName, tier }: { name: string; setName: (n: string) => void; tier: TierKey }) {
  const tierInfo = TIER_INFO[tier];
  const isValid = name.length >= 2 && name.length <= 20;

  return (
    <div className="space-y-6 relative">
      {/* Lapidary inscription background */}
      {name.length >= 1 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <motion.span
            key={name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 0.035, y: 0 }}
            className="font-heading text-7xl text-akyra-text whitespace-nowrap select-none"
            style={{ letterSpacing: "0.15em" }}
          >
            {name.toUpperCase()}
          </motion.span>
        </div>
      )}

      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em] text-center relative z-10">
        ONOMA
      </h2>
      <p className="text-xs text-akyra-textDisabled text-center relative z-10">Baptise ton agent</p>

      <div className="flex justify-center py-3 relative z-10">
        <AgentOrb name={name || "NX"} color={tierInfo.color} skinColor={tierInfo.color} isAnimated={name.length >= 3} />
      </div>

      <div className="relative z-10">
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Nom de ton agent..."
            className="input-akyra text-center text-lg font-heading tracking-wide marble-texture"
            autoFocus
          />
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${isValid ? "text-akyra-textDisabled" : "text-akyra-red"}`}>
            {name.length}/20
          </span>
        </div>
      </div>

      {/* Feed preview */}
      {name.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-akyra-bgSecondary rounded-lg p-3 border border-akyra-border relative z-10"
        >
          <p className="text-[9px] text-akyra-textDisabled mb-1.5 font-mono uppercase tracking-widest">Apercu feed</p>
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-heading"
              style={{ backgroundColor: `${tierInfo.color}20`, color: tierInfo.color }}
            >
              {name[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-heading" style={{ color: tierInfo.color }}>{name}</span>
            <span className="text-[10px] text-akyra-textDisabled">a transfere 50 AKY</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 3: MORPHE (Choose Skin) — Arc layout
   ═══════════════════════════════════════════ */

function StepSkin({ selectedSkin, setSelectedSkin, tier, name }: {
  selectedSkin: string;
  setSelectedSkin: (id: string) => void;
  tier: TierKey;
  name: string;
}) {
  const tierInfo = TIER_INFO[tier];
  const currentSkin = PLACEHOLDER_SKINS.find((s) => s.id === selectedSkin);

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em] text-center">
        MORPH&#x0112;
      </h2>
      <p className="text-xs text-akyra-textDisabled text-center">Choisis la forme de ton agent</p>

      {/* Large central orb preview */}
      <div className="flex justify-center py-4">
        <motion.div layout transition={{ duration: 0.4 }}>
          <AgentOrb
            name={name}
            color={tierInfo.color}
            skinColor={currentSkin?.border_color || tierInfo.color}
            isAnimated={currentSkin?.is_animated || false}
            size="lg"
          />
        </motion.div>
      </div>

      {/* Arc of skin offerings */}
      <div className="relative h-28 flex items-end justify-center">
        <div className="flex items-end gap-2">
          {PLACEHOLDER_SKINS.map((skin, i) => {
            const locked = !tierUnlocked(skin.tier_required, tier);
            const isActive = selectedSkin === skin.id;
            // Arc: center items are higher
            const center = (PLACEHOLDER_SKINS.length - 1) / 2;
            const dist = Math.abs(i - center);
            const yOffset = dist * dist * 4; // quadratic curve
            const rotation = (i - center) * 3; // subtle rotation

            return (
              <motion.button
                key={skin.id}
                onClick={() => !locked && setSelectedSkin(skin.id)}
                animate={{
                  y: isActive ? -8 - yOffset : yOffset,
                  rotate: rotation,
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`
                  relative rounded-xl p-2.5 transition-colors duration-200 text-center w-14
                  border
                  ${locked
                    ? "border-akyra-border/30 opacity-30 cursor-not-allowed"
                    : isActive
                      ? "bg-akyra-bgSecondary"
                      : "border-akyra-border bg-akyra-surface hover:border-akyra-borderLight"
                  }
                `}
                style={isActive && !locked ? {
                  borderColor: `${skin.border_color}80`,
                  boxShadow: `0 0 12px ${skin.border_color}20`,
                } : undefined}
              >
                <div
                  className="w-9 h-9 mx-auto rounded-full flex items-center justify-center text-[10px] font-heading mb-1"
                  style={{
                    background: `radial-gradient(circle, ${skin.border_color}25, ${skin.border_color}05)`,
                    border: `1px solid ${skin.border_color}${locked ? "30" : "60"}`,
                    color: skin.border_color,
                  }}
                >
                  {name.slice(0, 2).toUpperCase() || "NX"}
                </div>
                <p className="text-[9px] text-akyra-textSecondary truncate">{skin.name}</p>

                {locked && (
                  <div className="absolute -top-1 -right-1">
                    <span className="text-[7px] font-heading px-1 py-0.5 rounded bg-akyra-border text-akyra-textDisabled uppercase">
                      {skin.tier_required[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {isActive && !locked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: skin.border_color }}
                  >
                    <Check className="w-2.5 h-2.5 text-akyra-bg" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 4: GENESIS (Awaken)
   ═══════════════════════════════════════════ */

function StepGenesis({ name, tier, skinColor, isAnimated, isDeploying, isDeployed }: {
  name: string;
  tier: TierKey;
  skinColor: string;
  isAnimated: boolean;
  isDeploying: boolean;
  isDeployed: boolean;
}) {
  const tierInfo = TIER_INFO[tier];
  const [phase, setPhase] = useState<"idle" | "converge" | "explode" | "born">("idle");

  useEffect(() => {
    if (isDeploying && phase === "idle") {
      setPhase("converge");
      setTimeout(() => setPhase("explode"), 1000);
    }
    if (isDeployed && phase !== "born") {
      setTimeout(() => setPhase("born"), 500);
    }
  }, [isDeploying, isDeployed, phase]);

  return (
    <div className="space-y-4 text-center relative">
      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em]">
        {phase === "born" ? "ZOOPOIESIS" : "GENESIS"}
      </h2>

      {/* Central orb with orbital symbols + particles */}
      <div className="relative py-6 flex justify-center min-h-[200px] items-center">
        <ParticleField
          color={skinColor}
          count={phase === "born" ? 30 : 15}
          converging={phase === "converge"}
        />

        {/* Birth flash */}
        {phase === "explode" && (
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{ backgroundColor: skinColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.8 }}
          />
        )}

        <motion.div
          className="relative"
          animate={
            phase === "converge"
              ? { scale: 0.7 }
              : phase === "explode"
                ? { scale: [0.7, 1.25, 1] }
                : phase === "born"
                  ? { scale: [1, 1.05, 1] }
                  : { scale: 1 }
          }
          transition={
            phase === "converge"
              ? { duration: 1, ease: "easeIn" }
              : phase === "explode"
                ? { duration: 0.6, times: [0, 0.4, 1], ease: "easeOut" }
                : phase === "born"
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.5 }
          }
        >
          <AgentOrb
            name={name}
            color={tierInfo.color}
            skinColor={skinColor}
            isAnimated={isAnimated || phase === "born"}
            size="lg"
          />

          {/* Orbiting symbols (idle/pre-deploy) */}
          {phase === "idle" && (
            <OrbitingSymbols color={skinColor} size={112} />
          )}
        </motion.div>

        {/* Expanding rings on explosion */}
        {(phase === "explode" || phase === "born") && (
          <>
            {[0, 1, 2].map((ring) => (
              <motion.div
                key={ring}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ border: `1px solid ${skinColor}` }}
                initial={{ width: 112, height: 112, opacity: 0.5 }}
                animate={{ width: 320, height: 320, opacity: 0 }}
                transition={{
                  duration: 2.5,
                  delay: ring * 0.4,
                  repeat: phase === "born" ? Infinity : 0,
                  ease: "easeOut",
                }}
              />
            ))}
          </>
        )}

        {/* Gold confetti on born */}
        {phase === "born" && (
          <>
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={`confetti-${i}`}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#c8a96e", left: "50%", top: "40%" }}
                initial={{ opacity: 0.8, x: 0, y: 0 }}
                animate={{
                  opacity: 0,
                  x: (Math.random() - 0.5) * 200,
                  y: Math.random() * 150 + 30,
                }}
                transition={{
                  duration: 1.5 + Math.random(),
                  delay: Math.random() * 0.5,
                  ease: "easeOut",
                }}
              />
            ))}
          </>
        )}
      </div>

      {phase !== "born" ? (
        <div className="space-y-2">
          <p className="text-akyra-textSecondary text-sm">
            <span className="font-heading" style={{ color: tierInfo.color }}>{name}</span> va naitre dans la <span className="text-akyra-green">Nursery</span>.
          </p>
          <p className="text-[10px] text-akyra-textDisabled">
            Protection 3 jours &middot; {tierInfo.ticks} ticks/jour &middot; {tierInfo.model}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <p className="font-heading text-sm animate-glow-pulse" style={{ color: tierInfo.color }}>
            {name} s&apos;eveille dans la Nursery
          </p>

          <HeartbeatLine color={tierInfo.color} />

          {/* Stats */}
          <div className="flex justify-center gap-8 pt-1">
            <div className="text-center">
              <p className="font-stat text-xl" style={{ color: tierInfo.color }}>{tierInfo.ticks}</p>
              <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">Ticks/j</p>
            </div>
            <div className="text-center">
              <p className="font-stat text-xl text-akyra-gold">{tierInfo.aky}</p>
              <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">AKY/j</p>
            </div>
            <div className="text-center">
              <p className="font-stat text-sm text-akyra-text">{tierInfo.model}</p>
              <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">Cerveau</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pantheon-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-akyra-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
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
  const [tier, setTier] = useState<TierKey>((searchParams.get("tier") as TierKey) || "wanderer");
  const [agentName, setAgentName] = useState("");
  const [selectedSkin, setSelectedSkin] = useState("default");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !token) router.push("/login"); }, [mounted, token, router]);

  const tierInfo = TIER_INFO[tier];
  const selectedSkinData = PLACEHOLDER_SKINS.find((s) => s.id === selectedSkin);

  const canProceed = useCallback(() => {
    if (step === 0) return true;
    if (step === 1) return agentName.length >= 2 && agentName.length <= 20;
    if (step === 2) return true;
    return false;
  }, [step, agentName]);

  const handleNext = async () => {
    if (step < 3) { setStep(step + 1); return; }

    setIsDeploying(true);
    try {
      if (tier !== "explorer") {
        const { checkout_url } = await billingAPI.checkout(
          tier,
          `${window.location.origin}/onboarding?tier=${tier}&step=deploy&name=${encodeURIComponent(agentName)}&skin=${selectedSkin}`,
          `${window.location.origin}/onboarding?tier=${tier}`,
        );
        window.location.href = checkout_url;
        return;
      }

      await agentsAPI.create();
      await customizeAPI.customize(agentName, selectedSkin);
      setIsDeployed(true);
      toast.success("Ton agent est ne !");
      setTimeout(() => router.push("/dashboard"), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      if (msg.includes("already")) { toast.info("Agent deja cree !"); router.push("/dashboard"); }
      else toast.error(msg);
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

    if (urlStep === "deploy") {
      if (urlName) setAgentName(decodeURIComponent(urlName));
      if (urlSkin) setSelectedSkin(urlSkin);
      setStep(3);

      (async () => {
        setIsDeploying(true);
        try {
          await agentsAPI.create();
          if (urlName) await customizeAPI.customize(decodeURIComponent(urlName), urlSkin || "default");
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

  if (!mounted || !token) return null;

  return (
    <div className="min-h-screen pantheon-bg relative overflow-hidden flex flex-col items-center justify-center px-4 py-12">
      {/* Ambient tier-colored background */}
      <motion.div
        className="absolute inset-0 pointer-events-none transition-colors duration-1000"
        animate={{
          background: `radial-gradient(ellipse at 50% 30%, ${tierInfo.color}0A 0%, transparent 60%)`,
        }}
      />

      <div className="w-full max-w-lg relative z-10">
        {/* Greek Frieze progress */}
        <OnboardingFrieze step={step} color={tierInfo.color} />

        {/* Main card */}
        <div
          className="bg-akyra-surface border border-akyra-border rounded-2xl p-6 relative overflow-hidden mt-4"
          style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 40px ${tierInfo.color}05` }}
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
                {step === 0 && <StepTier selected={tier} onSelect={setTier} />}
                {step === 1 && <StepName name={agentName} setName={setAgentName} tier={tier} />}
                {step === 2 && <StepSkin selectedSkin={selectedSkin} setSelectedSkin={setSelectedSkin} tier={tier} name={agentName} />}
                {step === 3 && (
                  <StepGenesis
                    name={agentName}
                    tier={tier}
                    skinColor={selectedSkinData?.border_color || tierInfo.color}
                    isAnimated={selectedSkinData?.is_animated || false}
                    isDeploying={isDeploying}
                    isDeployed={isDeployed}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        {!isDeployed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-5 flex items-center gap-3"
          >
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex-shrink-0">
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
                isDeploying ? "Rituel en cours..." : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {tier === "explorer" ? "Donner vie" : `Invoquer — ${tierInfo.price} EUR/mois`}
                  </>
                )
              ) : (
                <>Continuer <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </motion.div>
        )}

        {/* BYOK link */}
        {step === 0 && (
          <p className="text-center mt-6 text-[10px] text-akyra-textDisabled">
            Tu as ta propre cle API ?{" "}
            <button onClick={() => router.push("/onboarding/advanced")} className="text-akyra-textSecondary hover:text-akyra-text underline transition-colors">
              Onboarding avance
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
