import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { KafkaConnectionConfig } from "../config/kafkaConfig.js";

export class KafkaProducerService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private config: KafkaConnectionConfig;
  private isConnected: boolean = false;

  constructor(config: KafkaConnectionConfig) {
    this.config = config;
    this.kafka = new Kafka(config.connectionConfig);
  }

  private async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer();

      this.producer.on("producer.connect", () => {
        console.log("Kafka Producer connected");
        this.isConnected = true;
      });

      this.producer.on("producer.disconnect", () => {
        console.log("Kafka Producer disconnected");
        this.isConnected = false;
      });
    }
    return this.producer;
  }

  /**
   * Send a message to a topic
   * @param topic - Topic
   * @param message - Message to send
   * @param key - Optional message key
   */
  async sendMessage(
    topic: string,
    message: string | object,
    key?: string
  ): Promise<boolean> {
    try {
      const producer = await this.getProducer();

      if (!this.isConnected) {
        await producer.connect();
      }

      const messageValue =
        typeof message === "string" ? message : JSON.stringify(message);

      const record: ProducerRecord = {
        topic,
        messages: [
          {
            key,
            value: messageValue,
            timestamp: Date.now().toString(),
          },
        ],
      };

      await producer.send(record);
      console.log(`Message sent to topic ${topic}`);
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }

  /**
   * Send a message to a flow topic
   * @param orgUsrNode - The dynamic part (e.g., "myorg-myuser-mynode")
   * @param message - Message to send
   * @param key - Optional message key
   */
  async sendToFlowTopic(
    orgUsrNode: string,
    message: string | object,
    key?: string
  ): Promise<boolean> {
    const topicName = `${orgUsrNode}-topic`;
    return await this.sendMessage(topicName, message, key);
  }

  /**
   * Send multiple messages in a batch
   * @param topic - Topic name
   * @param messages - Array of messages to send
   */
  async sendBatch(
    topic: string,
    messages: Array<{ value: string | object; key?: string }>
  ): Promise<boolean> {
    try {
      const producer = await this.getProducer();

      if (!this.isConnected) {
        await producer.connect();
      }

      const kafkaMessages = messages.map((msg) => ({
        key: msg.key,
        value:
          typeof msg.value === "string" ? msg.value : JSON.stringify(msg.value),
        timestamp: Date.now().toString(),
      }));

      const record: ProducerRecord = {
        topic,
        messages: kafkaMessages,
      };

      await producer.send(record);
      console.log(
        `Batch of ${messages.length} messages sent to topic ${topic}`
      );
      return true;
    } catch (error) {
      console.error("Error sending batch messages:", error);
      return false;
    }
  }

  /**
   * Disconnect the producer
   */
  async disconnect(): Promise<void> {
    if (this.producer && this.isConnected) {
      await this.producer.disconnect();
      this.producer = null;
      this.isConnected = false;
      console.log("Kafka Producer disconnected");
    }
  }

  /**
   * Check if producer is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
