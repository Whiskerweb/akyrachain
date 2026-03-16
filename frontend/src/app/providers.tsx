"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { http } from "viem";
import {
  RainbowKitProvider,
  darkTheme,
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
          theme={darkTheme({
            accentColor: "#3b5bdb",
            accentColorForeground: "#ffffff",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          {children}
          <CommandBar />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#12121e",
                border: "1px solid #1f1f32",
                color: "#e8e4df",
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
