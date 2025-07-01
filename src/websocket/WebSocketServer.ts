import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: string;
  data?: any;
}

export class KafkaWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 8080) {
    super();
    this.wss = new WebSocketServer({ port });
    this.setupServer();
    console.log(`🔌 WebSocket Server running on ws://localhost:${port}`);
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔗 Client connected');
      this.clients.add(ws);

      ws.on('message', (message: Buffer) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString());
          this.emit('message', data, ws);
        } catch (error) {
          console.error('❌ Invalid message format:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send welcome message
      this.sendToClient(ws, { type: 'connected' });
    });
  }

  public broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public sendToClient(client: WebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public close(): void {
    this.wss.close();
    console.log('🛑 WebSocket Server closed');
  }
}