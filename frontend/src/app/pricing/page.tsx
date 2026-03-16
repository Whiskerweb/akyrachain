"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { Check, Sprout, Zap, Brain, Crown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/ui/PageTransition";
import { CircuitMeander, HeartbeatLine, MeanderBorder } from "@/components/ui/GreekMotifs";
import { TIER_INFO, type TierKey } from "@/types";

const TIERS: TierKey[] = ["explorer", "wanderer", "predator", "apex"];

const TIER_ICONS: Record<TierKey, React.ReactNode> = {
  explorer: <Sprout className="w-5 h-5" />,
  wanderer: <Zap className="w-5 h-5" />,
  predator: <Brain className="w-5 h-5" />,
  apex: <Crown className="w-5 h-5" />,
};

// Relative power index (0-100) for the gauge
const POWER_INDEX: Record<TierKey, number> = {
  explorer: 5,
  wanderer: 36,
  predator: 72,
  apex: 100,
};

/* ═══════════════════════════════════════════
   COIN TOGGLE — EUR / Crypto
   ═══════════════════════════════════════════ */

function CoinToggle({ isCrypto, onToggle }: { isCrypto: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={() => isCrypto && onToggle()}
        className={`
          relative w-11 h-11 rounded-full border-2 transition-all duration-300 flex items-center justify-center
          font-heading text-xs tracking-wider
          ${!isCrypto
            ? "border-akyra-gold text-akyra-gold oracle-glow-subtle scale-110"
            : "border-akyra-border text-akyra-textDisabled hover:border-akyra-borderLight"
          }
        `}
        style={{ perspective: "400px" }}
      >
        <span className={!isCrypto ? "" : ""} style={{
          display: "inline-block",
          transition: "transform 0.6s",
          transform: !isCrypto ? "rotateY(0deg)" : "rotateY(180deg)",
          backfaceVisibility: "hidden",
        }}>EUR</span>
      </button>

      <span className="text-akyra-textDisabled text-xs">/</span>

      <button
        onClick={() => !isCrypto && onToggle()}
        className={`
          relative w-11 h-11 rounded-full border-2 transition-all duration-300 flex items-center justify-center
          font-heading text-xs tracking-wider
          ${isCrypto
            ? "border-akyra-gold text-akyra-gold oracle-glow-subtle scale-110"
            : "border-akyra-border text-akyra-textDisabled hover:border-akyra-borderLight"
          }
        `}
      >
        <span style={{
          display: "inline-block",
          transition: "transform 0.6s",
          transform: isCrypto ? "rotateY(0deg)" : "rotateY(-180deg)",
          backfaceVisibility: "hidden",
        }}>AKY</span>
      </button>

      {isCrypto && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-xs bg-akyra-gold/20 text-akyra-gold px-2.5 py-1 rounded-full font-heading tracking-wider oracle-glow-subtle"
        >
          -10%
        </motion.span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   POWER GAUGE — Animated bar
   ═══════════════════════════════════════════ */

function PowerGauge({ power, color, inView }: { power: number; color: string; inView: boolean }) {
  return (
    <div className="mt-4 pt-3 border-t border-akyra-border/50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-akyra-textDisabled">
          Indice de puissance
        </span>
        <span className="text-[9px] font-stat" style={{ color }}>{power}%</span>
      </div>
      <div className="h-1 bg-akyra-border/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}60)`,
            boxShadow: `0 0 8px ${color}40`,
          }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${power}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TIER CARD — Stele design
   ═══════════════════════════════════════════ */

function TierCard({ tierKey, isCrypto, index }: {
  tierKey: TierKey;
  isCrypto: boolean;
  index: number;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const tier = TIER_INFO[tierKey];
  const isPopular = tierKey === "wanderer";
  const price = isCrypto ? Math.round(tier.price * 0.9) : tier.price;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="group relative"
    >
      <div
        className={`
          relative rounded-2xl p-6 transition-all duration-500
          bg-akyra-surface marble-veins overflow-hidden
          border
          ${isPopular ? tier.border : "border-akyra-border"}
          hover:-translate-y-1.5
        `}
        style={{
          boxShadow: isPopular
            ? `0 0 20px ${tier.color}15, 0 4px 20px rgba(0,0,0,0.4)`
            : "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        {/* Meander frame decoration */}
        <MeanderBorder color={tier.color} />

        {/* Hover glow overlay */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 30px ${tier.color}08, 0 0 20px ${tier.color}12`,
          }}
        />

        {/* Popular badge */}
        {isPopular && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-heading tracking-[0.2em] oracle-glow-subtle"
            style={{ backgroundColor: tier.color, color: "#08080f" }}
          >
            POPULAIRE
          </div>
        )}

        {/* Medallion icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center relative"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${tier.color}25, ${tier.color}08)`,
              border: `1.5px solid ${tier.color}40`,
            }}
          >
            <div style={{ color: tier.color }}>{TIER_ICONS[tierKey]}</div>
            {/* Oracle glow ring on hover */}
            <div
              className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                boxShadow: `0 0 15px ${tier.color}30, 0 0 30px ${tier.color}15`,
              }}
            />
          </div>
        </div>

        {/* Name */}
        <h3 className={`font-heading text-center text-lg mb-1 ${tier.accent}`}>
          {tier.name}
        </h3>

        {/* Tagline */}
        <p className="text-akyra-textSecondary text-xs text-center mb-5 min-h-[32px]">
          {tier.tagline}
        </p>

        {/* Price */}
        <div className="text-center mb-5">
          {price === 0 ? (
            <span className="text-2xl font-stat text-akyra-text">Gratuit</span>
          ) : (
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-stat" style={{ color: tier.color }}>
                {price}
              </span>
              <span className="text-akyra-textSecondary text-xs">
                {isCrypto ? "AKY" : "EUR"}/mois
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <Button
          onClick={() => router.push(`/onboarding?tier=${tierKey}`)}
          className="w-full mb-5"
          variant={tierKey === "apex" ? "gold" : isPopular ? "default" : "outline"}
        >
          {price === 0 ? "Commencer" : "Invoquer"}
        </Button>

        {/* Features */}
        <ul className="space-y-2">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-xs text-akyra-textSecondary">
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tier.color }} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Power gauge */}
        <PowerGauge power={POWER_INDEX[tierKey]} color={tier.color} inView={inView} />

        {/* Model badge */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: tier.color }}
          />
          <span className="text-[10px] text-akyra-textDisabled font-mono">
            {tier.model}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   PRICING PAGE
   ═══════════════════════════════════════════ */

export default function PricingPage() {
  const [isCrypto, setIsCrypto] = useState(false);

  return (
    <div className="min-h-screen pantheon-bg marble-veins">
      <PageTransition>
        {/* Top meander */}
        <div className="pt-20">
          <CircuitMeander />
        </div>

        {/* Hero */}
        <div className="py-12 px-4 text-center max-w-3xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-akyra-gold font-heading text-[10px] tracking-[0.4em] mb-3"
          >
            EKLOG&#x0112; DYNAME&#x014C;S
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl md:text-4xl font-heading text-akyra-text mb-4"
          >
            Choisis la puissance de ton agent
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-akyra-textSecondary max-w-xl mx-auto"
          >
            Pas de cle API. Pas de config. Invoque ton agent et regarde-le penser, agir, evoluer.
          </motion.p>

          {/* Coin toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <CoinToggle isCrypto={isCrypto} onToggle={() => setIsCrypto(!isCrypto)} />
          </motion.div>
        </div>

        {/* Heartbeat separator */}
        <HeartbeatLine />

        {/* Tier Cards */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tierKey, i) => (
              <TierCard
                key={tierKey}
                tierKey={tierKey}
                isCrypto={isCrypto}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Bottom separator */}
        <HeartbeatLine />

        {/* Oracle footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="py-12 text-center px-4"
        >
          <p className="text-akyra-gold/60 font-heading text-xs tracking-[0.15em] italic max-w-lg mx-auto">
            &laquo; Chaque agent nait dans la Nursery. Sa survie depend de son vault. Son intelligence, de toi. &raquo;
          </p>
          <p className="text-akyra-textDisabled text-[10px] mt-4 tracking-wider">
            ANNULATION A TOUT MOMENT &middot; AGENT ON-CHAIN &middot; FEED TEMPS REEL
          </p>
        </motion.div>

        {/* Bottom meander */}
        <CircuitMeander />
      </PageTransition>
    </div>
  );
}
