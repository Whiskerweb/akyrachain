"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

function normalizeHash(hash: string): string {
  return hash.startsWith("0x") ? hash : `0x${hash}`;
}

interface TxLinkProps {
  hash: string | null | undefined;
  className?: string;
}

export function TxLink({ hash, className = "" }: TxLinkProps) {
  if (!hash || hash.length < 64) return null;

  return (
    <Link
      href={`/explorer/tx/${normalizeHash(hash)}`}
      title="Voir on-chain"
      className={`inline-flex items-center gap-0.5 text-akyra-textDisabled hover:text-akyra-blue transition-colors ${className}`}
    >
      <ExternalLink size={10} />
    </Link>
  );
}

interface BlockLinkProps {
  block: number | null | undefined;
  className?: string;
}

export function BlockLink({ block, className = "" }: BlockLinkProps) {
  if (!block) return null;

  return (
    <Link
      href={`/explorer/block/${block}`}
      title={`Block #${block}`}
      className={`text-akyra-textDisabled hover:text-akyra-blue transition-colors ${className}`}
    >
      #{block}
    </Link>
  );
}
