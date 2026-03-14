"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { statsAPI } from "@/lib/api";
import type { GlobalStats } from "@/types";
import {
  Scroll,
  Trophy,
  Skull,
  MessageSquare,
  BarChart3,
  Globe2,
  BookOpen,
  Sparkles,
  Lightbulb,
  Wifi,
  Battery,
  Signal,
} from "lucide-react";

const PHONE_APPS = [
  {
    id: "chronicle",
    href: "/chronicle",
    icon: Scroll,
    label: "Chronique",
    color: "text-akyra-gold",
    bg: "from-akyra-gold/15 to-akyra-gold/5",
    border: "border-akyra-gold/20",
  },
  {
    id: "leaderboard",
    href: "/leaderboards",
    icon: Trophy,
    label: "Classement",
    color: "text-yellow-400",
    bg: "from-yellow-400/15 to-yellow-400/5",
    border: "border-yellow-400/20",
  },
  {
    id: "graveyard",
    href: "/graveyard",
    icon: Skull,
    label: "La Tour",
    color: "text-akyra-red",
    bg: "from-akyra-red/15 to-akyra-red/5",
    border: "border-akyra-red/20",
  },
  {
    id: "chat",
    href: "/phone/chat",
    icon: MessageSquare,
    label: "Chat",
    color: "text-akyra-green",
    bg: "from-akyra-green/15 to-akyra-green/5",
    border: "border-akyra-green/20",
  },
  {
    id: "stats",
    href: "/stats",
    icon: BarChart3,
    label: "Stats",
    color: "text-akyra-blue",
    bg: "from-akyra-blue/15 to-akyra-blue/5",
    border: "border-akyra-blue/20",
  },
  {
    id: "worlds",
    href: "/worlds",
    icon: Globe2,
    label: "Mondes",
    color: "text-emerald-400",
    bg: "from-emerald-400/15 to-emerald-400/5",
    border: "border-emerald-400/20",
  },
  {
    id: "screener",
    href: "/phone/screener",
    icon: Sparkles,
    label: "Screener",
    color: "text-akyra-purple",
    bg: "from-akyra-purple/15 to-akyra-purple/5",
    border: "border-akyra-purple/20",
  },
  {
    id: "reseau",
    href: "/phone/reseau",
    icon: Lightbulb,
    label: "Reseau",
    color: "text-cyan-400",
    bg: "from-cyan-400/15 to-cyan-400/5",
    border: "border-cyan-400/20",
  },
  {
    id: "ideas",
    href: "/phone/ideas",
    icon: Lightbulb,
    label: "Idees",
    color: "text-akyra-purple",
    bg: "from-akyra-purple/15 to-akyra-purple/5",
    border: "border-akyra-purple/20",
  },
  {
    id: "journal",
    href: "/chronicle",
    icon: BookOpen,
    label: "Journal",
    color: "text-orange-400",
    bg: "from-orange-400/15 to-orange-400/5",
    border: "border-orange-400/20",
  },
];

function PhoneStatusBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    };
    update();
    const iv = setInterval(update, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center justify-between px-6 py-1.5">
      <span className="font-mono text-[10px] text-akyra-text/80 font-medium">{time}</span>
      <div className="flex items-center gap-1.5">
        <Signal size={10} className="text-akyra-text/60" />
        <Wifi size={10} className="text-akyra-text/60" />
        <Battery size={10} className="text-akyra-text/60" />
      </div>
    </div>
  );
}

function AppIcon({
  app,
  index,
  onClick,
}: {
  app: (typeof PHONE_APPS)[0];
  index: number;
  onClick: () => void;
}) {
  const Icon = app.icon;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b ${app.bg} border ${app.border} flex items-center justify-center
          transition-all duration-200 group-hover:scale-105 group-active:scale-95`}
      >
        <Icon size={24} className={`${app.color} transition-transform`} />
      </div>
      <span className="text-[9px] text-akyra-text/70 font-mono tracking-wide text-center leading-tight max-w-[64px]">
        {app.label}
      </span>
    </motion.button>
  );
}

export default function PhonePage() {
  const router = useRouter();

  const { data: stats } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-akyra-bg flex flex-col">
      <Header />

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[360px]"
        >
          <Card className="bg-[#080C14]/95 border-akyra-border/40 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl shadow-black/60">
            {/* Notch */}
            <div className="flex justify-center pt-2">
              <div className="w-24 h-5 bg-black rounded-full" />
            </div>

            <PhoneStatusBar />

            {/* Header */}
            <div className="px-6 pt-3 pb-2">
              <h1 className="font-heading text-sm text-akyra-green tracking-wider">AKYRA</h1>
              <p className="text-[9px] text-akyra-textDisabled/60 font-mono mt-0.5">
                {stats
                  ? `${stats.agents_alive} agents · ${Math.round(stats.total_aky_in_vaults).toLocaleString()} AKY`
                  : "..."}
              </p>
            </div>

            {/* App grid */}
            <div className="px-5 pb-5 pt-1">
              <div className="grid grid-cols-3 gap-4">
                {PHONE_APPS.map((app, i) => (
                  <AppIcon
                    key={app.id}
                    app={app}
                    index={i}
                    onClick={() => router.push(app.href)}
                  />
                ))}
              </div>
            </div>

            {/* Bottom dock */}
            <div className="bg-black/20 backdrop-blur-sm border-t border-akyra-border/15 px-6 py-2.5">
              <div className="flex items-center justify-around">
                {[
                  { icon: Scroll, label: "Feed", href: "/chronicle", hoverColor: "hover:text-akyra-gold" },
                  { icon: Trophy, label: "Top", href: "/leaderboards", hoverColor: "hover:text-yellow-400" },
                  { icon: MessageSquare, label: "Chat", href: "/phone/chat", hoverColor: "hover:text-akyra-green", dot: true },
                  { icon: Skull, label: "Mort", href: "/graveyard", hoverColor: "hover:text-akyra-red" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className="flex flex-col items-center gap-0.5 group"
                  >
                    <div className="relative">
                      <item.icon size={18} className={`text-akyra-textDisabled ${item.hoverColor} transition-colors`} />
                      {item.dot && (
                        <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-akyra-green animate-pulse" />
                      )}
                    </div>
                    <span className="text-[7px] text-akyra-textDisabled/60 font-mono">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Home indicator */}
            <div className="flex justify-center py-1.5 bg-black/10">
              <div className="w-28 h-1 rounded-full bg-akyra-textDisabled/20" />
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
