"use client";

import { motion } from "framer-motion";

/* ═══════════════════════════════════════════
   CIRCUIT MEANDER — Greek key × PCB trace
   Reusable across pages (extracted from phone/page)
   ═══════════════════════════════════════════ */

export function CircuitMeander({ color = "#c8a96e" }: { color?: string }) {
  return (
    <div className="w-full h-4 relative overflow-hidden opacity-60">
      <svg width="100%" height="16" className="absolute inset-0">
        <defs>
          <pattern id={`meander-${color.replace("#", "")}`} x="0" y="0" width="40" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M0,8 L8,8 L8,2 L16,2 L16,8 L24,8 L24,14 L32,14 L32,8 L40,8"
              fill="none"
              stroke={color}
              strokeWidth="1"
              strokeOpacity="0.25"
            />
            <circle cx="8" cy="8" r="1.2" fill={color} fillOpacity="0.3" />
            <circle cx="16" cy="2" r="1.2" fill={color} fillOpacity="0.2" />
            <circle cx="24" cy="8" r="1.2" fill={color} fillOpacity="0.3" />
            <circle cx="32" cy="14" r="1.2" fill={color} fillOpacity="0.2" />
          </pattern>
        </defs>
        <rect width="100%" height="16" fill={`url(#meander-${color.replace("#", "")})`} />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HEARTBEAT LINE — EKG pulse
   ═══════════════════════════════════════════ */

export function HeartbeatLine({ color = "#c8a96e" }: { color?: string }) {
  return (
    <div className="w-full h-6 relative overflow-hidden">
      <svg width="100%" height="24" className="absolute inset-0" preserveAspectRatio="none">
        <path
          d="M0,12 L60,12 L70,12 L75,3 L80,20 L85,8 L90,12 L160,12 L170,12 L175,3 L180,20 L185,8 L190,12 L260,12 L270,12 L275,3 L280,20 L285,8 L290,12 L360,12 L370,12 L375,3 L380,20 L385,8 L390,12 L460,12 L470,12 L475,3 L480,20 L485,8 L490,12 L560,12 L570,12 L575,3 L580,20 L585,8 L590,12 L700,12"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.35"
          strokeDasharray="200 800"
          className="animate-[heartbeatSweep_3s_linear_infinite]"
        />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MEANDER BORDER — Card border decoration
   ═══════════════════════════════════════════ */

export function MeanderBorder({ color = "#c8a96e", className = "" }: { color?: string; className?: string }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none rounded-2xl ${className}`}
      style={{
        border: "1px solid transparent",
        background: `
          linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0)) padding-box,
          repeating-linear-gradient(
            90deg,
            ${color}18 0px,
            ${color}18 6px,
            transparent 6px,
            transparent 10px,
            ${color}10 10px,
            ${color}10 14px,
            transparent 14px,
            transparent 20px
          ) border-box
        `,
      }}
    />
  );
}

/* ═══════════════════════════════════════════
   ONBOARDING FRIEZE — Animated SVG progress
   4 scenes that fill with color as steps complete
   ═══════════════════════════════════════════ */

export function OnboardingFrieze({ step, color }: { step: number; color: string }) {
  const inactive = "#2a2a40";

  return (
    <div className="w-full flex justify-center py-2">
      <svg width="360" height="52" viewBox="0 0 360 52" fill="none" className="overflow-visible">
        {/* Scene 1: Temple (Plan) */}
        <g>
          <motion.path
            d="M10,42 L10,20 L30,8 L50,20 L50,42 Z"
            stroke={step >= 0 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 0 ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.path
            d="M20,42 L20,28 L40,28 L40,42"
            stroke={step >= 0 ? color : inactive}
            strokeWidth="1"
            strokeOpacity="0.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 0 ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          {step >= 1 && (
            <motion.rect
              x="10" y="8" width="40" height="34" rx="2"
              fill={color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.08 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </g>

        {/* Connector 1→2 */}
        <motion.line
          x1="55" y1="32" x2="95" y2="32"
          stroke={step >= 1 ? color : inactive}
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: step >= 1 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Scene 2: Figure emerging (Identity) */}
        <g>
          <motion.path
            d="M115,42 L115,22 Q115,14 122,14 Q129,14 129,22 L129,42"
            stroke={step >= 1 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 1 ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.circle
            cx="122" cy="10" r="4"
            stroke={step >= 1 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 1 ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          />
          {step >= 2 && (
            <motion.rect
              x="108" y="4" width="28" height="40" rx="2"
              fill={color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.08 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </g>

        {/* Connector 2→3 */}
        <motion.line
          x1="140" y1="32" x2="180" y2="32"
          stroke={step >= 2 ? color : inactive}
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: step >= 2 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Scene 3: Adorned figure (Avatar) */}
        <g>
          <motion.path
            d="M200,42 L200,22 Q200,14 210,14 Q220,14 220,22 L220,42"
            stroke={step >= 2 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 2 ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.circle
            cx="210" cy="10" r="4"
            stroke={step >= 2 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 2 ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
          {/* Ornament rays */}
          {step >= 2 && [0, 1, 2, 3].map((i) => (
            <motion.line
              key={i}
              x1="210" y1="10"
              x2={210 + Math.cos((i * Math.PI) / 2) * 10}
              y2={10 + Math.sin((i * Math.PI) / 2) * 10}
              stroke={color}
              strokeWidth="0.8"
              strokeOpacity="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
            />
          ))}
          {step >= 3 && (
            <motion.rect
              x="193" y="4" width="34" height="40" rx="2"
              fill={color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.08 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </g>

        {/* Connector 3→4 */}
        <motion.line
          x1="225" y1="32" x2="265" y2="32"
          stroke={step >= 3 ? color : inactive}
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: step >= 3 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Scene 4: Awakened figure with halo (Genesis) */}
        <g>
          <motion.path
            d="M285,42 L285,22 Q285,14 295,14 Q305,14 305,22 L305,42"
            stroke={step >= 3 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 3 ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.circle
            cx="295" cy="10" r="4"
            stroke={step >= 3 ? color : inactive}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: step >= 3 ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
          {/* Halo */}
          {step >= 3 && (
            <motion.circle
              cx="295" cy="10" r="12"
              stroke={color}
              strokeWidth="0.8"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          )}
        </g>

        {/* Step labels */}
        {["EKLOGE", "ONOMA", "MORPHE", "GENESIS"].map((label, i) => (
          <text
            key={label}
            x={[30, 122, 210, 295][i]}
            y="50"
            textAnchor="middle"
            fontSize="7"
            fontFamily="var(--font-heading)"
            letterSpacing="0.12em"
            fill={i <= step ? color : inactive}
            fillOpacity={i === step ? 1 : 0.5}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ORBITING GREEK SYMBOLS — Around the agent orb
   ═══════════════════════════════════════════ */

export function OrbitingSymbols({ color, size = 80 }: { color: string; size?: number }) {
  const symbols = ["α", "β", "γ", "δ"];
  const radius = size / 2 + 20;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {symbols.map((sym, i) => (
        <motion.span
          key={sym}
          className="absolute font-heading text-xs"
          style={{
            color,
            opacity: 0.3,
            left: "50%",
            top: "50%",
          }}
          animate={{
            x: [
              Math.cos((i * Math.PI) / 2) * radius,
              Math.cos((i * Math.PI) / 2 + Math.PI * 2) * radius,
            ],
            y: [
              Math.sin((i * Math.PI) / 2) * radius,
              Math.sin((i * Math.PI) / 2 + Math.PI * 2) * radius,
            ],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {sym}
        </motion.span>
      ))}
    </div>
  );
}
