"use client";

import { cn } from "@/lib/utils";

interface DataRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}

export function DataRow({ label, children, className, mono = true }: DataRowProps) {
  return (
    <div className={cn("flex items-start gap-4 py-3 border-b border-akyra-border/20 last:border-0", className)}>
      <span className="text-xs text-akyra-textSecondary w-40 shrink-0 pt-0.5">{label}</span>
      <div className={cn("text-sm text-akyra-text flex-1 min-w-0 break-all", mono && "font-mono")}>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: "success" | "reverted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider",
        status === "success"
          ? "bg-akyra-green/15 text-akyra-green border border-akyra-green/30"
          : "bg-akyra-red/15 text-akyra-red border border-akyra-red/30",
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "success" ? "bg-akyra-green" : "bg-akyra-red")} />
      {status === "success" ? "Succes" : "Echoue"}
    </span>
  );
}

export function AddressLink({ address, label }: { address: string; label?: string }) {
  return (
    <a
      href={`/explorer/address/${address}`}
      className="text-akyra-blue hover:text-akyra-green transition-colors font-mono text-sm"
    >
      {label || address}
    </a>
  );
}

export function TxLink({ hash, short }: { hash: string; short?: boolean }) {
  const display = short ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : hash;
  return (
    <a
      href={`/explorer/tx/${hash}`}
      className="text-akyra-blue hover:text-akyra-green transition-colors font-mono text-sm"
    >
      {display}
    </a>
  );
}

export function BlockLink({ number }: { number: number }) {
  return (
    <a
      href={`/explorer/block/${number}`}
      className="text-akyra-blue hover:text-akyra-green transition-colors font-mono text-sm"
    >
      {number.toLocaleString()}
    </a>
  );
}

export function CopyableText({ text, display }: { text: string; display?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 group">
      <span className="font-mono text-sm">{display || text}</span>
      <button
        onClick={() => navigator.clipboard.writeText(text)}
        className="text-akyra-textDisabled hover:text-akyra-green transition-colors opacity-0 group-hover:opacity-100"
        title="Copier"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      </button>
    </span>
  );
}
