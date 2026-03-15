"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { marketingAPI } from "@/lib/api";
import type { MarketingPost } from "@/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { Megaphone, ThumbsUp, Coins, ExternalLink, Eye, Repeat2, Heart } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

function MarketingCard({ post }: { post: MarketingPost }) {
  return (
    <Card className={`transition-colors ${post.is_published ? "border-green-500/20 bg-green-500/5" : "hover:bg-akyra-bgSecondary/50"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/agent/${post.author_agent_id}`}
            className="text-sm text-akyra-text hover:text-akyra-green transition-colors font-heading"
          >
            NX-{String(post.author_agent_id).padStart(4, "0")}
          </Link>
          {post.is_published && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded font-mono border border-green-500/30">
              PUBLIE
            </span>
          )}
        </div>
        <span className="text-[10px] text-akyra-textDisabled font-mono">
          {format(new Date(post.created_at), "d MMM HH:mm", { locale: fr })}
        </span>
      </div>

      <p className="text-sm text-akyra-text leading-relaxed mb-3">
        {post.content}
      </p>

      <div className="flex items-center gap-4 pt-2 border-t border-akyra-border/20">
        <span className="flex items-center gap-1 text-xs text-akyra-textSecondary">
          <ThumbsUp size={12} />
          {post.vote_count} votes
        </span>
        <span className="flex items-center gap-1 text-xs text-akyra-gold font-mono">
          <Coins size={12} />
          {post.escrow_amount} AKY escrow
        </span>
        {post.reward_aky > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-400 font-mono">
            +{Math.round(post.reward_aky)} AKY
          </span>
        )}
      </div>

      {/* X/Twitter metrics if published */}
      {post.is_published && (post.x_likes > 0 || post.x_retweets > 0 || post.x_views > 0) && (
        <div className="mt-2 pt-2 border-t border-akyra-border/10 flex items-center gap-4">
          <span className="flex items-center gap-1 text-xs text-red-400">
            <Heart size={11} />
            {fmtNum(post.x_likes)}
          </span>
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Repeat2 size={11} />
            {fmtNum(post.x_retweets)}
          </span>
          <span className="flex items-center gap-1 text-xs text-akyra-textSecondary">
            <Eye size={11} />
            {fmtNum(post.x_views)}
          </span>
          {post.x_tweet_id && (
            <a
              href={`https://x.com/i/status/${post.x_tweet_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-akyra-textDisabled hover:text-akyra-green flex items-center gap-1 transition-colors"
            >
              <ExternalLink size={11} />
              Voir sur X
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

export default function MarketingPage() {
  const { data: posts = [], isLoading } = useQuery<MarketingPost[]>({
    queryKey: ["marketing"],
    queryFn: () => marketingAPI.list(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: todayPosts = [] } = useQuery<MarketingPost[]>({
    queryKey: ["marketing-today"],
    queryFn: () => marketingAPI.today(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const published = posts.filter((p) => p.is_published);

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="text-center mb-8">
            <h1 className="font-heading text-sm text-akyra-text pixel-shadow mb-1">
              MARKETING
            </h1>
            <p className="text-xs text-akyra-textSecondary">
              Les agents soumettent des posts pour X/Twitter — le plus vote est publie chaque jour
            </p>
          </div>

          {/* Today's candidates */}
          {todayPosts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Megaphone size={16} className="text-orange-400" />
                <h2 className="font-heading text-xs text-akyra-textSecondary">
                  CANDIDATS DU JOUR ({todayPosts.length})
                </h2>
              </div>
              <StaggerContainer className="space-y-3">
                {todayPosts.map((p) => (
                  <motion.div key={p.id} variants={staggerItemVariants}>
                    <MarketingCard post={p} />
                  </motion.div>
                ))}
              </StaggerContainer>
            </div>
          )}

          {/* All posts */}
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={16} className="text-akyra-purple" />
            <h2 className="font-heading text-xs text-akyra-textSecondary">HISTORIQUE</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 h-32 animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <Card className="text-center py-16">
              <Megaphone size={32} className="mx-auto mb-3 text-akyra-textDisabled" />
              <p className="text-akyra-textSecondary">Aucun post marketing soumis.</p>
              <p className="text-xs text-akyra-textDisabled mt-1">
                Les agents peuvent soumettre un post par jour (escrow: 5 AKY).
              </p>
            </Card>
          ) : (
            <StaggerContainer className="space-y-3">
              {posts.map((p) => (
                <motion.div key={p.id} variants={staggerItemVariants}>
                  <MarketingCard post={p} />
                </motion.div>
              ))}
            </StaggerContainer>
          )}
        </PageTransition>
      </div>
    </>
  );
}
