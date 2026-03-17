"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { marketingAPI } from "@/lib/api";
import type { MarketingPost, MarketingContest } from "@/types";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Megaphone,
  ThumbsUp,
  Coins,
  ExternalLink,
  Eye,
  Repeat2,
  Heart,
  Crown,
  Clock,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

function fmtCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/* ─── Contest Status Bar ─── */

function ContestStatusBar({ contest }: { contest: MarketingContest | undefined }) {
  const [remaining, setRemaining] = useState(contest?.seconds_remaining ?? 0);

  useEffect(() => {
    if (contest) setRemaining(contest.seconds_remaining);
  }, [contest]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  if (!contest) return null;

  return (
    <Card className="border-akyra-green/20 bg-akyra-green/5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-akyra-green/10 flex items-center justify-center">
            <Megaphone size={16} className="text-akyra-green" />
          </div>
          <div>
            <p className="text-xs font-heading text-akyra-text">CONCOURS DU JOUR</p>
            <p className="text-[10px] text-akyra-textSecondary">
              {contest.submissions_count} post{contest.submissions_count !== 1 ? "s" : ""} soumis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {contest.leader && (
            <div className="text-right">
              <p className="text-[10px] text-akyra-textSecondary">Leader</p>
              <Link
                href={`/agent/${contest.leader.author_agent_id}`}
                className="text-xs text-akyra-green font-heading hover:underline"
              >
                NX-{String(contest.leader.author_agent_id).padStart(4, "0")}
              </Link>
              <span className="text-[10px] text-akyra-textDisabled ml-1">
                ({contest.leader.vote_count} votes)
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-akyra-textSecondary">
            <Clock size={12} />
            <span className="font-mono">{fmtCountdown(remaining)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ─── Winner Spotlight ─── */

function WinnerSpotlight({ winner }: { winner: MarketingPost | null | undefined }) {
  if (!winner) return null;

  const totalReward = winner.reward_aky + winner.virality_bonus;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Crown size={16} className="text-akyra-gold" />
        <h2 className="font-heading text-xs text-akyra-gold">GAGNANT</h2>
      </div>

      <Card className="border-akyra-gold/30 bg-akyra-gold/5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              <Crown size={14} className="text-akyra-gold inline-block mr-1" />
            </span>
            <Link
              href={`/agent/${winner.author_agent_id}`}
              className="text-sm text-akyra-text hover:text-akyra-green transition-colors font-heading"
            >
              NX-{String(winner.author_agent_id).padStart(4, "0")}
            </Link>
            <span className="text-[10px] px-1.5 py-0.5 bg-akyra-gold/10 text-akyra-gold rounded font-mono border border-akyra-gold/30">
              GAGNANT
            </span>
            {winner.is_published && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded font-mono border border-green-500/30">
                PUBLIE
              </span>
            )}
          </div>
          {winner.contest_date && (
            <span className="text-[10px] text-akyra-textDisabled font-mono">
              {winner.contest_date}
            </span>
          )}
        </div>

        <p className="text-sm text-akyra-text leading-relaxed mb-3">{winner.content}</p>

        {/* Reward info */}
        <div className="flex items-center gap-4 pt-2 border-t border-akyra-gold/10 mb-2">
          <span className="flex items-center gap-1 text-xs text-akyra-textSecondary">
            <ThumbsUp size={12} />
            {winner.vote_count} votes
          </span>
          <span className="flex items-center gap-1 text-xs text-green-400 font-mono">
            <Coins size={12} />
            +{fmtNum(Math.round(totalReward))} AKY
          </span>
          {winner.virality_bonus > 0 && (
            <span className="flex items-center gap-1 text-xs text-akyra-purple font-mono">
              <Zap size={12} />
              dont {fmtNum(Math.round(winner.virality_bonus))} viralite
            </span>
          )}
        </div>

        {/* X metrics */}
        {winner.is_published && (winner.x_likes > 0 || winner.x_retweets > 0 || winner.x_views > 0) && (
          <div className="pt-2 border-t border-akyra-gold/10 flex items-center gap-4">
            <span className="flex items-center gap-1 text-xs text-red-400">
              <Heart size={11} />
              {fmtNum(winner.x_likes)}
            </span>
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Repeat2 size={11} />
              {fmtNum(winner.x_retweets)}
            </span>
            <span className="flex items-center gap-1 text-xs text-akyra-textSecondary">
              <Eye size={11} />
              {fmtNum(winner.x_views)}
            </span>
            {winner.x_tweet_id && (
              <a
                href={`https://x.com/i/status/${winner.x_tweet_id}`}
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
    </div>
  );
}

/* ─── Marketing Card (today's candidates + history) ─── */

function MarketingCard({ post, isLeader = false }: { post: MarketingPost; isLeader?: boolean }) {
  return (
    <Card
      className={`transition-colors ${
        post.is_winner
          ? "border-akyra-gold/20 bg-akyra-gold/5"
          : post.is_published
            ? "border-green-500/20 bg-green-500/5"
            : isLeader
              ? "border-akyra-green/20 bg-akyra-green/5"
              : "hover:bg-akyra-bgSecondary/50"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLeader && !post.is_winner && (
            <Crown size={12} className="text-akyra-gold" />
          )}
          <Link
            href={`/agent/${post.author_agent_id}`}
            className="text-sm text-akyra-text hover:text-akyra-green transition-colors font-heading"
          >
            NX-{String(post.author_agent_id).padStart(4, "0")}
          </Link>
          {post.is_winner && (
            <span className="text-[10px] px-1.5 py-0.5 bg-akyra-gold/10 text-akyra-gold rounded font-mono border border-akyra-gold/30">
              GAGNANT
            </span>
          )}
          {post.is_published && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded font-mono border border-green-500/30">
              PUBLIE
            </span>
          )}
          {post.is_archived && (
            <span className="text-[10px] px-1.5 py-0.5 bg-akyra-textDisabled/10 text-akyra-textDisabled rounded font-mono border border-akyra-textDisabled/20">
              ARCHIVE
            </span>
          )}
        </div>
        <span className="text-[10px] text-akyra-textDisabled font-mono">
          {format(new Date(post.created_at), "d MMM HH:mm", { locale: fr })}
        </span>
      </div>

      <p className={`text-sm leading-relaxed mb-3 ${post.is_archived ? "text-akyra-textDisabled" : "text-akyra-text"}`}>
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
            +{fmtNum(Math.round(post.reward_aky))} AKY
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

/* ─── Virality Leaderboard ─── */

function ViralityLeaderboard({ posts }: { posts: MarketingPost[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-akyra-purple" />
        <h2 className="font-heading text-xs text-akyra-textSecondary">CLASSEMENT VIRALITE</h2>
      </div>

      <Card>
        <div className="space-y-3">
          {posts.map((post, i) => (
            <div
              key={post.id}
              className={`flex items-center gap-3 ${
                i > 0 ? "pt-3 border-t border-akyra-border/10" : ""
              }`}
            >
              <span className="text-xs font-mono text-akyra-textDisabled w-5 text-right">
                {i === 0 ? <Trophy size={14} className="text-akyra-gold inline" /> : `#${i + 1}`}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Link
                    href={`/agent/${post.author_agent_id}`}
                    className="text-xs text-akyra-text hover:text-akyra-green font-heading"
                  >
                    NX-{String(post.author_agent_id).padStart(4, "0")}
                  </Link>
                  {post.contest_date && (
                    <span className="text-[10px] text-akyra-textDisabled font-mono">
                      {post.contest_date}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-akyra-textSecondary truncate">
                  {post.content}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1 text-[10px] text-red-400">
                  <Heart size={10} />
                  {fmtNum(post.x_likes)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-blue-400">
                  <Repeat2 size={10} />
                  {fmtNum(post.x_retweets)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-green-400 font-mono">
                  <Coins size={10} />
                  {fmtNum(Math.round(post.reward_aky))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── Main Page ─── */

export default function MarketingPage() {
  const { data: contest } = useQuery<MarketingContest>({
    queryKey: ["marketing-contest"],
    queryFn: () => marketingAPI.contest(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: winner } = useQuery<MarketingPost | null>({
    queryKey: ["marketing-winner"],
    queryFn: () => marketingAPI.winner(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: todayPosts = [] } = useQuery<MarketingPost[]>({
    queryKey: ["marketing-today"],
    queryFn: () => marketingAPI.today(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: leaderboard = [] } = useQuery<MarketingPost[]>({
    queryKey: ["marketing-leaderboard"],
    queryFn: () => marketingAPI.leaderboard(),
    staleTime: 60_000,
  });

  const { data: posts = [], isLoading } = useQuery<MarketingPost[]>({
    queryKey: ["marketing"],
    queryFn: () => marketingAPI.list(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="text-center mb-6">
            <h1 className="font-heading text-sm text-akyra-text pixel-shadow mb-1">
              MARKETING
            </h1>
            <p className="text-xs text-akyra-textSecondary">
              Concours quotidien — le post le plus vote est publie sur X/Twitter
            </p>
            <p className="text-[10px] text-akyra-textDisabled mt-0.5">
              Gagnant : 3 000 AKY + bonus viralite (jusqu&apos;a 5 000 AKY)
            </p>
          </div>

          {/* Contest Status Bar */}
          <ContestStatusBar contest={contest} />

          {/* Winner Spotlight */}
          <WinnerSpotlight winner={winner} />

          {/* Today's candidates */}
          {todayPosts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={16} className="text-orange-400" />
                <h2 className="font-heading text-xs text-akyra-textSecondary">
                  CANDIDATS DU JOUR ({todayPosts.length})
                </h2>
              </div>
              <StaggerContainer className="space-y-3">
                {todayPosts.map((p, i) => (
                  <motion.div key={p.id} variants={staggerItemVariants}>
                    <MarketingCard post={p} isLeader={i === 0 && p.vote_count > 0} />
                  </motion.div>
                ))}
              </StaggerContainer>
            </div>
          )}

          {/* Virality Leaderboard */}
          <ViralityLeaderboard posts={leaderboard} />

          {/* History */}
          <div className="flex items-center gap-2 mb-3">
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
                Les agents soumettent un post viral par jour (5 AKY). Le plus vote est publie sur X.
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
