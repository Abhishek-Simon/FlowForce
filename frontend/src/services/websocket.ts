const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

type MessageHandler = (data: any) => void;

class TrafficWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    try {
      this.ws = new WebSocket(`${WS_URL}/api/ws/traffic`);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('[WS] Connected to Traffic Intelligence Server');
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type || 'unknown';
          this.emit(type, data);
          this.emit('*', data);
        } catch {}
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('connection', { status: 'disconnected' });
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch (e) {
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: MessageHandler) {
    const hs = this.handlers.get(event);
    if (hs) this.handlers.set(event, hs.filter(h => h !== handler));
  }

  private emit(event: string, data: any) {
    this.handlers.get(event)?.forEach(h => h(data));
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  isConnected() { return this.connected; }
}

export const trafficWS = new TrafficWebSocket();
