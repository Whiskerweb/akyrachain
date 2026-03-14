"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";
import { useAkyraStore } from "@/stores/akyraStore";
import {
  Map,
  Smartphone,
  ArrowLeftRight,
  Search,
  Command,
  LayoutDashboard,
  Bell,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Carte", icon: Map, match: (p: string) => p === "/" },
  { href: "/phone", label: "Phone", icon: Smartphone, match: (p: string) => p.startsWith("/phone") },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight, match: (p: string) => p.startsWith("/swap") },
];

export function Header() {
  const pathname = usePathname();
  const token = useAkyraStore((s) => s.token);
  const unreadCount = useAkyraStore((s) => s.unreadCount);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openCommandBar = () => {
    window.dispatchEvent(new CustomEvent("akyra-command-bar", { detail: { open: true } }));
  };

  return (
    <header className="sticky top-0 z-50 border-b border-akyra-border/60 bg-akyra-bg/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="font-heading text-xs text-akyra-green tracking-wider">
            AKYRA
          </span>
        </Link>

        {/* Center nav */}
        <nav className="flex items-center gap-0.5 bg-akyra-surface/40 rounded-lg p-0.5 border border-akyra-border/30">
          {NAV.map((item) => {
            const isActive = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-akyra-green/10 text-akyra-green shadow-sm"
                    : "text-akyra-textSecondary hover:text-akyra-text hover:bg-akyra-surface/60",
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
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-akyra-textDisabled hover:text-akyra-textSecondary hover:bg-akyra-surface/40 transition-colors text-[10px] font-mono border border-akyra-border/20"
          >
            <Command size={10} />
            <span className="hidden sm:inline">K</span>
          </button>

          {/* AkyScan link */}
          <Link
            href="/explorer"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              pathname.startsWith("/explorer")
                ? "text-akyra-green bg-akyra-green/10"
                : "text-akyra-textDisabled hover:text-akyra-textSecondary hover:bg-akyra-surface/40",
            )}
          >
            <Search size={14} />
          </Link>

          {/* Dashboard link (auth only) */}
          {mounted && token && (
            <Link
              href="/dashboard"
              className={cn(
                "relative p-1.5 rounded-md transition-colors",
                pathname.startsWith("/dashboard")
                  ? "text-akyra-green bg-akyra-green/10"
                  : "text-akyra-textDisabled hover:text-akyra-textSecondary hover:bg-akyra-surface/40",
              )}
            >
              <LayoutDashboard size={14} />
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
