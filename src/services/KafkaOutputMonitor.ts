import { KafkaConsumerService } from "./KafkaConsumerService.js";
import { KafkaAdminService } from "./KafkaAdminService.js";
import { KafkaConnectionConfig } from "../config/kafkaConfig.js";
import { EventEmitter } from "events";

export interface FlowOutput {
  topic: string;
  orgUsrNode: string;
  timestamp: string;
  data: any;
  messageKey?: string;
  partition: number;
  offset: string;
}

export interface TopicStats {
  topic: string;
  messageCount: number;
  lastMessage?: FlowOutput;
  firstMessageTime?: string;
  lastMessageTime?: string;
}

export class KafkaOutputMonitor extends EventEmitter {
  private adminService: KafkaAdminService;
  private consumerService: KafkaConsumerService;
  private config: KafkaConnectionConfig;
  private isMonitoring: boolean = false;
  private topicStats: Map<string, TopicStats> = new Map();
  private allOutputs: FlowOutput[] = [];
  private maxOutputsToKeep: number = 1000;

  constructor(config: KafkaConnectionConfig, maxOutputsToKeep: number = 1000) {
    super();
    this.config = config;
    this.maxOutputsToKeep = maxOutputsToKeep;
    this.adminService = new KafkaAdminService(config);
    this.consumerService = new KafkaConsumerService(config);

    this.setupConsumerEvents();
  }

  private setupConsumerEvents(): void {
    this.consumerService.on("message", (messageData) => {
      this.handleFlowOutput(messageData);
    });

    this.consumerService.on("connected", () => {
      console.log("🔗 Output monitor consumer connected");
      this.emit("monitor-connected");
    });

    this.consumerService.on("error", (error) => {
      console.error("❌ Output monitor error:", error);
      this.emit("monitor-error", error);
    });
  }

  private handleFlowOutput(messageData: any): void {
    try {
      // Extract org-usr-node from topic name
      const topicParts = messageData.topic.split("-");

      // Remove the last part (-topic) to get org-usr-node
      const orgUsrNode = topicParts.slice(0, -1).join("-");

      const flowOutput: FlowOutput = {
        topic: messageData.topic,
        orgUsrNode,
        timestamp: new Date(parseInt(messageData.timestamp)).toISOString(),
        data: this.parseMessageData(messageData.value),
        messageKey: messageData.key,
        partition: messageData.partition,
        offset: messageData.offset,
      };

      // Update statistics
      this.updateTopicStats(flowOutput);

      // Store output (with limit)
      this.allOutputs.push(flowOutput);
      if (this.allOutputs.length > this.maxOutputsToKeep) {
        this.allOutputs.shift(); // Remove oldest
      }

      // Emit events
      this.emit("flow-output", flowOutput);
      this.emit(`output:${orgUsrNode}`, flowOutput);
      this.emit(`topic-output:${messageData.topic}`, flowOutput);
    } catch (error) {
      console.error("❌ Error handling flow output:", error);
      this.emit("parse-error", { error, messageData });
    }
  }

  private parseMessageData(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as string if not JSON
    }
  }

  private updateTopicStats(output: FlowOutput): void {
    const stats = this.topicStats.get(output.topic) || {
      topic: output.topic,
      messageCount: 0,
    };

    stats.messageCount++;
    stats.lastMessage = output;
    stats.lastMessageTime = output.timestamp;

    if (!stats.firstMessageTime) {
      stats.firstMessageTime = output.timestamp;
    }

    this.topicStats.set(output.topic, stats);
  }

  /**
   * Start monitoring all flow topics
   * @param orgUsrNode - Optional: monitor specific org-usr-node only
   */
  async startMonitoring(orgUsrNode?: string): Promise<void> {
    try {
      console.log("🔍 Starting Kafka output monitoring...");

      // Get all flow topics
      const flowTopics = await this.adminService.getFlowTopics(orgUsrNode);

      if (flowTopics.length === 0) {
        console.log("⚠️  No flow topics found to monitor");
        if (orgUsrNode) {
          console.log(`   Looking for topics matching: ${orgUsrNode}-topic`);
        } else {
          console.log("   Looking for topics ending with: -topic");
        }

        // Still set up the consumer service for when topics are created
        console.log("🔄 Setting up consumer for future topics...");
        this.isMonitoring = true;
        this.emit("monitoring-started", { topics: [] });
        return;
      }

      console.log(
        `📡 Found ${flowTopics.length} flow topics to monitor:`,
        flowTopics
      );

      // Subscribe to all flow topics
      await this.consumerService.subscribe(flowTopics, false); // fromBeginning = false for new messages only

      this.isMonitoring = true;
      this.emit("monitoring-started", { topics: flowTopics });

      console.log("✅ Output monitoring started successfully");
    } catch (error) {
      console.error("❌ Failed to start monitoring:", error);
      this.emit("monitoring-error", error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    try {
      this.isMonitoring = false;
      await this.consumerService.disconnect();
      console.log("🛑 Output monitoring stopped");
      this.emit("monitoring-stopped");
    } catch (error) {
      console.error("❌ Error stopping monitoring:", error);
      throw error;
    }
  }

  /**
   * Get all outputs received so far
   */
  getAllOutputs(): FlowOutput[] {
    return [...this.allOutputs];
  }

  /**
   * Get outputs for specific org-usr-node
   */
  getOutputsForOrgUsrNode(orgUsrNode: string): FlowOutput[] {
    return this.allOutputs.filter((output) => output.orgUsrNode === orgUsrNode);
  }

  /**
   * Get outputs from specific topic
   */
  getOutputsFromTopic(topic: string): FlowOutput[] {
    return this.allOutputs.filter((output) => output.topic === topic);
  }

  /**
   * Get latest outputs (most recent first)
   */
  getLatestOutputs(limit: number = 10): FlowOutput[] {
    return this.allOutputs.slice(-limit).reverse();
  }

  /**
   * Get statistics for all monitored topics
   */
  getTopicStatistics(): TopicStats[] {
    return Array.from(this.topicStats.values());
  }

  /**
   * Get statistics for specific topic
   */
  getTopicStats(topic: string): TopicStats | undefined {
    return this.topicStats.get(topic);
  }

  /**
   * Clear all stored outputs and statistics
   */
  clearOutputs(): void {
    this.allOutputs = [];
    this.topicStats.clear();
    console.log("🗑️  Cleared all stored outputs and statistics");
    this.emit("outputs-cleared");
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    totalOutputs: number;
    monitoredTopics: string[];
    topicCount: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      totalOutputs: this.allOutputs.length,
      monitoredTopics: Array.from(this.topicStats.keys()),
      topicCount: this.topicStats.size,
    };
  }

  /**
   * Disconnect all services
   */
  async disconnect(): Promise<void> {
    await this.stopMonitoring();
    await this.adminService.disconnect();
    console.log("🔌 Output monitor disconnected");
  }
}
