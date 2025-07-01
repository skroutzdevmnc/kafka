import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { KafkaOutputMonitor } from "./KafkaOutputMonitor.js";
import { defaultKafkaConfig } from "../config/kafkaConfig.js";

export class FlowOutputWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private kafkaMonitor: KafkaOutputMonitor;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 8080) {
    // Create HTTP server
    this.server = createServer();

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.server });

    // Initialize Kafka monitor
    this.kafkaMonitor = new KafkaOutputMonitor(defaultKafkaConfig, 1000);

    this.setupWebSocketHandlers();
    this.setupKafkaMonitor();

    this.server.listen(port, () => {
      console.log(`🚀 WebSocket server running on port ${port}`);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("📱 New WebSocket client connected");
      this.clients.add(ws);

      // Send current status to new client
      this.sendToClient(ws, {
        type: "flow-status",
        data: this.kafkaMonitor.getMonitoringStatus(),
        timestamp: new Date().toISOString(),
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error("Error parsing client message:", error);
        }
      });

      ws.on("close", () => {
        console.log("📱 WebSocket client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket client error:", error);
        this.clients.delete(ws);
      });
    });
  }

  private setupKafkaMonitor(): void {
    // Listen for flow outputs from Kafka
    this.kafkaMonitor.on("flow-output", (output) => {
      console.log(`📨 Broadcasting flow output from ${output.orgUsrNode}`);
      this.broadcastToClients({
        type: "flow-output",
        data: output,
        timestamp: new Date().toISOString(),
      });
    });

    this.kafkaMonitor.on("monitoring-started", (data) => {
      this.broadcastToClients({
        type: "flow-status",
        data: { status: "monitoring-started", ...data },
        timestamp: new Date().toISOString(),
      });
    });

    this.kafkaMonitor.on("monitor-error", (error) => {
      this.broadcastToClients({
        type: "error",
        data: { error: error.message || error },
        timestamp: new Date().toISOString(),
      });
    });

    // Start monitoring
    this.startKafkaMonitoring();
  }

  private async startKafkaMonitoring(): Promise<void> {
    try {
      await this.kafkaMonitor.startMonitoring();
      console.log("✅ Kafka monitoring started successfully");
    } catch (error) {
      console.error("❌ Failed to start Kafka monitoring:", error);
    }
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case "get-status":
        this.sendToClient(ws, {
          type: "flow-status",
          data: this.kafkaMonitor.getMonitoringStatus(),
          timestamp: new Date().toISOString(),
        });
        break;

      case "get-latest-outputs":
        const limit = message.limit || 10;
        this.sendToClient(ws, {
          type: "flow-output",
          data: this.kafkaMonitor.getLatestOutputs(limit),
          timestamp: new Date().toISOString(),
        });
        break;

      case "monitor-specific-org":
        if (message.orgUsrNode) {
          this.restartMonitoring(message.orgUsrNode);
        }
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  private async restartMonitoring(orgUsrNode?: string): Promise<void> {
    try {
      await this.kafkaMonitor.stopMonitoring();
      await this.kafkaMonitor.startMonitoring(orgUsrNode);
    } catch (error) {
      console.error("Error restarting monitoring:", error);
    }
  }

  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  async shutdown(): Promise<void> {
    console.log("🛑 Shutting down WebSocket server...");

    // Close all client connections
    this.clients.forEach((client) => {
      client.close();
    });

    // Stop Kafka monitoring
    await this.kafkaMonitor.disconnect();

    // Close WebSocket server
    this.wss.close();

    // Close HTTP server
    this.server.close();

    console.log("👋 WebSocket server shutdown complete");
  }
}

// Create and start the server
const wsServer = new FlowOutputWebSocketServer(8080);

// Graceful shutdown
process.on("SIGINT", async () => {
  await wsServer.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await wsServer.shutdown();
  process.exit(0);
});
