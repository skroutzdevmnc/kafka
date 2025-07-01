import { WebSocket } from 'ws';
import { KafkaOutputMonitor } from '../services/KafkaOutputMonitor.js';
import { KafkaWebSocketServer, WebSocketMessage } from './WebSocketServer.js';

export class WebSocketMessageHandler {
  private monitor: KafkaOutputMonitor;
  private wsServer: KafkaWebSocketServer;

  constructor(monitor: KafkaOutputMonitor, wsServer: KafkaWebSocketServer) {
    this.monitor = monitor;
    this.wsServer = wsServer;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle WebSocket messages
    this.wsServer.on('message', this.handleClientMessage.bind(this));

    // Handle Kafka monitor events
    this.monitor.on('flow-output', (output) => {
      this.wsServer.broadcast({
        type: 'message',
        data: output
      });
    });

    this.monitor.on('monitoring-started', (data) => {
      this.wsServer.broadcast({
        type: 'status',
        data: { monitoring: true, topics: data.topics }
      });
    });

    this.monitor.on('monitoring-stopped', () => {
      this.wsServer.broadcast({
        type: 'status',
        data: { monitoring: false }
      });
    });

    this.monitor.on('monitor-error', (error) => {
      this.wsServer.broadcast({
        type: 'error',
        data: { message: error.message }
      });
    });
  }

  private async handleClientMessage(message: WebSocketMessage, client: WebSocket): Promise<void> {
    try {
      switch (message.type) {
        case 'start':
          await this.monitor.startMonitoring();
          break;

        case 'stop':
          await this.monitor.stopMonitoring();
          break;

        case 'clear':
          this.monitor.clearOutputs();
          this.wsServer.broadcast({ type: 'cleared' });
          break;

        case 'status':
          this.wsServer.sendToClient(client, {
            type: 'status',
            data: {
              monitoring: this.monitor.getMonitoringStatus().isMonitoring,
              topics: this.monitor.getTopicStatistics().map(s => s.topic),
              messageCount: this.monitor.getAllOutputs().length
            }
          });
          break;

        case 'recent':
          this.wsServer.sendToClient(client, {
            type: 'recent',
            data: this.monitor.getLatestOutputs(20)
          });
          break;

        default:
          console.log('❓ Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      this.wsServer.sendToClient(client, {
        type: 'error',
        data: { message: 'Failed to process request' }
      });
    }
  }
}