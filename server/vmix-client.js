/**
 * vMix HTTP XML Client
 *
 * Polls vMix HTTP API to retrieve recording state and active input information.
 * Converts vMix's XML response into normalised state objects for the SuperDash
 * broadcast monitoring dashboard.
 *
 * vMix exposes a simple HTTP API that returns XML containing all system state.
 * This client polls that endpoint at configurable intervals and emits state
 * changes via EventEmitter pattern.
 *
 * Design principles:
 * - Fail loud: All errors logged with [vmix] prefix
 * - No silent failures: Every catch block logs
 * - Graceful degradation: Cache last good state during transient failures
 * - Simple XML parsing: Regex-based, no external dependencies
 */

const EventEmitter = require('events');
const http = require('http');

/**
 * @typedef {Object} VMixConfig
 * @property {number} id - Device ID for state tracking
 * @property {string} ip - vMix server IP address
 * @property {number} [port=8088] - vMix HTTP API port
 * @property {number} [framerate=50] - Framerate for timecode conversion
 * @property {number} [pollIntervalMs=500] - Polling interval in milliseconds
 * @property {number} [timeoutMs=2000] - HTTP request timeout in milliseconds
 */

/**
 * @typedef {Object} VMixState
 * @property {'play'|'rec'|'stop'} state - Normalised playback state
 * @property {string} timecode - Current timecode (HH:MM:SS:FF format)
 * @property {string} filename - Current active input title or recording filename
 */

/**
 * @typedef {Object} VMixRawState
 * @property {boolean} recording - Whether vMix is recording
 * @property {boolean} streaming - Whether vMix is streaming
 * @property {number} duration - Recording/playback duration in milliseconds
 * @property {string|null} activeInputTitle - Title of currently running input
 * @property {string|null} activeInputState - State of active input (Running, Paused, etc.)
 */

/**
 * vMix HTTP XML client for polling device state.
 *
 * @extends EventEmitter
 * @fires VMixClient#state - Emitted when device state changes
 * @fires VMixClient#connected - Emitted when connection established
 * @fires VMixClient#disconnected - Emitted when connection lost
 * @fires VMixClient#error - Emitted on errors (non-fatal, connection continues)
 *
 * @example
 * const client = new VMixClient({
 *   id: 1,
 *   ip: '192.168.1.100',
 *   port: 8088,
 *   framerate: 50
 * });
 *
 * client.on('state', (state) => {
 *   console.log(`State: ${state.state}, TC: ${state.timecode}`);
 * });
 *
 * client.on('error', (err) => {
 *   console.error('Error:', err.message);
 * });
 *
 * client.connect();
 */
class VMixClient extends EventEmitter {
  /**
   * Creates a new vMix client instance.
   *
   * @param {VMixConfig} config - Client configuration
   */
  constructor(config) {
    super();

    if (!config || typeof config !== 'object') {
      throw new Error('[vmix] Configuration object is required');
    }

    if (typeof config.id !== 'number') {
      throw new Error('[vmix] Device ID (config.id) must be a number');
    }

    if (!config.ip || typeof config.ip !== 'string') {
      throw new Error('[vmix] IP address (config.ip) is required');
    }

    /** @type {number} */
    this.id = config.id;

    /** @type {string} */
    this.ip = config.ip;

    /** @type {number} */
    this.port = config.port || 8088;

    /** @type {number} */
    this.framerate = config.framerate || 50;

    /** @type {number} */
    this.pollIntervalMs = config.pollIntervalMs || 500;

    /** @type {number} */
    this.timeoutMs = config.timeoutMs || 2000;

    /** @type {boolean} */
    this._isConnected = false;

    /** @type {boolean} */
    this._isRunning = false;

    /** @type {NodeJS.Timeout|null} */
    this._pollTimer = null;

    /** @type {VMixState|null} */
    this._lastGoodState = null;

    /** @type {number} */
    this._consecutiveFailures = 0;

    /** @type {number} */
    this._maxConsecutiveFailures = 3;

    /** @type {number} */
    this._pollStartTime = 0;
  }

  /**
   * Starts polling the vMix API.
   * Emits 'connected' event on first successful poll.
   */
  connect() {
    if (this._isRunning) {
      console.log(`[vmix] Device ${this.id}: Already running, ignoring connect() call`);
      return;
    }

    console.log(`[vmix] Device ${this.id}: Starting client for ${this.ip}:${this.port}`);
    this._isRunning = true;
    this._pollStartTime = performance.now();
    this._schedulePoll();
  }

  /**
   * Stops polling and cleans up resources.
   * Emits 'disconnected' event if currently connected.
   */
  disconnect() {
    if (!this._isRunning) {
      return;
    }

    console.log(`[vmix] Device ${this.id}: Stopping client`);
    this._isRunning = false;

    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }

    if (this._isConnected) {
      this._isConnected = false;
      this.emit('disconnected');
    }
  }

  /**
   * Schedules the next poll using absolute time reference to prevent drift.
   * Uses the same drift-free scheduling pattern as the main server.
   *
   * @private
   */
  _schedulePoll() {
    if (!this._isRunning) {
      return;
    }

    const elapsed = performance.now() - this._pollStartTime;
    const nextPoll = Math.ceil(elapsed / this.pollIntervalMs) * this.pollIntervalMs;
    const delay = Math.max(0, nextPoll - elapsed);

    this._pollTimer = setTimeout(() => {
      this._poll();
    }, delay);
  }

  /**
   * Performs a single poll of the vMix API.
   * Handles connection state transitions and error recovery.
   *
   * @private
   */
  async _poll() {
    if (!this._isRunning) {
      return;
    }

    try {
      const xml = await this._fetchXml();
      const rawState = this._parseXml(xml);
      const normalisedState = this._normaliseState(rawState);

      // Reset failure counter on success
      this._consecutiveFailures = 0;

      // Track connection state
      if (!this._isConnected) {
        this._isConnected = true;
        console.log(`[vmix] Device ${this.id}: Connected to ${this.ip}:${this.port}`);
        this.emit('connected');
      }

      // Cache good state and emit
      this._lastGoodState = normalisedState;
      this.emit('state', normalisedState);
    } catch (error) {
      this._consecutiveFailures++;
      console.error(`[vmix] Device ${this.id}: Poll failed - ${error.message}`);
      this.emit('error', error);

      // After threshold failures, mark as disconnected
      if (this._isConnected && this._consecutiveFailures >= this._maxConsecutiveFailures) {
        console.log(`[vmix] Device ${this.id}: Marking disconnected after ${this._consecutiveFailures} failures`);
        this._isConnected = false;
        this.emit('disconnected');
      }

      // Emit cached state during transient failures to maintain UI stability
      if (this._lastGoodState && this._consecutiveFailures < this._maxConsecutiveFailures) {
        this.emit('state', this._lastGoodState);
      }
    }

    // Schedule next poll
    this._schedulePoll();
  }

  /**
   * Fetches XML from the vMix HTTP API.
   *
   * @private
   * @returns {Promise<string>} Raw XML response body
   * @throws {Error} On HTTP error, timeout, or network failure
   */
  _fetchXml() {
    return new Promise((resolve, reject) => {
      const url = `http://${this.ip}:${this.port}/api`;

      const request = http.get(url, { timeout: this.timeoutMs }, (response) => {
        // Handle non-2xx responses
        if (response.statusCode < 200 || response.statusCode >= 300) {
          // Consume response to free socket
          response.resume();
          reject(new Error(`HTTP ${response.statusCode} from ${url}`));
          return;
        }

        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });

        response.on('error', (error) => {
          console.error(`[vmix] Device ${this.id}: Response error - ${error.message}`);
          reject(error);
        });
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Request timeout after ${this.timeoutMs}ms`));
      });

      request.on('error', (error) => {
        // Network errors (ECONNREFUSED, EHOSTUNREACH, etc.)
        reject(new Error(`Network error: ${error.message}`));
      });
    });
  }

  /**
   * Parses vMix XML response using regex-based extraction.
   *
   * vMix XML structure:
   * ```xml
   * <vmix>
   *   <recording>True</recording>
   *   <streaming>False</streaming>
   *   <duration>12345</duration>
   *   <inputs>
   *     <input key="..." number="1" type="..." title="..." state="Running" />
   *   </inputs>
   * </vmix>
   * ```
   *
   * @private
   * @param {string} xml - Raw XML response
   * @returns {VMixRawState} Parsed state values
   * @throws {Error} On malformed or unexpected XML structure
   */
  _parseXml(xml) {
    if (!xml || typeof xml !== 'string') {
      throw new Error('Invalid XML response: empty or not a string');
    }

    // Validate we have a vmix root element
    if (!/<vmix/i.test(xml)) {
      throw new Error('Invalid XML response: missing <vmix> root element');
    }

    // Extract recording state
    // vMix uses "True"/"False" strings (case-insensitive)
    const recordingMatch = xml.match(/<recording>([^<]*)<\/recording>/i);
    const recording = recordingMatch
      ? recordingMatch[1].toLowerCase() === 'true'
      : false;

    // Extract streaming state
    const streamingMatch = xml.match(/<streaming>([^<]*)<\/streaming>/i);
    const streaming = streamingMatch
      ? streamingMatch[1].toLowerCase() === 'true'
      : false;

    // Extract duration (milliseconds)
    // Duration represents recording time when recording, otherwise 0
    const durationMatch = xml.match(/<duration>([^<]*)<\/duration>/i);
    const duration = durationMatch
      ? parseInt(durationMatch[1], 10) || 0
      : 0;

    // Find active input with state="Running" or state="Paused"
    // Input format: <input key="..." number="1" type="Video" title="My Video" state="Running" />
    // Note: Inputs can be self-closing or have children, we handle both
    let activeInputTitle = null;
    let activeInputState = null;

    // Match all input elements (handles both self-closing and regular)
    const inputRegex = /<input\s+[^>]*>/gi;
    const inputs = xml.match(inputRegex);

    if (inputs) {
      for (const input of inputs) {
        // Extract state attribute
        const stateMatch = input.match(/state="([^"]*)"/i);
        if (stateMatch) {
          const state = stateMatch[1];
          // Look for active states (Running, Paused)
          if (state === 'Running' || state === 'Paused') {
            activeInputState = state;
            // Extract title attribute
            const titleMatch = input.match(/title="([^"]*)"/i);
            activeInputTitle = titleMatch ? titleMatch[1] : 'Unknown';
            break; // Take first active input
          }
        }
      }
    }

    return {
      recording,
      streaming,
      duration,
      activeInputTitle,
      activeInputState
    };
  }

  /**
   * Converts raw vMix state to normalised SuperDash state.
   *
   * State priority:
   * 1. recording=True → 'rec'
   * 2. Any input state=Running → 'play'
   * 3. Everything else → 'stop'
   *
   * @private
   * @param {VMixRawState} rawState - Parsed vMix state
   * @returns {VMixState} Normalised state for dashboard
   */
  _normaliseState(rawState) {
    // Determine state with priority: recording > playing > stop
    let state = 'stop';
    let filename = '';

    if (rawState.recording) {
      state = 'rec';
      // When recording, use the active input title as filename indicator
      filename = rawState.activeInputTitle || 'Recording';
    } else if (rawState.activeInputState === 'Running') {
      state = 'play';
      filename = rawState.activeInputTitle || '';
    } else if (rawState.activeInputState === 'Paused') {
      // Paused input still shows as stop, but we keep the filename
      state = 'stop';
      filename = rawState.activeInputTitle || '';
    }

    // Convert duration to timecode
    const timecode = this._millisecondsToTimecode(rawState.duration);

    return {
      state,
      timecode,
      filename
    };
  }

  /**
   * Converts milliseconds to timecode string (HH:MM:SS:FF).
   *
   * Calculation:
   * 1. Convert ms to total frames: floor(ms * framerate / 1000)
   * 2. Extract hours, minutes, seconds, frames from total
   *
   * @private
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Timecode in HH:MM:SS:FF format
   */
  _millisecondsToTimecode(ms) {
    if (!ms || ms < 0) {
      return '00:00:00:00';
    }

    // Convert milliseconds to total frames
    const totalFrames = Math.floor((ms * this.framerate) / 1000);

    // Extract timecode components
    const fps = Math.round(this.framerate);
    const frames = totalFrames % fps;
    const totalSeconds = Math.floor(totalFrames / fps);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    // Format with zero-padding
    return `${this._pad2(hours)}:${this._pad2(minutes)}:${this._pad2(seconds)}:${this._pad2(frames)}`;
  }

  /**
   * Pads a number to 2 digits with leading zero.
   *
   * @private
   * @param {number} n - Number to pad
   * @returns {string} Zero-padded string
   */
  _pad2(n) {
    return n.toString().padStart(2, '0');
  }

  /**
   * Returns current connection status.
   *
   * @returns {boolean} True if connected and receiving responses
   */
  get connected() {
    return this._isConnected;
  }

  /**
   * Returns cached state from last successful poll.
   * Useful for retrieving state without waiting for next poll.
   *
   * @returns {VMixState|null} Last known good state, or null if never connected
   */
  get lastState() {
    return this._lastGoodState;
  }
}

module.exports = VMixClient;
