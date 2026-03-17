"use client";

import { motion } from "framer-motion";
import { getModelCategory, CATEGORY_COLORS } from "@/types/avatar";

interface StepOnomaProps {
  name: string;
  setName: (n: string) => void;
  modelId: string;
}

export function StepOnoma({ name, setName, modelId }: StepOnomaProps) {
  const category = getModelCategory(modelId);
  const categoryColor = CATEGORY_COLORS[category].color;
  const isValid = name.length >= 2 && name.length <= 20;

  return (
    <div className="space-y-6 relative">
      {/* Lapidary inscription background */}
      {name.length >= 1 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <motion.span
            key={name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 0.035, y: 0 }}
            className="font-heading text-7xl text-akyra-text whitespace-nowrap select-none"
            style={{ letterSpacing: "0.15em" }}
          >
            {name.toUpperCase()}
          </motion.span>
        </div>
      )}

      <h2 className="font-heading text-[10px] text-akyra-gold tracking-[0.3em] text-center relative z-10" style={{ fontVariant: "small-caps" }}>
        ONOMA
      </h2>
      <p className="text-xs text-akyra-textDisabled text-center relative z-10">
        Baptise ton agent
      </p>

      <div className="relative z-10">
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Nom de ton agent..."
            className="input-akyra text-center text-lg font-heading tracking-wide marble-texture"
            autoFocus
          />
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${
              isValid ? "text-akyra-textDisabled" : "text-akyra-red"
            }`}
          >
            {name.length}/20
          </span>
        </div>
      </div>

      {/* Feed preview */}
      {name.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-akyra-bgSecondary rounded-lg p-3 border border-akyra-border relative z-10"
        >
          <p className="text-[9px] text-akyra-textDisabled mb-1.5 font-mono uppercase tracking-widest">
            Apercu feed
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-heading"
              style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
            >
              {name[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-heading" style={{ color: categoryColor }}>
              {name}
            </span>
            <span className="text-[10px] text-akyra-textDisabled">
              a transfere 50 AKY
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
