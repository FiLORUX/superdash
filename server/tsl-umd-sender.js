/**
 * TSL UMD v5.0 Sender for SuperDash
 *
 * Broadcasts device states as TSL UMD v5.0 messages to tally displays,
 * multiviewers, and under-monitor displays in a broadcast facility.
 *
 * State Mapping:
 * - play   → Red tally (Program/On-Air)
 * - rec    → Amber tally (Recording)
 * - stop   → No tally
 * - offline → No tally, dim brightness
 *
 * Architecture:
 * - UDP unicast/multicast to configurable destinations
 * - Background refresh cycle (200ms per display) for reliability
 * - Event-driven instant updates for responsive tally
 *
 * @module tsl-umd-sender
 */

const dgram = require('dgram');
const EventEmitter = require('events');

/**
 * TSL UMD v5.0 protocol constants.
 */
const TSL_V5 = {
  VERSION: 0x80,
  DEFAULT_PORT: 4003,
  DLE: 0xFE,
  STX: 0x02,

  // Tally states (2-bit encoding)
  TALLY_OFF: 0,
  TALLY_RED: 1,
  TALLY_GREEN: 2,
  TALLY_AMBER: 3,

  // Brightness (2-bit encoding)
  BRIGHTNESS_OFF: 0,
  BRIGHTNESS_DIM: 1,
  BRIGHTNESS_MEDIUM: 2,
  BRIGHTNESS_FULL: 3
};

/**
 * Default configuration for the TSL UMD sender.
 * @constant {Object}
 */
const DEFAULTS = {
  port: TSL_V5.DEFAULT_PORT,
  refreshIntervalMs: 200,
  screen: 0
};

/**
 * Maps SuperDash playback state to TSL UMD tally/brightness.
 *
 * @param {string} state - Device state (play, rec, stop, offline)
 * @returns {Object} - TSL control values
 */
function stateToTally(state) {
  switch (state) {
    case 'play':
      return {
        rhTally: TSL_V5.TALLY_RED,
        txtTally: TSL_V5.TALLY_RED,
        lhTally: TSL_V5.TALLY_OFF,
        brightness: TSL_V5.BRIGHTNESS_FULL
      };

    case 'rec':
      return {
        rhTally: TSL_V5.TALLY_AMBER,
        txtTally: TSL_V5.TALLY_AMBER,
        lhTally: TSL_V5.TALLY_OFF,
        brightness: TSL_V5.BRIGHTNESS_FULL
      };

    case 'stop':
      return {
        rhTally: TSL_V5.TALLY_OFF,
        txtTally: TSL_V5.TALLY_OFF,
        lhTally: TSL_V5.TALLY_OFF,
        brightness: TSL_V5.BRIGHTNESS_FULL
      };

    case 'offline':
    default:
      return {
        rhTally: TSL_V5.TALLY_OFF,
        txtTally: TSL_V5.TALLY_OFF,
        lhTally: TSL_V5.TALLY_OFF,
        brightness: TSL_V5.BRIGHTNESS_DIM
      };
  }
}

/**
 * Builds a TSL UMD v5.0 packet.
 *
 * @param {number} screen - Screen index (0-65534)
 * @param {number} index - Display index (0-65534)
 * @param {Object} display - Display data
 * @param {string} display.text - Display label text
 * @param {number} display.rhTally - Right-hand tally (0-3)
 * @param {number} display.txtTally - Text tally (0-3)
 * @param {number} display.lhTally - Left-hand tally (0-3)
 * @param {number} display.brightness - Brightness (0-3)
 * @returns {Buffer} - TSL UMD v5.0 packet
 */
function buildV50Packet(screen, index, display) {
  const text = display.text || '';
  const textBuf = Buffer.from(text, 'utf8');
  const packetLength = 12 + textBuf.length;

  const buffer = Buffer.alloc(packetLength);

  // PBC - Packet Byte Count (16-bit LE)
  buffer.writeUInt16LE(packetLength, 0);

  // VER - Version (0x80 for v5.0)
  buffer.writeUInt8(TSL_V5.VERSION, 2);

  // FLAGS (reserved, set to 0)
  buffer.writeUInt8(0x00, 3);

  // SCREEN - Screen index (16-bit LE)
  buffer.writeUInt16LE(screen & 0xFFFF, 4);

  // INDEX - Display index (16-bit LE)
  buffer.writeUInt16LE(index & 0xFFFF, 6);

  // CONTROL - Tally states and brightness (16-bit LE)
  // Bits 0-1: rh_tally, Bits 2-3: txt_tally, Bits 4-5: lh_tally, Bits 6-7: brightness
  const control = (
    ((display.rhTally & 0x03) << 0) |
    ((display.txtTally & 0x03) << 2) |
    ((display.lhTally & 0x03) << 4) |
    ((display.brightness & 0x03) << 6)
  );
  buffer.writeUInt16LE(control, 8);

  // LENGTH - Text length (16-bit LE)
  buffer.writeUInt16LE(textBuf.length, 10);

  // TEXT - Display text (UTF-8)
  textBuf.copy(buffer, 12);

  return buffer;
}

/**
 * TSL UMD v5.0 Sender class.
 *
 * Sends device state updates to tally display systems via UDP.
 *
 * @example
 * const sender = new TslUmdSender({
 *   destinations: [{ host: '192.168.1.100', port: 4003 }],
 *   screen: 0
 * });
 *
 * sender.start();
 *
 * // Update device state (triggers immediate send)
 * sender.updateDevice(1, {
 *   name: 'Playout 1',
 *   state: 'play'
 * });
 *
 * sender.stop();
 */
class TslUmdSender extends EventEmitter {
  /**
   * Creates a new TSL UMD sender.
   *
   * @param {Object} config - Sender configuration
   * @param {Array<{host: string, port?: number}>} config.destinations - Target addresses
   * @param {number} [config.screen=0] - TSL screen index
   * @param {number} [config.refreshIntervalMs=200] - Background refresh interval
   */
  constructor(config = {}) {
    super();

    /** @type {Array<{host: string, port: number}>} */
    this.destinations = (config.destinations || []).map(dest => ({
      host: dest.host,
      port: dest.port || DEFAULTS.port
    }));

    /** @type {number} */
    this.screen = config.screen ?? DEFAULTS.screen;

    /** @type {number} */
    this.refreshIntervalMs = config.refreshIntervalMs || DEFAULTS.refreshIntervalMs;

    /** @type {dgram.Socket|null} */
    this._socket = null;

    /** @type {Map<number, Object>} Device ID to state */
    this._deviceStates = new Map();

    /** @type {NodeJS.Timeout|null} */
    this._refreshTimer = null;

    /** @type {number} Current device index for round-robin refresh */
    this._refreshIndex = 0;

    /** @type {boolean} */
    this._isRunning = false;

    if (this.destinations.length === 0) {
      console.warn('[tsl-umd] No destinations configured');
    } else {
      console.log(`[tsl-umd] Configured with ${this.destinations.length} destination(s)`);
      for (const dest of this.destinations) {
        console.log(`[tsl-umd]   → ${dest.host}:${dest.port}`);
      }
    }
  }

  /**
   * Starts the TSL UMD sender.
   * Creates UDP socket and begins background refresh cycle.
   */
  start() {
    if (this._isRunning) {
      console.warn('[tsl-umd] Sender already running');
      return;
    }

    if (this.destinations.length === 0) {
      console.warn('[tsl-umd] Cannot start: no destinations configured');
      return;
    }

    console.log('[tsl-umd] Starting sender');

    // Create UDP socket
    this._socket = dgram.createSocket('udp4');

    this._socket.on('error', (error) => {
      console.error(`[tsl-umd] Socket error: ${error.message}`);
      this.emit('error', error);
    });

    // Enable broadcast if needed (for multicast addresses)
    this._socket.bind(() => {
      // Guard against callback firing after stop()
      if (this._socket) {
        this._socket.setBroadcast(true);
      }
    });

    this._isRunning = true;

    // Start background refresh cycle
    this._scheduleRefresh();

    console.log('[tsl-umd] Sender running');
  }

  /**
   * Stops the TSL UMD sender.
   */
  stop() {
    if (!this._isRunning) {
      return;
    }

    console.log('[tsl-umd] Stopping sender');

    // Clear refresh timer
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }

    // Close socket
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }

    this._isRunning = false;
    console.log('[tsl-umd] Sender stopped');
  }

  /**
   * Registers or updates a device.
   * Triggers an immediate send if state changed.
   *
   * @param {number} deviceId - Device ID (used as display index)
   * @param {Object} state - Device state
   * @param {string} state.name - Device display name
   * @param {string} state.state - Playback state (play, rec, stop, offline)
   */
  updateDevice(deviceId, state) {
    const previous = this._deviceStates.get(deviceId);
    const current = {
      id: deviceId,
      name: state.name || `Device ${deviceId}`,
      state: state.state || 'offline'
    };

    this._deviceStates.set(deviceId, current);

    // Send immediately if state changed (for responsive tally)
    if (!previous || previous.state !== current.state || previous.name !== current.name) {
      this._sendDevice(deviceId);
    }
  }

  /**
   * Removes a device from tracking.
   *
   * @param {number} deviceId - Device ID
   */
  removeDevice(deviceId) {
    this._deviceStates.delete(deviceId);
  }

  /**
   * Returns the number of tracked devices.
   *
   * @returns {number}
   */
  get deviceCount() {
    return this._deviceStates.size;
  }

  /**
   * Sends a TSL UMD packet for a specific device.
   *
   * @param {number} deviceId - Device ID
   * @private
   */
  _sendDevice(deviceId) {
    if (!this._isRunning || !this._socket) {
      return;
    }

    const device = this._deviceStates.get(deviceId);
    if (!device) {
      return;
    }

    // Map state to tally values
    const tally = stateToTally(device.state);

    // Build packet
    const packet = buildV50Packet(this.screen, deviceId, {
      text: device.name,
      rhTally: tally.rhTally,
      txtTally: tally.txtTally,
      lhTally: tally.lhTally,
      brightness: tally.brightness
    });

    // Send to all destinations
    for (const dest of this.destinations) {
      this._socket.send(packet, dest.port, dest.host, (error) => {
        if (error) {
          console.error(`[tsl-umd] Send error to ${dest.host}:${dest.port}: ${error.message}`);
        }
      });
    }
  }

  /**
   * Schedules the next background refresh.
   * Implements round-robin refresh across all devices.
   *
   * @private
   */
  _scheduleRefresh() {
    if (!this._isRunning) {
      return;
    }

    this._refreshTimer = setTimeout(() => {
      this._doRefresh();
      this._scheduleRefresh();
    }, this.refreshIntervalMs);
  }

  /**
   * Performs one background refresh cycle.
   * Sends update for the next device in round-robin order.
   *
   * @private
   */
  _doRefresh() {
    const deviceIds = Array.from(this._deviceStates.keys());
    if (deviceIds.length === 0) {
      return;
    }

    // Round-robin through devices
    this._refreshIndex = this._refreshIndex % deviceIds.length;
    const deviceId = deviceIds[this._refreshIndex];
    this._refreshIndex++;

    this._sendDevice(deviceId);
  }

  /**
   * Returns whether the sender is running.
   *
   * @returns {boolean}
   */
  get isRunning() {
    return this._isRunning;
  }
}

module.exports = TslUmdSender;
