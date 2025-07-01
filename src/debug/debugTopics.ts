import { KafkaAdminService } from "../services/KafkaAdminService.js";
import { defaultKafkaConfig } from "../config/kafkaConfig.js";

async function debugTopics() {
  const adminService = new KafkaAdminService(defaultKafkaConfig);

  try {
    console.log("🔍 Debugging Kafka topics...");
    console.log(
      "📡 Kafka broker:",
      defaultKafkaConfig.connectionConfig.brokers
    );

    // Get all topics
    console.log("\n📋 Fetching all topics...");
    const allTopics = await adminService.getAllTopics();
    console.log(`Found ${allTopics.length} total topics:`);
    allTopics.forEach((topic, index) => {
      console.log(`  ${index + 1}. ${topic}`);
    });

    // Get flow topics specifically
    console.log("\n🔄 Fetching flow topics (ending with '-topic')...");
    const flowTopics = await adminService.getFlowTopics();
    console.log(`Found ${flowTopics.length} flow topics:`);
    flowTopics.forEach((topic, index) => {
      console.log(`  ${index + 1}. ${topic}`);
    });

    if (flowTopics.length === 0) {
      console.log("\n⚠️  No flow topics found!");
      console.log(
        "💡 Flow topics should follow the pattern: org-usr-node-topic"
      );
      console.log("   Examples:");
      console.log("   - myorg-myuser-mynode-topic");
      console.log("   - company-john-processor-topic");
      console.log("   - test-user-flow-topic");
    }

    // Get metadata for flow topics if they exist
    if (flowTopics.length > 0) {
      console.log("\n📊 Getting topic metadata...");
      const metadata = await adminService.getTopicMetadata(flowTopics);
      console.log("Topic metadata:", JSON.stringify(metadata, null, 2));
    }
  } catch (error) {
    console.error("❌ Error debugging topics:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string" &&
      (error as { message: string }).message.includes("ECONNREFUSED")
    ) {
      console.log("\n🔧 Connection refused - check if:");
      console.log("   1. Kafka broker is running");
      console.log(
        "   2. Broker address is correct:",
        defaultKafkaConfig.connectionConfig.brokers
      );
      console.log("   3. Port 9092 is accessible");
    }
  } finally {
    await adminService.disconnect();
    console.log("\n✅ Debug complete");
  }
}

debugTopics();
