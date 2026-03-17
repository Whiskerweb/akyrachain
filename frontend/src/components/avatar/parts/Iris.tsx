"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ModelCategory } from "@/types/avatar";
import { CATEGORY_COLORS } from "@/types/avatar";

interface IrisProps {
  modelCategory: ModelCategory;
}

/**
 * Generates 8 radiating lines from center outward to the iris edge.
 */
function RadiatingLines({ color }: { color: string }) {
  const lines = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    const innerR = 12;
    const outerR = 50;
    return {
      x1: 200 + innerR * Math.cos(angle),
      y1: 200 + innerR * Math.sin(angle),
      x2: 200 + outerR * Math.cos(angle),
      y2: 200 + outerR * Math.sin(angle),
    };
  });

  return (
    <g>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={color}
          strokeWidth={0.8}
          strokeOpacity={0.7}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/**
 * Four small golden arcs that rotate continuously for elite category.
 */
function SwirlingArcs({ color }: { color: string }) {
  const arcs = Array.from({ length: 4 }, (_, i) => {
    const startAngle = i * 90;
    const rad1 = ((startAngle + 10) * Math.PI) / 180;
    const rad2 = ((startAngle + 70) * Math.PI) / 180;
    const r = 38;
    const x1 = 200 + r * Math.cos(rad1);
    const y1 = 200 + r * Math.sin(rad1);
    const x2 = 200 + r * Math.cos(rad2);
    const y2 = 200 + r * Math.sin(rad2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  });

  return (
    <motion.g
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      {arcs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.6}
          strokeLinecap="round"
        />
      ))}
    </motion.g>
  );
}

/**
 * 20 radial fibers from center to iris edge, slowly rotating.
 */
function RadialFibers({ color }: { color: string }) {
  const fibers = Array.from({ length: 20 }, (_, i) => {
    const angle = (i * 18 * Math.PI) / 180;
    const innerR = 10;
    const outerR = 50;
    return {
      x1: 200 + innerR * Math.cos(angle),
      y1: 200 + innerR * Math.sin(angle),
      x2: 200 + outerR * Math.cos(angle),
      y2: 200 + outerR * Math.sin(angle),
      opacity: 0.15 + (i % 3) * 0.1,
    };
  });

  return (
    <motion.g
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      {fibers.map((f, i) => (
        <line
          key={i}
          x1={f.x1}
          y1={f.y1}
          x2={f.x2}
          y2={f.y2}
          stroke={color}
          strokeWidth={0.5}
          opacity={f.opacity}
          strokeLinecap="round"
        />
      ))}
    </motion.g>
  );
}

/**
 * Elite sparkles — floating golden dots within the iris.
 */
function EliteSparkles() {
  const sparkles = [
    { cx: 190, cy: 190, dur: 2 },
    { cx: 210, cy: 195, dur: 2.7 },
    { cx: 195, cy: 210, dur: 3.2 },
    { cx: 208, cy: 188, dur: 1.8 },
  ];

  return (
    <g>
      {sparkles.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={1}
          fill="#c8a96e"
          animate={{ opacity: [0, 0.7, 0] }}
          transition={{
            duration: s.dur,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </g>
  );
}

export function Iris({ modelCategory }: IrisProps) {
  const { color, secondaryColor } = CATEGORY_COLORS[modelCategory];

  const gradientId = useMemo(() => `iris-grad-${modelCategory}`, [modelCategory]);

  return (
    <g>
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={0.85} />
          <stop offset="40%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={secondaryColor} stopOpacity={1} />
        </radialGradient>
      </defs>

      {/* Main iris circle */}
      <motion.circle
        cx={200}
        cy={200}
        r={52}
        fill={`url(#${gradientId})`}
        initial={{ r: 48 }}
        animate={{ r: 52 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />

      {/* Radial fibers — slow imperceptible rotation */}
      <RadialFibers color={color} />

      {/* Limbal ring — dark ring at iris-sclera boundary */}
      <circle
        cx={200}
        cy={200}
        r={52}
        fill="none"
        stroke={secondaryColor}
        strokeWidth={2.5}
        opacity={0.5}
      />

      {/* Internal light arc — light passing through upper-left */}
      <path
        d="M 175 185 Q 185 175 195 180"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1}
        opacity={0.12}
        strokeLinecap="round"
      />

      {/* Category-specific patterns */}

      {/* Standard: 3 concentric ring strokes */}
      {modelCategory === "standard" && (
        <g>
          <circle
            cx={200} cy={200} r={30}
            fill="none" stroke={color}
            strokeWidth={1} strokeOpacity={0.3}
          />
          <circle
            cx={200} cy={200} r={40}
            fill="none" stroke={color}
            strokeWidth={0.8} strokeOpacity={0.2}
          />
          <circle
            cx={200} cy={200} r={48}
            fill="none" stroke={color}
            strokeWidth={0.6} strokeOpacity={0.15}
          />
        </g>
      )}

      {/* Premium: 8 radiating electric lines */}
      {modelCategory === "premium" && <RadiatingLines color={color} />}

      {/* Elite: swirling golden arcs + sparkles */}
      {modelCategory === "elite" && (
        <>
          <SwirlingArcs color={color} />
          <EliteSparkles />
        </>
      )}
    </g>
  );
}
