"use client";

import { Header } from "@/components/layout/Header";
import Link from "next/link";
import { ExplorerSearch } from "./ExplorerSearch";
import { Blocks, ArrowLeftRight, Search as SearchIcon } from "lucide-react";

export function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* AkyScan header bar */}
      <div className="border-b border-akyra-border bg-akyra-bg/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/explorer" className="flex items-center gap-2 shrink-0">
            <span className="font-heading text-sm text-akyra-green">AKY</span>
            <span className="font-heading text-sm text-akyra-gold">SCAN</span>
          </Link>
          <ExplorerSearch size="sm" className="max-w-xl" />
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            <Link
              href="/explorer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-akyra-textSecondary hover:text-akyra-text hover:bg-akyra-surface/50 transition-colors font-mono"
            >
              <SearchIcon size={14} />
              Explorer
            </Link>
            <Link
              href="/explorer/block/latest"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-akyra-textSecondary hover:text-akyra-text hover:bg-akyra-surface/50 transition-colors font-mono"
            >
              <Blocks size={14} />
              Blocs
            </Link>
          </nav>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </>
  );
}
