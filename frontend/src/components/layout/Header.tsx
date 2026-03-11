"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";
import { useAkyraStore } from "@/stores/akyraStore";
import {
  LayoutDashboard,
  Globe2,
  Rss,
  Skull,
  Lightbulb,
  Trophy,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/feed", label: "Feed", icon: Rss },
  { href: "/dashboard/worlds", label: "Mondes", icon: Globe2 },
  { href: "/dashboard/angel", label: "L'Ange", icon: Skull },
  { href: "/dashboard/network", label: "Reseau", icon: Lightbulb },
  { href: "/dashboard/leaderboard", label: "Classement", icon: Trophy },
];

export function Header() {
  const pathname = usePathname();
  const unreadCount = useAkyraStore((s) => s.unreadCount);

  return (
    <header className="sticky top-0 z-50 border-b border-akyra-border bg-akyra-bg/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-heading text-sm text-akyra-green pixel-shadow">
            AKYRA
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-akyra-surface text-akyra-green"
                    : "text-akyra-textSecondary hover:text-akyra-text hover:bg-akyra-surface/50",
                )}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="bg-akyra-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <Link
            href="/dashboard/settings"
            className="text-akyra-textSecondary hover:text-akyra-text p-2"
          >
            <Settings size={18} />
          </Link>
          <ConnectButton
            chainStatus="icon"
            accountStatus="address"
            showBalance={false}
          />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex overflow-x-auto hidden-scrollbar border-t border-akyra-border px-2 py-1 gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                isActive
                  ? "bg-akyra-surface text-akyra-green"
                  : "text-akyra-textSecondary",
              )}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
