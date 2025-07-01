console.log("🧪 Basic test starting...");
console.log("📅 Current time:", new Date().toISOString());
console.log("🔧 Node version:", process.version);
console.log("📁 Current directory:", process.cwd());
console.log("📋 Command line args:", process.argv);

// Test basic functionality
try {
  console.log("✅ Console.log is working");

  // Test async functionality
  setTimeout(() => {
    console.log("⏰ Timeout test - this should appear after 1 second");
  }, 1000);

  // Test promise
  Promise.resolve().then(() => {
    console.log("🔄 Promise test - this should appear immediately");
  });

  console.log(
    "🎯 Basic test completed - if you see this, console output is working"
  );
} catch (error) {
  console.error("❌ Error in basic test:", error);
}

// Keep process alive for a few seconds to see async outputs
setTimeout(() => {
  console.log("🏁 Basic test finished - exiting");
  process.exit(0);
}, 3000);
