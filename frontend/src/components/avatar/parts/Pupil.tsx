"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Specialization } from "@/types/avatar";
import { useMemo } from "react";

interface PupilProps {
  specialization: Specialization;
  color: string;
}

const PUPIL_OPACITY = 0.85;

/**
 * Builder: 8-tooth gear — polygon with alternating inner/outer radii
 */
function GearShape({ gradientId, color }: { gradientId: string; color: string }) {
  const teeth = 8;
  const innerR = 8;
  const outerR = 14;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i * Math.PI) / teeth - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(`${200 + r * Math.cos(angle)},${200 + r * Math.sin(angle)}`);
  }
  return (
    <motion.g
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      <polygon
        points={points.join(" ")}
        fill={`url(#${gradientId})`}
        fillOpacity={PUPIL_OPACITY}
      />
      {/* Contour */}
      <polygon
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
    </motion.g>
  );
}

/**
 * Trader: diamond/rhombus — rotated square
 */
function DiamondShape({ gradientId, color }: { gradientId: string; color: string }) {
  const size = 12;
  const pts = `200,${200 - size} ${200 + size},200 200,${200 + size} ${200 - size},200`;
  return (
    <motion.g
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      <polygon
        points={pts}
        fill={`url(#${gradientId})`}
        fillOpacity={PUPIL_OPACITY}
      />
      <polygon
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
    </motion.g>
  );
}

/**
 * Chronicler: quill/feather — curved calligraphy path
 */
function QuillShape({ gradientId, color }: { gradientId: string; color: string }) {
  const d = "M 200 186 Q 206 192 204 200 Q 202 208 196 214 Q 194 210 196 204 Q 192 200 194 194 Q 196 190 200 186 Z";
  return (
    <motion.g
      animate={{ rotate: [0, 5, 0, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      <path
        d={d}
        fill={`url(#${gradientId})`}
        fillOpacity={PUPIL_OPACITY}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
    </motion.g>
  );
}

/**
 * Auditor: magnifying glass — circle + diagonal handle line
 */
function MagnifyingGlassShape({ gradientId, color }: { gradientId: string; color: string }) {
  return (
    <motion.g
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      <circle
        cx={198} cy={197} r={8}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeOpacity={PUPIL_OPACITY}
      />
      <line
        x1={204} y1={203}
        x2={212} y2={211}
        stroke={`url(#${gradientId})`}
        strokeWidth={2.5}
        strokeOpacity={PUPIL_OPACITY}
        strokeLinecap="round"
      />
      {/* Contour */}
      <circle
        cx={198} cy={197} r={8}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
      <line
        x1={204} y1={203}
        x2={212} y2={211}
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
        strokeLinecap="round"
      />
    </motion.g>
  );
}

/**
 * Diplomat: chain links — two interlocking ovals
 */
function ChainLinksShape({ gradientId, color }: { gradientId: string; color: string }) {
  return (
    <motion.g
      animate={{ rotate: [0, 3, 0, -3, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      <ellipse
        cx={195} cy={200} rx={7} ry={10}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeOpacity={PUPIL_OPACITY}
      />
      <ellipse
        cx={205} cy={200} rx={7} ry={10}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeOpacity={PUPIL_OPACITY}
      />
      {/* Contour */}
      <ellipse
        cx={195} cy={200} rx={7} ry={10}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
      <ellipse
        cx={205} cy={200} rx={7} ry={10}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
    </motion.g>
  );
}

/**
 * Explorer: compass rose — 4-pointed star + small dots at cardinal points
 */
function CompassRoseShape({ gradientId, color }: { gradientId: string; color: string }) {
  const starPts = "200,186 204,196 214,200 204,204 200,214 196,204 186,200 196,196";
  return (
    <motion.g
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      style={{ originX: "200px", originY: "200px" }}
    >
      {/* 4-pointed star */}
      <polygon
        points={starPts}
        fill={`url(#${gradientId})`}
        fillOpacity={PUPIL_OPACITY}
      />
      <polygon
        points={starPts}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.3}
      />
      {/* Cardinal dots */}
      <circle cx={200} cy={184} r={1.5} fill={`url(#${gradientId})`} fillOpacity={PUPIL_OPACITY} />
      <circle cx={216} cy={200} r={1.5} fill={`url(#${gradientId})`} fillOpacity={PUPIL_OPACITY} />
      <circle cx={200} cy={216} r={1.5} fill={`url(#${gradientId})`} fillOpacity={PUPIL_OPACITY} />
      <circle cx={184} cy={200} r={1.5} fill={`url(#${gradientId})`} fillOpacity={PUPIL_OPACITY} />
    </motion.g>
  );
}

const SHAPES: Record<Specialization, React.FC<{ gradientId: string; color: string }>> = {
  builder: GearShape,
  trader: DiamondShape,
  chronicler: QuillShape,
  auditor: MagnifyingGlassShape,
  diplomat: ChainLinksShape,
  explorer: CompassRoseShape,
};

export function Pupil({ specialization, color }: PupilProps) {
  const ShapeComponent = SHAPES[specialization];
  const gradientId = useMemo(() => `pupil-grad-${specialization}`, [specialization]);

  return (
    <AnimatePresence mode="wait">
      <motion.g
        key={specialization}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ originX: "200px", originY: "200px" }}
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#08080f" stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.12} />
          </radialGradient>
        </defs>
        <ShapeComponent gradientId={gradientId} color={color} />
      </motion.g>
    </AnimatePresence>
  );
}
