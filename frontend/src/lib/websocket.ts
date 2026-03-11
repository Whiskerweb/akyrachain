type EventHandler = (event: Record<string, unknown>) => void;

class AkyraWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<EventHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    this.url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/feed";
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(data));
        } catch {
          // ignore non-JSON messages (pong, etc.)
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected, reconnecting in 3s...");
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.stopPing();
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: EventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[WS] Max reconnect attempts reached, stopping");
      return;
    }
    const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Singleton
export const websocket = typeof window !== "undefined" ? new AkyraWebSocket() : null;
