"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AvatarConfig } from "@/types/avatar";
import { getModelCategory, CATEGORY_COLORS } from "@/types/avatar";
import { EyeCreature } from "./EyeCreature";

interface EyeCreaturePreviewProps {
  config: AvatarConfig;
  phase?: "building" | "idle" | "awakening";
  className?: string;
}

/**
 * Generates deterministic particle positions from an index seed.
 * Returns array of { x, y, size, delay, duration, isStar }.
 */
function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => {
    // Pseudo-random using golden ratio distribution
    const phi = (i * 0.618033988749895) % 1;
    const theta = (i * 0.381966011250105) % 1;
    return {
      x: 10 + phi * 80, // percentage
      y: 5 + theta * 90, // percentage
      size: 2 + (i % 3),
      delay: i * 0.4,
      duration: 3 + (i % 4) * 1.2,
      isStar: i % 3 === 0,
    };
  });
}

export function EyeCreaturePreview({
  config,
  phase = "building",
  className,
}: EyeCreaturePreviewProps) {
  const category = getModelCategory(config.modelId);
  const categoryColor = CATEGORY_COLORS[category].color;
  const particles = useMemo(() => generateParticles(14), []);

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden ${className ?? ""}`}
    >
      {/* Background: dark observatory gradient */}
      <div className="absolute inset-0 pantheon-bg" />

      {/* Spotlight: category-colored radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${categoryColor}15, transparent 70%)`,
        }}
      />

      {/* Volumetric light rays */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 2,
          height: 200,
          left: "45%",
          top: "10%",
          background: `linear-gradient(to bottom, ${categoryColor}08, transparent)`,
          transform: "rotate(15deg)",
          transformOrigin: "top center",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 2,
          height: 200,
          left: "55%",
          top: "10%",
          background: `linear-gradient(to bottom, ${categoryColor}08, transparent)`,
          transform: "rotate(-15deg)",
          transformOrigin: "top center",
        }}
      />

      {/* Floating particles — mix of dots and star characters */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) =>
          p.isStar ? (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                color: categoryColor,
                fontSize: p.size + 4,
                lineHeight: 1,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.1, 0.4, 0.1],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              &#10022;
            </motion.div>
          ) : (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                top: `${p.y}%`,
                backgroundColor: categoryColor,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.1, 0.4, 0.1],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ),
        )}
      </div>

      {/* Eye Creature SVG */}
      <div className="relative z-10 w-full max-w-[320px]">
        <EyeCreature config={config} phase={phase} />
      </div>

      {/* Cast shadow between creature and podium */}
      <div
        className="relative z-10"
        style={{
          width: 160,
          height: 20,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.3), transparent 70%)",
          filter: "blur(12px)",
          marginTop: -10,
        }}
      />

      {/* Podium */}
      <div className="relative z-10 -mt-4 flex flex-col items-center">
        <div
          className="relative"
          style={{
            width: 200,
            height: 80,
            clipPath: "polygon(20% 0%, 80% 0%, 95% 100%, 5% 100%)",
          }}
        >
          {/* Category-colored top glow line */}
          <div
            className="absolute top-0 left-[20%] right-[20%] h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${categoryColor}, transparent)`,
              boxShadow: `0 0 12px ${categoryColor}60`,
            }}
          />
          {/* Podium highlight — thin light edge */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
            }}
          />
          {/* Marble body */}
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(180deg, rgba(30,30,50,0.9) 0%, rgba(16,16,28,0.95) 100%)`,
              borderTop: `1px solid ${categoryColor}30`,
            }}
          >
            <div className="marble-veins absolute inset-0 pointer-events-none opacity-60" />
          </div>

          {/* Name plate */}
          {config.name && (
            <div
              className="absolute inset-0 flex items-center justify-center"
            >
              <span
                className="font-heading text-[10px] tracking-[0.25em] uppercase"
                style={{
                  color: categoryColor,
                  opacity: 0.7,
                }}
              >
                {config.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
