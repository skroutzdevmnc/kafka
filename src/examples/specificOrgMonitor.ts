import { KafkaOutputMonitor } from "../services/KafkaOutputMonitor.js";
import { createKafkaConfig } from "../config/kafkaConfig.js";

/**
 * Example: Monitor outputs for a specific org-usr-node
 * This is useful when you know exactly which flow you want to monitor
 */
async function monitorSpecificOrg() {
  console.log("🎯 Starting Specific Org Monitor Example");

  // The org-usr-node you want to monitor (update this)
  const targetOrgUsrNode = "mycompany-john-workflow-node1";

  const config = createKafkaConfig(
    ["192.168.100.164:9092"],
    "specific-org-monitor",
    "specific-org-monitor-group"
  );

  const monitor = new KafkaOutputMonitor(config, 100);

  // Listen specifically for this org-usr-node
  monitor.on(`output:${targetOrgUsrNode}`, (output) => {
    console.log(`\n🎉 Output from ${targetOrgUsrNode}:`);
    console.log(`   Timestamp: ${output.timestamp}`);
    console.log(`   Topic: ${output.topic}`);
    console.log(`   Data:`, JSON.stringify(output.data, null, 2));

    // You can process the specific output here
    processFlowOutput(output);
  });

  monitor.on("monitoring-started", ({ topics }) => {
    console.log(`\n✅ Started monitoring for: ${targetOrgUsrNode}`);
    console.log(`Found topics: ${topics}`);
  });

  try {
    // Monitor only the specific org-usr-node
    await monitor.startMonitoring(targetOrgUsrNode);

    console.log(`\n🔍 Monitoring outputs for: ${targetOrgUsrNode}`);
    console.log("💡 Process files through NiFi to see outputs here!");

    // Keep running
    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping specific monitor...");

      // Show what we collected
      const outputs = monitor.getOutputsForOrgUsrNode(targetOrgUsrNode);
      console.log(
        `\n📊 Collected ${outputs.length} outputs from ${targetOrgUsrNode}`
      );

      await monitor.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start specific monitoring:", error);
    await monitor.disconnect();
    process.exit(1);
  }
}

function processFlowOutput(output: any) {
  // Example processing logic
  console.log("🔄 Processing flow output...");

  if (output.data && output.data.status === "completed") {
    console.log("✅ Flow completed successfully!");
  } else if (output.data && output.data.status === "error") {
    console.log("❌ Flow completed with errors:", output.data.error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  monitorSpecificOrg();
}

export { monitorSpecificOrg };
