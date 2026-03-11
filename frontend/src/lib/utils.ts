import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAKY(wei: number): string {
  const aky = wei / 1e18;
  if (aky >= 1000) return `${(aky / 1000).toFixed(1)}K`;
  if (aky >= 1) return aky.toFixed(1);
  return aky.toFixed(4);
}

export function formatAKYFull(wei: number): string {
  return (wei / 1e18).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function agentName(id: number): string {
  return `AK-${String(id).padStart(4, "0")}`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export function tierFromVault(vaultWei: number): number {
  const aky = vaultWei / 1e18;
  if (aky >= 5000) return 4;
  if (aky >= 500) return 3;
  if (aky >= 50) return 2;
  return 1;
}
