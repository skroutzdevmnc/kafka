import { KafkaConfig } from "kafkajs";

export interface KafkaConnectionConfig {
  connectionConfig: KafkaConfig;
  groupId: string;
}

export const createKafkaConfig = (
  brokers: string[],
  clientId: string = "kafka-service",
  groupId: string = "kafka-service-group"
): KafkaConnectionConfig => {
  return {
    connectionConfig: {
      clientId,
      brokers,
      // No SSL/SASL configuration needed for simplified setup
      connectionTimeout: 3000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    },
    groupId,
  };
};

// Default configuration - update these values as needed
export const defaultKafkaConfig = createKafkaConfig(
  ["192.168.100.164:9092"], // Default Kafka broker
  "kafka-service",
  "kafka-service-group"
);
