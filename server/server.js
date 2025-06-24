// server/server.js

const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Load config.json once at startup
let config = [];
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).servers || [];
  console.log(`[config] Loaded ${config.length} playout servers`);
} catch (e) {
  console.warn('[config] Failed to load config.json – using fallback');
  config = [];
}

// WebSocket server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', socket => {
  console.log('[ws] Client connected');

  // Send initial mock data for each configured server
  const sendMockState = () => {
    const states = config.map((server, i) => ({
      id: i,
      name: server.name || `Device ${i + 1}`,
      type: server.type,
      ip: server.ip,
      state: ['play', 'rec', 'stop'][Math.floor(Math.random() * 3)],
      timecode: `00:0${i}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`,
      filename: `clip_${i + 1}.mov`,
      updated: Date.now()
    }));

    socket.send(JSON.stringify({ type: 'playoutStates', data: states }));
  };

  // Start sending every 1000 ms
  const interval = setInterval(sendMockState, 1000);

  socket.on('close', () => {
    console.log('[ws] Client disconnected');
    clearInterval(interval);
  });
});

server.listen(3050, () => {
  console.log('[ws] WebSocket server running on ws://localhost:3050');
});
