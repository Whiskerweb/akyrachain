"use client";

import { ExternalLink } from "lucide-react";

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "http://35.233.51.51:4000";

interface TxLinkProps {
  hash: string | null | undefined;
  className?: string;
}

export function TxLink({ hash, className = "" }: TxLinkProps) {
  if (!hash) return null;

  return (
    <a
      href={`${EXPLORER_URL}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Voir on-chain"
      className={`inline-flex items-center gap-0.5 text-akyra-textDisabled hover:text-akyra-blue transition-colors ${className}`}
    >
      <ExternalLink size={10} />
    </a>
  );
}

interface BlockLinkProps {
  block: number | null | undefined;
  className?: string;
}

export function BlockLink({ block, className = "" }: BlockLinkProps) {
  if (!block) return null;

  return (
    <a
      href={`${EXPLORER_URL}/block/${block}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Block #${block}`}
      className={`text-akyra-textDisabled hover:text-akyra-blue transition-colors ${className}`}
    >
      #{block}
    </a>
  );
}
