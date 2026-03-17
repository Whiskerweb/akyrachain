"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/ui/PageTransition";
import { useMe } from "@/hooks/useAkyra";
import { authAPI } from "@/lib/api";
import { useAkyraStore } from "@/stores/akyraStore";
import { Settings, Key, Wallet, LogOut } from "lucide-react";

const LLM_PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
  { value: "deepinfra", label: "DeepInfra", models: ["meta-llama/Llama-3.3-70B-Instruct"] },
  { value: "kimi", label: "Kimi", models: ["kimi-k2"] },
];

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAkyraStore((s) => s.logout);
  const { data: user, refetch } = useMe();

  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [budget, setBudget] = useState("1.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProvider((user as { llm_provider?: string }).llm_provider || "openai");
      setModel((user as { llm_model?: string }).llm_model || "gpt-4o");
      setBudget(String((user as { daily_budget_usd?: number }).daily_budget_usd || 1));
    }
  }, [user]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Entre ta cle API");
      return;
    }
    setSaving(true);
    try {
      await authAPI.setApiKey(provider, apiKey, model, parseFloat(budget));
      toast.success("Configuration sauvegardee !");
      setApiKey("");
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeKey = async () => {
    try {
      await authAPI.revokeApiKey();
      toast.success("Cle API revoquee");
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const selectedProvider = LLM_PROVIDERS.find((p) => p.value === provider);
  const u = user as {
    email?: string;
    wallet_address?: string;
    llm_provider?: string;
  } | null;

  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="flex items-center gap-3 mb-8">
            <Settings className="text-akyra-textSecondary" size={24} />
            <h1 className="font-heading text-sm text-akyra-text pixel-shadow">
              PARAMETRES
            </h1>
          </div>

          {/* Account info */}
          <Card className="space-y-4 mb-6">
            <h3 className="font-heading text-xs text-akyra-textSecondary flex items-center gap-2">
              <Wallet size={16} />
              COMPTE
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-akyra-textSecondary">Email</span>
                <span className="text-akyra-text">{u?.email || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-akyra-textSecondary">Wallet</span>
                <span className="text-akyra-text font-mono text-xs">
                  {u?.wallet_address || "Non connecte"}
                </span>
              </div>
            </div>
          </Card>

          {/* LLM Config */}
          <Card className="space-y-4 mb-6">
            <h3 className="font-heading text-xs text-akyra-textSecondary flex items-center gap-2">
              <Key size={16} />
              CONFIGURATION LLM
            </h3>

            {u?.llm_provider && (
              <div className="bg-akyra-bg rounded-lg p-3 text-sm">
                <span className="text-akyra-textSecondary">Provider actuel : </span>
                <span className="text-akyra-green">{u.llm_provider}</span>
              </div>
            )}

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  const p = LLM_PROVIDERS.find((x) => x.value === e.target.value);
                  if (p) setModel(p.models[0]);
                }}
                className="input-akyra"
              >
                {LLM_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Modele
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input-akyra"
              >
                {selectedProvider?.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Nouvelle cle API
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input-akyra"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Budget quotidien : ${budget}/jour
              </label>
              <input
                type="range"
                min="0.50"
                max="10"
                step="0.50"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full accent-akyra-green"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSaveApiKey}
                loading={saving}
                className="flex-1"
              >
                Sauvegarder
              </Button>
              {u?.llm_provider && (
                <Button variant="destructive" onClick={handleRevokeKey}>
                  Revoquer
                </Button>
              )}
            </div>
          </Card>

          {/* Logout */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full text-akyra-red hover:text-akyra-redDark"
          >
            <LogOut size={16} />
            Se deconnecter
          </Button>
        </PageTransition>
      </div>
    </>
  );
}
