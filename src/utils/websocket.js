import { message } from 'antd';

class WebSocketClient {
  constructor() {
    this.url = import.meta?.env?.VITE_WS_URL || 'ws://localhost:10300/ws';
    this.ws = null;
    this.listeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.isConnected = false;
    this.pingIntervalMs = 30000;
    this.pongTimeoutMs = 65000;
    this.pingTimer = null;
    this.lastPongAt = 0;
    this.hasSeenPong = false;
    this.manualClose = false;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.manualClose = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('WebSocket connect skipped: No token found');
      return;
    }

    try {
      const rawToken = String(token).trim();
      const cleanToken = rawToken.toLowerCase().startsWith('bearer ') ? rawToken.slice(7).trim() : rawToken;
      const wsUrl = `${this.url}?token=${encodeURIComponent(cleanToken)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected to', this.url);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastPongAt = Date.now();
        this.hasSeenPong = false;
        this.startHeartbeat();
        this.notifyListeners({ type: 'status', status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'pong') {
            this.lastPongAt = Date.now();
            this.hasSeenPong = true;
            return;
          }
          // Treat any incoming frame as a keep-alive signal as well.
          this.lastPongAt = Date.now();
          this.notifyListeners(payload);
        } catch (error) {
          console.error('[WS] Parse error:', error, event.data);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.isConnected = false;
        this.stopHeartbeat();
        this.notifyListeners({ type: 'status', status: 'disconnected' });
        if (!this.manualClose) this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

    } catch (e) {
      console.error('[WS] Connection failed:', e);
      this.attemptReconnect();
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      if (this.hasSeenPong && this.lastPongAt && Date.now() - this.lastPongAt > this.pongTimeoutMs) {
        console.warn('[WS] pong timeout, closing socket to trigger reconnect');
        this.ws.close();
        return;
      }

      this.ws.send(JSON.stringify({ type: 'ping' }));
    }, this.pingIntervalMs);
  }

  stopHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket max reconnect attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`WebSocket reconnecting... (Attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.manualClose = true;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    } else {
      console.warn('WebSocket not connected, cannot send message');
      message.error('连接断开，无法发送消息');
      return false;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach((listener) => listener(data));
  }
}

export const wsClient = new WebSocketClient();
// Expose for debugging
window.wsClient = wsClient;
