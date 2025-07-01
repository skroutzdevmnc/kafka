import { defaultKafkaConfig } from "../config/kafkaConfig.js";
import { KafkaAdminService } from "../services/KafkaAdminService.js";
import { KafkaOutputMonitor } from "../services/KafkaOutputMonitor.js";

console.log("🔌 Kafka Connection Test Starting...");
console.log(
  "📡 Broker configuration:",
  defaultKafkaConfig.connectionConfig.brokers
);

async function testKafkaConnection() {
  try {
    console.log("🚀 Kafka Flow Output Service Starting...");
    console.log(
      "📡 Connecting to Kafka broker:",
      defaultKafkaConfig.connectionConfig.brokers
    );

    // First, let's check what topics exist
    const adminService = new KafkaAdminService(defaultKafkaConfig);

    console.log("🔍 Checking available topics...");
    const allTopics = await adminService.getAllTopics();
    console.log(`📋 Found ${allTopics.length} total topics:`, allTopics);

    const flowTopics = await adminService.getFlowTopics();
    console.log(`🔄 Found ${flowTopics.length} flow topics:`, flowTopics);

    if (flowTopics.length === 0) {
      console.log("\n⚠️  No flow topics found to monitor!");
      console.log(
        "💡 Flow topics should follow the pattern: org-usr-node-topic"
      );
      console.log("   Examples:");
      console.log("   - myorg-myuser-mynode-topic");
      console.log("   - company-john-processor-topic");
      console.log("   - test-user-flow-topic");
      console.log(
        "\n🔄 Will continue monitoring and check for new topics periodically..."
      );
    }

    await adminService.disconnect();

    // Create output monitor
    const monitor = new KafkaOutputMonitor(defaultKafkaConfig, 1000);

    // Set up monitoring events
    monitor.on("flow-output", (output) => {
      console.log(`📥 Flow output from ${output.orgUsrNode}:`, {
        topic: output.topic,
        timestamp: output.timestamp,
        hasData: !!output.data,
        dataPreview:
          typeof output.data === "string"
            ? output.data.substring(0, 100) +
              (output.data.length > 100 ? "..." : "")
            : JSON.stringify(output.data).substring(0, 100) + "...",
      });
    });

    monitor.on("monitoring-started", ({ topics }) => {
      console.log(`✅ Monitoring ${topics.length} flow topics:`, topics);
    });

    monitor.on("monitoring-error", (error) => {
      console.error("❌ Monitoring error:", error);
    });

    monitor.on("monitor-connected", () => {
      console.log("🔗 Monitor consumer connected successfully");
    });

    // Start monitoring all flow topics
    console.log("🔍 Starting flow output monitoring...");
    await monitor.startMonitoring();

    // Show status periodically and check for new topics
    const statusInterval = setInterval(async () => {
      const status = monitor.getMonitoringStatus();
      console.log(
        `📊 Status: ${status.totalOutputs} outputs from ${status.topicCount} topics`
      );

      // Periodically check for new flow topics
      if (status.topicCount === 0) {
        console.log("🔄 Checking for new flow topics...");
        try {
          const adminCheck = new KafkaAdminService(defaultKafkaConfig);
          const newFlowTopics = await adminCheck.getFlowTopics();
          if (newFlowTopics.length > 0) {
            console.log(
              `🆕 Found ${newFlowTopics.length} new flow topics! Restarting monitor...`
            );
            await monitor.stopMonitoring();
            await monitor.startMonitoring();
          }
          await adminCheck.disconnect();
        } catch (error) {
          console.error("Error checking for new topics:", error);
        }
      }
    }, 30000);

    console.log("\n🎯 Service is running and monitoring for flow outputs!");
    console.log("📝 To test the service:");
    console.log(
      "   1. Create a topic ending with '-topic' (e.g., test-user-flow-topic)"
    );
    console.log("   2. Send messages to that topic");
    console.log("   3. Watch for outputs in this console");
    console.log("\n💡 Press Ctrl+C to stop");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down...");
      clearInterval(statusInterval);
      await monitor.disconnect();
      console.log("👋 Shutdown complete");
      process.exit(0);
    });

    // Keep the process alive
    process.on("SIGTERM", async () => {
      console.log("\n🛑 Received SIGTERM, shutting down...");
      clearInterval(statusInterval);
      await monitor.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Error in main:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string" &&
      (error as { message: string }).message.includes("ECONNREFUSED")
    ) {
      console.log("\n🔧 Connection troubleshooting:");
      console.log("   1. Check if Kafka broker is running");
      console.log(
        "   2. Verify broker address:",
        defaultKafkaConfig.connectionConfig.brokers
      );
      console.log("   3. Ensure port 9092 is accessible");
      console.log("   4. Try running: npm run debug");
    }

    process.exit(1);
  }
}

testKafkaConnection();
