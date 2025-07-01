import { KafkaOutputMonitor } from "../services/KafkaOutputMonitor.js";
import { defaultKafkaConfig } from "../config/kafkaConfig.js";

async function monitorFlowOutputs() {
  const monitor = new KafkaOutputMonitor(defaultKafkaConfig, 1000);

  try {
    console.log("🚀 Starting dedicated flow output monitor...");

    // Set up event listeners
    monitor.on("flow-output", (output) => {
      console.log(`\n📥 NEW FLOW OUTPUT`);
      console.log(`   From: ${output.orgUsrNode}`);
      console.log(`   Topic: ${output.topic}`);
      console.log(`   Time: ${output.timestamp}`);
      console.log(`   Key: ${output.messageKey || "none"}`);
      console.log(`   Data:`, JSON.stringify(output.data, null, 2));
      console.log(
        `   Partition: ${output.partition}, Offset: ${output.offset}`
      );
    });

    monitor.on("monitoring-started", ({ topics }) => {
      console.log(`✅ Monitoring started for ${topics.length} topics:`, topics);
      if (topics.length === 0) {
        console.log(
          "💡 No flow topics found. Create topics ending with '-topic' to see outputs."
        );
      }
    });

    monitor.on("monitor-connected", () => {
      console.log("🔗 Monitor consumer connected");
    });

    monitor.on("monitoring-error", (error) => {
      console.error("❌ Monitoring error:", error);
    });

    // Start monitoring
    await monitor.startMonitoring();

    // Show periodic status
    setInterval(() => {
      const status = monitor.getMonitoringStatus();
      const stats = monitor.getTopicStatistics();

      console.log(`\n📊 MONITOR STATUS:`);
      console.log(`   Total outputs received: ${status.totalOutputs}`);
      console.log(`   Active topics: ${status.topicCount}`);

      if (stats.length > 0) {
        console.log(`   Topic statistics:`);
        stats.forEach((stat) => {
          console.log(`     ${stat.topic}: ${stat.messageCount} messages`);
        });
      }
    }, 60000); // Every minute

    console.log("\n🎯 Monitor is running!");
    console.log(
      "💡 Send messages to topics ending with '-topic' to see outputs here."
    );
    console.log("🛑 Press Ctrl+C to stop");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down monitor...");
      await monitor.disconnect();
      console.log("👋 Monitor stopped");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Error starting monitor:", error);
    process.exit(1);
  }
}

monitorFlowOutputs();
