import type { ChannelConfig, Message } from '../types/index.js';
import { EventEmitter } from 'eventemitter3';

export interface ChannelAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: Message): Promise<void>;
  onMessage(handler: (message: Message) => void): void;
  isConnected(): boolean;
}

export class ChannelManager {
  private channels: Map<string, ChannelAdapter>;
  private eventEmitter: EventEmitter;

  constructor(channelConfigs: ChannelConfig[]) {
    this.channels = new Map();
    this.eventEmitter = new EventEmitter();

    for (const config of channelConfigs) {
      if (config.enabled) {
        const adapter = this.createAdapter(config);
        this.channels.set(config.type, adapter);
      }
    }
  }

  private createAdapter(config: ChannelConfig): ChannelAdapter {
    switch (config.type) {
      case 'whatsapp':
        return new WhatsAppAdapter(config.config);
      case 'telegram':
        return new TelegramAdapter(config.config);
      case 'discord':
        return new DiscordAdapter(config.config);
      case 'slack':
        return new SlackAdapter(config.config);
      case 'http':
        return new HTTPAdapter(config.config);
      case 'websocket':
        return new WebSocketAdapter(config.config);
      default:
        throw new Error(`Unknown channel type: ${config.type}`);
    }
  }

  async connect(): Promise<void> {
    const connectPromises = Array.from(this.channels.values()).map(
      channel => channel.connect()
    );
    await Promise.all(connectPromises);
  }

  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.channels.values()).map(
      channel => channel.disconnect()
    );
    await Promise.all(disconnectPromises);
  }

  getChannel(type: string): ChannelAdapter | undefined {
    return this.channels.get(type);
  }

  onMessage(handler: (message: Message) => void): void {
    this.channels.forEach(channel => {
      channel.onMessage(handler);
    });
  }
}

class WhatsAppAdapter implements ChannelAdapter {
  private config: Record<string, unknown>;
  private connected: boolean = false;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('Connecting to WhatsApp...');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from WhatsApp...');
    this.connected = false;
  }

  async sendMessage(message: Message): Promise<void> {
    console.log('Sending WhatsApp message:', message.content);
  }

  onMessage(handler: (message: Message) => void): void {
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class TelegramAdapter implements ChannelAdapter {
  private config: Record<string, unknown>;
  private connected: boolean = false;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('Connecting to Telegram...');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from Telegram...');
    this.connected = false;
  }

  async sendMessage(message: Message): Promise<void> {
    console.log('Sending Telegram message:', message.content);
  }

  onMessage(handler: (message: Message) => void): void {
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class DiscordAdapter implements ChannelAdapter {
  private config: Record<string, unknown>;
  private connected: boolean = false;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('Connecting to Discord...');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from Discord...');
    this.connected = false;
  }

  async sendMessage(message: Message): Promise<void> {
    console.log('Sending Discord message:', message.content);
  }

  onMessage(handler: (message: Message) => void): void {
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class SlackAdapter implements ChannelAdapter {
  private config: Record<string, unknown>;
  private connected: boolean = false;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('Connecting to Slack...');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from Slack...');
    this.connected = false;
  }

  async sendMessage(message: Message): Promise<void> {
    console.log('Sending Slack message:', message.content);
  }

  onMessage(handler: (message: Message) => void): void {
  }

  isConnected(): boolean {
    return this.OTHER;
  }
}

class HTTPAdapter implements ChannelAdapter {
  private config: Record<string, unknown>;
  private connected: boolean = false;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('Starting HTTP server...');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Stopping HTTP server...');
    this.connected = false;
  }

  async sendMessage(message: Message): Promise<void> {
    console.log('Sending HTTP response:', message.content);
  }

  onMessage(handler: (message: Message) => void): void {
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class WebSocketAdapter implements ChannelAdapter {
  private config: Record<string, unknown>;
  private connected: boolean = false;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('Starting WebSocket server...');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Stopping WebSocket server...');
    this.connected = false;
  }

  async sendMessage(message: Message): Promise<void> {
    console.log('Sending WebSocket message:', message.content);
  }

  onMessage(handler: (message: Message) => void): void {
  }

  isConnected(): boolean {
    return this.connected;
  }
}
