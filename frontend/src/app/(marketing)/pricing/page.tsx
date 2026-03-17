"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Check, Sprout, Zap, Brain, Crown, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { CircuitMeander, HeartbeatLine, MeanderBorder } from "@/components/ui/GreekMotifs";
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
   COIN TOGGLE — Ancient EUR / Crypto pieces
   ═══════════════════════════════════════════ */

function CoinPiece({ symbol, label, active, activeColor, onClick, flipping }: {
  symbol: string;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
  flipping: boolean;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <motion.div
        className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg relative"
        style={{
          borderColor: active ? activeColor : "#2a2a40",
          background: active
            ? `radial-gradient(circle at 35% 35%, ${activeColor}28, ${activeColor}06)`
            : "rgba(255,255,255,0.01)",
          color: active ? activeColor : "#4a4458",
          boxShadow: active
            ? `0 0 15px ${activeColor}25, 0 0 30px ${activeColor}12, inset 0 0 10px ${activeColor}08`
            : "none",
          transformStyle: "preserve-3d",
        }}
        animate={flipping ? { rotateY: [0, 180, 360] } : { rotateY: 0 }}
        transition={flipping ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.3 }}
        whileHover={!active ? { borderColor: `${activeColor}50`, scale: 1.08 } : undefined}
      >
        <span className="font-heading">{symbol}</span>
        {/* Inner ring decoration */}
        {active && (
          <div
            className="absolute inset-1.5 rounded-full border pointer-events-none"
            style={{ borderColor: `${activeColor}18` }}
          />
        )}
        {/* Dot markers like ancient coin */}
        {active && (
          <>
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: `${activeColor}30` }} />
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: `${activeColor}30` }} />
          </>
        )}
      </motion.div>
      <span
        className="text-[9px] tracking-[0.15em] font-mono transition-colors duration-300"
        style={{ color: active ? activeColor : "#4a4458" }}
      >
        {label}
      </span>
    </button>
  );
}

function CoinToggle({ isCrypto, onToggle }: { isCrypto: boolean; onToggle: () => void }) {
  const [flipping, setFlipping] = useState<"eur" | "crypto" | null>(null);

  const handleFlip = (target: "eur" | "crypto") => {
    if ((target === "eur" && !isCrypto) || (target === "crypto" && isCrypto)) return;
    setFlipping(target === "eur" ? "crypto" : "eur");
    setTimeout(() => {
      onToggle();
      setFlipping(null);
    }, 250);
  };

  return (
    <div className="flex items-center justify-center gap-5">
      <CoinPiece
        symbol="€"
        label="EUR"
        active={!isCrypto}
        activeColor="#5c7cfa"
        onClick={() => handleFlip("eur")}
        flipping={flipping === "eur"}
      />

      <div className="flex flex-col items-center gap-0.5">
        <div className="w-px h-4 bg-akyra-border/30" />
        <span className="text-[8px] text-akyra-textDisabled font-mono tracking-widest">OU</span>
        <div className="w-px h-4 bg-akyra-border/30" />
      </div>

      <CoinPiece
        symbol="◈"
        label="CRYPTO"
        active={isCrypto}
        activeColor="#c8a96e"
        onClick={() => handleFlip("crypto")}
        flipping={flipping === "crypto"}
      />

      <AnimatePresence>
        {isCrypto && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.5, x: -8 }}
            className="text-[11px] font-heading tracking-wider px-2.5 py-1 rounded-full"
            style={{
              background: "linear-gradient(135deg, #c8a96e20, #c8a96e08)",
              color: "#c8a96e",
              border: "1px solid #c8a96e25",
              boxShadow: "0 0 16px #c8a96e10",
            }}
          >
            -10%
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TIER CARD — Stele / Artifact
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
          className="absolute -inset-[1px] rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"
          style={{
            background: `linear-gradient(135deg, ${tier.color}35, transparent 50%, ${tier.color}18)`,
            filter: "blur(1px)",
          }}
        />
      )}

      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:scale-[1.01]"
        style={{
          background: isApex
            ? "linear-gradient(165deg, #1a1a2e 0%, #16162a 40%, #1c1820 100%)"
            : isPopular
              ? "linear-gradient(165deg, #14142e 0%, #121228 40%, #0e0e20 100%)"
              : "linear-gradient(165deg, #12121e 0%, #0f0f1a 100%)",
          boxShadow: isPopular
            ? `0 8px 32px ${tier.color}12, 0 0 0 1px ${tier.color}20`
            : isApex
              ? `0 8px 32px ${tier.color}10, 0 0 0 1px ${tier.color}18`
              : "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Meander border — reveals on hover */}
        <MeanderBorder
          color={tier.color}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"
        />

        {/* Marble veins — reveals on hover */}
        <div className="marble-veins absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

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
          {/* Circular icon medallion with oracle-glow */}
          <div className="flex justify-center mb-5">
            <motion.div
              className="w-16 h-16 rounded-full flex items-center justify-center relative"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${tier.color}18, ${tier.color}04)`,
                border: `1.5px solid ${tier.color}30`,
              }}
              whileHover={{
                boxShadow: `0 0 15px ${tier.color}30, 0 0 30px ${tier.color}15, inset 0 0 10px ${tier.color}05`,
              }}
            >
              {/* Inner ring */}
              <div
                className="absolute inset-2.5 rounded-full border pointer-events-none"
                style={{ borderColor: `${tier.color}10` }}
              />
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
                  <motion.span
                    key={price}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-stat"
                    style={{ color: tier.color }}
                  >
                    {price}
                  </motion.span>
                  <div className="text-left">
                    <motion.span
                      key={isCrypto ? "aky" : "eur"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-akyra-textSecondary block leading-none"
                    >
                      {isCrypto ? "AKY" : "EUR"}
                    </motion.span>
                    <span className="text-[10px] text-akyra-textDisabled">/mois</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <button
            onClick={() => {
              const defaults: Record<string, { model: string; ticks: number }> = {
                explorer: { model: "llama-3.1-8b", ticks: 6 },
                wanderer: { model: "gpt-4.1-mini", ticks: 72 },
                predator: { model: "gpt-4o", ticks: 144 },
                apex: { model: "claude-sonnet-4-6", ticks: 200 },
              };
              const d = defaults[tierKey] || defaults.wanderer;
              router.push(`/onboarding?model=${d.model}&ticks=${d.ticks}`);
            }}
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
                  background: `linear-gradient(90deg, ${tier.color}, ${tier.color}60)`,
                  boxShadow: `0 0 12px ${tier.color}40`,
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
   COMPARISON TABLE
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
      {/* Grain texture for depth */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
      />

      {/* Ambient radial glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse at 50% 20%, rgba(200,169,110,0.03) 0%, transparent 60%)",
        }}
      />

      <PageTransition>
        <div className="relative z-10">
          {/* Top meander frame */}
          <div className="pt-20 px-4 max-w-5xl mx-auto">
            <CircuitMeander />
          </div>

          {/* Hero */}
          <div className="pt-8 pb-8 px-4 text-center max-w-3xl mx-auto">
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

            {/* Coin toggle */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-10"
            >
              <CoinToggle isCrypto={isCrypto} onToggle={() => setIsCrypto(!isCrypto)} />
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

          {/* HeartbeatLine separator */}
          <div className="max-w-4xl mx-auto px-4 py-2">
            <HeartbeatLine />
          </div>

          {/* Comparison section */}
          <div className="max-w-4xl mx-auto px-4 py-12">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="hidden lg:block"
            >
              <h2 className="text-xl font-heading text-akyra-text text-center mb-8">
                Comparaison detaillee
              </h2>
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-6 relative overflow-hidden">
                {/* Subtle marble veins on the table */}
                <div className="marble-veins absolute inset-0 pointer-events-none rounded-2xl opacity-50" />
                <div className="relative z-10">
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
                  <ComparisonRow label="Support" values={["\u2014", "Email", "Prioritaire", "Discord DM"]} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom oracle quote */}
          <div className="pb-6 text-center px-4">
            <div className="max-w-md mx-auto">
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

          {/* Bottom meander frame */}
          <div className="px-4 pb-8 max-w-5xl mx-auto">
            <CircuitMeander />
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
