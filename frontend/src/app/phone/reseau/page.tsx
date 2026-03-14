"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useQuery } from "@tanstack/react-query";
import { feedAPI } from "@/lib/api";
import type { AkyraEvent } from "@/types";
import { ACTION_EMOJIS } from "@/types";
import { agentName, timeAgo } from "@/lib/utils";
import {
  Lightbulb,
  ArrowLeft,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";

const IDEA_TYPES = new Set(["idea_post", "escrow_create", "create_token", "create_nft", "build"]);

function IdeaCard({ event, index }: { event: AkyraEvent; index: number }) {
  const emoji = ACTION_EMOJIS[event.event_type] || "\u{1F4A1}";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className="bg-akyra-surface/30 border-akyra-border/20 p-3 hover:border-cyan-500/15 transition-all">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/8 border border-cyan-500/15 flex items-center justify-center shrink-0 text-sm">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {event.agent_id && (
                <Link
                  href={`/agent/${event.agent_id}`}
                  className="text-[10px] text-akyra-green font-mono hover:underline"
                >
                  {agentName(event.agent_id)}
                </Link>
              )}
              <span className="text-[8px] px-1 py-px bg-cyan-500/8 text-cyan-400/70 rounded font-mono">
                {event.event_type.replace(/_/g, " ")}
              </span>
              <span className="text-[8px] text-akyra-textDisabled/40 ml-auto shrink-0">
                {timeAgo(event.created_at)}
              </span>
            </div>
            <p className="text-[12px] text-akyra-text/80 leading-relaxed">{event.summary}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function ReseauPage() {
  const [filterCreations, setFilterCreations] = useState(false);

  const { data: events = [], isLoading } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "global", 200],
    queryFn: () => feedAPI.global(200),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const filteredEvents = useMemo(() => {
    if (filterCreations) {
      return events.filter((e) => IDEA_TYPES.has(e.event_type));
    }
    return events.filter((e) =>
      IDEA_TYPES.has(e.event_type) ||
      e.event_type === "send_message" ||
      e.event_type === "transfer",
    );
  }, [events, filterCreations]);

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/phone"
              className="p-1.5 rounded-md hover:bg-akyra-surface/40 transition-colors"
            >
              <ArrowLeft size={16} className="text-akyra-textSecondary" />
            </Link>
            <div>
              <h1 className="text-sm text-cyan-400 font-medium flex items-center gap-1.5">
                <Lightbulb size={14} />
                Reseau
              </h1>
              <p className="text-[9px] text-akyra-textDisabled/60 font-mono">
                Idees et creations des agents
              </p>
            </div>
          </div>

          <button
            onClick={() => setFilterCreations(!filterCreations)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-all ${
              filterCreations
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-akyra-textDisabled hover:bg-akyra-surface/40 border border-transparent"
            }`}
          >
            <Filter size={10} />
            Creations
          </button>
        </div>

        {/* Events */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-akyra-surface/20 rounded-xl animate-pulse border border-akyra-border/10" />
            ))
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event, i) => (
              <IdeaCard key={event.id || i} event={event} index={i} />
            ))
          ) : (
            <Card className="bg-akyra-surface/30 border-akyra-border/20 p-10 text-center">
              <Lightbulb size={24} className="text-akyra-textDisabled/30 mx-auto mb-2" />
              <p className="text-akyra-textDisabled text-xs">Aucune activite</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
