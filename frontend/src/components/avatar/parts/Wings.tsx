"use client";

import { motion } from "framer-motion";
import { getWingMetrics } from "@/types/avatar";

interface WingsProps {
  maxTicks: number;
  color: string;
}

/**
 * Generates a curved feather path (quadratic bezier) radiating from the eye center.
 * Each feather fans outward from the left side at angles spread across a ~60deg arc.
 */
function generateFeatherPath(
  index: number,
  total: number,
  span: number,
): string {
  // Feathers radiate from center-left, fanning upward across ~60deg arc
  const arcStart = -30; // degrees above horizontal
  const arcEnd = 30; // degrees below horizontal (negative = up)
  const angle = arcStart + (arcEnd - arcStart) * (index / Math.max(total - 1, 1));
  const rad = (angle * Math.PI) / 180;

  // Start point near center-left of the eye
  const sx = 200 - 80;
  const sy = 200;

  // End point at the span distance
  const ex = sx - span * Math.cos(rad);
  const ey = sy - span * Math.sin(rad);

  // Control point creates the curve — offset perpendicular to direction
  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;
  // Curve upward for upper feathers, downward for lower
  const curveFactor = span * 0.25;
  const perpX = midX + curveFactor * Math.sin(rad);
  const perpY = midY - curveFactor * Math.cos(rad);

  return `M ${sx} ${sy} Q ${perpX} ${perpY} ${ex} ${ey}`;
}

/**
 * Generates a slightly inset version of the feather path for stem highlight.
 */
function generateStemPath(
  index: number,
  total: number,
  span: number,
): string {
  const arcStart = -30;
  const arcEnd = 30;
  const angle = arcStart + (arcEnd - arcStart) * (index / Math.max(total - 1, 1));
  const rad = (angle * Math.PI) / 180;

  const sx = 200 - 80;
  const sy = 200;
  // Slightly shorter span for the highlight
  const insetSpan = span * 0.92;
  const ex = sx - insetSpan * Math.cos(rad);
  const ey = sy - insetSpan * Math.sin(rad);

  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;
  const curveFactor = insetSpan * 0.22;
  const perpX = midX + curveFactor * Math.sin(rad);
  const perpY = midY - curveFactor * Math.cos(rad);

  return `M ${sx} ${sy} Q ${perpX} ${perpY} ${ex} ${ey}`;
}

export function Wings({ maxTicks, color }: WingsProps) {
  const { featherCount, wingSpan } = getWingMetrics(maxTicks);

  const feathers = Array.from({ length: featherCount }, (_, i) => ({
    index: i,
    path: generateFeatherPath(i, featherCount, wingSpan),
    stemPath: generateStemPath(i, featherCount, wingSpan),
    // Inner feathers darker, outer lighter
    opacity: 0.9 - (i / featherCount) * 0.45,
    // Fill opacity: inner feathers more opaque, outer more transparent
    fillOpacity: 0.12 + (1 - i / featherCount) * 0.15,
    // Wingbeat amplitude: innermost ±0.5°, outermost ±5°
    wingbeatAmplitude: 0.5 + (i / Math.max(featherCount - 1, 1)) * 4.5,
  }));

  return (
    <g>
      <defs>
        <filter id="wing-shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Wing shadows */}
      <ellipse
        cx={140}
        cy={240}
        rx={60}
        ry={8}
        fill="#000"
        opacity={0.1}
        filter="url(#wing-shadow-blur)"
      />
      <ellipse
        cx={260}
        cy={240}
        rx={60}
        ry={8}
        fill="#000"
        opacity={0.1}
        filter="url(#wing-shadow-blur)"
      />

      {/* Left wing */}
      <g>
        {feathers.map(({ index, path, stemPath, opacity, fillOpacity, wingbeatAmplitude }) => (
          <g key={`left-${index}`}>
            {/* Filled feather */}
            <motion.path
              d={path}
              fill={color}
              fillOpacity={fillOpacity}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeOpacity={opacity}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                rotate: [0, wingbeatAmplitude, 0, -wingbeatAmplitude, 0],
              }}
              transition={{
                pathLength: {
                  duration: 0.6,
                  delay: index * 0.08,
                  ease: "easeOut",
                },
                opacity: {
                  duration: 0.3,
                  delay: index * 0.08,
                },
                rotate: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.3,
                },
              }}
              style={{ originX: "200px", originY: "200px" }}
            />
            {/* Stem highlight */}
            <motion.path
              d={stemPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth={0.4}
              strokeLinecap="round"
              opacity={0.08}
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: 1,
                rotate: [0, wingbeatAmplitude, 0, -wingbeatAmplitude, 0],
              }}
              transition={{
                pathLength: {
                  duration: 0.6,
                  delay: index * 0.08,
                  ease: "easeOut",
                },
                rotate: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.3,
                },
              }}
              style={{ originX: "200px", originY: "200px" }}
            />
          </g>
        ))}
      </g>

      {/* Right wing — mirror of left */}
      <g transform="translate(400, 0) scale(-1, 1)">
        {feathers.map(({ index, path, stemPath, opacity, fillOpacity, wingbeatAmplitude }) => (
          <g key={`right-${index}`}>
            {/* Filled feather */}
            <motion.path
              d={path}
              fill={color}
              fillOpacity={fillOpacity}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeOpacity={opacity}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                rotate: [0, wingbeatAmplitude, 0, -wingbeatAmplitude, 0],
              }}
              transition={{
                pathLength: {
                  duration: 0.6,
                  delay: index * 0.08 + 0.1,
                  ease: "easeOut",
                },
                opacity: {
                  duration: 0.3,
                  delay: index * 0.08 + 0.1,
                },
                rotate: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.3 + 0.15,
                },
              }}
              style={{ originX: "200px", originY: "200px" }}
            />
            {/* Stem highlight */}
            <motion.path
              d={stemPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth={0.4}
              strokeLinecap="round"
              opacity={0.08}
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: 1,
                rotate: [0, wingbeatAmplitude, 0, -wingbeatAmplitude, 0],
              }}
              transition={{
                pathLength: {
                  duration: 0.6,
                  delay: index * 0.08 + 0.1,
                  ease: "easeOut",
                },
                rotate: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.3 + 0.15,
                },
              }}
              style={{ originX: "200px", originY: "200px" }}
            />
          </g>
        ))}
      </g>
    </g>
  );
}
