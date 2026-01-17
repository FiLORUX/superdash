/**
 * CasparCG OSC Client for SuperDash
 *
 * Receives OSC messages from CasparCG 2.x servers and emits normalised
 * playback state for the dashboard. This module supports two modes:
 *
 * 1. Standalone mode: Each client creates its own UDP listener (legacy)
 * 2. Shared listener mode: Multiple clients share a single UDP port,
 *    with messages demultiplexed by source IP address
 *
 * OSC Protocol Notes:
 * - CasparCG SENDS OSC packets TO this client (we listen, not connect)
 * - Messages arrive as OSC bundles containing multiple addresses
 * - Channel/layer info is encoded in the OSC address path
 * - Time is reported in seconds (float), frames, and fps separately
 *
 * @module osc-casparcg
 */

const EventEmitter = require('events');
const osc = require('osc');

/**
 * Default configuration values for CasparCG OSC client.
 * @constant {Object}
 */
const DEFAULTS = {
  port: 6250,
  framerate: 50,
  channel: 1,
  layer: 10,
  staleTimeoutMs: 5000
};

/**
 * Shared OSC listener manager.
 * Creates a single UDP port that can serve multiple CasparCG clients.
 * Messages are demultiplexed by source IP address.
 *
 * @type {Object}
 */
const SharedListener = {
  /** @type {osc.UDPPort|null} */
  udpPort: null,

  /** @type {number|null} */
  port: null,

  /** @type {Map<string, CasparCGClient>} Map of IP address to client */
  clients: new Map(),

  /** @type {boolean} Listener is fully operational */
  isRunning: false,

  /** @type {boolean} Listener is in the process of starting (prevents race condition) */
  isStarting: false,

  /**
   * Registers a client for the shared listener.
   * Creates the UDP port on first registration.
   *
   * @param {CasparCGClient} client - Client instance
   * @param {number} port - UDP port to listen on
   */
  register(client, port) {
    // If listener exists on different port, warn but continue
    if ((this.isRunning || this.isStarting) && this.port !== port) {
      console.warn(
        `[casparcg-shared] Client ${client.id} requested port ${port} but listener already on ${this.port}`
      );
    }

    // Register client by IP
    this.clients.set(client.ip, client);
    console.log(`[casparcg-shared] Registered client ${client.id} for IP ${client.ip}`);

    // Start listener if not running and not already starting
    if (!this.isRunning && !this.isStarting) {
      this._start(port);
    } else if (this.isRunning) {
      // Listener already ready, notify client immediately
      client._handleSharedListenerReady();
    }
    // If isStarting but not isRunning, the 'ready' callback will notify all clients
  },

  /**
   * Unregisters a client from the shared listener.
   * Stops the UDP port when no clients remain.
   *
   * @param {CasparCGClient} client - Client instance
   */
  unregister(client) {
    this.clients.delete(client.ip);
    console.log(`[casparcg-shared] Unregistered client ${client.id}`);

    // Stop listener if no clients remain
    if (this.clients.size === 0 && this.isRunning) {
      this._stop();
    }
  },

  /**
   * Starts the shared UDP listener.
   *
   * @param {number} port - UDP port to listen on
   * @private
   */
  _start(port) {
    console.log(`[casparcg-shared] Starting shared OSC listener on UDP port ${port}`);

    // Set isStarting immediately to prevent race condition with multiple clients
    this.isStarting = true;
    this.port = port;

    try {
      this.udpPort = new osc.UDPPort({
        localAddress: '0.0.0.0',
        localPort: port,
        metadata: true
      });

      this.udpPort.on('message', (oscMessage, timeTag, info) => {
        this._handleMessage(oscMessage, info);
      });

      this.udpPort.on('bundle', (oscBundle, timeTag, info) => {
        this._handleBundle(oscBundle, info);
      });

      this.udpPort.on('ready', () => {
        console.log(`[casparcg-shared] UDP port ${port} ready`);
        this.isRunning = true;
        this.isStarting = false;

        // Notify all registered clients
        for (const client of this.clients.values()) {
          client._handleSharedListenerReady();
        }
      });

      this.udpPort.on('error', (error) => {
        console.error(`[casparcg-shared] UDP error: ${error.message}`);
        this.isStarting = false;

        // Notify all clients of error
        for (const client of this.clients.values()) {
          client.emit('error', error);
        }
      });

      this.udpPort.open();
    } catch (error) {
      console.error(`[casparcg-shared] Failed to create UDP port: ${error.message}`);
      this.isRunning = false;
      this.isStarting = false;
    }
  },

  /**
   * Stops the shared UDP listener.
   *
   * @private
   */
  _stop() {
    console.log('[casparcg-shared] Stopping shared OSC listener');

    if (this.udpPort) {
      try {
        this.udpPort.close();
      } catch (error) {
        console.error(`[casparcg-shared] Error closing UDP port: ${error.message}`);
      }
      this.udpPort = null;
    }

    this.isRunning = false;
    this.isStarting = false;
    this.port = null;
  },

  /**
   * Handles incoming OSC message and routes to appropriate client.
   *
   * @param {Object} message - OSC message
   * @param {Object} info - Sender info with address property
   * @private
   */
  _handleMessage(message, info) {
    const sourceIp = info?.address;
    if (!sourceIp) return;

    const client = this.clients.get(sourceIp);
    if (client) {
      client._handleOscMessage(message, info);
    }
    // Ignore messages from unknown IPs
  },

  /**
   * Handles incoming OSC bundle and routes to appropriate client.
   *
   * @param {Object} bundle - OSC bundle
   * @param {Object} info - Sender info with address property
   * @private
   */
  _handleBundle(bundle, info) {
    const sourceIp = info?.address;
    if (!sourceIp) return;

    const client = this.clients.get(sourceIp);
    if (client) {
      client._handleOscBundle(bundle, info);
    }
    // Ignore bundles from unknown IPs
  }
};

/**
 * CasparCG OSC client that receives playback state via UDP.
 *
 * @extends EventEmitter
 * @fires CasparCGClient#state - When playback state changes
 * @fires CasparCGClient#connected - When first OSC message received
 * @fires CasparCGClient#disconnected - When state becomes stale (no updates)
 * @fires CasparCGClient#error - When an error occurs
 *
 * @example
 * const client = new CasparCGClient({
 *   id: 1,
 *   ip: '192.168.0.101',
 *   port: 6250,
 *   framerate: 50
 * });
 *
 * client.on('state', (state) => {
 *   console.log(state); // { state: 'play', timecode: '00:01:23:12', filename: 'clip.mov' }
 * });
 *
 * client.connect();
 */
class CasparCGClient extends EventEmitter {
  /**
   * Creates a new CasparCG OSC client.
   *
   * @param {Object} config - Client configuration
   * @param {number} config.id - Unique device identifier
   * @param {string} config.ip - CasparCG server IP (used for demultiplexing)
   * @param {number} [config.port=6250] - UDP port to listen on
   * @param {number} [config.framerate=50] - Default framerate for timecode
   * @param {number} [config.channel=1] - CasparCG channel to monitor
   * @param {number} [config.layer=10] - CasparCG layer to monitor
   * @param {number} [config.staleTimeoutMs=5000] - Time before marking state stale
   * @param {boolean} [config.useSharedListener=true] - Use shared UDP listener
   */
  constructor(config) {
    super();

    if (typeof config.id !== 'number') {
      throw new Error('[casparcg] Configuration error: id must be a number');
    }
    if (typeof config.ip !== 'string' || !config.ip) {
      throw new Error('[casparcg] Configuration error: ip must be a non-empty string');
    }

    /** @type {number} Device identifier */
    this.id = config.id;

    /** @type {string} CasparCG server IP (for demultiplexing) */
    this.ip = config.ip;

    /** @type {number} UDP port to listen on */
    this.port = config.port || DEFAULTS.port;

    /** @type {number} Default framerate for timecode conversion */
    this.framerate = config.framerate || DEFAULTS.framerate;

    /** @type {number} CasparCG channel to monitor */
    this.channel = config.channel || DEFAULTS.channel;

    /** @type {number} CasparCG layer to monitor */
    this.layer = config.layer || DEFAULTS.layer;

    /** @type {number} Milliseconds before state is considered stale */
    this.staleTimeoutMs = config.staleTimeoutMs || DEFAULTS.staleTimeoutMs;

    /** @type {boolean} Whether to use shared UDP listener */
    this.useSharedListener = config.useSharedListener !== false;

    /** @type {osc.UDPPort|null} Own UDP port (only used in standalone mode) */
    this._udpPort = null;

    /** @type {boolean} Whether we've received any OSC messages */
    this._hasReceivedData = false;

    /** @type {boolean} Current connection status */
    this._isConnected = false;

    /** @type {NodeJS.Timeout|null} Stale check timer */
    this._staleTimer = null;

    /** @type {number} Timestamp of last received OSC message */
    this._lastUpdateTime = 0;

    /**
     * Cached state from OSC messages.
     * OSC only sends on change, so we must maintain state.
     * @type {Object}
     */
    this._stateCache = {
      filePath: '',
      fileName: '',
      timeSeconds: 0,
      frame: 0,
      fps: this.framerate,
      paused: true,
      foregroundFile: ''
    };

    /**
     * Last emitted state, used to detect changes.
     * @type {string|null}
     */
    this._lastEmittedState = null;

    // Build the OSC address patterns we're interested in
    this._buildAddressPatterns();
  }

  /**
   * Builds the OSC address patterns for the configured channel/layer.
   * @private
   */
  _buildAddressPatterns() {
    const base = `/channel/${this.channel}/stage/layer/${this.layer}`;

    /** @type {Object} OSC address patterns to match */
    this._patterns = {
      filePath: `${base}/file/path`,
      fileTime: `${base}/file/time`,
      fileFrame: `${base}/file/frame`,
      fileFps: `${base}/file/fps`,
      paused: `${base}/paused`,
      foregroundFile: `${base}/foreground/file/name`
    };

    console.log(`[casparcg] Device ${this.id}: Monitoring channel ${this.channel}, layer ${this.layer}`);
  }

  /**
   * Starts listening for OSC messages.
   * Uses shared listener by default for multiple CasparCG clients.
   */
  connect() {
    if (this.useSharedListener) {
      console.log(`[casparcg] Device ${this.id}: Using shared OSC listener for ${this.ip}`);
      SharedListener.register(this, this.port);
    } else {
      this._startStandaloneListener();
    }
  }

  /**
   * Starts a standalone UDP listener (legacy mode).
   * @private
   */
  _startStandaloneListener() {
    if (this._udpPort) {
      console.warn(`[casparcg] Device ${this.id}: Already listening, ignoring connect call`);
      return;
    }

    console.log(`[casparcg] Device ${this.id}: Starting standalone OSC listener on UDP port ${this.port}`);

    try {
      this._udpPort = new osc.UDPPort({
        localAddress: '0.0.0.0',
        localPort: this.port,
        metadata: true
      });

      this._udpPort.on('message', (oscMessage, timeTag, info) => {
        this._handleOscMessage(oscMessage, info);
      });

      this._udpPort.on('bundle', (oscBundle, timeTag, info) => {
        this._handleOscBundle(oscBundle, info);
      });

      this._udpPort.on('ready', () => {
        console.log(`[casparcg] Device ${this.id}: UDP port ${this.port} ready, awaiting OSC data from ${this.ip}`);
        this._startStaleChecker();
      });

      this._udpPort.on('error', (error) => {
        console.error(`[casparcg] Device ${this.id}: UDP error: ${error.message}`);
        this.emit('error', error);
      });

      this._udpPort.open();
    } catch (error) {
      console.error(`[casparcg] Device ${this.id}: Failed to create UDP port: ${error.message}`);
      this.emit('error', error);
    }
  }

  /**
   * Called when the shared listener is ready.
   * Starts the stale checker timer.
   * @private
   */
  _handleSharedListenerReady() {
    console.log(`[casparcg] Device ${this.id}: Shared listener ready, awaiting OSC data from ${this.ip}`);
    this._startStaleChecker();
  }

  /**
   * Stops listening for OSC messages and cleans up resources.
   */
  disconnect() {
    console.log(`[casparcg] Device ${this.id}: Stopping OSC listener`);

    if (this._staleTimer) {
      clearInterval(this._staleTimer);
      this._staleTimer = null;
    }

    if (this.useSharedListener) {
      SharedListener.unregister(this);
    } else if (this._udpPort) {
      try {
        this._udpPort.close();
      } catch (error) {
        console.error(`[casparcg] Device ${this.id}: Error closing UDP port: ${error.message}`);
      }
      this._udpPort = null;
    }

    if (this._isConnected) {
      this._isConnected = false;
      this.emit('disconnected');
    }

    this._hasReceivedData = false;
  }

  /**
   * Handles an OSC bundle containing multiple messages.
   * CasparCG typically sends state updates as bundles.
   *
   * @param {Object} bundle - OSC bundle object
   * @param {Object} info - Sender information (address, port)
   */
  _handleOscBundle(bundle, info) {
    if (!bundle.packets || !Array.isArray(bundle.packets)) {
      console.warn(`[casparcg] Device ${this.id}: Received malformed bundle`);
      return;
    }

    // Process each message in the bundle
    for (const packet of bundle.packets) {
      if (packet.address) {
        // It's a message
        this._handleOscMessage(packet, info);
      } else if (packet.packets) {
        // Nested bundle (rare but possible)
        this._handleOscBundle(packet, info);
      }
    }

    // After processing the bundle, emit state if changed
    this._emitStateIfChanged();
  }

  /**
   * Handles a single OSC message.
   *
   * @param {Object} message - OSC message with address and args
   * @param {Object} info - Sender information
   */
  _handleOscMessage(message, info) {
    const { address, args } = message;

    if (!address || !args || args.length === 0) {
      return; // Ignore malformed messages
    }

    // Mark that we've received data
    if (!this._hasReceivedData) {
      this._hasReceivedData = true;
      this._isConnected = true;
      console.log(`[casparcg] Device ${this.id}: First OSC message received from ${info?.address || 'unknown'}`);
      this.emit('connected');
    }

    this._lastUpdateTime = Date.now();

    // Extract the value (osc package with metadata wraps values)
    const value = this._extractValue(args[0]);

    // Route the message to the appropriate handler
    if (address === this._patterns.filePath) {
      this._stateCache.filePath = String(value);
    } else if (address === this._patterns.fileTime) {
      this._stateCache.timeSeconds = Number(value) || 0;
    } else if (address === this._patterns.fileFrame) {
      this._stateCache.frame = Math.floor(Number(value)) || 0;
    } else if (address === this._patterns.fileFps) {
      const fps = Number(value);
      if (fps > 0 && fps < 120) {
        this._stateCache.fps = fps;
      }
    } else if (address === this._patterns.paused) {
      // CasparCG sends 1 for paused, 0 for playing
      this._stateCache.paused = Number(value) === 1;
    } else if (address === this._patterns.foregroundFile) {
      this._stateCache.foregroundFile = String(value);
    }
    // Ignore addresses we don't care about
  }

  /**
   * Extracts the actual value from an OSC argument.
   * The osc package with metadata enabled wraps values in objects.
   *
   * @param {*} arg - OSC argument (may be wrapped)
   * @returns {*} - Unwrapped value
   * @private
   */
  _extractValue(arg) {
    if (arg && typeof arg === 'object' && 'value' in arg) {
      return arg.value;
    }
    return arg;
  }

  /**
   * Emits state update if the normalised state has changed.
   * Prevents duplicate emissions for unchanged state.
   *
   * @private
   */
  _emitStateIfChanged() {
    const state = this._buildNormalisedState();
    const stateKey = `${state.state}|${state.timecode}|${state.filename}`;

    if (this._lastEmittedState !== stateKey) {
      this._lastEmittedState = stateKey;
      this.emit('state', state);
    }
  }

  /**
   * Builds the normalised state object from the cached OSC data.
   *
   * @returns {Object} Normalised state object
   * @private
   */
  _buildNormalisedState() {
    // Determine filename - prefer file/path, fall back to foreground/file/name
    let filename = this._stateCache.filePath || this._stateCache.foregroundFile || '';

    // Extract just the filename from path (CasparCG may send full path)
    if (filename.includes('/') || filename.includes('\\')) {
      const parts = filename.split(/[/\\]/);
      filename = parts[parts.length - 1];
    }

    // Determine play state
    // - If we have a file and not paused → play
    // - Otherwise → stop
    // - CasparCG doesn't record, so never 'rec'
    const hasFile = Boolean(this._stateCache.filePath || this._stateCache.foregroundFile);
    const state = hasFile && !this._stateCache.paused ? 'play' : 'stop';

    // Convert frame to timecode
    // Prefer frame count if available, otherwise calculate from time
    const fps = this._stateCache.fps || this.framerate;
    let totalFrames = this._stateCache.frame;

    if (totalFrames === 0 && this._stateCache.timeSeconds > 0) {
      // Calculate frames from time if frame count not available
      totalFrames = Math.floor(this._stateCache.timeSeconds * fps);
    }

    const timecode = this._framesToTimecode(totalFrames, fps);

    return {
      state,
      timecode,
      filename
    };
  }

  /**
   * Converts frame count to timecode string.
   * Handles both drop-frame (29.97, 59.94) and non-drop-frame rates.
   *
   * @param {number} totalFrames - Total frame count
   * @param {number} fps - Framerate
   * @returns {string} Timecode in HH:MM:SS:FF or HH:MM:SS;FF format
   * @private
   */
  _framesToTimecode(totalFrames, fps) {
    if (totalFrames < 0) {
      totalFrames = 0;
    }

    const isDropFrame = this._requiresDropFrame(fps);

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
      return `${this._pad2(hours)}:${this._pad2(minutes)}:${this._pad2(seconds)};${this._pad2(frames)}`;
    } else {
      // Non-drop-frame calculation (25, 50, 24, 30, 60 fps)
      const roundedFps = Math.round(fps);
      const frames = totalFrames % roundedFps;
      const totalSeconds = Math.floor(totalFrames / roundedFps);
      const seconds = totalSeconds % 60;
      const totalMinutes = Math.floor(totalSeconds / 60);
      const minutes = totalMinutes % 60;
      const hours = Math.floor(totalMinutes / 60);

      return `${this._pad2(hours)}:${this._pad2(minutes)}:${this._pad2(seconds)}:${this._pad2(frames)}`;
    }
  }

  /**
   * Determines if a framerate requires drop-frame timecode.
   *
   * @param {number} fps - Framerate
   * @returns {boolean} True if drop-frame required
   * @private
   */
  _requiresDropFrame(fps) {
    return Math.abs(fps - 29.97) < 0.01 || Math.abs(fps - 59.94) < 0.01;
  }

  /**
   * Pads a number to 2 digits with leading zero.
   *
   * @param {number} n - Number to pad
   * @returns {string} Zero-padded string
   * @private
   */
  _pad2(n) {
    return n.toString().padStart(2, '0');
  }

  /**
   * Starts the periodic check for stale state.
   * If no OSC messages received within timeout, marks device as disconnected.
   *
   * @private
   */
  _startStaleChecker() {
    if (this._staleTimer) {
      clearInterval(this._staleTimer);
    }

    this._staleTimer = setInterval(() => {
      this._checkStaleState();
    }, 1000); // Check every second
  }

  /**
   * Checks if the state is stale and emits disconnected if necessary.
   *
   * @private
   */
  _checkStaleState() {
    if (!this._hasReceivedData) {
      return; // Haven't received any data yet, not considered stale
    }

    const timeSinceUpdate = Date.now() - this._lastUpdateTime;

    if (timeSinceUpdate > this.staleTimeoutMs && this._isConnected) {
      console.warn(
        `[casparcg] Device ${this.id}: No OSC data for ${Math.round(timeSinceUpdate / 1000)}s, marking as offline`
      );
      this._isConnected = false;
      this.emit('disconnected');
    }
  }

  /**
   * Returns the current connection status.
   *
   * @returns {boolean} True if receiving OSC data
   */
  get isConnected() {
    return this._isConnected;
  }

  /**
   * Returns the current normalised state.
   * Useful for immediate state queries without waiting for events.
   *
   * @returns {Object} Current state object
   */
  getState() {
    if (!this._isConnected) {
      return {
        state: 'stop',
        timecode: '00:00:00:00',
        filename: ''
      };
    }
    return this._buildNormalisedState();
  }
}

module.exports = CasparCGClient;
