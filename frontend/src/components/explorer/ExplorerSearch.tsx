"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { parseSearchQuery } from "@/lib/explorer";
import { cn } from "@/lib/utils";

interface ExplorerSearchProps {
  className?: string;
  size?: "sm" | "lg";
  placeholder?: string;
}

export function ExplorerSearch({ className, size = "lg", placeholder }: ExplorerSearchProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      const result = parseSearchQuery(query);

      switch (result.type) {
        case "tx":
          router.push(`/explorer/tx/${result.value}`);
          break;
        case "block":
          router.push(`/explorer/block/${result.value}`);
          break;
        case "address":
          router.push(`/explorer/address/${result.value}`);
          break;
        default:
          setError("Format non reconnu. Entrez une adresse (0x...), un hash de transaction, ou un numero de bloc.");
          break;
      }
    },
    [query, router],
  );

  const isLg = size === "lg";

  return (
    <form onSubmit={handleSearch} className={cn("w-full", className)}>
      <div className="relative">
        <Search
          size={isLg ? 20 : 16}
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 text-akyra-textDisabled",
            isLg && "left-5",
          )}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(""); }}
          placeholder={placeholder || "Rechercher par adresse / tx hash / bloc..."}
          className={cn(
            "w-full bg-akyra-surface/80 border border-akyra-border rounded-xl text-akyra-text placeholder:text-akyra-textDisabled font-mono focus:outline-none focus:border-akyra-green/50 focus:ring-1 focus:ring-akyra-green/20 transition-all",
            isLg ? "pl-14 pr-5 py-4 text-sm" : "pl-10 pr-4 py-2.5 text-xs",
          )}
        />
        <button
          type="submit"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 bg-akyra-green/10 text-akyra-green border border-akyra-green/30 rounded-lg font-mono uppercase tracking-wider hover:bg-akyra-green/20 transition-all",
            isLg ? "px-5 py-2 text-xs" : "px-3 py-1.5 text-[10px]",
          )}
        >
          Chercher
        </button>
      </div>
      {error && (
        <p className="text-akyra-red text-xs mt-2 font-mono">{error}</p>
      )}
    </form>
  );
}
