import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { KafkaOutputMonitor } from './services/KafkaOutputMonitor.js';
import { defaultKafkaConfig } from './config/kafkaConfig.js';

const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

// Create HTTP server for serving the frontend
const server = createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  try {
    let contentType = 'text/html';
    if (filePath?.endsWith('.css')) contentType = 'text/css';
    if (filePath?.endsWith('.js')) contentType = 'application/javascript';
    
    const content = readFileSync(join(process.cwd(), 'public', filePath!));
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });

// Initialize Kafka monitor
const monitor = new KafkaOutputMonitor(defaultKafkaConfig);

// Store connected clients
const clients = new Set<any>();

wss.on('connection', (ws) => {
  console.log('🔗 Client connected to WebSocket');
  clients.add(ws);

  // Send initial status
  ws.send(JSON.stringify({
    type: 'status',
    data: monitor.getMonitoringStatus()
  }));

  // Send current topic statistics
  ws.send(JSON.stringify({
    type: 'topic-stats',
    data: monitor.getTopicStatistics()
  }));

  // Send recent outputs
  ws.send(JSON.stringify({
    type: 'recent-outputs',
    data: monitor.getLatestOutputs(20)
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'start-monitoring':
          await monitor.startMonitoring();
          break;
        case 'stop-monitoring':
          await monitor.stopMonitoring();
          break;
        case 'clear-outputs':
          monitor.clearOutputs();
          break;
        case 'get-status':
          ws.send(JSON.stringify({
            type: 'status',
            data: monitor.getMonitoringStatus()
          }));
          break;
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected from WebSocket');
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// Set up monitor event listeners
monitor.on('flow-output', (output) => {
  broadcast({
    type: 'new-output',
    data: output
  });
});

monitor.on('monitoring-started', (data) => {
  broadcast({
    type: 'monitoring-started',
    data
  });
});

monitor.on('monitoring-stopped', () => {
  broadcast({
    type: 'monitoring-stopped'
  });
});

monitor.on('monitor-connected', () => {
  broadcast({
    type: 'monitor-connected'
  });
});

monitor.on('monitor-error', (error) => {
  broadcast({
    type: 'error',
    data: { message: error.message }
  });
});

// Start servers
server.listen(PORT, () => {
  console.log(`🌐 HTTP Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server running on ws://localhost:${WS_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down servers...');
  await monitor.disconnect();
  server.close();
  wss.close();
  process.exit(0);
});

// Start monitoring automatically
monitor.startMonitoring().catch(console.error);