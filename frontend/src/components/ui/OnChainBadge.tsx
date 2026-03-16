"use client";

import Link from "next/link";

interface OnChainBadgeProps {
  blockNumber?: number | null;
  txHash?: string | null;
  label?: string;
}

/**
 * Subtle blockchain indicator — shows block number or "on-chain" with link to explorer.
 * Used everywhere to remind users that data is live on AKYRA L2.
 */
export function OnChainBadge({ blockNumber, txHash, label }: OnChainBadgeProps) {
  if (!blockNumber && !txHash) return null;

  const normalizedHash = txHash
    ? txHash.startsWith("0x") ? txHash : `0x${txHash}`
    : null;

  const href = normalizedHash
    ? `/explorer/tx/${normalizedHash}`
    : blockNumber
      ? `/explorer/block/${blockNumber}`
      : "#";

  const text = label
    ? label
    : blockNumber
      ? `#${blockNumber.toLocaleString()}`
      : "on-chain";

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[9px] font-mono text-akyra-textDisabled hover:text-akyra-green transition-colors"
      title={normalizedHash ? `TX: ${normalizedHash}` : `Block ${blockNumber}`}
    >
      <span className="text-[8px]">&#x26D3;</span>
      {text}
    </Link>
  );
}

/**
 * Chain identity badge — shows "AKYRA L2 • Chain 47197" with explorer link.
 */
export function ChainBadge() {
  return (
    <Link
      href="/explorer"
      className="inline-flex items-center gap-1.5 text-[9px] font-mono text-akyra-textDisabled hover:text-akyra-green transition-colors"
    >
      <span className="w-1 h-1 rounded-full bg-green-400 animate-breathe" />
      AKYRA L2 &middot; Chain 47197
    </Link>
  );
}
