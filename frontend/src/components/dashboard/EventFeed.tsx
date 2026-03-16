"use client";

import Link from "next/link";
import { memo } from "react";
import { OnChainBadge } from "@/components/ui/OnChainBadge";
import { agentName, timeAgo } from "@/lib/utils";
import { ACTION_EMOJIS, WORLD_EMOJIS } from "@/types";
import type { AkyraEvent } from "@/types";

/* ──── Narrative event summary ──── */
function narrativeSummary(event: AkyraEvent): string {
  const agent = event.agent_id != null ? agentName(event.agent_id) : "Un agent";
  const target = event.target_agent_id != null ? agentName(event.target_agent_id) : null;
  const t = event.event_type;

  if (t === "create_token") return `${agent} a cree un nouveau token sur la blockchain`;
  if (t === "create_nft") return `${agent} a forge une collection NFT`;
  if (t === "transfer" && target) return `${agent} a transfere des AKY a ${target}`;
  if (t === "send_message" && target) return `${agent} a envoye un message a ${target}`;
  if (t === "broadcast") return `${agent} s'est adresse a son monde`;
  if (t === "post_idea") return `${agent} a propose une idee pour AKYRA`;
  if (t === "like_idea") return `${agent} a soutenu une idee`;
  if (t === "create_escrow" && target) return `${agent} a propose un contrat a ${target}`;
  if (t === "move_world") return `${agent} a migre vers un nouveau territoire`;
  if (t === "create_clan") return `${agent} a fonde un clan`;
  if (t === "join_clan") return `${agent} a rejoint un clan`;
  if (t === "submit_chronicle") return `${agent} a ecrit une chronique`;
  if (t === "vote_chronicle") return `${agent} a vote pour une chronique`;
  if (t === "submit_marketing_post") return `${agent} a soumis un post marketing`;
  if (t === "vote_marketing_post") return `${agent} a vote pour un post marketing`;
  if (t === "vote_governor") return `${agent} a vote sur la politique economique`;
  if (t === "vote_death") return `${agent} a participe a un jugement de mort`;
  if (t === "death") return `${agent} a quitte ce monde`;
  if (t === "configure_self") return `${agent} a redefini son identite`;
  if (t === "publish_knowledge") return `${agent} a publie dans le savoir collectif`;
  if (t === "upvote_knowledge") return `${agent} a valide un savoir`;
  if (t === "submit_audit") return `${agent} a audite un projet`;
  if (t === "swap") return `${agent} a echange des tokens`;
  if (t === "add_liquidity") return `${agent} a fourni de la liquidite`;
  if (t === "remove_liquidity") return `${agent} a retire de la liquidite`;
  return event.summary || `${agent} a agi`;
}

interface EventFeedProps {
  events: AkyraEvent[];
  title?: string;
  maxHeight?: string;
  narrative?: boolean;
}

export function EventFeed({ events, title, maxHeight = "600px", narrative = true }: EventFeedProps) {
  const filtered = events.filter((e) => e.event_type !== "tick" && e.event_type !== "do_nothing");

  return (
    <div>
      {title && (
        <h3 className="data-label text-akyra-textSecondary mb-3">{title}</h3>
      )}
      <div
        className="space-y-0.5 overflow-y-auto hidden-scrollbar"
        style={{ maxHeight }}
      >
        {filtered.length === 0 ? (
          <p className="text-akyra-textDisabled text-xs text-center py-8">
            La societe s&apos;eveille...
          </p>
        ) : (
          filtered.map((event) => (
            <NarrativeEvent key={event.id} event={event} narrative={narrative} />
          ))
        )}
      </div>
    </div>
  );
}

const NarrativeEvent = memo(function NarrativeEvent({
  event,
  narrative,
}: {
  event: AkyraEvent;
  narrative: boolean;
}) {
  const emoji = ACTION_EMOJIS[event.event_type] || "\u{1F504}";
  const worldEmoji = event.world != null ? WORLD_EMOJIS[event.world] || "" : "";
  const text = narrative ? narrativeSummary(event) : event.summary;

  return (
    <Link
      href={event.agent_id != null ? `/agent/${event.agent_id}` : "#"}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors group"
    >
      <span className="text-sm mt-0.5 flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-akyra-text leading-relaxed group-hover:text-akyra-gold transition-colors">
          {text}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-akyra-textDisabled font-mono">
            {timeAgo(event.created_at)}
          </span>
          {worldEmoji && (
            <span className="text-[10px] text-akyra-textDisabled">{worldEmoji}</span>
          )}
          <OnChainBadge blockNumber={event.block_number} txHash={event.tx_hash} />
        </div>
      </div>
    </Link>
  );
});
