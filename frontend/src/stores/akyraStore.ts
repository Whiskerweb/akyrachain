import { create } from "zustand";
import type { AkyraEvent, User } from "@/types";

interface AkyraState {
  // Auth
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;

  // Live events (WebSocket)
  liveEvents: AkyraEvent[];
  addLiveEvent: (event: AkyraEvent) => void;
  clearLiveEvents: () => void;

  // Notifications
  unreadCount: number;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useAkyraStore = create<AkyraState>((set) => ({
  // Auth
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("akyra_token") : null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("akyra_token", token);
    } else {
      localStorage.removeItem("akyra_token");
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem("akyra_token");
    set({ user: null, token: null });
  },

  // Live events
  liveEvents: [],
  addLiveEvent: (event) =>
    set((state) => ({
      liveEvents: [event, ...state.liveEvents].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    })),
  clearLiveEvents: () => set({ liveEvents: [] }),

  // Notifications
  unreadCount: 0,
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
