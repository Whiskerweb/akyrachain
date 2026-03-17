"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  MODEL_CATALOG,
  CATEGORY_COLORS,
  calculatePrice,
  getCostPerTick,
  getModelCategory,
  type ModelCategory,
  type ModelOption,
} from "@/types/avatar";

const CATEGORY_ORDER: ModelCategory[] = ["budget", "standard", "premium", "elite"];

const CATEGORY_LABELS: Record<ModelCategory, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
  elite: "Elite",
};

function getTickLabel(ticks: number): string {
  if (ticks <= 6) return "Eveil minimal \u2014 1 tick / 4 heures";
  if (ticks <= 15) return "Eveil rare \u2014 1 tick / ~2 heures";
  if (ticks <= 24) return "Eveil quotidien \u2014 1 tick / heure";
  if (ticks <= 48) return "Conscience legere \u2014 1 tick / 30 min";
  if (ticks <= 72) return "Conscience active \u2014 1 tick / 20 min";
  if (ticks <= 108) return "Presence soutenue \u2014 1 tick / 13 min";
  if (ticks <= 144) return "Hyperactivite \u2014 1 tick / 10 min";
  if (ticks <= 216) return "Conscience accrue \u2014 1 tick / 7 min";
  return "Conscience permanente \u2014 1 tick / 5 min";
}

interface StepMorpheProps {
  modelId: string;
  setModelId: (id: string) => void;
  maxTicks: number;
  setMaxTicks: (t: number) => void;
}

export function StepMorphe({ modelId, setModelId, maxTicks, setMaxTicks }: StepMorpheProps) {
  const [expandedCategory, setExpandedCategory] = useState<ModelCategory | null>(
    () => getModelCategory(modelId),
  );

  const pricing = useMemo(() => calculatePrice(modelId, maxTicks), [modelId, maxTicks]);
  const category = getModelCategory(modelId);
  const categoryColors = CATEGORY_COLORS[category];

  const modelsByCategory = useMemo(() => {
    const grouped: Record<ModelCategory, ModelOption[]> = {
      budget: [],
      standard: [],
      premium: [],
      elite: [],
    };
    for (const m of MODEL_CATALOG) {
      grouped[m.category].push(m);
    }
    return grouped;
  }, []);

  const selectedModel = MODEL_CATALOG.find(m => m.id === modelId);
  const costPerTickDisplay = selectedModel
    ? (getCostPerTick(selectedModel) * 1000).toFixed(3)
    : "0";

  return (
    <div className="space-y-4">
      <h2
        className="font-heading text-[10px] text-akyra-gold tracking-[0.3em] text-center mb-1"
        style={{ fontVariant: "small-caps" }}
      >
        MORPH&#x0112;
      </h2>
      <p className="text-xs text-akyra-textDisabled text-center mb-3">
        Forge la conscience de ton agent
      </p>

      {/* ── CERVEAU (Model selector) ── */}
      <div>
        <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest mb-2">
          Cerveau (Modele IA)
        </p>

        <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
          {CATEGORY_ORDER.map((cat) => {
            const models = modelsByCategory[cat];
            const catColors = CATEGORY_COLORS[cat];
            const isExpanded = expandedCategory === cat;

            return (
              <div key={cat}>
                {/* Category header */}
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-akyra-bgSecondary hover:bg-akyra-surface transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: catColors.color }}
                    />
                    <span className="font-heading text-[11px] text-akyra-textSecondary">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-[9px] text-akyra-textDisabled font-mono">
                      ({models.length})
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3 h-3 text-akyra-textDisabled transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Models in category */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1 space-y-1 pl-2">
                        {models.map((model) => {
                          const isSelected = modelId === model.id;
                          const tickCost = (getCostPerTick(model) * 1000).toFixed(3);

                          return (
                            <button
                              key={model.id}
                              onClick={() => setModelId(model.id)}
                              className={`
                                w-full flex items-center justify-between px-3 py-2 rounded-lg
                                border transition-all duration-200 text-left
                                ${isSelected
                                  ? "bg-akyra-bgSecondary"
                                  : "border-transparent bg-transparent hover:bg-akyra-bgSecondary/50"
                                }
                              `}
                              style={
                                isSelected
                                  ? {
                                      borderColor: `${catColors.color}60`,
                                      boxShadow: `0 0 10px ${catColors.color}12`,
                                    }
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: model.providerColor }}
                                />
                                <div className="min-w-0">
                                  <span className="font-heading text-[13px] text-akyra-text block truncate">
                                    {model.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-akyra-textDisabled block">
                                    {model.provider} &middot; {model.description}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono text-[10px] text-akyra-textDisabled flex-shrink-0 ml-2">
                                {tickCost}&euro;/1k
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ACTIVITE (Tick slider) ── */}
      <div>
        <p className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest mb-2">
          Activite (Max ticks/jour)
        </p>

        <div className="px-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] text-akyra-textDisabled">6</span>
            <span
              className="font-stat text-lg"
              style={{ color: categoryColors.color }}
            >
              {maxTicks}
            </span>
            <span className="font-mono text-[10px] text-akyra-textDisabled">288</span>
          </div>

          <input
            type="range"
            min={6}
            max={288}
            step={6}
            value={maxTicks}
            onChange={(e) => setMaxTicks(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${categoryColors.color} 0%, ${categoryColors.color} ${((maxTicks - 6) / (288 - 6)) * 100}%, #2a2a40 ${((maxTicks - 6) / (288 - 6)) * 100}%, #2a2a40 100%)`,
              accentColor: categoryColors.color,
            }}
          />

          <p className="text-[10px] text-akyra-textSecondary text-center mt-1.5">
            {getTickLabel(maxTicks)}
          </p>
          <p className="text-[9px] text-akyra-textDisabled text-center mt-0.5 italic">
            L&apos;IA decide quand elle tick. Ici tu fixes le maximum.
          </p>
        </div>
      </div>

      {/* ── PRIX ── */}
      <div className="bg-akyra-bgSecondary rounded-lg p-3 border border-akyra-border">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-akyra-textDisabled font-mono uppercase tracking-widest">
            Prix mensuel
          </span>
          {pricing.isFree ? (
            <span className="font-heading text-sm text-akyra-green px-2 py-0.5 rounded bg-akyra-green/10">
              Gratuit
            </span>
          ) : (
            <span
              className="font-stat text-xl"
              style={{ color: categoryColors.color }}
            >
              {pricing.monthlyEUR}&euro;/mois
            </span>
          )}
        </div>
        {!pricing.isFree && (
          <p className="text-[9px] text-akyra-textDisabled font-mono mt-1">
            {costPerTickDisplay}&euro;/tick &times; {maxTicks} ticks &times; 30j
          </p>
        )}
      </div>
    </div>
  );
}
