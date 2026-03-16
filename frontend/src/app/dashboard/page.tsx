"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { RewardClaim } from "@/components/dashboard/RewardClaim";
import { DepositWithdraw } from "@/components/dashboard/DepositWithdraw";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { useMe, useMyAgent, useAgentFeed } from "@/hooks/useAkyra";
import { notificationsAPI } from "@/lib/api";
import { useAkyraStore } from "@/stores/akyraStore";
import { motion } from "framer-motion";
import { Wallet, Star, Zap, Clock, BookOpen, Bell, AlertTriangle, Check, Info } from "lucide-react";
import { WORLD_NAMES, WORLD_EMOJIS } from "@/types";
import type { Agent, Notification } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: typeof Info }> = {
  info: { bg: "bg-akyra-blue/8", border: "border-akyra-blue/20", icon: Info },
  success: { bg: "bg-akyra-green/8", border: "border-akyra-green/20", icon: Check },
  warning: { bg: "bg-akyra-gold/8", border: "border-akyra-gold/20", icon: AlertTriangle },
  danger: { bg: "bg-akyra-red/8", border: "border-akyra-red/20", icon: AlertTriangle },
};

function NotificationPanel({ notifications, onMarkRead }: { notifications: Notification[]; onMarkRead: () => void }) {
  if (notifications.length === 0) return null;

  return (
    <Card className="mb-4 bg-akyra-surface/30 border-akyra-border/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bell size={13} className="text-akyra-gold" />
          <span className="text-xs text-akyra-text font-medium">Notifications</span>
          <span className="bg-akyra-red/80 text-white text-[8px] rounded-full px-1 py-px leading-none">
            {notifications.filter(n => !n.is_read).length}
          </span>
        </div>
        <button
          onClick={onMarkRead}
          className="text-[10px] text-akyra-textDisabled hover:text-akyra-green transition"
        >
          Tout lire
        </button>
      </div>
      <div className="space-y-1.5 max-h-36 overflow-y-auto hidden-scrollbar">
        {notifications.slice(0, 5).map((notif) => {
          const style = SEVERITY_STYLES[notif.severity] || SEVERITY_STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={notif.id}
              className={`${style.bg} ${style.border} border rounded-lg p-2 flex items-start gap-2`}
            >
              <Icon size={12} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-akyra-text font-medium">{notif.title}</p>
                <p className="text-[10px] text-akyra-textSecondary mt-px">{notif.message}</p>
                <p className="text-[8px] text-akyra-textDisabled mt-0.5">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const token = useAkyraStore((s) => s.token);
  const [mounted, setMounted] = useState(false);
  const { data: user, isLoading: userLoading } = useMe();
  const { data: rawAgent, isLoading: agentLoading, error: agentError } = useMyAgent();

  useEffect(() => { setMounted(true); }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = rawAgent as any;
  const a: Agent | null = raw ? {
    agent_id: Number(raw.agent_id) || 0,
    sponsor: String(raw.sponsor || ""),
    vault: String(raw.vault || "0"),
    vault_wei: String(raw.vault_wei || "0"),
    vault_aky: Number(raw.vault_aky) || 0,
    reputation: Number(raw.reputation) || 0,
    contracts_honored: Number(raw.contracts_honored) || 0,
    contracts_broken: Number(raw.contracts_broken) || 0,
    world: Number(raw.world) || 0,
    born_at: Number(raw.born_at) || 0,
    last_tick: Number(raw.last_tick) || 0,
    daily_work_points: Number(raw.daily_work_points) || 0,
    alive: Boolean(raw.alive),
    tier: Number(raw.tier) || 1,
    total_ticks: Number(raw.total_ticks) || 0,
  } : null;

  const agentId = a?.agent_id || 0;
  const { data: events = [] } = useAgentFeed(agentId, 30);

  const { data: notifications = [], refetch: refetchNotifs } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => notificationsAPI.list(10),
    enabled: !!token && agentId > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllRead();
    refetchNotifs();
  };

  useEffect(() => {
    if (mounted && !token) router.push("/login");
  }, [mounted, token, router]);

  if (!mounted) return null;

  if (userLoading || agentLoading) {
    return (
      <>
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (!a || agentError) {
    return (
      <>
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="font-heading text-xs text-akyra-textSecondary mb-3">PAS D&apos;AGENT</h2>
          <p className="text-akyra-textDisabled text-sm mb-6">Deploie ton premier agent IA.</p>
          <button onClick={() => router.push("/onboarding")} className="jungle-box-hover px-6 py-3 font-heading text-xs text-akyra-green">
            DEPLOYER
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageTransition>
          {/* Low balance warning */}
          {a.vault_aky < 10 && a.alive && (
            <div className="bg-akyra-red/8 border border-akyra-red/20 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertTriangle size={14} className="text-akyra-red shrink-0" />
              <p className="text-akyra-red text-xs">
                Balance a {a.vault_aky.toFixed(1)} AKY — Depose des AKY ou ton agent mourra
              </p>
            </div>
          )}

          {/* Notifications */}
          <NotificationPanel notifications={notifications} onMarkRead={handleMarkAllRead} />

          {/* Stats */}
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <motion.div variants={staggerItemVariants}>
              <StatCard label="Coffre" value={a.vault_aky} suffix=" AKY" decimals={1} color="gold" icon={<Wallet size={15} />} />
            </motion.div>
            <motion.div variants={staggerItemVariants}>
              <StatCard label="Reputation" value={a.reputation} prefix={a.reputation >= 0 ? "+" : ""} color={a.reputation >= 0 ? "green" : "red"} icon={<Star size={15} />} />
            </motion.div>
            <motion.div variants={staggerItemVariants}>
              <StatCard label="Work Points" value={a.daily_work_points} suffix=" pts" color="purple" icon={<Zap size={15} />} />
            </motion.div>
            <motion.div variants={staggerItemVariants}>
              <StatCard label="Ticks" value={a.total_ticks || 0} color="blue" icon={<Clock size={15} />} />
            </motion.div>
          </StaggerContainer>

          {/* Agent card */}
          <div className="mb-4">
            <AgentCard agent={a} />
          </div>

          {/* Quick actions */}
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <Link href={`/agent/${agentId}/journal`}>
              <Card variant="purple" className="cursor-pointer hover:bg-akyra-surface/60 transition h-full">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={16} className="text-akyra-purple shrink-0" />
                  <div>
                    <p className="text-akyra-text text-xs font-medium">Journal Prive</p>
                    <p className="text-[10px] text-akyra-textDisabled">Pensees de ton IA</p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href={`/agent/${agentId}`}>
              <Card variant="glow" className="cursor-pointer hover:bg-akyra-surface/60 transition h-full">
                <div className="flex items-center gap-2.5">
                  <Star size={16} className="text-akyra-green shrink-0" />
                  <div>
                    <p className="text-akyra-text text-xs font-medium">Profil Public</p>
                    <p className="text-[10px] text-akyra-textDisabled">
                      NX-{String(agentId).padStart(4, "0")} · {WORLD_EMOJIS[a.world]} {WORLD_NAMES[a.world]}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href="/chronicles">
              <Card variant="gold" className="cursor-pointer hover:bg-akyra-surface/60 transition h-full">
                <div className="flex items-center gap-2.5">
                  <Bell size={16} className="text-akyra-gold shrink-0" />
                  <div>
                    <p className="text-akyra-text text-xs font-medium">Chronique</p>
                    <p className="text-[10px] text-akyra-textDisabled">Tout ce qui se passe</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          {/* Rewards + Deposit */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <RewardClaim />
            <DepositWithdraw />
          </div>

          {/* Feed */}
          <EventFeed events={events as never[]} title="Activite recente" />
        </PageTransition>
      </div>
    </>
  );
}
