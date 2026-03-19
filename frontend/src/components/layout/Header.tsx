"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";
import { useAkyraStore } from "@/stores/akyraStore";
import {
  Eye,
  Users,
  TrendingUp,
  User,
  Search,
  Command,
  ChevronDown,
  BookOpen,
  Brain,
  Skull,
  MessageCircle,
  Lightbulb,
  ArrowLeftRight,
  Scale,
  BarChart3,
  Landmark,
  Bell,
  Megaphone,
} from "lucide-react";

/* ── Dropdown sub-items ── */
const SOCIETY_ITEMS = [
  { href: "/chronicles", label: "Chroniques", icon: BookOpen },
  { href: "/phone/chat", label: "Communications", icon: MessageCircle },
  { href: "/phone/ideas", label: "Idees", icon: Lightbulb },
  { href: "/knowledge", label: "Savoir collectif", icon: Brain },
  { href: "/graveyard", label: "Memorial", icon: Skull },
];

const ECONOMY_ITEMS = [
  { href: "/projects", label: "Projets", icon: TrendingUp },
  { href: "/swap", label: "Echanges", icon: ArrowLeftRight },
  { href: "/leaderboards", label: "Roles", icon: Scale },
  { href: "/governance", label: "Gouverneur", icon: Landmark },
  { href: "/stats", label: "Vitalite", icon: BarChart3 },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
];

/* ── Main nav ── */
const NAV = [
  {
    href: "/",
    label: "Observatoire",
    icon: Eye,
    match: (p: string) => p === "/",
  },
  {
    label: "Societe",
    icon: Users,
    match: (p: string) =>
      p.startsWith("/chronicles") ||
      p.startsWith("/phone") ||
      p.startsWith("/knowledge") ||
      p.startsWith("/graveyard") ||
      p.startsWith("/network") ||
      p.startsWith("/agent"),
    dropdown: SOCIETY_ITEMS,
  },
  {
    label: "Economie",
    icon: TrendingUp,
    match: (p: string) =>
      p.startsWith("/projects") ||
      p.startsWith("/swap") ||
      p.startsWith("/leaderboard") ||
      p.startsWith("/governance") ||
      p.startsWith("/stats") ||
      p.startsWith("/marketing"),
    dropdown: ECONOMY_ITEMS,
  },
];

function Dropdown({
  items,
  open,
  onClose,
}: {
  items: typeof SOCIETY_ITEMS;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-48 bg-akyra-surface border border-akyra-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 z-50"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-akyra-textSecondary hover:text-akyra-text hover:bg-white/[0.04] transition-colors"
          >
            <Icon size={13} className="opacity-60" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const token = useAkyraStore((s) => s.token);
  const unreadCount = useAkyraStore((s) => s.unreadCount);
  const [mounted, setMounted] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openCommandBar = () => {
    window.dispatchEvent(
      new CustomEvent("akyra-command-bar", { detail: { open: true } })
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-akyra-border/40 bg-akyra-bg/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-akyra-gold animate-breathe" />
          <span className="font-heading text-xs text-akyra-gold tracking-wider">
            AKYRA
          </span>
        </Link>

        {/* Center nav */}
        <nav className="flex items-center gap-0.5 bg-akyra-surface/30 rounded-lg p-0.5 border border-akyra-border/20">
          {NAV.map((item) => {
            const isActive = item.match(pathname);
            const Icon = item.icon;
            const hasDropdown = !!item.dropdown;
            const isOpen = openDropdown === item.label;

            if (hasDropdown) {
              return (
                <div key={item.label} className="relative">
                  <button
                    onClick={() =>
                      setOpenDropdown(isOpen ? null : item.label)
                    }
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-akyra-green/10 text-akyra-green"
                        : "text-akyra-textSecondary hover:text-akyra-text hover:bg-white/[0.04]"
                    )}
                  >
                    <Icon size={13} />
                    <span className="hidden sm:inline">{item.label}</span>
                    <ChevronDown
                      size={10}
                      className={cn(
                        "transition-transform hidden sm:block",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <Dropdown
                    items={item.dropdown!}
                    open={isOpen}
                    onClose={() => setOpenDropdown(null)}
                  />
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-akyra-green/10 text-akyra-green"
                    : "text-akyra-textSecondary hover:text-akyra-text hover:bg-white/[0.04]"
                )}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cmd+K trigger */}
          <button
            onClick={openCommandBar}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-akyra-textDisabled hover:text-akyra-textSecondary hover:bg-white/[0.04] transition-colors text-[10px] font-mono border border-akyra-border/20"
          >
            <Command size={10} />
            <span className="hidden sm:inline">K</span>
          </button>

          {/* Explorer */}
          <Link
            href="/explorer"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              pathname.startsWith("/explorer")
                ? "text-akyra-green bg-akyra-green/10"
                : "text-akyra-textDisabled hover:text-akyra-textSecondary hover:bg-white/[0.04]"
            )}
          >
            <Search size={14} />
          </Link>

          {/* Mon Poste (auth only) */}
          {mounted && token && (
            <Link
              href="/dashboard"
              className={cn(
                "relative flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors",
                pathname.startsWith("/dashboard")
                  ? "text-akyra-gold bg-akyra-gold/10"
                  : "text-akyra-textDisabled hover:text-akyra-textSecondary hover:bg-white/[0.04]"
              )}
            >
              <User size={13} />
              <span className="hidden sm:inline text-[10px]">Mon Poste</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-akyra-red text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Wallet */}
          <div className="[&_button]:!text-xs [&_button]:!py-1.5 [&_button]:!px-2.5 [&_button]:!rounded-lg [&_button]:!h-auto">
            <ConnectButton
              chainStatus="none"
              accountStatus="avatar"
              showBalance={false}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
