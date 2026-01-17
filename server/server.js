/**
 * SuperDash WebSocket Server
 *
 * Real-time playout device state aggregator for broadcast monitoring.
 * Connects to HyperDeck (TCP), vMix (HTTP XML), and CasparCG (OSC) devices
 * and broadcasts normalised state to dashboard clients via WebSocket.
 *
 * Design principles:
 * - Fail fast: Configuration errors terminate process immediately
 * - Monotonic timing: Uses performance.now() to avoid NTP drift
 * - Drift-free scheduling: setTimeout recursion with absolute time reference
 * - Graceful client handling: Socket errors don't crash server
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');

const HyperDeckClient = require('./hyperdeck-client');
const VMixClient = require('./vmix-client');
const CasparCGClient = require('./osc-casparcg');
const EmberPlusProvider = require('./emberplus-provider');
const TslUmdSender = require('./tsl-umd-sender');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// -----------------------------------------------------------------------------
// Configuration Loading (Fail Fast)
// -----------------------------------------------------------------------------

let config;
try {
  const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  if (!rawConfig.settings || typeof rawConfig.settings !== 'object') {
    throw new Error('Missing or invalid "settings" object in config.json');
  }
  if (!Array.isArray(rawConfig.servers)) {
    throw new Error('Missing or invalid "servers" array in config.json');
  }

  config = rawConfig;
  console.log(`[config] Loaded ${config.servers.length} playout servers`);
  console.log(`[config] Update interval: ${config.settings.updateIntervalMs}ms`);
  console.log(`[config] Default framerate: ${config.settings.defaultFramerate} fps`);
} catch (error) {
  console.error('[config] FATAL: Failed to load config.json');
  console.error('[config]', error.message);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Timecode Utilities
// -----------------------------------------------------------------------------

/**
 * Determines if a framerate requires drop-frame timecode.
 * Only 29.97 and 59.94 fps use drop-frame in broadcast.
 *
 * @param {number} fps - Framerate
 * @returns {boolean} - True if drop-frame required
 */
function requiresDropFrame(fps) {
  // 29.97 and 59.94 are the only standard drop-frame rates
  return Math.abs(fps - 29.97) < 0.01 || Math.abs(fps - 59.94) < 0.01;
}

/**
 * Converts frame count to timecode string.
 * Handles both drop-frame (29.97, 59.94) and non-drop-frame rates.
 *
 * @param {number} totalFrames - Total frame count
 * @param {number} fps - Framerate (default: 50)
 * @returns {string} - Timecode in HH:MM:SS:FF or HH:MM:SS;FF (drop-frame) format
 */
function framesToTimecode(totalFrames, fps = 50) {
  const isDropFrame = requiresDropFrame(fps);

  if (isDropFrame) {
    // Drop-frame calculation for 29.97 / 59.94 fps
    // Drop 2 frames (or 4 for 59.94) at the start of each minute, except every 10th minute
    const dropFrames = fps > 30 ? 4 : 2;
    const framesPerMinute = Math.round(fps * 60) - dropFrames;
    const framesPer10Minutes = Math.round(fps * 60 * 10) - dropFrames * 9;
    const roundedFps = Math.round(fps);

    const tenMinuteBlocks = Math.floor(totalFrames / framesPer10Minutes);
    let remainingFrames = totalFrames % framesPer10Minutes;

    let minutes = tenMinuteBlocks * 10;
    if (remainingFrames >= roundedFps * 60) {
      remainingFrames -= roundedFps * 60;
      minutes += 1;
      minutes += Math.floor(remainingFrames / framesPerMinute);
      remainingFrames = remainingFrames % framesPerMinute;
    }

    const hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
    const seconds = Math.floor(remainingFrames / roundedFps);
    const frames = remainingFrames % roundedFps;

    // Drop-frame uses semicolon separator
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)};${pad2(frames)}`;
  } else {
    // Non-drop-frame calculation (25, 50, 24, 30, 60 fps)
    const roundedFps = Math.round(fps);
    const frames = totalFrames % roundedFps;
    const totalSeconds = Math.floor(totalFrames / roundedFps);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}:${pad2(frames)}`;
  }
}

/**
 * Pads a number to 2 digits with leading zero.
 * @param {number} n - Number to pad
 * @returns {string} - Zero-padded string
 */
function pad2(n) {
  return n.toString().padStart(2, '0');
}

// -----------------------------------------------------------------------------
// Device State Management
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} DeviceState
 * @property {number} id - Device ID from config
 * @property {string} name - Device display name
 * @property {string} type - Device type (hyperdeck, vmix, casparcg)
 * @property {string} ip - Device IP address
 * @property {number} port - Device port
 * @property {'play'|'rec'|'stop'|'offline'} state - Current playback state
 * @property {string} timecode - Current timecode (HH:MM:SS:FF)
 * @property {string} filename - Current clip filename
 * @property {number} framerate - Device framerate
 * @property {number} updated - Monotonic timestamp (performance.timeOrigin + performance.now())
 * @property {boolean} connected - Whether device is reachable
 */

/** @type {Map<number, DeviceState>} */
const deviceStates = new Map();

/** @type {Map<number, HyperDeckClient|VMixClient|CasparCGClient>} */
const deviceClients = new Map();

/** @type {EmberPlusProvider|null} */
let emberProvider = null;

/** @type {TslUmdSender|null} */
let tslSender = null;

// Initialise device states from config
for (const server of config.servers) {
  const framerate = server.framerate || config.settings.defaultFramerate;
  const port = server.port || config.settings.defaultPorts[server.type];

  deviceStates.set(server.id, {
    id: server.id,
    name: server.name,
    type: server.type,
    ip: server.ip,
    port: port,
    state: 'offline',
    timecode: '00:00:00:00',
    filename: '',
    framerate: framerate,
    updated: performance.timeOrigin + performance.now(),
    connected: false
  });
}

// -----------------------------------------------------------------------------
// Protocol Client Initialisation
// -----------------------------------------------------------------------------

/**
 * Initialises protocol clients for all configured devices.
 * Each client emits 'state' events when device state changes.
 */
function initialiseClients() {
  for (const server of config.servers) {
    const state = deviceStates.get(server.id);

    let client;
    switch (server.type) {
      case 'hyperdeck':
        client = new HyperDeckClient({
          id: server.id,
          ip: server.ip,
          port: state.port,
          framerate: state.framerate
        });
        break;

      case 'vmix':
        client = new VMixClient({
          id: server.id,
          ip: server.ip,
          port: state.port,
          framerate: state.framerate
        });
        break;

      case 'casparcg':
        client = new CasparCGClient({
          id: server.id,
          ip: server.ip,
          port: state.port,
          framerate: state.framerate
        });
        break;

      default:
        console.warn(`[server] Unknown device type: ${server.type} for device ${server.id}`);
        continue;
    }

    // Handle state updates from client
    client.on('state', (newState) => {
      const current = deviceStates.get(server.id);
      deviceStates.set(server.id, {
        ...current,
        state: newState.state,
        timecode: newState.timecode,
        filename: newState.filename,
        updated: performance.timeOrigin + performance.now(),
        connected: true
      });

      // Push to Ember+ consumers
      if (emberProvider) {
        emberProvider.updateDevice(server.id, {
          state: newState.state,
          timecode: newState.timecode,
          filename: newState.filename,
          connected: true
        });
      }

      // Push to TSL UMD displays
      if (tslSender) {
        tslSender.updateDevice(server.id, {
          name: server.name,
          state: newState.state
        });
      }
    });

    // Handle connection status
    client.on('connected', () => {
      console.log(`[${server.type}] Connected to ${server.name} (${server.ip})`);
      const current = deviceStates.get(server.id);
      deviceStates.set(server.id, {
        ...current,
        connected: true,
        updated: performance.timeOrigin + performance.now()
      });

      // Push connection status to Ember+ consumers
      if (emberProvider) {
        emberProvider.updateDevice(server.id, { connected: true });
      }
    });

    client.on('disconnected', () => {
      console.log(`[${server.type}] Disconnected from ${server.name} (${server.ip})`);
      const current = deviceStates.get(server.id);
      deviceStates.set(server.id, {
        ...current,
        state: 'offline',
        connected: false,
        updated: performance.timeOrigin + performance.now()
      });

      // Push offline state to Ember+ consumers
      if (emberProvider) {
        emberProvider.updateDevice(server.id, {
          state: 'offline',
          connected: false
        });
      }

      // Push offline state to TSL UMD displays
      if (tslSender) {
        tslSender.updateDevice(server.id, {
          name: server.name,
          state: 'offline'
        });
      }
    });

    client.on('error', (error) => {
      console.error(`[${server.type}] Error on ${server.name}: ${error.message}`);
    });

    deviceClients.set(server.id, client);

    // Start the client
    client.connect();
  }
}

// -----------------------------------------------------------------------------
// HTTP Server with Express
// -----------------------------------------------------------------------------

const app = express();
const httpServer = http.createServer(app);

// Serve static files from public directory
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health endpoint for monitoring
app.get('/health', (req, res) => {
  const devices = Array.from(deviceStates.values()).map(d => ({
    id: d.id,
    name: d.name,
    type: d.type,
    connected: d.connected,
    state: d.state
  }));

  const connectedDevices = devices.filter(d => d.connected).length;

  res.json({
    status: connectedDevices > 0 ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: require('../package.json').version,
    devices: {
      total: devices.length,
      connected: connectedDevices,
      list: devices
    },
    protocols: {
      websocket: {
        clients: connectedClients.size
      },
      emberPlus: {
        enabled: emberProvider !== null,
        running: emberProvider?.isRunning || false,
        port: config.settings.emberPlusPort || 9000
      },
      tslUmd: {
        enabled: tslSender !== null,
        running: tslSender?.isRunning || false,
        destinations: config.settings.tslUmdDestinations?.length || 0
      }
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  });
});

// -----------------------------------------------------------------------------
// WebSocket Server
// -----------------------------------------------------------------------------

const wss = new WebSocket.Server({ server: httpServer });

/** @type {Set<WebSocket>} */
const connectedClients = new Set();

wss.on('connection', (socket, request) => {
  const origin = request.headers.origin || 'unknown';
  console.log(`[ws] Client connected from ${origin}`);

  connectedClients.add(socket);

  // Handle incoming messages (for future config updates from control panel)
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(socket, message);
    } catch (error) {
      console.error('[ws] Failed to parse client message:', error.message);
    }
  });

  socket.on('close', () => {
    console.log('[ws] Client disconnected');
    connectedClients.delete(socket);
  });

  socket.on('error', (error) => {
    console.error('[ws] Socket error:', error.message);
    connectedClients.delete(socket);
  });

  // Send current state immediately on connect
  sendStateToClient(socket);
});

/**
 * Handles incoming messages from WebSocket clients.
 * Used for configuration updates and device control.
 *
 * @param {WebSocket} socket - Client socket
 * @param {Object} message - Parsed message object
 */
function handleClientMessage(socket, message) {
  switch (message.type) {
    case 'getConfig':
      socket.send(JSON.stringify({
        type: 'config',
        data: {
          settings: config.settings,
          servers: config.servers
        }
      }));
      break;

    case 'updateSettings':
      // Future: Handle settings updates from control panel
      console.log('[ws] Settings update requested (not yet implemented)');
      break;

    default:
      console.log(`[ws] Unknown message type: ${message.type}`);
  }
}

/**
 * Gets current protocol status for dashboard display.
 * @returns {Object} Protocol status object
 */
function getProtocolStatus() {
  return {
    emberPlus: {
      enabled: emberProvider !== null,
      running: emberProvider?.isRunning || false,
      port: config.settings.emberPlusPort || 9000
    },
    tslUmd: {
      enabled: tslSender !== null,
      running: tslSender?.isRunning || false,
      destinations: tslSender?.destinations?.length || 0,
      deviceCount: tslSender?.deviceCount || 0
    }
  };
}

/**
 * Sends current device states to a single client.
 * @param {WebSocket} socket - Target socket
 */
function sendStateToClient(socket) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    const states = Array.from(deviceStates.values());
    socket.send(JSON.stringify({
      type: 'playoutStates',
      timestamp: performance.timeOrigin + performance.now(),
      data: states,
      protocols: getProtocolStatus()
    }));
  } catch (error) {
    console.error('[ws] Failed to send state to client:', error.message);
  }
}

/**
 * Broadcasts current device states to all connected clients.
 */
function broadcastState() {
  const states = Array.from(deviceStates.values());
  const message = JSON.stringify({
    type: 'playoutStates',
    timestamp: performance.timeOrigin + performance.now(),
    data: states,
    protocols: getProtocolStatus()
  });

  for (const socket of connectedClients) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(message);
      } catch (error) {
        console.error('[ws] Failed to broadcast to client:', error.message);
        connectedClients.delete(socket);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Drift-Free Update Loop
// -----------------------------------------------------------------------------

const UPDATE_INTERVAL_MS = config.settings.updateIntervalMs;
const startTime = performance.now();

/**
 * Schedules the next state broadcast using absolute time reference.
 * This prevents timing drift that accumulates with setInterval.
 */
function scheduleNextUpdate() {
  const elapsed = performance.now() - startTime;
  const nextUpdate = Math.ceil(elapsed / UPDATE_INTERVAL_MS) * UPDATE_INTERVAL_MS;
  const delay = Math.max(0, nextUpdate - elapsed);

  setTimeout(() => {
    broadcastState();
    scheduleNextUpdate();
  }, delay);
}

// -----------------------------------------------------------------------------
// Startup
// -----------------------------------------------------------------------------

const PORT = config.settings.webSocketPort;

httpServer.listen(PORT, async () => {
  console.log(`[server] SuperDash running on http://localhost:${PORT}`);
  console.log(`[server] Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`[server] Health:    http://localhost:${PORT}/health`);
  console.log(`[server] WebSocket: ws://localhost:${PORT}`);
  console.log(`[server] Monitoring ${config.servers.length} devices`);

  // Initialise protocol clients
  initialiseClients();

  // Start Ember+ provider for broadcast control system integration
  const emberPort = config.settings.emberPlusPort || 9000;
  emberProvider = new EmberPlusProvider({ port: emberPort });

  try {
    // Build device list for Ember+ tree
    const devices = config.servers.map(server => ({
      id: server.id,
      name: server.name,
      type: server.type
    }));

    await emberProvider.start(devices);
  } catch (error) {
    console.error(`[ember+] Failed to start provider: ${error.message}`);
    console.error('[ember+] Continuing without Ember+ support');
    emberProvider = null;
  }

  // Start TSL UMD sender for tally display integration
  const tslDestinations = config.settings.tslUmdDestinations || [];
  if (tslDestinations.length > 0) {
    tslSender = new TslUmdSender({
      destinations: tslDestinations,
      screen: config.settings.tslUmdScreen || 0
    });

    tslSender.start();

    // Register initial device states
    for (const server of config.servers) {
      tslSender.updateDevice(server.id, {
        name: server.name,
        state: 'offline'
      });
    }
  } else {
    console.log('[tsl-umd] No destinations configured, skipping TSL UMD sender');
  }

  // Start the broadcast loop
  scheduleNextUpdate();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[server] Shutting down...');

  // Stop Ember+ provider
  if (emberProvider) {
    emberProvider.stop();
  }

  // Stop TSL UMD sender
  if (tslSender) {
    tslSender.stop();
  }

  // Close all device clients
  for (const client of deviceClients.values()) {
    if (typeof client.disconnect === 'function') {
      client.disconnect();
    }
  }

  // Close WebSocket server
  wss.close(() => {
    console.log('[ws] WebSocket server closed');
    process.exit(0);
  });
});
