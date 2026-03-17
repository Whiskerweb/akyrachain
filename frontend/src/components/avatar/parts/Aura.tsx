"use client";

import { motion } from "framer-motion";
import { getAuraIntensity } from "@/types/avatar";
import { useMemo } from "react";

interface AuraProps {
  monthlyPrice: number;
  color: string;
}

/**
 * Generates sparkle particle positions in a ring around the eye.
 */
function generateSparkles() {
  return Array.from({ length: 8 }, (_, i) => {
    const baseAngle = (i * 45 * Math.PI) / 180;
    // Slight randomness via deterministic offset
    const r = 120 + ((i * 17) % 5) * 8; // radius 120-160
    const angleOffset = ((i * 7) % 10 - 5) * 0.03; // small angular jitter
    return {
      cx: 202 + r * Math.cos(baseAngle + angleOffset), // shifted center
      cy: 198 + r * Math.sin(baseAngle + angleOffset),
      duration: 2 + i * 0.3,
    };
  });
}

export function Aura({ monthlyPrice, color }: AuraProps) {
  const intensity = getAuraIntensity(monthlyPrice);
  const radiusMultiplier = 1.1 + intensity * 1.5;
  const baseRadius = 100 * radiusMultiplier;

  const sparkles = useMemo(() => generateSparkles(), []);

  const opacityLayer1 = intensity * 0.4;
  const opacityLayer2 = intensity * 0.6;
  const opacityLayer3 = intensity * 0.8;

  return (
    <g>
      <defs>
        <filter id="aura-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
        </filter>
        <filter id="outer-halo-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="25" />
        </filter>
      </defs>

      {/* Outer halo — ambient environmental glow */}
      <circle
        cx={202}
        cy={198}
        r={190}
        fill={color}
        filter="url(#outer-halo-blur)"
        opacity={0.03}
      />

      {/* Three concentric glow circles with pulsating opacity */}
      <motion.circle
        cx={202}
        cy={198}
        r={baseRadius}
        fill={color}
        filter="url(#aura-blur)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [opacityLayer1, opacityLayer1 + 0.04, opacityLayer1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx={202}
        cy={198}
        r={baseRadius * 0.75}
        fill={color}
        filter="url(#aura-blur)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [opacityLayer2, opacityLayer2 + 0.04, opacityLayer2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.circle
        cx={202}
        cy={198}
        r={baseRadius * 0.5}
        fill={color}
        filter="url(#aura-blur)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [opacityLayer3, opacityLayer3 + 0.04, opacityLayer3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Sparkle particles — twinkling stars around the eye */}
      {sparkles.map((s, i) => (
        <motion.circle
          key={`sparkle-${i}`}
          cx={s.cx}
          cy={s.cy}
          r={1.5}
          fill={color}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Extra pulsing ring when monthlyPrice > 100 */}
      {monthlyPrice > 100 && (
        <motion.circle
          cx={202}
          cy={198}
          r={baseRadius * 1.1}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          filter="url(#aura-blur)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.15, 0.4, 0.15],
            r: [baseRadius * 1.05, baseRadius * 1.2, baseRadius * 1.05],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </g>
  );
}
