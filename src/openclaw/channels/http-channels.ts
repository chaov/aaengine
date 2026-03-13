import type { AgentMessage, Channel, ChannelConfig } from '../core/agent-runtime.js';

export class HTTPChannel implements Channel {
  private server?: any;

  constructor(private config: ChannelConfig) {}

  async connect(): Promise<void> {
    const port = (this.config.config.port as number) || 3000;
    this.server = Bun.serve({
      port,
      fetch: async (req) => {
        if (req.method === 'POST' && req.url.endsWith('/message')) {
          const body = await req.json();
          this.handleMessage(body);
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    });
  }

  async disconnect(): Promise<void> {
    if (this.server) {
      this.server.stop();
    }
  }

  async sendMessage(message: AgentMessage): Promise<void> {
    console.log(`HTTP Channel: Sending message`, message);
  }

  onMessage(callback: (message: AgentMessage) => void): void {
    this.messageCallback = callback;
  }

  private messageCallback?: (message: AgentMessage) => void;

  private handleMessage(message: any): void {
    if (this.messageCallback) {
      this.messageCallback({
        id: `msg-${Date.now()}`,
        role: message.role,
        content: message.content,
        timestamp: Date.now(),
      });
    }
  }
}

export class WebSocketChannel implements Channel {
  private server?: any;
  private clients: Set<WebSocket> = new Set();

  constructor(private config: ChannelConfig) {}

  async connect(): Promise<void> {
    const port = (this.config.config.port as number) || 3001;
    this.server = Bun.serve({
      port,
      fetch: (req, server) => {
        if (server.upgrade(req)) {
          return undefined;
        }
        return new Response('Upgrade Failed', { status: 400 });
      },
      websocket: {
        message: (ws, message) => {
          const data = JSON.parse(message.toString());
          this.handleMessage(data, ws);
        },
        open: (ws) => {
          this.clients.add(ws);
        },
        close: (ws) => {
          this.clients.delete(ws);
        },
      },
    });
  }

  async disconnect(): Promise<void> {
    if (this.server) {
      this.server.stop();
    }
    this.clients.clear();
  }

  async sendMessage(message: AgentMessage): Promise<void> {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      client.send(data);
    }
  }

  onMessage(callback: (message: AgentMessage) => void): void {
    this.messageCallback = callback;
  }

  private messageCallback?: (message: AgentMessage) => void;

  private handleMessage(message: any, ws: WebSocket): void {
    if (this.messageCallback) {
      this.messageCallback({
        id: `msg-${Date.now()}`,
        role: message.role,
        content: message.content,
        timestamp: Date.now(),
      });
    }
  }
}

export async function createHTTPChannel(config: ChannelConfig): Promise<Channel> {
  return new HTTPChannel(config);
}

export async function createWebSocketChannel(config: ChannelConfig): Promise<Channel> {
  return new WebSocketChannel(config);
}
