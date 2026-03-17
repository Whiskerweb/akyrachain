"use client";

import { motion } from "framer-motion";
import {
  PUPIL_CONFIGS,
  SCLERA_CONFIGS,
  SPECIALIZATION_ORDER,
  SKIN_ORDER,
  CATEGORY_COLORS,
  getModelCategory,
  type Specialization,
  type SkinKey,
} from "@/types/avatar";

interface StepEidolonProps {
  specialization: Specialization;
  setSpecialization: (s: Specialization) => void;
  skin: SkinKey;
  setSkin: (s: SkinKey) => void;
  modelId: string;
}

export function StepEidolon({
  specialization,
  setSpecialization,
  skin,
  setSkin,
  modelId,
}: StepEidolonProps) {
  const category = getModelCategory(modelId);
  const categoryColor = CATEGORY_COLORS[category].color;

  return (
    <div className="space-y-5">
      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em] text-center" style={{ fontVariant: "small-caps" }}>
        EID&#x014C;LON
      </h2>
      <p className="text-xs text-akyra-textDisabled text-center">
        Definis le regard de ton agent
      </p>

      {/* Pupil section — Specialization */}
      <div>
        <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest mb-2">
          Focus
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SPECIALIZATION_ORDER.map((spec) => {
            const cfg = PUPIL_CONFIGS[spec];
            const isActive = specialization === spec;

            return (
              <motion.button
                key={spec}
                onClick={() => setSpecialization(spec)}
                whileTap={{ scale: 0.96 }}
                className={`
                  relative rounded-lg p-2.5 text-left transition-all duration-200
                  border
                  ${isActive
                    ? "bg-akyra-bgSecondary"
                    : "border-akyra-border bg-akyra-surface hover:border-akyra-borderLight"
                  }
                `}
                style={
                  isActive
                    ? {
                        borderColor: `${categoryColor}60`,
                        boxShadow: `0 0 12px ${categoryColor}15`,
                      }
                    : undefined
                }
              >
                <span className="text-lg block mb-1">{cfg.icon}</span>
                <span
                  className={`text-[11px] font-heading block ${
                    isActive ? "text-akyra-text" : "text-akyra-textSecondary"
                  }`}
                  style={isActive ? { color: categoryColor } : undefined}
                >
                  {cfg.label}
                </span>
                <span className="text-[9px] text-akyra-textDisabled block leading-tight mt-0.5">
                  {cfg.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Sclera section — Skin (all unlocked) */}
      <div>
        <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest mb-2">
          Peau
        </p>
        <div className="flex items-center justify-center gap-3">
          {SKIN_ORDER.map((skinKey) => {
            const sclera = SCLERA_CONFIGS[skinKey];
            const isActive = skin === skinKey;

            return (
              <motion.button
                key={skinKey}
                onClick={() => setSkin(skinKey)}
                whileTap={{ scale: 0.9 }}
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="relative flex-shrink-0 cursor-pointer"
              >
                <div
                  className="w-8 h-8 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: sclera.fillColor,
                    border: `2px solid ${sclera.accentColor}`,
                    boxShadow: isActive
                      ? `0 0 0 3px ${sclera.accentColor}40, 0 0 12px ${sclera.accentColor}30`
                      : "none",
                  }}
                />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
