/**
 * HyperDeck TCP Client
 *
 * Production-ready TCP client for Blackmagic HyperDeck devices.
 * Implements the HyperDeck Ethernet Protocol for transport state monitoring.
 *
 * Protocol Reference:
 * - Line-oriented protocol with CRLF delimiters
 * - Responses begin with 3-digit status codes
 * - Multi-line responses end with blank line
 * - Transport notifications for real-time state updates
 *
 * @module hyperdeck-client
 */

const { EventEmitter } = require('events');
const net = require('net');

/**
 * @typedef {Object} HyperDeckConfig
 * @property {number} id - Device ID for state management
 * @property {string} ip - IP address of the HyperDeck
 * @property {number} [port=9993] - TCP port (default: 9993)
 * @property {number} [framerate=50] - Framerate for timecode context (informational)
 */

/**
 * @typedef {Object} HyperDeckState
 * @property {'play'|'rec'|'stop'} state - Normalised playback state
 * @property {string} timecode - Current timecode in HH:MM:SS:FF format
 * @property {string} filename - Current clip filename
 */

/**
 * HyperDeck response status codes relevant to state monitoring.
 * Full protocol documentation available from Blackmagic Design.
 */
const STATUS_CODES = {
  OK: 200,
  DEVICE_INFO: 204,
  SLOT_INFO: 202,
  TRANSPORT_INFO: 208,
  NOTIFY: 209,
  ASYNC_TRANSPORT: 508, // Asynchronous transport notification
  ASYNC_SLOT: 502       // Asynchronous slot notification
};

/**
 * Map HyperDeck transport status strings to normalised SuperDash states.
 * HyperDeck reports: play, record, preview, stopped, shuttle forward,
 * shuttle reverse, jog, fast forward, rewind
 *
 * @param {string} hyperdeckStatus - Raw status from HyperDeck
 * @returns {'play'|'rec'|'stop'} Normalised state
 */
function normaliseTransportState(hyperdeckStatus) {
  if (!hyperdeckStatus) return 'stop';

  const status = hyperdeckStatus.toLowerCase().trim();

  switch (status) {
    case 'play':
    case 'playing':
      return 'play';

    case 'record':
    case 'recording':
      return 'rec';

    case 'preview':
    case 'stopped':
    case 'shuttle forward':
    case 'shuttle reverse':
    case 'jog':
    case 'fast forward':
    case 'rewind':
    default:
      return 'stop';
  }
}

/**
 * HyperDeck TCP Client
 *
 * Connects to a HyperDeck device and monitors transport state via the
 * Ethernet Protocol. Emits normalised state updates suitable for the
 * SuperDash monitoring dashboard.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Transport notification subscription for real-time updates
 * - Periodic polling as backup for missed notifications
 * - Graceful error handling with detailed logging
 *
 * @extends EventEmitter
 * @fires HyperDeckClient#state
 * @fires HyperDeckClient#connected
 * @fires HyperDeckClient#disconnected
 * @fires HyperDeckClient#error
 *
 * @example
 * const client = new HyperDeckClient({
 *   id: 1,
 *   ip: '192.168.0.201',
 *   port: 9993,
 *   framerate: 50
 * });
 *
 * client.on('state', (state) => {
 *   console.log(`State: ${state.state}, TC: ${state.timecode}`);
 * });
 *
 * client.connect();
 */
class HyperDeckClient extends EventEmitter {
  /**
   * Creates a new HyperDeck client instance.
   *
   * @param {HyperDeckConfig} config - Client configuration
   */
  constructor(config) {
    super();

    if (!config || !config.id || !config.ip) {
      throw new Error('[hyperdeck] Configuration must include id and ip');
    }

    this.id = config.id;
    this.ip = config.ip;
    this.port = config.port || 9993;
    this.framerate = config.framerate || 50;

    // Connection state
    this.socket = null;
    this.connected = false;
    this.intentionalDisconnect = false;

    // Reconnection with exponential backoff
    this.reconnectAttempt = 0;
    this.reconnectTimeout = null;
    this.baseReconnectDelay = 1000;  // 1 second initial
    this.maxReconnectDelay = 30000;  // 30 seconds maximum

    // Response parsing
    this.buffer = '';
    this.currentResponse = null;
    this.responseLines = [];

    // Polling intervals (backup for notifications)
    this.pollInterval = null;
    this.pollIntervalMs = 2000; // Poll every 2 seconds as backup

    // Current state
    this.currentState = {
      state: 'stop',
      timecode: '00:00:00:00',
      filename: ''
    };

    // Active slot tracking (HyperDecks have 2 SSD slots)
    this.activeSlot = 1;

    // Bind methods to preserve context
    this._handleConnect = this._handleConnect.bind(this);
    this._handleData = this._handleData.bind(this);
    this._handleClose = this._handleClose.bind(this);
    this._handleError = this._handleError.bind(this);
  }

  /**
   * Initiates connection to the HyperDeck device.
   * Will automatically reconnect on failure using exponential backoff.
   */
  connect() {
    if (this.connected || this.socket) {
      console.log(`[hyperdeck] Device ${this.id}: Already connected or connecting`);
      return;
    }

    this.intentionalDisconnect = false;
    this._createConnection();
  }

  /**
   * Creates the TCP socket connection.
   * @private
   */
  _createConnection() {
    console.log(`[hyperdeck] Device ${this.id}: Connecting to ${this.ip}:${this.port}`);

    this.socket = new net.Socket();
    this.socket.setEncoding('utf8');
    this.socket.setTimeout(5000); // 5 second connection timeout

    this.socket.on('connect', this._handleConnect);
    this.socket.on('data', this._handleData);
    this.socket.on('close', this._handleClose);
    this.socket.on('error', this._handleError);
    this.socket.on('timeout', () => {
      console.error(`[hyperdeck] Device ${this.id}: Connection timeout`);
      this.socket.destroy();
    });

    this.socket.connect(this.port, this.ip);
  }

  /**
   * Handles successful TCP connection.
   * Subscribes to transport notifications and starts polling.
   * @private
   */
  _handleConnect() {
    console.log(`[hyperdeck] Device ${this.id}: TCP connection established`);

    this.connected = true;
    this.reconnectAttempt = 0;
    this.socket.setTimeout(0); // Disable timeout after connection

    this.emit('connected');

    // Subscribe to transport notifications for real-time updates
    // Small delay to allow connection handshake to complete
    setTimeout(() => {
      this._sendCommand('notify: transport: true');
      this._sendCommand('notify: slot: true');

      // Request initial state (transport info will tell us the active slot)
      this._sendCommand('transport info');
    }, 100);

    // Start periodic polling as backup
    this._startPolling();
  }

  /**
   * Handles incoming data from the HyperDeck.
   * Parses the line-oriented protocol and extracts state information.
   *
   * Protocol format:
   * - Single line: `200 ok`
   * - Multi-line: Code on first line, fields on subsequent lines, blank line terminates
   *
   * @param {string} data - Raw data from socket
   * @private
   */
  _handleData(data) {
    this.buffer += data;

    // Process complete lines (CRLF or LF delimited)
    let lines = this.buffer.split(/\r?\n/);

    // Keep incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this._processLine(line);
    }
  }

  /**
   * Processes a single line from the HyperDeck response.
   *
   * @param {string} line - Single line from response
   * @private
   */
  _processLine(line) {
    // Check for response code (start of response)
    const codeMatch = line.match(/^(\d{3})\s*(.*)/);

    if (codeMatch) {
      // New response starting
      const code = parseInt(codeMatch[1], 10);
      const message = codeMatch[2];

      // Single-line response (200 ok, etc.)
      if (code === STATUS_CODES.OK || code < 200) {
        // Acknowledgement, no action needed
        return;
      }

      // Start collecting multi-line response
      this.currentResponse = { code, message, fields: {} };
      this.responseLines = [];
      return;
    }

    // Blank line signals end of multi-line response
    if (line.trim() === '' && this.currentResponse) {
      this._handleResponse(this.currentResponse);
      this.currentResponse = null;
      this.responseLines = [];
      return;
    }

    // Field line in multi-line response
    if (this.currentResponse) {
      const fieldMatch = line.match(/^([^:]+):\s*(.*)$/);
      if (fieldMatch) {
        const key = fieldMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = fieldMatch[2].trim();
        this.currentResponse.fields[key] = value;
        this.responseLines.push(line);
      }
    }
  }

  /**
   * Handles a complete parsed response from the HyperDeck.
   *
   * @param {Object} response - Parsed response object
   * @param {number} response.code - Status code
   * @param {string} response.message - Status message
   * @param {Object} response.fields - Key-value fields from response
   * @private
   */
  _handleResponse(response) {
    const { code, fields } = response;

    switch (code) {
      case STATUS_CODES.TRANSPORT_INFO:
      case STATUS_CODES.ASYNC_TRANSPORT:
        this._handleTransportInfo(fields);
        break;

      case STATUS_CODES.SLOT_INFO:
      case STATUS_CODES.ASYNC_SLOT:
        this._handleSlotInfo(fields);
        break;

      case STATUS_CODES.NOTIFY:
        // Notification subscription confirmed
        console.log(`[hyperdeck] Device ${this.id}: Notification subscription active`);
        break;

      default:
        // Log unexpected responses for debugging
        if (code >= 100 && code < 600) {
          console.log(`[hyperdeck] Device ${this.id}: Response ${code}`);
        }
    }
  }

  /**
   * Handles transport info response containing playback state.
   *
   * Expected fields:
   * - status: play, record, preview, stopped, etc.
   * - timecode: HH:MM:SS:FF
   * - display_timecode: HH:MM:SS:FF (preferred if available)
   * - active_slot: Currently active slot (1 or 2)
   * - clip_id: Current clip identifier
   *
   * @param {Object} fields - Parsed response fields
   * @private
   */
  _handleTransportInfo(fields) {
    const newState = { ...this.currentState };

    // Extract and normalise transport state
    if (fields.status) {
      newState.state = normaliseTransportState(fields.status);
    }

    // Prefer display_timecode over timecode if available
    if (fields.display_timecode) {
      newState.timecode = this._normaliseTimecode(fields.display_timecode);
    } else if (fields.timecode) {
      newState.timecode = this._normaliseTimecode(fields.timecode);
    }

    // Track active slot and request slot info if it changed
    if (fields.active_slot) {
      const newSlot = parseInt(fields.active_slot, 10);
      if (!isNaN(newSlot) && newSlot !== this.activeSlot) {
        this.activeSlot = newSlot;
        // Request slot info for the newly active slot
        this._sendCommand(`slot info: slot id: ${this.activeSlot}`);
      } else if (newSlot === this.activeSlot && !this.currentState.filename) {
        // First transport info after connect — request slot info
        this._sendCommand(`slot info: slot id: ${this.activeSlot}`);
      }
    }

    // Update and emit if changed
    if (this._stateChanged(newState)) {
      this.currentState = newState;
      this.emit('state', { ...this.currentState });
    }
  }

  /**
   * Handles slot info response containing clip information.
   *
   * Expected fields:
   * - clip_name: Current clip filename
   * - slot_id: Active slot number
   * - recording_time: Duration available for recording
   *
   * @param {Object} fields - Parsed response fields
   * @private
   */
  _handleSlotInfo(fields) {
    const newState = { ...this.currentState };

    if (fields.clip_name) {
      newState.filename = fields.clip_name;
    }

    // Update and emit if changed
    if (this._stateChanged(newState)) {
      this.currentState = newState;
      this.emit('state', { ...this.currentState });
    }
  }

  /**
   * Normalises timecode string to HH:MM:SS:FF format.
   * Handles various formats the HyperDeck might return.
   *
   * @param {string} tc - Raw timecode string
   * @returns {string} Normalised timecode
   * @private
   */
  _normaliseTimecode(tc) {
    if (!tc || typeof tc !== 'string') {
      return '00:00:00:00';
    }

    // Remove any whitespace
    tc = tc.trim();

    // Already in correct format
    if (/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(tc)) {
      // Normalise drop-frame semicolon to colon for consistency
      return tc.replace(';', ':');
    }

    // Handle timecode without separators (HHMMSSFF)
    if (/^\d{8}$/.test(tc)) {
      return `${tc.slice(0, 2)}:${tc.slice(2, 4)}:${tc.slice(4, 6)}:${tc.slice(6, 8)}`;
    }

    // Return as-is if unrecognised, but log warning
    console.warn(`[hyperdeck] Device ${this.id}: Unexpected timecode format: ${tc}`);
    return tc;
  }

  /**
   * Checks if state has meaningfully changed.
   *
   * @param {HyperDeckState} newState - New state to compare
   * @returns {boolean} True if state differs from current
   * @private
   */
  _stateChanged(newState) {
    return (
      newState.state !== this.currentState.state ||
      newState.timecode !== this.currentState.timecode ||
      newState.filename !== this.currentState.filename
    );
  }

  /**
   * Sends a command to the HyperDeck.
   * Commands are newline-terminated as per protocol.
   *
   * @param {string} command - Command to send
   * @private
   */
  _sendCommand(command) {
    if (!this.connected || !this.socket) {
      console.warn(`[hyperdeck] Device ${this.id}: Cannot send command, not connected`);
      return;
    }

    try {
      this.socket.write(`${command}\n`);
    } catch (error) {
      console.error(`[hyperdeck] Device ${this.id}: Failed to send command: ${error.message}`);
    }
  }

  /**
   * Starts periodic polling for transport and slot info.
   * Acts as backup in case notifications are missed.
   * @private
   */
  _startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(() => {
      if (this.connected) {
        this._sendCommand('transport info');
        this._sendCommand(`slot info: slot id: ${this.activeSlot}`);
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stops the polling interval.
   * @private
   */
  _stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Handles socket close event.
   * Initiates reconnection unless intentionally disconnected.
   * @private
   */
  _handleClose() {
    const wasConnected = this.connected;
    this.connected = false;
    this.socket = null;

    this._stopPolling();

    if (wasConnected) {
      console.log(`[hyperdeck] Device ${this.id}: Connection closed`);
      this.emit('disconnected');
    }

    // Reconnect unless intentionally disconnected
    if (!this.intentionalDisconnect) {
      this._scheduleReconnect();
    }
  }

  /**
   * Handles socket error event.
   *
   * @param {Error} error - Socket error
   * @private
   */
  _handleError(error) {
    // ECONNREFUSED, ETIMEDOUT, ENOTFOUND are common connection errors
    console.error(`[hyperdeck] Device ${this.id}: Socket error: ${error.message}`);

    this.emit('error', error);

    // Socket will emit 'close' after error, which handles reconnection
  }

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * Delay doubles each attempt: 1s, 2s, 4s, 8s, 16s, up to 30s max.
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay
    );

    this.reconnectAttempt++;

    console.log(`[hyperdeck] Device ${this.id}: Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempt})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this._createConnection();
    }, delay);
  }

  /**
   * Disconnects from the HyperDeck device.
   * Cleans up resources and prevents automatic reconnection.
   */
  disconnect() {
    console.log(`[hyperdeck] Device ${this.id}: Disconnecting`);

    this.intentionalDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this._stopPolling();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }

    if (this.connected) {
      this.connected = false;
      this.emit('disconnected');
    }
  }

  /**
   * Returns the current state without triggering an emission.
   *
   * @returns {HyperDeckState} Current device state
   */
  getState() {
    return { ...this.currentState };
  }
}

module.exports = HyperDeckClient;
