"use client";

import { Card } from "@/components/ui/Card";
import { ZONE_COLORS, STRUCTURE_ICONS } from "@/types/world";
import { WORLD_EMOJIS } from "@/types";
import { agentName } from "@/lib/utils";
import Link from "next/link";
import { X, MapPin, Layers, User, Building, ChevronRight } from "lucide-react";
// Legacy type for grid-based tile selection
export interface SelectedTileInfo {
  x: number; y: number; zone: number; zoneName: string;
  terrain: string; ownerAgentId: number | null;
  structure: string | null; structureLevel: number;
}

interface TileInfoPanelProps {
  tile: SelectedTileInfo;
  onClose: () => void;
}

const TERRAIN_LABELS: Record<string, string> = {
  grass: "Herbe",
  sand: "Sable",
  rock: "Roche",
  water: "Eau",
  void: "Vide",
};

export function TileInfoPanel({ tile, onClose }: TileInfoPanelProps) {
  const zoneInfo = ZONE_COLORS[tile.zone];
  const structInfo = tile.structure ? STRUCTURE_ICONS[tile.structure] : null;

  return (
    <div className="absolute right-4 top-4 w-72 z-30 animate-slideUp">
      <Card variant="glow" className="relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-akyra-textSecondary hover:text-akyra-text transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} className="text-akyra-green" />
            <span className="font-heading text-xs text-akyra-green">
              [{tile.x}, {tile.y}]
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{WORLD_EMOJIS[tile.zone] || ""}</span>
            <span
              className="text-sm font-medium"
              style={{ color: zoneInfo?.border || "#8B949E" }}
            >
              {tile.zoneName}
            </span>
          </div>
        </div>

        {/* Terrain */}
        <div className="space-y-3 border-t border-akyra-border pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-akyra-textSecondary">
              <Layers size={12} />
              Terrain
            </div>
            <span className="text-xs text-akyra-text">
              {TERRAIN_LABELS[tile.terrain] || tile.terrain}
            </span>
          </div>

          {/* Owner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-akyra-textSecondary">
              <User size={12} />
              Proprietaire
            </div>
            {tile.ownerAgentId !== null ? (
              <Link
                href={`/agent/${tile.ownerAgentId}`}
                className="text-xs text-akyra-green hover:underline flex items-center gap-1"
              >
                {agentName(tile.ownerAgentId)}
                <ChevronRight size={10} />
              </Link>
            ) : (
              <span className="text-xs text-akyra-textDisabled">Terre libre</span>
            )}
          </div>

          {/* Structure */}
          {tile.structure && structInfo && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-akyra-textSecondary">
                <Building size={12} />
                Structure
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ backgroundColor: structInfo.color }}
                />
                <span className="text-xs text-akyra-text capitalize">
                  {tile.structure} Nv.{tile.structureLevel}
                </span>
              </div>
            </div>
          )}

          {!tile.structure && tile.ownerAgentId === null && (
            <div className="mt-2 p-2 rounded-lg bg-akyra-bgSecondary text-center">
              <p className="text-xs text-akyra-textSecondary">
                Cette parcelle est libre.
              </p>
              <p className="text-[10px] text-akyra-textDisabled mt-1">
                Un agent peut la revendiquer.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
