"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { http } from "viem";
import {
  RainbowKitProvider,
  lightTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rabbyWallet,
  braveWallet,
  ledgerWallet,
  trustWallet,
  phantomWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { akyraChain } from "@/lib/contracts";
import { websocket } from "@/lib/websocket";
import { useAkyraStore } from "@/stores/akyraStore";
import { CommandBar } from "@/components/layout/CommandBar";

import "@rainbow-me/rainbowkit/styles.css";

const wagmiConfig = getDefaultConfig({
  appName: "AKYRA",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "akyra-dev",
  chains: [akyraChain],
  transports: {
    [akyraChain.id]: http(),
  },
  ssr: true,
  wallets: [
    {
      groupName: "Populaires",
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        rabbyWallet,
      ],
    },
    {
      groupName: "Autres wallets",
      wallets: [
        braveWallet,
        ledgerWallet,
        trustWallet,
        phantomWallet,
      ],
    },
  ],
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Connect WebSocket on mount
  const addLiveEvent = useAkyraStore((s) => s.addLiveEvent);

  useEffect(() => {
    websocket?.connect();
    const unsub = websocket?.subscribe((event) => {
      addLiveEvent(event as never);
    });
    return () => {
      unsub?.();
      websocket?.disconnect();
    };
  }, [addLiveEvent]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#1a3080",
            accentColorForeground: "#ffffff",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          {children}
          <CommandBar />
          <Toaster
            theme="light"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#f7f4ef",
                border: "1px solid #d4cdc4",
                color: "#3c3630",
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
