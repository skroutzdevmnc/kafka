import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { EventEmitter } from "events";
import { KafkaConnectionConfig } from "../config/kafkaConfig.js";

export class KafkaConsumerService extends EventEmitter {
  private kafka: Kafka;
  private consumer: Consumer | null = null;
  private config: KafkaConnectionConfig;
  private isConnected: boolean = false;

  constructor(config: KafkaConnectionConfig) {
    super();
    this.config = config;
    this.kafka = new Kafka(config.connectionConfig);
  }

  private async getConsumer(): Promise<Consumer> {
    if (!this.consumer) {
      this.consumer = this.kafka.consumer({
        groupId:
          this.config.groupId + "_" + Math.random().toString(36).substring(7),
      });

      // Set up event listeners
      this.consumer.on("consumer.connect", () => {
        console.log("Kafka Consumer connected");
        this.isConnected = true;
        this.emit("connected");
      });

      this.consumer.on("consumer.disconnect", () => {
        console.log("Kafka Consumer disconnected");
        this.isConnected = false;
        this.emit("disconnected");
      });

      this.consumer.on("consumer.crash", (error) => {
        console.error("Kafka Consumer crashed:", error);
        this.emit("error", error);
      });
    }
    return this.consumer;
  }

  /**
   * Subscribe to topics and start consuming messages
   * @param topics - Array of topic names to subscribe to
   * @param fromBeginning - Whether to read from the beginning of the topic
   */
  async subscribe(
    topics: string[],
    fromBeginning: boolean = false
  ): Promise<void> {
    try {
      const consumer = await this.getConsumer();

      if (!this.isConnected) {
        await consumer.connect();
      }

      await consumer.subscribe({
        topics,
        fromBeginning,
      });

      await consumer.run({
        eachMessage: this.handleMessage.bind(this),
      });

      console.log(`Subscribed to topics: ${topics.join(", ")}`);
    } catch (error) {
      console.error("Error subscribing to topics:", error);
      throw error;
    }
  }

  /**
   * Subscribe to all flow topics matching the pattern
   * @param orgUsrNode - The dynamic part (optional, if not provided, subscribes to all *-topic topics)
   * @param fromBeginning - Whether to read from the beginning of the topic
   */
  async subscribeToFlowTopics(
    orgUsrNode?: string,
    fromBeginning: boolean = false
  ): Promise<void> {
    // This would require getting topics first from admin service
    // For now, we'll accept topic names directly
    const topics = orgUsrNode ? [`${orgUsrNode}-topic`] : [];
    await this.subscribe(topics, fromBeginning);
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    if (!message.value) return;

    try {
      const messageData = {
        topic,
        partition,
        offset: message.offset,
        key: message.key?.toString(),
        value: message.value.toString(),
        timestamp: message.timestamp,
        headers: message.headers,
      };

      // Emit the message for external handling
      this.emit("message", messageData);

      // Emit topic-specific events
      this.emit(`topic:${topic}`, messageData);
    } catch (error) {
      console.error("Error processing message:", error);
      this.emit("error", error);
    }
  }

  /**
   * Disconnect the consumer
   */
  async disconnect(): Promise<void> {
    if (this.consumer && this.isConnected) {
      await this.consumer.disconnect();
      this.consumer = null;
      this.isConnected = false;
      console.log("Kafka Consumer disconnected");
    }
  }

  /**
   * Check if consumer is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
