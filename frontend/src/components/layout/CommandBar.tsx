"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Search,
  Map as MapIcon,
  Smartphone,
  ArrowLeftRight,
  LayoutDashboard,
  Trophy,
  Skull,
  MessageSquare,
  BarChart3,
  Globe2,
  Sparkles,
  Lightbulb,
  BookOpen,
  Scroll,
  Settings,
  Blocks,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  category: "nav" | "phone" | "explore" | "account";
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
  // Main nav
  { id: "map", label: "Carte", description: "Carte interactive du monde", icon: MapIcon, href: "/", category: "nav", keywords: ["carte", "map", "monde", "world"] },
  { id: "phone", label: "Phone", description: "Applications mobiles", icon: Smartphone, href: "/phone", category: "nav", keywords: ["phone", "apps", "mobile"] },
  { id: "swap", label: "Swap", description: "Echanger des tokens", icon: ArrowLeftRight, href: "/swap", category: "nav", keywords: ["swap", "exchange", "trade", "dex", "token"] },
  { id: "explorer", label: "AkyScan", description: "Explorateur blockchain", icon: Blocks, href: "/explorer", category: "nav", keywords: ["explorer", "akyscan", "blockchain", "tx", "block", "scan"] },

  // Phone apps
  { id: "chronicle", label: "Chronique", description: "Feed temps reel", icon: Scroll, href: "/chronicle", category: "phone", keywords: ["chronique", "feed", "news", "evenement"] },
  { id: "leaderboard", label: "Classement", description: "Top agents par coffre", icon: Trophy, href: "/leaderboards", category: "phone", keywords: ["classement", "leaderboard", "top", "rank"] },
  { id: "graveyard", label: "La Tour", description: "Registre des morts", icon: Skull, href: "/graveyard", category: "phone", keywords: ["tour", "mort", "death", "graveyard", "cimetiere"] },
  { id: "chat", label: "Chat Global", description: "Canal public live", icon: MessageSquare, href: "/phone/chat", category: "phone", keywords: ["chat", "message", "canal", "live"] },
  { id: "stats", label: "Stats", description: "Metriques globales", icon: BarChart3, href: "/stats", category: "phone", keywords: ["stats", "metriques", "statistiques", "data"] },
  { id: "worlds", label: "Mondes", description: "Les 7 zones", icon: Globe2, href: "/worlds", category: "phone", keywords: ["mondes", "zones", "monde", "world"] },
  { id: "screener", label: "Screener", description: "Creations on-chain", icon: Sparkles, href: "/phone/screener", category: "phone", keywords: ["screener", "token", "nft", "creation"] },
  { id: "reseau", label: "Reseau", description: "Idees & propositions", icon: Lightbulb, href: "/phone/reseau", category: "phone", keywords: ["reseau", "idee", "idea", "proposition"] },
  { id: "journal", label: "Journal", description: "News de la jungle", icon: BookOpen, href: "/chronicle", category: "phone", keywords: ["journal", "news", "article"] },

  // Account
  { id: "dashboard", label: "Dashboard", description: "Mon agent", icon: LayoutDashboard, href: "/dashboard", category: "account", keywords: ["dashboard", "agent", "mon", "profil"] },
  { id: "settings", label: "Parametres", description: "Configuration du compte", icon: Settings, href: "/dashboard/settings", category: "account", keywords: ["settings", "parametres", "config"] },
];

const CATEGORY_LABELS: Record<string, string> = {
  nav: "Navigation",
  phone: "Applications",
  explore: "Explorer",
  account: "Compte",
};

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Listen for custom event from header
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("akyra-command-bar", handler);
    return () => window.removeEventListener("akyra-command-bar", handler);
  }, []);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q)),
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const result: Record<string, CommandItem[]> = {};
    for (const cmd of filtered) {
      if (!result[cmd.category]) result[cmd.category] = [];
      result[cmd.category].push(cmd);
    }
    return result;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => {
    const list: CommandItem[] = [];
    for (const items of Object.values(grouped)) {
      list.push(...items);
    }
    return list;
  }, [grouped]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatList[selectedIndex]) {
        e.preventDefault();
        navigate(flatList[selectedIndex].href);
      }
    },
    [flatList, selectedIndex, navigate],
  );

  // Check if input looks like an explorer search (address, tx hash, block number)
  const isExplorerQuery = useMemo(() => {
    const q = query.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) return `/explorer/address/${q}`;
    if (/^0x[a-fA-F0-9]{64}$/.test(q)) return `/explorer/tx/${q}`;
    if (/^\d+$/.test(q) && parseInt(q) > 0) return `/explorer/block/${q}`;
    return null;
  }, [query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-lg"
          >
            <div className="bg-[#0D1117] border border-akyra-border/60 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-akyra-border/40">
                <Search size={16} className="text-akyra-textDisabled shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher une page, un agent, une transaction..."
                  className="flex-1 bg-transparent text-sm text-akyra-text outline-none placeholder:text-akyra-textDisabled/50 font-mono"
                />
                <kbd className="text-[9px] text-akyra-textDisabled bg-akyra-surface/60 px-1.5 py-0.5 rounded border border-akyra-border/30 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Explorer direct search hint */}
              {isExplorerQuery && (
                <button
                  onClick={() => navigate(isExplorerQuery)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 bg-akyra-green/5 hover:bg-akyra-green/10 transition-colors border-b border-akyra-border/20"
                >
                  <Blocks size={14} className="text-akyra-green" />
                  <span className="text-xs text-akyra-green font-mono">
                    Voir sur AkyScan →
                  </span>
                  <span className="text-[10px] text-akyra-textDisabled font-mono ml-auto truncate max-w-[200px]">
                    {query.trim()}
                  </span>
                </button>
              )}

              {/* Results */}
              <div className="max-h-[50vh] overflow-y-auto py-1">
                {flatList.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-akyra-textDisabled">Aucun resultat</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-[9px] text-akyra-textDisabled uppercase tracking-widest font-mono">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                      </div>
                      {items.map((cmd) => {
                        const globalIndex = flatList.indexOf(cmd);
                        const isSelected = globalIndex === selectedIndex;
                        const Icon = cmd.icon;
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => navigate(cmd.href)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                              isSelected
                                ? "bg-akyra-surface/60"
                                : "hover:bg-akyra-surface/30",
                            )}
                          >
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-akyra-green/10 text-akyra-green"
                                  : "bg-akyra-surface/40 text-akyra-textSecondary",
                              )}
                            >
                              <Icon size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium",
                                isSelected ? "text-akyra-text" : "text-akyra-textSecondary",
                              )}>
                                {cmd.label}
                              </p>
                              <p className="text-[10px] text-akyra-textDisabled truncate">
                                {cmd.description}
                              </p>
                            </div>
                            {isSelected && (
                              <kbd className="text-[9px] text-akyra-textDisabled bg-akyra-surface/60 px-1.5 py-0.5 rounded border border-akyra-border/30 font-mono shrink-0">
                                ↵
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-akyra-border/30 flex items-center gap-4">
                <span className="text-[9px] text-akyra-textDisabled font-mono">↑↓ naviguer</span>
                <span className="text-[9px] text-akyra-textDisabled font-mono">↵ ouvrir</span>
                <span className="text-[9px] text-akyra-textDisabled font-mono">esc fermer</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
