"use client";

import { useState, useCallback } from "react";
import { WorldMap } from "@/components/world/WorldMap";
import { WorldOverlay } from "@/components/world/WorldOverlay";
import { Header } from "@/components/layout/Header";
import type { SelectedNodeInfo } from "@/components/world/WorldMap";

export default function HomePage() {
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [graphStats, setGraphStats] = useState({ totalAgents: 0, aliveAgents: 0, totalEdges: 0, totalTokens: 0 });

  const handleZoomIn = useCallback(() => {
    window.dispatchEvent(new CustomEvent("akyra-zoom", { detail: { action: "in" } }));
  }, []);

  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent("akyra-zoom", { detail: { action: "out" } }));
  }, []);

  const handleResetView = useCallback(() => {
    window.dispatchEvent(new CustomEvent("akyra-zoom", { detail: { action: "reset" } }));
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 relative bg-[#040810]">
        <WorldMap
          onNodeSelect={setSelectedNode}
          onZoomChange={setZoom}
          onStatsUpdate={setGraphStats}
        />
        <WorldOverlay
          selectedNode={selectedNode}
          onClearNode={() => setSelectedNode(null)}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          graphStats={graphStats}
        />
      </div>
    </div>
  );
}
