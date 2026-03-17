"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-akyra-border/40 bg-akyra-bg/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-akyra-gold animate-breathe" />
          <span className="font-heading text-xs text-akyra-gold tracking-wider">
            AKYRA
          </span>
        </Link>

        {/* Center nav */}
        <nav className="flex items-center gap-6">
          <a
            href="#concept"
            className="text-xs text-akyra-textSecondary hover:text-akyra-text transition-colors"
          >
            Decouvrir
          </a>
          <Link
            href="/pricing"
            className="text-xs text-akyra-textSecondary hover:text-akyra-text transition-colors"
          >
            Pricing
          </Link>
        </nav>

        {/* CTA */}
        <Link
          href="/signup"
          className="group inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-akyra-gold/10 border border-akyra-gold/30 text-xs font-medium text-akyra-gold hover:bg-akyra-gold/15 hover:border-akyra-gold/50 transition-all"
        >
          Lancer mon IA
          <ArrowRight size={12} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </header>
  );
}
