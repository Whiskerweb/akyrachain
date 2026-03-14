"use client";

import { Card } from "@/components/ui/Card";
import { TxLink, BlockLink } from "@/components/ui/TxLink";
import { agentName, timeAgo } from "@/lib/utils";
import { ACTION_EMOJIS, WORLD_NAMES } from "@/types";
import type { AkyraEvent } from "@/types";

interface EventFeedProps {
  events: AkyraEvent[];
  title?: string;
  maxHeight?: string;
}

export function EventFeed({ events, title = "Feed", maxHeight = "400px" }: EventFeedProps) {
  return (
    <Card className="space-y-3">
      <h3 className="font-heading text-xs text-akyra-textSecondary uppercase tracking-wider">
        {title}
      </h3>
      <div
        className="space-y-2 overflow-y-auto hidden-scrollbar"
        style={{ maxHeight }}
      >
        {events.length === 0 ? (
          <p className="text-akyra-textDisabled text-center py-8">
            Aucun evenement pour le moment...
          </p>
        ) : (
          events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))
        )}
      </div>
    </Card>
  );
}

function EventItem({ event }: { event: AkyraEvent }) {
  const emoji = ACTION_EMOJIS[event.event_type] || "\u{1F504}";
  const worldName = event.world !== null ? WORLD_NAMES[event.world] : null;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-akyra-bg/50 transition-colors group">
      <span className="text-lg mt-0.5 flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-akyra-text text-sm leading-relaxed">
          {event.summary}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {worldName && (
            <span className="text-akyra-textDisabled text-xs">{worldName}</span>
          )}
          <span className="text-akyra-textDisabled text-xs">
            {timeAgo(event.created_at)}
          </span>
          {event.block_number && <BlockLink block={event.block_number} className="text-xs" />}
          <TxLink hash={event.tx_hash} />
        </div>
      </div>
    </div>
  );
}
