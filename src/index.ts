import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { KafkaOutputMonitor } from './services/KafkaOutputMonitor.js';
import { KafkaWebSocketServer } from './websocket/WebSocketServer.js';
import { WebSocketMessageHandler } from './websocket/MessageHandler.js';
import { defaultKafkaConfig } from './config/kafkaConfig.js';

const HTTP_PORT = 3000;
const WS_PORT = 8080;

// Simple HTTP server for static files (React build)
const server = createServer((req, res) => {
  const filePath = req.url === '/' ? '/index.html' : req.url;
  
  try {
    let contentType = 'text/html';
    if (filePath?.endsWith('.css')) contentType = 'text/css';
    if (filePath?.endsWith('.js')) contentType = 'application/javascript';
    if (filePath?.endsWith('.jsx')) contentType = 'application/javascript';
    
    const content = readFileSync(join(process.cwd(), 'static', filePath!));
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    // Fallback to index.html for SPA routing
    try {
      const content = readFileSync(join(process.cwd(), 'static', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
});

// Initialize services
const monitor = new KafkaOutputMonitor(defaultKafkaConfig);
const wsServer = new KafkaWebSocketServer(WS_PORT);
const messageHandler = new WebSocketMessageHandler(monitor, wsServer);

// Start HTTP server
server.listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP Server: http://localhost:${HTTP_PORT}`);
  console.log(`🔌 WebSocket Server: ws://localhost:${WS_PORT}`);
  console.log(`📱 React Dev Server: http://localhost:3001 (run 'npm run client')`);
});

// Start monitoring
monitor.startMonitoring().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await monitor.disconnect();
  wsServer.close();
  server.close();
  process.exit(0);
});