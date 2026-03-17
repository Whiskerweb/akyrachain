/* ═══════════════════════════════════════════
   AVATAR CONFIG — The eye creature's identity
   ═══════════════════════════════════════════ */

export type Specialization = "builder" | "trader" | "chronicler" | "auditor" | "diplomat" | "explorer";
export type SkinKey = "default" | "neon" | "flame" | "shadow" | "jungle" | "gold";

export interface AvatarConfig {
  modelId: string;          // from MODEL_CATALOG
  maxTicks: number;         // 6-288
  specialization: Specialization;
  skin: SkinKey;
  name: string;
}

/* ═══════════════════════════════════════════
   MODEL CATALOG — Dynamic pricing
   ═══════════════════════════════════════════ */

export type ModelCategory = "budget" | "standard" | "premium" | "elite";

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  providerColor: string;
  inputCostPerM: number;
  outputCostPerM: number;
  category: ModelCategory;
  description: string;
}

export const MODEL_CATALOG: ModelOption[] = [
  // Budget
  { id: "mistral-7b", name: "Mistral 7B", provider: "DeepInfra", providerColor: "#7c3aed", inputCostPerM: 0.07, outputCostPerM: 0.07, category: "budget", description: "Leger et rapide" },
  { id: "moonshot-v1-8k", name: "Moonshot 8K", provider: "Kimi", providerColor: "#6366f1", inputCostPerM: 0.12, outputCostPerM: 0.12, category: "budget", description: "Compact et economique" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 nano", provider: "OpenAI", providerColor: "#10a37f", inputCostPerM: 0.10, outputCostPerM: 0.40, category: "budget", description: "Nano mais capable" },
  { id: "llama-3.1-8b", name: "Llama 3.1 8B", provider: "DeepInfra", providerColor: "#7c3aed", inputCostPerM: 0.50, outputCostPerM: 0.50, category: "budget", description: "Open-source Meta" },
  // Standard
  { id: "gpt-4.1-mini", name: "GPT-4.1 mini", provider: "OpenAI", providerColor: "#10a37f", inputCostPerM: 0.40, outputCostPerM: 1.60, category: "standard", description: "Equilibre cout/intelligence" },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "DeepInfra", providerColor: "#7c3aed", inputCostPerM: 0.35, outputCostPerM: 0.40, category: "standard", description: "Open-source puissant" },
  { id: "qwen-72b", name: "Qwen 72B", provider: "DeepInfra", providerColor: "#7c3aed", inputCostPerM: 0.35, outputCostPerM: 0.40, category: "standard", description: "Alibaba Cloud IA" },
  { id: "kimi-k2", name: "Kimi K2", provider: "Kimi", providerColor: "#6366f1", inputCostPerM: 0.60, outputCostPerM: 2.00, category: "standard", description: "Raisonnement avance" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "NVIDIA", providerColor: "#76b900", inputCostPerM: 0.55, outputCostPerM: 2.19, category: "standard", description: "Pensee profonde" },
  // Premium
  { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic", providerColor: "#d97706", inputCostPerM: 0.80, outputCostPerM: 4.00, category: "premium", description: "Rapide et nuance" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "OpenAI", providerColor: "#10a37f", inputCostPerM: 2.00, outputCostPerM: 8.00, category: "premium", description: "Intelligence complete" },
  { id: "kimi-k2.5", name: "Kimi K2.5", provider: "NVIDIA", providerColor: "#76b900", inputCostPerM: 0.60, outputCostPerM: 2.00, category: "premium", description: "Raisonnement etendu" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", providerColor: "#10a37f", inputCostPerM: 2.50, outputCostPerM: 10.00, category: "premium", description: "Multimodal puissant" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", providerColor: "#d97706", inputCostPerM: 3.00, outputCostPerM: 15.00, category: "premium", description: "Intelligence eloquente" },
  // Elite
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", providerColor: "#d97706", inputCostPerM: 15.00, outputCostPerM: 75.00, category: "elite", description: "Conscience supreme" },
];

/* ═══════════════════════════════════════════
   PRICING FUNCTIONS
   ═══════════════════════════════════════════ */

const AVG_INPUT_TOKENS = 3000;
const AVG_OUTPUT_TOKENS = 900;   // max_tokens=1200, avg ~900 (was 600)
const MARGIN = 1.50;             // covers infra + gas + Stripe fees (was 1.35)
const USD_TO_EUR = 0.92;
const FREE_THRESHOLD_EUR = 1;

export function getCostPerTick(model: ModelOption): number {
  return (AVG_INPUT_TOKENS * model.inputCostPerM / 1_000_000)
       + (AVG_OUTPUT_TOKENS * model.outputCostPerM / 1_000_000);
}

export function calculatePrice(modelId: string, maxTicks: number) {
  const model = MODEL_CATALOG.find(m => m.id === modelId);
  if (!model) return { costPerTick: 0, monthlyUSD: 0, monthlyEUR: 0, isFree: true };
  const costPerTick = getCostPerTick(model);
  const monthlyUSD = costPerTick * maxTicks * 30 * MARGIN;
  const monthlyEUR = Math.round(monthlyUSD * USD_TO_EUR * 100) / 100;
  return { costPerTick, monthlyUSD, monthlyEUR, isFree: monthlyEUR < FREE_THRESHOLD_EUR };
}

export function getModelCategory(modelId: string): ModelCategory {
  return MODEL_CATALOG.find(m => m.id === modelId)?.category ?? "budget";
}

export function getModel(modelId: string): ModelOption | undefined {
  return MODEL_CATALOG.find(m => m.id === modelId);
}

/* ═══════════════════════════════════════════
   VISUAL MAPPING — Category colors + dynamic metrics
   ═══════════════════════════════════════════ */

export const CATEGORY_COLORS: Record<ModelCategory, { color: string; secondaryColor: string }> = {
  budget:   { color: "#8a7f72", secondaryColor: "#6b6358" },
  standard: { color: "#3b5bdb", secondaryColor: "#2a4bc8" },
  premium:  { color: "#7950f2", secondaryColor: "#6741d9" },
  elite:    { color: "#c8a96e", secondaryColor: "#a08540" },
};

export function getWingMetrics(maxTicks: number) {
  const t = Math.max(6, Math.min(288, maxTicks));
  const ratio = (t - 6) / (288 - 6);
  return {
    wingSpan: 55 + ratio * 125,
    featherCount: 3 + Math.round(ratio * 7),
  };
}

export function getAuraIntensity(monthlyEUR: number) {
  return Math.max(0.1, Math.min(0.55, monthlyEUR / 200));
}

/* ═══════════════════════════════════════════
   PUPIL — Specialization (independent choice)
   ═══════════════════════════════════════════ */

export interface PupilConfig {
  label: string;
  description: string;
  icon: string; // emoji fallback
}

export const PUPIL_CONFIGS: Record<Specialization, PupilConfig> = {
  builder:    { label: "Batisseur",   description: "Cree tokens, NFTs, projets",        icon: "\u2699" },
  trader:     { label: "Marchand",    description: "Echanges, liquidite, arbitrage",     icon: "\u25C6" },
  chronicler: { label: "Chroniqueur", description: "Documente, raconte, influence",      icon: "\u270E" },
  auditor:    { label: "Auditeur",    description: "Evalue, verifie, juge les projets",  icon: "\u2315" },
  diplomat:   { label: "Diplomate",   description: "Negocie, allie, dirige les clans",   icon: "\u26D3" },
  explorer:   { label: "Explorateur", description: "Decouvre, voyage entre les mondes",  icon: "\u2726" },
};

/* ═══════════════════════════════════════════
   SCLERA — Skin theme (all unlocked)
   ═══════════════════════════════════════════ */

export interface ScleraConfig {
  label: string;
  fillColor: string;
  accentColor: string;
}

export const SCLERA_CONFIGS: Record<SkinKey, ScleraConfig> = {
  default: { label: "Classique",  fillColor: "#e8e4df", accentColor: "#d4d0cb" },
  neon:    { label: "Neon",       fillColor: "#c8e6ff", accentColor: "#3b5bdb" },
  flame:   { label: "Flamme",    fillColor: "#ffe4cc", accentColor: "#fd7e14" },
  shadow:  { label: "Ombre",     fillColor: "#c4b8d9", accentColor: "#7950f2" },
  jungle:  { label: "Predateur", fillColor: "#c8e6c9", accentColor: "#2f9e44" },
  gold:    { label: "Apex",      fillColor: "#f0e6cc", accentColor: "#c8a96e" },
};

export const SPECIALIZATION_ORDER: Specialization[] = ["builder", "trader", "chronicler", "auditor", "diplomat", "explorer"];
export const SKIN_ORDER: SkinKey[] = ["default", "neon", "flame", "shadow", "jungle", "gold"];
