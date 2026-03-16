"use client";

// ═══════════════════════════════════════════════════════════════════
// AKYRA — Living Blockchain Graph Visualization (v2 — Interactive)
// ═══════════════════════════════════════════════════════════════════
// Force-directed graph: each agent is a luminous island floating in
// space. Interactions form glowing filaments. Tokens orbit creators
// as satellite bubbles. Dead agents become dark asteroids.
//
// v2 adds: hover dimming, double-click focus, bezier edges, node
// particles, activity ripples, edge hover labels, rich tooltips,
// selected node highlight, enhanced visuals, breathing glow.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from "react";
import type { GraphNode, GraphEdge, GraphToken, RecentTx, SelectedEdgeInfo } from "@/types/world";
import { worldMapAPI } from "@/lib/api";

// ──── Physics ────
const REPULSION = 4000;
const ATTRACTION = 0.008;
const CENTER_GRAVITY = 0.003;
const DAMPING = 0.88;
const MIN_DIST = 60;
const DT_CAP = 0.05;

// ──── Visuals ────
const BG_COLOR = 0x08080f;
const STAR_LAYERS = [
  { count: 280, minSize: 0.4, maxSize: 1.0, minA: 0.08, maxA: 0.25, parallax: 0.015, twinkle: 0.3 },
  { count: 120, minSize: 0.8, maxSize: 1.8, minA: 0.15, maxA: 0.45, parallax: 0.04, twinkle: 0.5 },
  { count: 40, minSize: 1.2, maxSize: 2.8, minA: 0.25, maxA: 0.75, parallax: 0.08, twinkle: 0.8 },
];
const NEBULA_COUNT = 5;
const NODE_BASE_R = 14;
const POLL_MS = 5000;

// ──── Emotion → color ────
const EMO_COLORS: Record<string, number> = {
  confiant: 0x5c7cfa, prudent: 0xc8a96e, anxieux: 0xfd7e14,
  agressif: 0xe03131, mefiant: 0x7950f2, curieux: 0x4dabf7,
  ambitieux: 0xdbc28a, cooperatif: 0x3b5bdb, neutre: 0x8a8494,
  desespere: 0xe03131, excite: 0xfd7e14, strategique: 0x5c7cfa,
};
const DEFAULT_GLOW = 0x3b5bdb;

const EMO_EMOJI: Record<string, string> = {
  confiant: "\u{1F60E}", prudent: "\u{1F914}", anxieux: "\u{1F630}",
  agressif: "\u{1F621}", mefiant: "\u{1F928}", curieux: "\u{1F9D0}",
  ambitieux: "\u{1F929}", cooperatif: "\u{1F91D}", neutre: "\u{1F610}",
  desespere: "\u{1F622}", excite: "\u{1F525}", strategique: "\u{1F9E0}",
};

const EMO_LABEL: Record<string, string> = {
  confiant: "Confiant", prudent: "Prudent", anxieux: "Anxieux",
  agressif: "Agressif", mefiant: "Mefiant", curieux: "Curieux",
  ambitieux: "Ambitieux", cooperatif: "Cooperatif", neutre: "Neutre",
  desespere: "Desespere", excite: "Excite", strategique: "Strategique",
};

const ACTION_EMOJI: Record<string, string> = {
  transfer: "\u{1F4B0}", build: "\u{1F528}", claim_tile: "\u{1F6A9}",
  send_message: "\u{1F4AC}", raid: "\u2694\uFE0F", upgrade: "\u2B06\uFE0F",
  do_nothing: "\u{1F4A4}", create_token: "\u{1FA99}", create_nft: "\u{1F3A8}",
  move_world: "\u{1F30D}", idea_post: "\u{1F4A1}", escrow_create: "\u{1F4DD}",
  explore: "\u{1F50D}",
};

const ACTION_LABEL: Record<string, string> = {
  transfer: "Transfert", build: "Construction", claim_tile: "Revendication",
  send_message: "Message", raid: "Raid", upgrade: "Amelioration",
  do_nothing: "Repos", create_token: "Token cree", create_nft: "NFT cree",
  move_world: "Migration", idea_post: "Idee", escrow_create: "Contrat",
  explore: "Exploration",
};

const WORLD_RING_COLORS = [0x6fa85a, 0x8bb880, 0xc8a96e, 0xc87030, 0x8888aa, 0x6c5ce7, 0xc8a96e];
const WORLD_NAMES = ["Nursery", "Agora", "Bazar", "Forge", "Banque", "Noir", "Sommet"];
const TIER_LABELS = ["", "Newcomer", "Settler", "Veteran", "Elite"];

// ──── Types ────
interface SimNode {
  id: number; x: number; y: number; vx: number; vy: number;
  radius: number; targetRadius: number; mass: number;
  vault_aky: number; tier: number; world: number; alive: boolean;
  emotional_state: string | null; action_type: string | null;
  message: string | null;
  // blockchain
  sponsor: string | null; reputation: number;
  contracts_honored: number; contracts_broken: number;
  total_ticks: number; born_at: string | null;
  recent_txs: RecentTx[];
  // rendering
  birthTime: number; alpha: number; pulsePhase: number; glowColor: number;
  orbitParticles: { angle: number; dist: number; speed: number; size: number; color: number }[];
  ripples: { radius: number; alpha: number; color: number; speed: number }[];
  prevAction: string | null;
}

interface SimEdge {
  source: number; target: number; weight: number;
  msg_count: number; transfer_count: number;
  escrow_count: number; idea_count: number;
  first_interaction: string | null; last_interaction: string | null;
  alpha: number; targetAlpha: number;
  ctrlOffset: number;
}

/* Edge type colors */
const EDGE_TYPE_COLORS: Record<string, number> = {
  message:  0x42A5F5,  // Blue
  transfer: 0xFFD700,  // Gold
  escrow:   0x3b5bdb,  // Blue
  idea:     0xAB47BC,  // Purple
};

function edgeDominantColor(e: SimEdge): number {
  const types = [
    { type: "message",  score: e.msg_count },
    { type: "transfer", score: e.transfer_count * 2 },
    { type: "escrow",   score: e.escrow_count * 2 },
    { type: "idea",     score: e.idea_count },
  ];
  const best = types.reduce((a, b) => b.score > a.score ? b : a);
  return best.score > 0 ? EDGE_TYPE_COLORS[best.type] : 0x42A5F5;
}

function edgeHoverText(e: SimEdge): string {
  const parts: string[] = [];
  if (e.msg_count > 0) parts.push(`${e.msg_count} msg`);
  if (e.transfer_count > 0) parts.push(`${e.transfer_count} tx`);
  if (e.escrow_count > 0) parts.push(`${e.escrow_count} escrow`);
  if (e.idea_count > 0) parts.push(`${e.idea_count} idea`);
  let line = parts.join(" · ");
  if (e.first_interaction) {
    const first = new Date(e.first_interaction);
    const last = e.last_interaction ? new Date(e.last_interaction) : new Date();
    const days = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000));
    line += ` | ${days}j`;
  }
  return line;
}

interface Star {
  x: number; y: number; size: number; brightness: number;
  twinklePhase: number; twinkleSpeed: number; layer: number; color: number;
}

interface Nebula {
  x: number; y: number; rx: number; ry: number;
  color: number; alpha: number; driftVx: number; driftVy: number;
}

interface EParticle {
  edgeKey: string; progress: number; speed: number; color: number; size: number;
}

interface TBubble {
  creator_id: number; symbol: string | null;
  orbitPhase: number; orbitSpeed: number; radius: number; color: number;
}

// ──── Helpers ────
function calcRadius(v: number): number {
  return Math.max(NODE_BASE_R + Math.sqrt(Math.max(v, 1)) * 2.2, 10);
}
function calcMass(v: number): number { return 1 + Math.sqrt(Math.max(v, 1)) * 0.3; }
function emoColor(s: string | null): number { return s ? (EMO_COLORS[s] ?? DEFAULT_GLOW) : DEFAULT_GLOW; }
function agentHue(id: number): number {
  const h = (id * 137.508) % 360;
  const s = 0.65, l = 0.55, a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))); };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
function ca(color: number, alpha: number) { return { color, alpha: Math.max(0, Math.min(1, alpha)) }; }
function ekey(a: number, b: number): string { return a < b ? `${a}-${b}` : `${b}-${a}`; }
function initPos(id: number, w: number) {
  const wa = (w / 7) * Math.PI * 2 - Math.PI / 2;
  const aa = (id * 137.508) * Math.PI / 180;
  const ar = 40 + (id % 7) * 25;
  return { x: Math.cos(wa) * 250 + Math.cos(aa) * ar, y: Math.sin(wa) * 250 + Math.sin(aa) * ar };
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function fmtNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
}

// Generate ambient orbit particles for a node
function makeOrbitParticles(tier: number, world: number): SimNode["orbitParticles"] {
  const count = 2 + tier * 2; // 4-10 particles
  const wColor = WORLD_RING_COLORS[world % 7];
  const pts: SimNode["orbitParticles"] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      angle: Math.random() * Math.PI * 2,
      dist: 0.6 + Math.random() * 0.9, // multiplied by radius later
      speed: (0.3 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1),
      size: 0.8 + Math.random() * 1.2,
      color: i % 3 === 0 ? wColor : (i % 3 === 1 ? 0xFFFFFF : emoColor(null)),
    });
  }
  return pts;
}

// Get connected node IDs for a given node
function getConnected(nodeId: number, edges: SimEdge[]): Set<number> {
  const s = new Set<number>();
  for (const e of edges) {
    if (e.source === nodeId) s.add(e.target);
    if (e.target === nodeId) s.add(e.source);
  }
  return s;
}

// ──── Bezier helpers ────
function bezierPoint(sx: number, sy: number, cx: number, cy: number, ex: number, ey: number, t: number) {
  const it = 1 - t;
  return {
    x: it * it * sx + 2 * it * t * cx + t * t * ex,
    y: it * it * sy + 2 * it * t * cy + t * t * ey,
  };
}
function bezierCtrl(sx: number, sy: number, ex: number, ey: number, offset: number) {
  const mx = (sx + ex) / 2, my = (sy + ey) / 2;
  const dx = ex - sx, dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular offset
  return { x: mx + (-dy / len) * offset, y: my + (dx / len) * offset };
}

// ──── Force Simulation ────
function simulate(nodes: Map<number, SimNode>, edges: SimEdge[], dt: number) {
  const list = Array.from(nodes.values()).filter(n => n.alive);
  const n = list.length;
  if (!n) return;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = list[i], b = list[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) { d = 1; dx = Math.random() - 0.5; dy = Math.random() - 0.5; }
      const sep = a.radius + b.radius + MIN_DIST;
      const f = REPULSION * a.mass * b.mass / (d * d + sep);
      const fx = f * dx / d, fy = f * dy / d;
      a.vx -= fx / a.mass; a.vy -= fy / a.mass;
      b.vx += fx / b.mass; b.vy += fy / b.mass;
    }
  }

  for (const e of edges) {
    const a = nodes.get(e.source), b = nodes.get(e.target);
    if (!a || !b || !a.alive || !b.alive) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) continue;
    const ideal = (a.radius + b.radius) * 3;
    const str = ATTRACTION * Math.log1p(e.weight);
    const f = str * (d - ideal);
    a.vx += f * dx / d; a.vy += f * dy / d;
    b.vx -= f * dx / d; b.vy -= f * dy / d;
  }

  for (const nd of list) {
    nd.vx -= nd.x * CENTER_GRAVITY;
    nd.vy -= nd.y * CENTER_GRAVITY;
    nd.vx *= DAMPING; nd.vy *= DAMPING;
    const sp = Math.sqrt(nd.vx * nd.vx + nd.vy * nd.vy);
    if (sp > 200) { nd.vx = nd.vx / sp * 200; nd.vy = nd.vy / sp * 200; }
    nd.x += nd.vx * dt;
    nd.y += nd.vy * dt;
    nd.radius += (nd.targetRadius - nd.radius) * 0.08;
  }
}

// ──── Exports ────
export interface SelectedNodeInfo {
  agent_id: number; vault_aky: number; tier: number; world: number;
  alive: boolean; emotional_state: string | null; action_type: string | null;
  message: string | null;
  // blockchain details
  sponsor: string | null;
  reputation: number;
  contracts_honored: number;
  contracts_broken: number;
  total_ticks: number;
  born_at: string | null;
  recent_txs: RecentTx[];
}

interface WorldMapProps {
  onNodeSelect?: (node: SelectedNodeInfo | null) => void;
  onEdgeSelect?: (edge: SelectedEdgeInfo | null) => void;
  onZoomChange?: (zoom: number) => void;
  onStatsUpdate?: (stats: { totalAgents: number; aliveAgents: number; totalEdges: number; totalTokens: number }) => void;
}

export function WorldMap({ onNodeSelect, onEdgeSelect, onZoomChange, onStatsUpdate }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<unknown>(null);

  const nodesRef = useRef<Map<number, SimNode>>(new Map());
  const edgesRef = useRef<SimEdge[]>([]);
  const starsRef = useRef<Star[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const particlesRef = useRef<EParticle[]>([]);
  const bubblesRef = useRef<TBubble[]>([]);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const tgtZoomRef = useRef(1);
  const tgtPanRef = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const hovered = useRef<number | null>(null);
  const hoveredEdge = useRef<string | null>(null);
  const selectedEdgeKey = useRef<string | null>(null);
  const selected = useRef<number | null>(null);
  const lastClick = useRef(0);

  const animRef = useRef(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const mountedRef = useRef(true);
  const textCache = useRef<Map<string, unknown>>(new Map());
  // Track camera animation target
  const cameraTarget = useRef<{ x: number; y: number; zoom: number } | null>(null);

  const [loading, setLoading] = useState(true);

  // ──── Fetch ────
  const fetchGraph = useCallback(async () => {
    try {
      const data = await worldMapAPI.getGraph();
      const map = nodesRef.current;
      const now = timeRef.current;
      const seen = new Set<number>();

      for (const gn of data.nodes) {
        seen.add(gn.agent_id);
        const gc = emoColor(gn.emotional_state);
        const prev = map.get(gn.agent_id);
        if (prev) {
          // Detect action change → trigger ripple
          if (gn.action_type && gn.action_type !== prev.prevAction && prev.alive) {
            prev.ripples.push({
              radius: 0, alpha: 0.6,
              color: gc, speed: 60 + Math.random() * 30,
            });
          }
          prev.vault_aky = gn.vault_aky;
          prev.targetRadius = calcRadius(gn.vault_aky);
          prev.mass = calcMass(gn.vault_aky);
          prev.tier = gn.tier; prev.world = gn.world;
          prev.alive = gn.alive;
          prev.emotional_state = gn.emotional_state;
          prev.prevAction = prev.action_type;
          prev.action_type = gn.action_type;
          prev.message = gn.message;
          prev.sponsor = gn.sponsor;
          prev.reputation = gn.reputation;
          prev.contracts_honored = gn.contracts_honored;
          prev.contracts_broken = gn.contracts_broken;
          prev.total_ticks = gn.total_ticks;
          prev.born_at = gn.born_at;
          prev.recent_txs = gn.recent_txs || [];
          prev.glowColor = gc;
          // Refresh orbit particles if tier changed
          if (prev.orbitParticles.length !== 2 + prev.tier * 2) {
            prev.orbitParticles = makeOrbitParticles(prev.tier, prev.world);
          }
        } else {
          const p = initPos(gn.agent_id, gn.world);
          map.set(gn.agent_id, {
            id: gn.agent_id, x: p.x, y: p.y, vx: 0, vy: 0,
            radius: 4, targetRadius: calcRadius(gn.vault_aky),
            mass: calcMass(gn.vault_aky),
            vault_aky: gn.vault_aky, tier: gn.tier, world: gn.world,
            alive: gn.alive, emotional_state: gn.emotional_state,
            action_type: gn.action_type, message: gn.message,
            sponsor: gn.sponsor, reputation: gn.reputation,
            contracts_honored: gn.contracts_honored, contracts_broken: gn.contracts_broken,
            total_ticks: gn.total_ticks, born_at: gn.born_at,
            recent_txs: gn.recent_txs || [],
            birthTime: now, alpha: 0, pulsePhase: Math.random() * Math.PI * 2,
            glowColor: gc,
            orbitParticles: makeOrbitParticles(gn.tier, gn.world),
            ripples: [{ radius: 0, alpha: 0.8, color: gc, speed: 50 }], // birth ripple
            prevAction: null,
          });
        }
      }

      map.forEach((nd, id) => {
        if (!seen.has(id)) { nd.alive = false; }
      });

      const newEdges: SimEdge[] = data.edges.map(ge => {
        const prev = edgesRef.current.find(e => ekey(e.source, e.target) === ekey(ge.source, ge.target));
        return {
          source: ge.source, target: ge.target,
          weight: ge.weight, msg_count: ge.msg_count, transfer_count: ge.transfer_count,
          escrow_count: ge.escrow_count ?? 0, idea_count: ge.idea_count ?? 0,
          first_interaction: ge.first_interaction ?? null, last_interaction: ge.last_interaction ?? null,
          alpha: prev?.alpha ?? 0,
          targetAlpha: Math.min(0.8, 0.15 + Math.log1p(ge.weight) * 0.12),
          ctrlOffset: prev?.ctrlOffset ?? ((ge.source + ge.target) % 2 === 0 ? 1 : -1) * (20 + Math.random() * 25),
        };
      });
      edgesRef.current = newEdges;

      // Edge particles
      const pts = particlesRef.current;
      const activeKeys = new Set(newEdges.map(e => ekey(e.source, e.target)));
      particlesRef.current = pts.filter(p => activeKeys.has(p.edgeKey));
      for (const edge of newEdges) {
        const ek = ekey(edge.source, edge.target);
        const have = particlesRef.current.filter(p => p.edgeKey === ek).length;
        const want = Math.min(8, Math.ceil(Math.log1p(edge.weight) * 2));
        for (let i = have; i < want; i++) {
          particlesRef.current.push({
            edgeKey: ek, progress: Math.random(),
            speed: 0.06 + Math.random() * 0.14,
            color: edgeDominantColor(edge),
            size: 1.2 + Math.random() * 1.8,
          });
        }
      }

      bubblesRef.current = data.tokens.map((t, i) => ({
        creator_id: t.creator_agent_id, symbol: t.symbol,
        orbitPhase: (i * 137.508 * Math.PI) / 180,
        orbitSpeed: 0.3 + Math.random() * 0.2,
        radius: 6 + Math.log1p(t.trade_count) * 4,
        color: agentHue(t.creator_agent_id + 100),
      }));

      onStatsUpdate?.({
        totalAgents: data.nodes.length,
        aliveAgents: data.nodes.filter(n => n.alive).length,
        totalEdges: data.edges.length,
        totalTokens: data.tokens.length,
      });
      if (loading) setLoading(false);
    } catch {
      if (loading) setLoading(false);
    }
  }, [loading, onStatsUpdate]);

  // ──── Main Effect ────
  useEffect(() => {
    const ctr = containerRef.current;
    if (!ctr) return;
    mountedRef.current = true;
    let destroyed = false;

    import("pixi.js").then(async (PIXI) => {
      if (destroyed || !mountedRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = PIXI as any;

      const app = new PIXI.Application();
      await app.init({
        resizeTo: ctr,
        backgroundColor: BG_COLOR,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      appRef.current = app;
      ctr.appendChild(app.canvas as HTMLCanvasElement);

      // ──── Layers ────
      const bgGfx = new PIXI.Graphics();
      app.stage.addChild(bgGfx);

      const worldCtr = new PIXI.Container();
      app.stage.addChild(worldCtr);

      const nebGfx = new PIXI.Graphics();
      worldCtr.addChild(nebGfx);
      const edgeGfx = new PIXI.Graphics();
      worldCtr.addChild(edgeGfx);
      const particleGfx = new PIXI.Graphics();
      worldCtr.addChild(particleGfx);
      const tokGfx = new PIXI.Graphics();
      worldCtr.addChild(tokGfx);
      const nodeGfx = new PIXI.Graphics();
      worldCtr.addChild(nodeGfx);
      const orbitGfx = new PIXI.Graphics();
      worldCtr.addChild(orbitGfx);
      const rippleGfx = new PIXI.Graphics();
      worldCtr.addChild(rippleGfx);
      const labels = new PIXI.Container();
      worldCtr.addChild(labels);
      const tooltipGfx = new PIXI.Graphics();
      worldCtr.addChild(tooltipGfx);
      const tooltipLabels = new PIXI.Container();
      worldCtr.addChild(tooltipLabels);

      // ──── Stars ────
      const sw0 = app.screen.width, sh0 = app.screen.height;
      const fw = Math.max(sw0, 2400), fh = Math.max(sh0, 1600);
      const starCol = [0xFFFFFF, 0xCCDDFF, 0xFFEEDD, 0xAABBFF, 0xFFDDAA];
      const allStars: Star[] = [];
      for (let li = 0; li < STAR_LAYERS.length; li++) {
        const L = STAR_LAYERS[li];
        for (let i = 0; i < L.count; i++) {
          allStars.push({
            x: Math.random() * fw, y: Math.random() * fh,
            size: L.minSize + Math.random() * (L.maxSize - L.minSize),
            brightness: L.minA + Math.random() * (L.maxA - L.minA),
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: L.twinkle * (0.7 + Math.random() * 0.6),
            layer: li, color: starCol[Math.floor(Math.random() * starCol.length)],
          });
        }
      }
      starsRef.current = allStars;

      // ──── Nebulae ────
      const nebCol = [0xd8d0c0, 0xd0d8d0, 0xe0d0c8, 0xd0e0e0, 0xd8dcd0];
      const nebs: Nebula[] = [];
      for (let i = 0; i < NEBULA_COUNT; i++) {
        nebs.push({
          x: (Math.random() - 0.5) * 900, y: (Math.random() - 0.5) * 700,
          rx: 180 + Math.random() * 280, ry: 120 + Math.random() * 220,
          color: nebCol[i % nebCol.length], alpha: 0.012 + Math.random() * 0.022,
          driftVx: (Math.random() - 0.5) * 0.25, driftVy: (Math.random() - 0.5) * 0.18,
        });
      }
      nebulaeRef.current = nebs;

      // Initial fetch
      fetchGraph();
      const poll = setInterval(fetchGraph, POLL_MS);

      // ──── Screen→World transform ────
      function screenToWorld(sx: number, sy: number) {
        const z = zoomRef.current, p = panRef.current;
        const rect = ctr!.getBoundingClientRect();
        return {
          x: (sx - rect.left - app.screen.width / 2 - p.x) / z,
          y: (sy - rect.top - app.screen.height / 2 - p.y) / z,
        };
      }

      // ──── Find closest edge to a world point ────
      function findEdgeAt(wx: number, wy: number, threshold: number): SimEdge | null {
        let best: SimEdge | null = null;
        let bestDist = threshold;
        for (const e of edgesRef.current) {
          const sN = nodesRef.current.get(e.source), tN = nodesRef.current.get(e.target);
          if (!sN || !tN) continue;
          // Simple point-to-segment distance
          const dx = tN.x - sN.x, dy = tN.y - sN.y;
          const len2 = dx * dx + dy * dy;
          if (len2 < 1) continue;
          let t = ((wx - sN.x) * dx + (wy - sN.y) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const px = sN.x + t * dx, py = sN.y + t * dy;
          const d = Math.sqrt((wx - px) * (wx - px) + (wy - py) * (wy - py));
          if (d < bestDist) { bestDist = d; best = e; }
        }
        return best;
      }

      // ──── Camera ────
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        cameraTarget.current = null; // cancel any zoom-to animation

        // Normalize deltaY: trackpads send small continuous values, mice send ±100+
        const raw = e.deltaY;
        const isTrackpad = Math.abs(raw) < 50 && !Number.isInteger(raw);
        const delta = isTrackpad ? raw * -0.008 : (raw > 0 ? -0.08 : 0.08);
        const newZoom = tgtZoomRef.current * (1 + delta);
        const clampedZoom = Math.max(0.3, Math.min(6, newZoom));

        // Zoom toward cursor position
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const cx = e.clientX - rect.left - rect.width / 2;
          const cy = e.clientY - rect.top - rect.height / 2;
          const scale = clampedZoom / tgtZoomRef.current;
          tgtPanRef.current.x = cx - scale * (cx - tgtPanRef.current.x);
          tgtPanRef.current.y = cy - scale * (cy - tgtPanRef.current.y);
        }

        tgtZoomRef.current = clampedZoom;
        onZoomChange?.(tgtZoomRef.current);
      };
      const onDown = (e: PointerEvent) => {
        dragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...tgtPanRef.current };
        cameraTarget.current = null;
        ctr.style.cursor = "grabbing";
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging.current) {
          const w = screenToWorld(e.clientX, e.clientY);
          // Check node hover
          let foundNode: number | null = null;
          nodesRef.current.forEach(nd => {
            const dx = nd.x - w.x, dy = nd.y - w.y;
            if (dx * dx + dy * dy < nd.radius * nd.radius * 2.2) foundNode = nd.id;
          });
          hovered.current = foundNode;

          // Check edge hover (only if no node hovered)
          if (foundNode === null) {
            const edge = findEdgeAt(w.x, w.y, 15 / zoomRef.current);
            hoveredEdge.current = edge ? ekey(edge.source, edge.target) : null;
          } else {
            hoveredEdge.current = null;
          }

          ctr.style.cursor = foundNode !== null ? "pointer" : (hoveredEdge.current ? "pointer" : "grab");
          return;
        }
        tgtPanRef.current = {
          x: panStart.current.x + e.clientX - dragStart.current.x,
          y: panStart.current.y + e.clientY - dragStart.current.y,
        };
      };
      const onUp = () => { dragging.current = false; ctr.style.cursor = "grab"; };

      const onClick = (e: MouseEvent) => {
        const now = Date.now();
        const isDoubleClick = now - lastClick.current < 350;
        lastClick.current = now;

        if (hovered.current !== null) {
          const nd = nodesRef.current.get(hovered.current);
          if (nd) {
            selected.current = nd.id;
            selectedEdgeKey.current = null;
            onEdgeSelect?.(null); // clear edge selection
            onNodeSelect?.({
              agent_id: nd.id, vault_aky: nd.vault_aky, tier: nd.tier, world: nd.world,
              alive: nd.alive, emotional_state: nd.emotional_state,
              action_type: nd.action_type, message: nd.message,
              sponsor: nd.sponsor, reputation: nd.reputation,
              contracts_honored: nd.contracts_honored, contracts_broken: nd.contracts_broken,
              total_ticks: nd.total_ticks, born_at: nd.born_at,
              recent_txs: nd.recent_txs,
            });

            // Double-click: zoom-to-node
            if (isDoubleClick) {
              cameraTarget.current = {
                x: -nd.x * 2.5,
                y: -nd.y * 2.5,
                zoom: 2.5,
              };
            }
          }
        } else if (hoveredEdge.current !== null) {
          // Edge clicked — find the edge data and emit
          const edge = edgesRef.current.find(
            e => ekey(e.source, e.target) === hoveredEdge.current
          );
          if (edge) {
            selected.current = null;
            selectedEdgeKey.current = hoveredEdge.current;
            onNodeSelect?.(null);
            onEdgeSelect?.({
              source: edge.source,
              target: edge.target,
              weight: edge.weight,
              msg_count: edge.msg_count,
              transfer_count: edge.transfer_count,
              escrow_count: edge.escrow_count,
              idea_count: edge.idea_count,
            });
          }
        } else {
          selected.current = null;
          selectedEdgeKey.current = null;
          onNodeSelect?.(null);
          onEdgeSelect?.(null);
        }
      };

      const onZoomEvt = (e: Event) => {
        const d = (e as CustomEvent).detail;
        cameraTarget.current = null;
        if (d.action === "in") tgtZoomRef.current = Math.min(6, tgtZoomRef.current * 1.3);
        if (d.action === "out") tgtZoomRef.current = Math.max(0.3, tgtZoomRef.current * 0.7);
        if (d.action === "reset") { tgtZoomRef.current = 1; tgtPanRef.current = { x: 0, y: 0 }; }
        onZoomChange?.(tgtZoomRef.current);
      };

      ctr.addEventListener("wheel", onWheel, { passive: false });
      ctr.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      ctr.addEventListener("click", onClick);
      window.addEventListener("akyra-zoom", onZoomEvt);
      ctr.style.cursor = "grab";

      // ──── Text helper ────
      function getOrCreateText(key: string, text: string, style: Record<string, unknown>, parent: typeof labels): InstanceType<typeof PIXI.Text> {
        let txt = textCache.current.get(key) as InstanceType<typeof PIXI.Text> | undefined;
        if (!txt) {
          txt = new P.Text({ text, style });
          txt!.anchor.set(0.5, 0.5);
          parent.addChild(txt!);
          textCache.current.set(key, txt);
        }
        return txt!;
      }

      // ──── Render Loop ────
      const render = (now: number) => {
        if (destroyed) return;
        if (!lastFrameRef.current) lastFrameRef.current = now;
        const dt = Math.min((now - lastFrameRef.current) / 1000, DT_CAP);
        lastFrameRef.current = now;
        timeRef.current += dt;
        const t = timeRef.current;
        const sw = app.screen.width, sh = app.screen.height;

        // ──── Camera with smooth zoom-to-target ────
        if (cameraTarget.current) {
          tgtZoomRef.current = lerp(tgtZoomRef.current, cameraTarget.current.zoom, 0.04);
          tgtPanRef.current.x = lerp(tgtPanRef.current.x, cameraTarget.current.x, 0.04);
          tgtPanRef.current.y = lerp(tgtPanRef.current.y, cameraTarget.current.y, 0.04);
          onZoomChange?.(tgtZoomRef.current);
          // Stop when close enough
          if (Math.abs(tgtZoomRef.current - cameraTarget.current.zoom) < 0.01) {
            cameraTarget.current = null;
          }
        }

        zoomRef.current += (tgtZoomRef.current - zoomRef.current) * 0.18;
        panRef.current.x += (tgtPanRef.current.x - panRef.current.x) * 0.18;
        panRef.current.y += (tgtPanRef.current.y - panRef.current.y) * 0.18;
        const zm = zoomRef.current, pn = panRef.current;
        worldCtr.position.set(sw / 2 + pn.x, sh / 2 + pn.y);
        worldCtr.scale.set(zm);

        // ──── Node animation ────
        nodesRef.current.forEach(nd => {
          if (nd.alive && nd.alpha < 1) nd.alpha = Math.min(1, nd.alpha + dt * 1.5);
          if (!nd.alive && nd.alpha > 0) nd.alpha = Math.max(0, nd.alpha - dt * 0.3);
          nd.pulsePhase += dt * 1.2;

          // Update orbit particles
          for (const op of nd.orbitParticles) {
            op.angle += op.speed * dt;
          }

          // Update ripples
          for (const rp of nd.ripples) {
            rp.radius += rp.speed * dt;
            rp.alpha -= dt * 0.5;
          }
          nd.ripples = nd.ripples.filter(rp => rp.alpha > 0.01);
        });

        // Physics
        simulate(nodesRef.current, edgesRef.current, dt);

        // Edge alpha
        for (const e of edgesRef.current) e.alpha += (e.targetAlpha - e.alpha) * 0.05;

        // Particles
        for (const p of particlesRef.current) { p.progress += p.speed * dt; if (p.progress > 1) p.progress -= 1; }

        // Nebula drift
        for (const nb of nebulaeRef.current) { nb.x += nb.driftVx * dt; nb.y += nb.driftVy * dt; }

        // ──── Hover dimming calculations ────
        const hovId = hovered.current;
        const selId = selected.current;
        const focusId = hovId ?? selId;
        const connected = focusId !== null ? getConnected(focusId, edgesRef.current) : null;
        const isNodeFocused = (id: number) => {
          if (focusId === null) return true; // no focus → all visible
          if (id === focusId) return true;
          return connected!.has(id);
        };
        const isEdgeFocused = (e: SimEdge) => {
          if (focusId === null) return true;
          return e.source === focusId || e.target === focusId;
        };

        // ═══ 1. BACKGROUND ═══
        bgGfx.clear();
        bgGfx.rect(0, 0, sw, sh).fill({ color: BG_COLOR });
        for (const s of starsRef.current) {
          const px = STAR_LAYERS[s.layer].parallax;
          const sx = ((s.x - pn.x * px) % sw + sw) % sw;
          const sy = ((s.y - pn.y * px) % sh + sh) % sh;
          const tw = Math.sin(t * s.twinkleSpeed + s.twinklePhase);
          bgGfx.circle(sx, sy, s.size).fill(ca(s.color, s.brightness * (0.6 + 0.4 * tw)));
        }

        // ═══ 2. NEBULAE ═══
        nebGfx.clear();
        for (const nb of nebulaeRef.current) {
          for (let r = 0; r < 5; r++) {
            const sc = 1 - r * 0.18;
            nebGfx.ellipse(nb.x, nb.y, nb.rx * sc, nb.ry * sc)
              .fill(ca(nb.color, nb.alpha * (1 + r * 0.3)));
          }
        }

        // ═══ 3. RIPPLES ═══
        rippleGfx.clear();
        nodesRef.current.forEach(nd => {
          for (const rp of nd.ripples) {
            rippleGfx.circle(nd.x, nd.y, rp.radius)
              .stroke({ color: rp.color, alpha: rp.alpha * nd.alpha * 0.5, width: 1.5 });
          }
        });

        // ═══ 4. EDGES (bezier curves) ═══
        edgeGfx.clear();
        for (const e of edgesRef.current) {
          const sN = nodesRef.current.get(e.source), tN = nodesRef.current.get(e.target);
          if (!sN || !tN) continue;
          const nodeA = Math.min(sN.alpha, tN.alpha);
          const focused = isEdgeFocused(e);
          const dimFactor = focused ? 1 : 0.08;
          const a = e.alpha * nodeA * dimFactor;
          if (a < 0.005) continue;

          const color = edgeDominantColor(e);
          const w = 2 + Math.log1p(e.weight) * 2;

          // Highlight hovered or selected edge
          const ek = ekey(e.source, e.target);
          const isHovEdge = hoveredEdge.current === ek || selectedEdgeKey.current === ek;
          const hovBoost = isHovEdge ? 1.8 : 1;

          // Bezier control point
          const ctrl = bezierCtrl(sN.x, sN.y, tN.x, tN.y, e.ctrlOffset);

          // Draw bezier glow layers
          const steps = 20;
          for (let layer = 0; layer < 3; layer++) {
            const layerAlpha = layer === 0 ? a * 0.06 * hovBoost : layer === 1 ? a * 0.18 * hovBoost : a * 0.55 * hovBoost;
            const layerWidth = layer === 0 ? w * 3.5 : layer === 1 ? w * 1.8 : Math.max(0.5, w * 0.45);
            edgeGfx.moveTo(sN.x, sN.y);
            for (let i = 1; i <= steps; i++) {
              const pt = bezierPoint(sN.x, sN.y, ctrl.x, ctrl.y, tN.x, tN.y, i / steps);
              edgeGfx.lineTo(pt.x, pt.y);
            }
            edgeGfx.stroke({ color, alpha: layerAlpha, width: layerWidth });
          }

          // Edge hover label
          if (isHovEdge && zm > 0.4) {
            const mid = bezierPoint(sN.x, sN.y, ctrl.x, ctrl.y, tN.x, tN.y, 0.5);
            const lk = `edge-${ekey(e.source, e.target)}`;
            const hoverStr = edgeHoverText(e);
            const txt = getOrCreateText(lk,
              hoverStr,
              { fontFamily: "monospace", fontSize: 9, fill: 0xFFFFFF, fontWeight: "bold" },
              labels
            );
            txt.text = hoverStr;
            txt.position.set(mid.x, mid.y - 12);
            txt.alpha = 0.85;
            txt.visible = true;

            // Background for edge label
            const b = txt.getBounds();
            const pad = 5;
            edgeGfx.roundRect(
              mid.x - (b.width / zm + pad * 2) / 2,
              mid.y - 12 - (b.height / zm + pad) / 2,
              b.width / zm + pad * 2,
              b.height / zm + pad,
              4
            ).fill(ca(0x08080f, 0.92));
            edgeGfx.roundRect(
              mid.x - (b.width / zm + pad * 2) / 2,
              mid.y - 12 - (b.height / zm + pad) / 2,
              b.width / zm + pad * 2,
              b.height / zm + pad,
              4
            ).stroke({ color, alpha: 0.4, width: 0.6 });
          }
        }

        // ═══ 5. EDGE PARTICLES (follow bezier) ═══
        particleGfx.clear();
        for (const p of particlesRef.current) {
          const [aStr, bStr] = p.edgeKey.split("-");
          const sN = nodesRef.current.get(parseInt(aStr)), tN = nodesRef.current.get(parseInt(bStr));
          if (!sN || !tN) continue;
          const edge = edgesRef.current.find(e => ekey(e.source, e.target) === p.edgeKey);
          const ctrl = edge
            ? bezierCtrl(sN.x, sN.y, tN.x, tN.y, edge.ctrlOffset)
            : { x: (sN.x + tN.x) / 2, y: (sN.y + tN.y) / 2 };
          const pt = bezierPoint(sN.x, sN.y, ctrl.x, ctrl.y, tN.x, tN.y, p.progress);
          const pa = Math.sin(p.progress * Math.PI) * 0.7 * Math.min(sN.alpha, tN.alpha);
          const ps = p.size * (0.8 + Math.sin(t * 3 + p.progress * 10) * 0.2);

          // Particle glow
          particleGfx.circle(pt.x, pt.y, ps * 2.5).fill(ca(p.color, pa * 0.1));
          particleGfx.circle(pt.x, pt.y, ps).fill(ca(p.color, pa));
          particleGfx.circle(pt.x, pt.y, ps * 0.4).fill(ca(0xFFFFFF, pa * 0.6));
        }

        // ═══ 6. TOKENS ═══
        tokGfx.clear();
        for (const tk of bubblesRef.current) {
          const cr = nodesRef.current.get(tk.creator_id);
          if (!cr || cr.alpha < 0.1) continue;
          const dimF = isNodeFocused(cr.id) ? 1 : 0.15;
          const orb = cr.radius * 2.2;
          const ang = t * tk.orbitSpeed + tk.orbitPhase;
          const bx = cr.x + Math.cos(ang) * orb;
          const by = cr.y + Math.sin(ang) * orb;

          // Orbit trail (faint)
          tokGfx.circle(cr.x, cr.y, orb).stroke({ color: tk.color, alpha: 0.03 * cr.alpha * dimF, width: 0.5 });

          // Connection line
          tokGfx.moveTo(cr.x, cr.y).lineTo(bx, by).stroke({ color: 0xFFFFFF, alpha: 0.05 * cr.alpha * dimF, width: 0.5 });

          // Token bubble layers
          tokGfx.circle(bx, by, tk.radius * 1.8).fill(ca(tk.color, 0.02 * cr.alpha * dimF));
          tokGfx.circle(bx, by, tk.radius).fill(ca(tk.color, 0.15 * cr.alpha * dimF));
          const pulseR = 1 + Math.sin(t * 2 + tk.orbitPhase) * 0.15;
          tokGfx.circle(bx, by, tk.radius * pulseR).stroke({ color: tk.color, alpha: 0.4 * cr.alpha * dimF, width: 0.8 });
          // Core shine
          tokGfx.circle(bx, by, tk.radius * 0.35).fill(ca(0xFFFFFF, 0.3 * cr.alpha * dimF));

          if (zm > 0.6 && tk.symbol) {
            const k = `tok-${tk.symbol}`;
            const txt = getOrCreateText(k, `$${tk.symbol}`,
              { fontFamily: "monospace", fontSize: 9, fill: 0xFFFFFF, fontWeight: "bold" }, labels);
            txt.text = `$${tk.symbol}`;
            txt.position.set(bx, by + tk.radius + 8);
            txt.alpha = 0.55 * cr.alpha * dimF;
            txt.visible = true;
          }
        }

        // ═══ 7. ORBIT PARTICLES ═══
        orbitGfx.clear();
        nodesRef.current.forEach(nd => {
          if (nd.alpha < 0.05 || !nd.alive) return;
          const dimF = isNodeFocused(nd.id) ? 1 : 0.1;
          for (const op of nd.orbitParticles) {
            const d = nd.radius * op.dist;
            const ox = nd.x + Math.cos(op.angle) * d;
            const oy = nd.y + Math.sin(op.angle) * d;
            const flicker = 0.5 + Math.sin(t * 3 + op.angle * 5) * 0.5;
            orbitGfx.circle(ox, oy, op.size * flicker).fill(ca(op.color, 0.25 * nd.alpha * dimF * flicker));
          }
        });

        // ═══ 8. NODES ═══
        nodeGfx.clear();
        nodesRef.current.forEach(nd => {
          if (nd.alpha < 0.01) return;
          const r = nd.radius, a = nd.alpha;
          const pulse = Math.sin(nd.pulsePhase) * 0.08 + 1;
          const glowR = r * 2.8 * pulse;
          const isH = hovered.current === nd.id;
          const isSel = selected.current === nd.id;
          const dimF = isNodeFocused(nd.id) ? 1 : 0.12;
          const effA = a * dimF;

          // ─── Outer aura ───
          for (let i = 0; i < 7; i++) {
            const tt = i / 7;
            const auraR = glowR * (1 - tt * 0.55);
            nodeGfx.circle(nd.x, nd.y, auraR)
              .fill(ca(nd.glowColor, 0.01 * (1 + tt * 2.5) * effA));
          }

          // ─── Hover ring ───
          if (isH) {
            nodeGfx.circle(nd.x, nd.y, r * 2.2).fill(ca(0xFFFFFF, 0.035));
            nodeGfx.circle(nd.x, nd.y, r * 1.6)
              .stroke({ color: 0xFFFFFF, alpha: 0.25 * effA, width: 1.2 });
            // Scanning ring animation
            const scanAngle = t * 2;
            const scanR = r * 1.8;
            for (let i = 0; i < 3; i++) {
              const sa = scanAngle + (i * Math.PI * 2 / 3);
              const sx = nd.x + Math.cos(sa) * scanR;
              const sy = nd.y + Math.sin(sa) * scanR;
              nodeGfx.circle(sx, sy, 2).fill(ca(0xFFFFFF, 0.4 * effA));
            }
          }

          // ─── Selected persistent ring ───
          if (isSel && !isH) {
            const selPulse = Math.sin(t * 3) * 0.1 + 1;
            nodeGfx.circle(nd.x, nd.y, r * 1.7 * selPulse)
              .stroke({ color: nd.glowColor, alpha: 0.35 * effA, width: 1.5 });
          }

          if (nd.alive) {
            // ─── Tier rings ───
            for (let ti = 0; ti < nd.tier; ti++) {
              const rr = r + 4 + ti * 5;
              const tierColor = nd.tier >= 4 ? 0xFFD700 : nd.tier >= 3 ? 0xCCDDEE : 0x88AACC;
              const rotation = t * (0.2 + ti * 0.1) * (ti % 2 === 0 ? 1 : -1);
              // Dashed ring effect
              for (let seg = 0; seg < 8; seg++) {
                const startA = rotation + (seg / 8) * Math.PI * 2;
                const endA = startA + Math.PI / 6;
                nodeGfx.moveTo(nd.x + Math.cos(startA) * rr, nd.y + Math.sin(startA) * rr);
                for (let si = 1; si <= 6; si++) {
                  const angle = startA + (endA - startA) * (si / 6);
                  nodeGfx.lineTo(nd.x + Math.cos(angle) * rr, nd.y + Math.sin(angle) * rr);
                }
                nodeGfx.stroke({ color: tierColor, alpha: (0.3 - ti * 0.05) * effA, width: 0.7 });
              }
            }

            // ─── Core body (layered gradient) ───
            const cc = agentHue(nd.id);
            nodeGfx.circle(nd.x, nd.y, r).fill(ca(cc, 0.15 * effA));
            nodeGfx.circle(nd.x, nd.y, r * 0.82).fill(ca(cc, 0.3 * effA));
            nodeGfx.circle(nd.x, nd.y, r * 0.6).fill(ca(cc, 0.45 * effA));
            nodeGfx.circle(nd.x, nd.y, r * 0.4).fill(ca(0xFFFFFF, 0.3 * effA));
            nodeGfx.circle(nd.x, nd.y, r * 0.2).fill(ca(0xFFFFFF, 0.55 * effA));
            nodeGfx.circle(nd.x, nd.y, r * 0.08).fill(ca(0xFFFFFF, 0.9 * effA));

            // ─── Outer ring (world color) ───
            const wc = WORLD_RING_COLORS[nd.world % 7];
            nodeGfx.circle(nd.x, nd.y, r + 1)
              .stroke({ color: wc, alpha: 0.25 * effA, width: 1.2 });

            // ─── World dot ───
            nodeGfx.circle(nd.x + r * 0.72, nd.y - r * 0.72, 3.5)
              .fill(ca(wc, 0.8 * effA));
            nodeGfx.circle(nd.x + r * 0.72, nd.y - r * 0.72, 2)
              .fill(ca(0xFFFFFF, 0.4 * effA));

            // ─── Tier crown for T4 ───
            if (nd.tier >= 4) {
              const crownY = nd.y - r - 8;
              const crownPts = [
                [-5, 0], [-3, -6], [0, -2], [3, -6], [5, 0]
              ];
              for (let ci = 0; ci < crownPts.length - 1; ci++) {
                nodeGfx.moveTo(nd.x + crownPts[ci][0], crownY + crownPts[ci][1])
                  .lineTo(nd.x + crownPts[ci + 1][0], crownY + crownPts[ci + 1][1])
                  .stroke({ color: 0xFFD700, alpha: 0.7 * effA, width: 1.2 });
              }
              nodeGfx.circle(nd.x, crownY - 5, 1.5).fill(ca(0xFFD700, 0.8 * effA));
            }

          } else {
            // ─── Dead agent (asteroid) ───
            nodeGfx.circle(nd.x, nd.y, r * 0.55).fill(ca(0xb0a898, 0.4 * effA));
            nodeGfx.circle(nd.x, nd.y, r * 0.55).stroke({ color: 0x8a7f72, alpha: 0.3 * effA, width: 0.8 });
            // Cracks
            for (let c = 0; c < 6; c++) {
              const ang = (c / 6) * Math.PI * 2 + nd.id * 0.7;
              const len = r * 0.45 * (0.4 + ((nd.id * 17 + c * 31) % 100) / 100 * 0.6);
              nodeGfx.moveTo(nd.x, nd.y)
                .lineTo(nd.x + Math.cos(ang) * len, nd.y + Math.sin(ang) * len)
                .stroke({ color: 0x8a7f72, alpha: 0.3 * effA, width: 0.6 });
            }
            // Debris particles
            for (let d = 0; d < 3; d++) {
              const da = t * 0.3 + d * 2.1 + nd.id;
              const dd = r * 0.7 + Math.sin(t * 0.5 + d) * r * 0.2;
              nodeGfx.circle(nd.x + Math.cos(da) * dd, nd.y + Math.sin(da) * dd, 1.5)
                .fill(ca(0x8a7f72, 0.2 * effA));
            }
            // Death marker
            const xSize = r * 0.25;
            nodeGfx.moveTo(nd.x - xSize, nd.y - xSize).lineTo(nd.x + xSize, nd.y + xSize)
              .stroke({ color: 0xFF4444, alpha: 0.4 * effA, width: 1 });
            nodeGfx.moveTo(nd.x + xSize, nd.y - xSize).lineTo(nd.x - xSize, nd.y + xSize)
              .stroke({ color: 0xFF4444, alpha: 0.4 * effA, width: 1 });
          }
        });

        // ═══ 9. LABELS ═══
        textCache.current.forEach(t => { (t as InstanceType<typeof PIXI.Text>).visible = false; });

        if (zm > 0.35) {
          nodesRef.current.forEach(nd => {
            if (nd.alpha < 0.1) return;
            const dimF = isNodeFocused(nd.id) ? 1 : 0.1;
            const isH = hovered.current === nd.id;

            // Agent ID + tier stars
            const k = `a-${nd.id}`;
            const tierStars = nd.alive ? "\u2B50".repeat(Math.min(nd.tier, 4)) : "\u2620\uFE0F";
            const txt = getOrCreateText(k, `#${nd.id}`,
              { fontFamily: "monospace", fontSize: 10, fill: 0xCCDDEE, fontWeight: "bold" }, labels);
            txt.text = `#${nd.id} ${tierStars}`;
            txt.position.set(nd.x, nd.y + nd.radius + 8);
            txt.anchor.set(0.5, 0);
            txt.alpha = 0.6 * nd.alpha * dimF;
            txt.visible = true;

            // Vault
            if (zm > 0.7 && nd.alive) {
              const vk = `v-${nd.id}`;
              const vt = getOrCreateText(vk, "", { fontFamily: "monospace", fontSize: 8, fill: 0xFFD700 }, labels);
              vt.text = `${fmtNum(nd.vault_aky)} AKY`;
              vt.position.set(nd.x, nd.y + nd.radius + 20);
              vt.anchor.set(0.5, 0);
              vt.alpha = 0.45 * nd.alpha * dimF;
              vt.visible = true;
            }

            // Action emoji
            if (zm > 0.5 && nd.action_type && nd.alive) {
              const ak = `ac-${nd.id}`;
              const at = getOrCreateText(ak, "", { fontSize: 14 }, labels);
              at.text = ACTION_EMOJI[nd.action_type] || "";
              at.position.set(nd.x, nd.y - nd.radius - 6);
              at.anchor.set(0.5, 1);
              at.alpha = 0.75 * nd.alpha * dimF;
              at.visible = !!at.text;
            }

            // Emotion emoji
            if (zm > 0.6 && nd.emotional_state && nd.alive) {
              const emoji = EMO_EMOJI[nd.emotional_state];
              if (emoji) {
                const ek = `em-${nd.id}`;
                const et = getOrCreateText(ek, "", { fontSize: 12 }, labels);
                et.text = emoji;
                et.position.set(nd.x + nd.radius + 6, nd.y);
                et.anchor.set(0, 0.5);
                et.alpha = 0.65 * nd.alpha * dimF;
                et.visible = true;
              }
            }
          });
        }

        // ═══ 10. RICH TOOLTIP (on hover) ═══
        tooltipGfx.clear();
        tooltipLabels.children.forEach((c: { visible: boolean }) => { c.visible = false; });

        if (hovId !== null && zm > 0.3) {
          const nd = nodesRef.current.get(hovId);
          if (nd && nd.alpha > 0.2) {
            const tooltipX = nd.x + nd.radius + 15;
            const tooltipY = nd.y - 45;
            const tw = 165 / zm; // Scale tooltip with zoom
            const lineH = 14 / zm;
            const padX = 8 / zm, padY = 6 / zm;

            // Build tooltip lines
            const lines: { text: string; color: number; bold?: boolean }[] = [];
            lines.push({ text: `Agent #${nd.id}`, color: 0xFFFFFF, bold: true });
            if (nd.alive) {
              lines.push({ text: `${TIER_LABELS[nd.tier] || ""} (T${nd.tier})`, color: nd.tier >= 4 ? 0xFFD700 : 0xCCDDEE });
              lines.push({ text: `${fmtNum(nd.vault_aky)} AKY`, color: 0xFFD700 });
              lines.push({ text: `${WORLD_NAMES[nd.world] || "?"}`, color: WORLD_RING_COLORS[nd.world % 7] });
              if (nd.emotional_state) {
                lines.push({
                  text: `${EMO_EMOJI[nd.emotional_state] || ""} ${EMO_LABEL[nd.emotional_state] || nd.emotional_state}`,
                  color: emoColor(nd.emotional_state),
                });
              }
              if (nd.action_type) {
                lines.push({
                  text: `${ACTION_EMOJI[nd.action_type] || ""} ${ACTION_LABEL[nd.action_type] || nd.action_type}`,
                  color: 0xAABBCC,
                });
              }
              if (nd.message) {
                const msg = nd.message.length > 30 ? nd.message.slice(0, 28) + "..." : nd.message;
                lines.push({ text: `"${msg}"`, color: 0x8899AA });
              }
            } else {
              lines.push({ text: "\u2620\uFE0F MORT", color: 0xFF4444, bold: true });
            }

            const th = lines.length * lineH + padY * 2;

            // Background
            tooltipGfx.roundRect(tooltipX - padX, tooltipY - padY, tw + padX * 2, th + padY, 6 / zm)
              .fill(ca(0x08080f, 0.94));
            tooltipGfx.roundRect(tooltipX - padX, tooltipY - padY, tw + padX * 2, th + padY, 6 / zm)
              .stroke({ color: nd.glowColor, alpha: 0.4, width: 1 / zm });

            // Left accent bar
            tooltipGfx.roundRect(tooltipX - padX, tooltipY - padY, 2 / zm, th + padY, 1 / zm)
              .fill(ca(nd.glowColor, 0.6));

            // Lines
            for (let i = 0; i < lines.length; i++) {
              const ln = lines[i];
              const lk = `tt-${hovId}-${i}`;
              const fontSize = (ln.bold ? 10 : 9) / zm;
              let lt = tooltipLabels.children.find(
                (c: { name: string }) => c.name === lk
              ) as InstanceType<typeof PIXI.Text> | undefined;
              if (!lt) {
                lt = new P.Text({
                  text: ln.text,
                  style: {
                    fontFamily: "monospace",
                    fontSize: Math.max(fontSize, 7),
                    fill: ln.color,
                    fontWeight: ln.bold ? "bold" : "normal",
                  },
                });
                lt!.name = lk;
                lt!.anchor.set(0, 0.5);
                tooltipLabels.addChild(lt!);
              }
              lt!.text = ln.text;
              lt!.style.fontSize = Math.max(fontSize, 7);
              lt!.style.fill = ln.color;
              lt!.position.set(tooltipX + 2 / zm, tooltipY + i * lineH + lineH / 2);
              lt!.alpha = 0.9;
              lt!.visible = true;
            }
          }
        }

        animRef.current = requestAnimationFrame(render);
      };
      animRef.current = requestAnimationFrame(render);

      // Cleanup
      return () => {
        destroyed = true;
        mountedRef.current = false;
        clearInterval(poll);
        cancelAnimationFrame(animRef.current);
        ctr.removeEventListener("wheel", onWheel);
        ctr.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        ctr.removeEventListener("click", onClick);
        window.removeEventListener("akyra-zoom", onZoomEvt);
        textCache.current.forEach(t => (t as InstanceType<typeof PIXI.Text>).destroy());
        textCache.current.clear();
        app.destroy(true);
      };
    });

    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full absolute inset-0" style={{ touchAction: "none" }}>
      <div ref={containerRef} className="w-full h-full absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-akyra-bg z-10">
          <div className="text-center">
            <div className="font-heading text-sm text-akyra-green mb-3 animate-pulse tracking-wider">
              CONNEXION AU RESEAU
            </div>
            <div className="w-56 h-1.5 bg-akyra-surface rounded-full overflow-hidden mx-auto">
              <div className="h-full rounded-full animate-shimmer"
                style={{ width: "70%", background: "linear-gradient(90deg, #1a3080, #2a50c8, #1a3080)", backgroundSize: "200% 100%" }} />
            </div>
            <div className="text-[10px] text-akyra-textDisabled mt-2 font-mono">
              Cartographie de la blockchain...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
