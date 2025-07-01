import { Kafka, Admin, KafkaConfig } from "kafkajs";
import { KafkaConnectionConfig } from "../config/kafkaConfig.js";

export class KafkaAdminService {
  private kafka: Kafka;
  private admin: Admin | null = null;
  private config: KafkaConnectionConfig;

  constructor(config: KafkaConnectionConfig) {
    this.config = config;
    this.kafka = new Kafka(config.connectionConfig);
  }

  private async getAdmin(): Promise<Admin> {
    if (!this.admin) {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      console.log("Kafka Admin connected successfully");
    }
    return this.admin;
  }

  /**
   * Get all topics that match the pattern: org-usr-flw-node-topic
   * @param orgUsrNode - The dynamic part (e.g., "myorg-myuser-mynode")
   * @returns Array of matching topic names
   */
  async getFlowTopics(orgUsrNode?: string): Promise<string[]> {
    try {
      const admin = await this.getAdmin();
      const allTopics = await admin.listTopics();

      // Return all topics that end with '-topic'
      return allTopics.filter((topic) => topic.endsWith("-topic"));
    } catch (error) {
      console.error("Error retrieving topics:", error);
      throw error;
    }
  }
  /**
   * Get all topics from Kafka
   * @returns Array of all topic names
   */
  async getAllTopics(): Promise<string[]> {
    try {
      const admin = await this.getAdmin();
      return await admin.listTopics();
    } catch (error) {
      console.error("Error retrieving all topics:", error);
      throw error;
    }
  }

  /**
   * Create a new topic with the pattern: org-usr-flw-node-topic
   * @param orgUsrNode - The dynamic part (e.g., "myorg-myuser-mynode")
   * @param numPartitions - Number of partitions (default: 1)
   * @param replicationFactor - Replication factor (default: 1)
   */

  /**
   * Delete a topic
   * @param topicName - Name of the topic to delete
   */
  async deleteTopic(topicName: string): Promise<boolean> {
    try {
      const admin = await this.getAdmin();
      await admin.deleteTopics({
        topics: [topicName],
      });
      console.log(`Topic ${topicName} deleted successfully`);
      return true;
    } catch (error) {
      console.error("Error deleting topic:", error);
      return false;
    }
  }

  /**
   * Get topic metadata
   * @param topicNames - Array of topic names to get metadata for
   */
  async getTopicMetadata(topicNames: string[]) {
    try {
      const admin = await this.getAdmin();
      return await admin.fetchTopicMetadata({ topics: topicNames });
    } catch (error) {
      console.error("Error fetching topic metadata:", error);
      throw error;
    }
  }

  /**
   * Disconnect the admin client
   */
  async disconnect(): Promise<void> {
    if (this.admin) {
      await this.admin.disconnect();
      this.admin = null;
      console.log("Kafka Admin disconnected");
    }
  }
}
