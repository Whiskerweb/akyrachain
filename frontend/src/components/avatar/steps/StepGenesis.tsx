"use client";

import { motion } from "framer-motion";
import { HeartbeatLine } from "@/components/ui/GreekMotifs";
import {
  PUPIL_CONFIGS,
  CATEGORY_COLORS,
  getModel,
  getModelCategory,
  calculatePrice,
  type AvatarConfig,
} from "@/types/avatar";

interface StepGenesisProps {
  config: AvatarConfig;
  isDeploying: boolean;
  isDeployed: boolean;
}

export function StepGenesis({ config, isDeploying, isDeployed }: StepGenesisProps) {
  const { specialization, name } = config;
  const model = getModel(config.modelId);
  const category = getModelCategory(config.modelId);
  const categoryColor = CATEGORY_COLORS[category].color;
  const pricing = calculatePrice(config.modelId, config.maxTicks);
  const pupil = PUPIL_CONFIGS[specialization];

  return (
    <div className="space-y-4 text-center">
      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em]" style={{ fontVariant: "small-caps" }}>
        {isDeployed ? "Z\u014COPOIESIS" : "GENESIS"}
      </h2>

      {!isDeployed ? (
        <div className="space-y-4">
          {/* Stats summary */}
          <div className="bg-akyra-bgSecondary rounded-lg p-4 border border-akyra-border text-left space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-akyra-textDisabled font-mono">Modele</span>
              <span className="text-akyra-textSecondary font-heading">{model?.name ?? config.modelId}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-akyra-textDisabled font-mono">Ticks/jour</span>
              <span className="text-akyra-textSecondary font-heading">{config.maxTicks}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-akyra-textDisabled font-mono">Prix</span>
              <span className="text-akyra-textSecondary font-heading">
                {pricing.isFree ? "Gratuit" : `${pricing.monthlyEUR}\u20AC/mois`}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-akyra-textDisabled font-mono">Specialisation</span>
              <span className="text-akyra-textSecondary font-heading">{pupil.label}</span>
            </div>
          </div>

          <p className="text-akyra-textSecondary text-sm">
            <span className="font-heading" style={{ color: categoryColor }}>
              {name}
            </span>{" "}
            va s&apos;eveiller dans la{" "}
            <span className="text-akyra-green">Nursery</span>.
          </p>
          <p className="text-[10px] text-akyra-textDisabled">
            Protection 3 jours
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <HeartbeatLine color={categoryColor} />

          <p
            className="font-heading text-sm animate-glow-pulse"
            style={{ color: categoryColor }}
          >
            {name} s&apos;eveille dans la Nursery
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 pt-1">
            <div className="text-center">
              <p className="font-stat text-xl" style={{ color: categoryColor }}>
                {config.maxTicks}
              </p>
              <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">
                Ticks/j
              </p>
            </div>
            <div className="text-center">
              <p className="font-stat text-xl text-akyra-gold">
                {pricing.isFree ? "Gratuit" : `${pricing.monthlyEUR}\u20AC`}
              </p>
              <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">
                /mois
              </p>
            </div>
            <div className="text-center">
              <p className="font-stat text-sm text-akyra-text">{model?.name ?? config.modelId}</p>
              <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">
                Cerveau
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
