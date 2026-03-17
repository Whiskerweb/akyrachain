"use client";

import { motion } from "framer-motion";
import type { SkinKey } from "@/types/avatar";
import { SCLERA_CONFIGS } from "@/types/avatar";
import { useMemo } from "react";

interface ScleraProps {
  skin: SkinKey;
}

export function Sclera({ skin }: ScleraProps) {
  const sclera = SCLERA_CONFIGS[skin];
  const { fillColor, accentColor } = sclera;

  // Unique gradient IDs per skin to avoid SVG ID conflicts
  const gradientId = useMemo(() => `sclera-grad-${skin}`, [skin]);
  const innerShadowId = useMemo(() => `sclera-inner-${skin}`, [skin]);
  const cornealGradId = useMemo(() => `sclera-corneal-${skin}`, [skin]);

  // Eyelash positions fanning out from the upper eyelid curve
  const eyelashes = useMemo(() => {
    const lashes = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count; // 0..1 across the curve
      // Position on the upper eyelid arc: M100,200 Q200,135 300,200
      const cx = 100 + t * 200;
      const cy = 200 - (1 - (2 * t - 1) ** 2) * 65; // Parabolic arc approximation of the Q curve
      // Angle: fan outward and upward
      const angleBase = -90; // straight up
      const angleFan = (t - 0.5) * 50; // spread +-25deg from center
      const angle = ((angleBase + angleFan) * Math.PI) / 180;
      const length = 8 + (1 - Math.abs(t - 0.5) * 2) * 4; // longer in center
      lashes.push({
        x1: cx,
        y1: cy,
        x2: cx + length * Math.cos(angle),
        y2: cy + length * Math.sin(angle),
      });
    }
    return lashes;
  }, []);

  return (
    <g>
      <defs>
        {/* Radial gradient: center lighter, edges accent-tinted */}
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={fillColor} stopOpacity={1} />
          <stop offset="70%" stopColor={fillColor} stopOpacity={0.95} />
          <stop offset="100%" stopColor={accentColor} stopOpacity={0.35} />
        </radialGradient>
        {/* Inner shadow gradient */}
        <radialGradient id={innerShadowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity={0} />
          <stop offset="60%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.12} />
        </radialGradient>
        {/* Corneal reflection gradient */}
        <linearGradient id={cornealGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.07} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Main almond eye shape */}
      <motion.ellipse
        cx={200}
        cy={200}
        rx={100}
        ry={70}
        fill={`url(#${gradientId})`}
        initial={{ fill: `url(#${gradientId})` }}
        animate={{ fill: `url(#${gradientId})` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Thin accent outline */}
      <ellipse
        cx={200}
        cy={200}
        rx={100}
        ry={70}
        fill="none"
        stroke={accentColor}
        strokeWidth={1.5}
        strokeOpacity={0.3}
      />

      {/* Inner shadow effect */}
      <ellipse
        cx={200}
        cy={200}
        rx={96}
        ry={66}
        fill={`url(#${innerShadowId})`}
      />

      {/* Wet rim — subtle highlight around inner edge */}
      <ellipse
        cx={200}
        cy={200}
        rx={96}
        ry={66}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1}
        opacity={0.04}
      />

      {/* Corneal reflection — glassy dome over upper half */}
      <ellipse
        cx={200}
        cy={185}
        rx={90}
        ry={40}
        fill={`url(#${cornealGradId})`}
      />

      {/* Upper eyelid — overlaps top of sclera for natural shadow */}
      <path
        d="M 100 200 Q 200 130 300 200"
        fill="#12121e"
      />

      {/* Lower eyelid — subtle arc below */}
      <path
        d="M 110 200 Q 200 260 290 200"
        fill="#12121e"
        opacity={0.6}
      />

      {/* Eyelashes — small lines fanning from upper eyelid */}
      {eyelashes.map((lash, i) => (
        <line
          key={i}
          x1={lash.x1}
          y1={lash.y1}
          x2={lash.x2}
          y2={lash.y2}
          stroke="#e8e4df"
          strokeWidth={0.8}
          opacity={0.35}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}
