"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import type { AvatarConfig } from "@/types/avatar";
import {
  getModelCategory,
  CATEGORY_COLORS,
  calculatePrice,
} from "@/types/avatar";
import { Aura } from "./parts/Aura";
import { Wings } from "./parts/Wings";
import { Sclera } from "./parts/Sclera";
import { Iris } from "./parts/Iris";
import { Pupil } from "./parts/Pupil";

interface EyeCreatureProps {
  config: AvatarConfig;
  phase?: "building" | "idle" | "awakening";
  className?: string;
}

export function EyeCreature({
  config,
  phase = "building",
  className,
}: EyeCreatureProps) {
  const { specialization, skin } = config;

  const category = getModelCategory(config.modelId);
  const categoryColors = CATEGORY_COLORS[category];
  const pricing = calculatePrice(config.modelId, config.maxTicks);

  // Blink state — triggers every 5-7 seconds during idle phase
  const [blinking, setBlinking] = useState(false);

  const triggerBlink = useCallback(() => {
    setBlinking(true);
    setTimeout(() => setBlinking(false), 150);
  }, []);

  useEffect(() => {
    if (phase !== "idle") return;
    const interval = setInterval(triggerBlink, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [phase, triggerBlink]);

  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Grain texture filter for pixel-art feel */}
        <filter id="grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={3}
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            type="saturate"
            values="0"
            in="noise"
            result="mono"
          />
          <feBlend mode="overlay" in="SourceGraphic" in2="mono" />
        </filter>

        {/* Drop shadow for the creature */}
        <filter id="drop-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* Main creature group with phase animations */}
      <motion.g
        filter="url(#grain)"
        style={{ originX: "200px", originY: "200px" }}
        animate={
          phase === "idle"
            ? {
                scale: [1, 1.02, 1],
              }
            : undefined
        }
        transition={
          phase === "idle"
            ? {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      >
        {/* Layer 1: Aura (background glow) */}
        {phase === "awakening" ? (
          <motion.g
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, delay: 1.5, ease: "easeOut" }}
            style={{ originX: "200px", originY: "200px" }}
          >
            <Aura monthlyPrice={pricing.monthlyEUR} color={categoryColors.color} />
          </motion.g>
        ) : (
          <Aura monthlyPrice={pricing.monthlyEUR} color={categoryColors.color} />
        )}

        {/* Drop shadow — between aura and wings */}
        <ellipse
          cx={200}
          cy={280}
          rx={80}
          ry={10}
          fill="#000"
          opacity={0.15}
          filter="url(#drop-shadow)"
        />

        {/* Layer 2: Wings */}
        {phase === "awakening" ? (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.8, ease: "easeOut" }}
          >
            <Wings maxTicks={config.maxTicks} color={categoryColors.color} />
          </motion.g>
        ) : (
          <Wings maxTicks={config.maxTicks} color={categoryColors.color} />
        )}

        {/* Layer 3: Sclera (eye shape) */}
        {phase === "awakening" ? (
          <g>
            {/* Animate from thin line to full almond shape via clipPath */}
            <motion.g
              initial={{ scaleY: 0.03 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              style={{ originX: "200px", originY: "200px" }}
            >
              <Sclera skin={skin} />
            </motion.g>
          </g>
        ) : (
          <Sclera skin={skin} />
        )}

        {/* Layer 4: Iris */}
        {phase === "awakening" ? (
          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
            style={{ originX: "200px", originY: "200px" }}
          >
            <Iris modelCategory={category} />
          </motion.g>
        ) : (
          <Iris modelCategory={category} />
        )}

        {/* Layer 5: Pupil */}
        {phase === "awakening" ? (
          <motion.g
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.2, ease: "backOut" }}
            style={{ originX: "200px", originY: "200px" }}
          >
            <Pupil specialization={specialization} color={categoryColors.color} />
          </motion.g>
        ) : (
          <Pupil specialization={specialization} color={categoryColors.color} />
        )}

        {/* Layer 6: Blink overlay — covers the eye briefly */}
        {blinking && (
          <motion.ellipse
            cx={200}
            cy={200}
            rx={102}
            ry={72}
            fill="#12121e"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 0.15, times: [0, 0.5, 1] }}
            style={{ originX: "200px", originY: "200px" }}
          />
        )}

        {/* Layer 7: Specular highlights — glassy 3D look */}
        <motion.ellipse
          cx={180}
          cy={182}
          rx={8}
          ry={5}
          fill="#ffffff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{
            duration: phase === "awakening" ? 0.4 : 0.8,
            delay: phase === "awakening" ? 1.4 : 0,
            ease: "easeOut",
          }}
        />
        {/* Secondary specular highlight — smaller reflection */}
        <motion.ellipse
          cx={186}
          cy={186}
          rx={4}
          ry={3}
          fill="#ffffff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{
            duration: phase === "awakening" ? 0.4 : 0.8,
            delay: phase === "awakening" ? 1.5 : 0.1,
            ease: "easeOut",
          }}
        />
      </motion.g>
    </svg>
  );
}
