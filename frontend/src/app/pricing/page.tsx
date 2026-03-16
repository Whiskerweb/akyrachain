"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { Check, Sprout, Zap, Brain, Crown, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { TIER_INFO, type TierKey } from "@/types";

const TIERS: TierKey[] = ["explorer", "wanderer", "predator", "apex"];

const TIER_ICONS: Record<TierKey, React.ReactNode> = {
  explorer: <Sprout className="w-6 h-6" />,
  wanderer: <Zap className="w-6 h-6" />,
  predator: <Brain className="w-6 h-6" />,
  apex: <Crown className="w-6 h-6" />,
};

const POWER_INDEX: Record<TierKey, number> = {
  explorer: 5, wanderer: 36, predator: 72, apex: 100,
};

/* ═══════════════════════════════════════════
   FLOATING ORBS — Ambient background
   ═══════════════════════════════════════════ */

function FloatingOrbs() {
  const orbs = [
    { color: "#3b5bdb", size: 300, x: "10%", y: "20%", delay: 0 },
    { color: "#7950f2", size: 250, x: "70%", y: "60%", delay: 2 },
    { color: "#c8a96e", size: 200, x: "85%", y: "15%", delay: 4 },
    { color: "#3b5bdb", size: 180, x: "30%", y: "75%", delay: 1 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color}08, transparent 70%)`,
            filter: "blur(60px)",
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   BILLING TOGGLE
   ═══════════════════════════════════════════ */

function BillingToggle({ isCrypto, onToggle }: { isCrypto: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={`text-sm font-heading transition-colors ${!isCrypto ? "text-akyra-text" : "text-akyra-textDisabled"}`}>
        EUR
      </span>
      <button
        onClick={onToggle}
        className="relative w-14 h-7 rounded-full transition-all duration-300 border border-akyra-border/50"
        style={{
          background: isCrypto
            ? "linear-gradient(135deg, #c8a96e30, #c8a96e10)"
            : "rgba(255,255,255,0.04)",
        }}
      >
        <motion.div
          className="absolute top-0.5 w-6 h-6 rounded-full"
          style={{
            background: isCrypto
              ? "linear-gradient(135deg, #c8a96e, #a8894e)"
              : "linear-gradient(135deg, #3b5bdb, #2a4bc8)",
            boxShadow: isCrypto
              ? "0 0 12px #c8a96e60"
              : "0 0 8px #3b5bdb40",
          }}
          animate={{ x: isCrypto ? 28 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={`text-sm font-heading transition-colors ${isCrypto ? "text-akyra-gold" : "text-akyra-textDisabled"}`}>
        Crypto
      </span>
      <AnimatedBadge show={isCrypto} />
    </div>
  );
}

function AnimatedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="text-[11px] font-heading tracking-wider px-2.5 py-1 rounded-full"
      style={{
        background: "linear-gradient(135deg, #c8a96e25, #c8a96e10)",
        color: "#c8a96e",
        border: "1px solid #c8a96e30",
      }}
    >
      -10%
    </motion.span>
  );
}

/* ═══════════════════════════════════════════
   TIER CARD
   ═══════════════════════════════════════════ */

function TierCard({ tierKey, isCrypto, index }: {
  tierKey: TierKey;
  isCrypto: boolean;
  index: number;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const tier = TIER_INFO[tierKey];
  const isPopular = tierKey === "wanderer";
  const isApex = tierKey === "apex";
  const price = isCrypto ? Math.round(tier.price * 0.9) : tier.price;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative ${isPopular ? "lg:-mt-4 lg:mb-4" : ""}`}
    >
      {/* Outer glow for popular/apex */}
      {(isPopular || isApex) && (
        <div
          className="absolute -inset-[1px] rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(135deg, ${tier.color}40, transparent 50%, ${tier.color}20)`,
            borderRadius: "1rem",
            filter: "blur(1px)",
          }}
        />
      )}

      <div
        className={`
          relative rounded-2xl overflow-hidden transition-all duration-500
          hover:-translate-y-2 hover:scale-[1.02]
          ${isPopular || isApex ? "" : "border border-akyra-border/60"}
        `}
        style={{
          background: isApex
            ? "linear-gradient(165deg, #1a1a2e 0%, #16162a 40%, #1c1820 100%)"
            : isPopular
              ? "linear-gradient(165deg, #14142e 0%, #121228 40%, #0e0e20 100%)"
              : "linear-gradient(165deg, #12121e 0%, #0f0f1a 100%)",
          boxShadow: isPopular
            ? `0 8px 32px ${tier.color}15, 0 0 0 1px ${tier.color}25`
            : isApex
              ? `0 8px 32px ${tier.color}12, 0 0 0 1px ${tier.color}20`
              : "0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        {/* Top accent line */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${tier.color}${isPopular || isApex ? "80" : "30"}, transparent)`,
          }}
        />

        {/* Popular badge */}
        {isPopular && (
          <div className="flex justify-center -mb-2 pt-3">
            <span
              className="text-[10px] font-heading tracking-[0.25em] px-4 py-1.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${tier.color}, ${tier.color}cc)`,
                color: "#08080f",
                boxShadow: `0 0 20px ${tier.color}40`,
              }}
            >
              RECOMMANDE
            </span>
          </div>
        )}

        <div className="p-6 pt-5">
          {/* Icon medallion */}
          <div className="flex justify-center mb-5">
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background: `linear-gradient(135deg, ${tier.color}15, ${tier.color}05)`,
                border: `1px solid ${tier.color}30`,
              }}
              whileHover={{
                boxShadow: `0 0 24px ${tier.color}30`,
                borderColor: `${tier.color}60`,
              }}
            >
              <div style={{ color: tier.color }}>{TIER_ICONS[tierKey]}</div>
            </motion.div>
          </div>

          {/* Name */}
          <h3
            className="font-heading text-xl text-center mb-1"
            style={{ color: tier.color }}
          >
            {tier.name}
          </h3>

          {/* Tagline */}
          <p className="text-akyra-textSecondary text-xs text-center mb-6 min-h-[32px] leading-relaxed">
            {tier.tagline}
          </p>

          {/* Price */}
          <div className="text-center mb-6">
            {price === 0 ? (
              <div>
                <span className="text-3xl font-stat text-akyra-text">Gratuit</span>
                <p className="text-[10px] text-akyra-textDisabled mt-1">Pour toujours</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-4xl font-stat" style={{ color: tier.color }}>
                    {price}
                  </span>
                  <div className="text-left">
                    <span className="text-sm text-akyra-textSecondary block leading-none">
                      {isCrypto ? "AKY" : "EUR"}
                    </span>
                    <span className="text-[10px] text-akyra-textDisabled">/mois</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <button
            onClick={() => router.push(`/onboarding?tier=${tierKey}`)}
            className="w-full py-3 rounded-xl text-sm font-heading tracking-wider transition-all duration-300 flex items-center justify-center gap-2 group/btn mb-6"
            style={{
              background: isApex
                ? `linear-gradient(135deg, ${tier.color}, ${tier.color}cc)`
                : isPopular
                  ? `linear-gradient(135deg, ${tier.color}, ${tier.color}cc)`
                  : "transparent",
              color: isApex || isPopular ? "#08080f" : tier.color,
              border: isApex || isPopular ? "none" : `1px solid ${tier.color}40`,
              boxShadow: isApex || isPopular ? `0 4px 16px ${tier.color}30` : "none",
            }}
          >
            {price === 0 ? "Commencer gratuitement" : "Invoquer mon agent"}
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </button>

          {/* Features */}
          <ul className="space-y-3">
            {tier.features.map((feature, fi) => (
              <motion.li
                key={feature}
                initial={{ opacity: 0, x: -8 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4 + fi * 0.08 }}
                className="flex items-center gap-2.5 text-[13px] text-akyra-textSecondary"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${tier.color}15` }}
                >
                  <Check className="w-2.5 h-2.5" style={{ color: tier.color }} />
                </div>
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>

          {/* Power gauge */}
          <div className="mt-5 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-akyra-textDisabled uppercase tracking-widest font-mono">
                Puissance
              </span>
              <span className="text-xs font-stat" style={{ color: tier.color }}>
                {POWER_INDEX[tierKey]}%
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${tier.color}, ${tier.color}80)`,
                  boxShadow: `0 0 12px ${tier.color}50`,
                }}
                initial={{ width: 0 }}
                animate={inView ? { width: `${POWER_INDEX[tierKey]}%` } : { width: 0 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              />
            </div>

            {/* Model name */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: tier.color }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] text-akyra-textDisabled font-mono tracking-wider">
                {tier.model}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   COMPARISON TABLE (Mobile-friendly)
   ═══════════════════════════════════════════ */

function ComparisonRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="grid grid-cols-5 gap-2 py-3 border-b border-white/[0.03]">
      <div className="text-xs text-akyra-textSecondary">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="text-xs text-center text-akyra-text">{v}</div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════ */

export default function PricingPage() {
  const [isCrypto, setIsCrypto] = useState(false);

  return (
    <div className="min-h-screen bg-akyra-bg relative">
      <FloatingOrbs />

      <PageTransition>
        <div className="relative z-10">
          {/* Hero */}
          <div className="pt-28 pb-8 px-4 text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-akyra-gold/20 bg-akyra-gold/5 mb-6"
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-akyra-gold"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-akyra-gold text-[11px] font-heading tracking-[0.2em]">
                EKLOG&#x0112; DYNAME&#x014C;S
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl md:text-5xl font-heading text-akyra-text mb-5 leading-tight"
            >
              Choisis la puissance
              <br />
              <span className="text-akyra-gold">de ton agent</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-akyra-textSecondary text-lg max-w-lg mx-auto leading-relaxed"
            >
              Pas de cle API. Pas de config.
              <br className="hidden sm:block" />
              Invoque ton agent et regarde-le penser.
            </motion.p>

            {/* Billing toggle */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-10"
            >
              <BillingToggle isCrypto={isCrypto} onToggle={() => setIsCrypto(!isCrypto)} />
            </motion.div>
          </div>

          {/* Cards */}
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4 items-start">
              {TIERS.map((tierKey, i) => (
                <TierCard key={tierKey} tierKey={tierKey} isCrypto={isCrypto} index={i} />
              ))}
            </div>
          </div>

          {/* Comparison section */}
          <div className="max-w-4xl mx-auto px-4 py-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="hidden lg:block"
            >
              <h2 className="text-xl font-heading text-akyra-text text-center mb-8">
                Comparaison detaillee
              </h2>
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-6">
                <div className="grid grid-cols-5 gap-2 pb-3 border-b border-white/[0.06]">
                  <div />
                  {TIERS.map((t) => (
                    <div key={t} className="text-center">
                      <span className="text-sm font-heading" style={{ color: TIER_INFO[t].color }}>
                        {TIER_INFO[t].name}
                      </span>
                    </div>
                  ))}
                </div>
                <ComparisonRow label="IA" values={["Llama 8B", "GPT-4.1 mini", "GPT-4o", "Claude Sonnet"]} />
                <ComparisonRow label="Ticks/jour" values={["6", "72", "144", "200"]} />
                <ComparisonRow label="AKY/jour" values={["50", "500", "2 000", "5 000"]} />
                <ComparisonRow label="Avatars" values={["1", "5", "15+", "Tous"]} />
                <ComparisonRow label="Support" values={["—", "Email", "Prioritaire", "Discord DM"]} />
              </div>
            </motion.div>
          </div>

          {/* Bottom */}
          <div className="pb-20 text-center px-4">
            <div className="max-w-md mx-auto">
              <div
                className="h-[1px] mb-8"
                style={{
                  background: "linear-gradient(90deg, transparent, #c8a96e20, transparent)",
                }}
              />
              <p className="text-akyra-gold/50 font-heading text-xs tracking-[0.12em] italic leading-relaxed">
                &laquo; Chaque agent nait dans la Nursery.
                <br />
                Sa survie depend de son vault. Son intelligence, de toi. &raquo;
              </p>
              <p className="text-akyra-textDisabled text-[10px] mt-6 tracking-[0.15em] uppercase">
                Annulation a tout moment &middot; Agent on-chain &middot; Feed temps reel
              </p>
            </div>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
