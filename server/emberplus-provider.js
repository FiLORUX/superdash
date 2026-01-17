/**
 * Ember+ Provider for SuperDash
 *
 * Exposes SuperDash playout device states via Ember+ protocol, enabling
 * integration with broadcast control systems like Lawo VSM, Ross DashBoard,
 * and Grass Valley control panels.
 *
 * Architecture:
 * - TCP server on port 9000 (standard Ember+ port)
 * - Tree structure with nodes for each playout device
 * - Parameters for state, timecode, filename, connection status
 * - Real-time updates pushed to all connected clients
 *
 * Tree Structure:
 * ```
 * SuperDash (root)
 * ├── Info
 * │   ├── Version (string)
 * │   └── DeviceCount (integer)
 * └── Devices
 *     ├── [Device Name] (per device)
 *     │   ├── State (enum: play/stop/rec/offline)
 *     │   ├── Timecode (string: HH:MM:SS:FF)
 *     │   ├── Filename (string)
 *     │   ├── Connected (boolean)
 *     │   └── Type (string: hyperdeck/vmix/casparcg)
 *     └── ...
 * ```
 *
 * @module emberplus-provider
 */

const {
  EmberServer,
  Model: {
    EmberNodeImpl,
    ParameterImpl,
    ParameterType,
    ParameterAccess,
    NumberedTreeNodeImpl
  }
} = require('emberplus-connection');

/**
 * Default configuration for the Ember+ provider.
 * @constant {Object}
 */
const DEFAULTS = {
  port: 9000,
  address: '0.0.0.0'
};

/**
 * SuperDash version string exposed via Ember+.
 * @constant {string}
 */
const VERSION = '1.0.0';

/**
 * State enumeration string for Ember+ (newline-separated).
 * Order matters: 0=stop, 1=play, 2=rec, 3=offline
 * @constant {string}
 */
const STATE_ENUM = 'stop\nplay\nrec\noffline';

/**
 * Maps state string to enum index.
 * @constant {Object}
 */
const STATE_TO_INDEX = {
  stop: 0,
  play: 1,
  rec: 2,
  offline: 3
};

/**
 * Ember+ Provider class that exposes SuperDash device states.
 *
 * @example
 * const provider = new EmberPlusProvider({ port: 9000 });
 *
 * // Start the provider
 * await provider.start(devices);
 *
 * // Update device state (called from main server loop)
 * provider.updateDevice(1, {
 *   state: 'play',
 *   timecode: '00:01:23:12',
 *   filename: 'clip.mov',
 *   connected: true
 * });
 *
 * // Graceful shutdown
 * provider.stop();
 */
class EmberPlusProvider {
  /**
   * Creates a new Ember+ provider.
   *
   * @param {Object} config - Provider configuration
   * @param {number} [config.port=9000] - TCP port to listen on
   * @param {string} [config.address='0.0.0.0'] - Address to bind to
   */
  constructor(config = {}) {
    /** @type {number} TCP port */
    this.port = config.port || DEFAULTS.port;

    /** @type {string} Bind address */
    this.address = config.address || DEFAULTS.address;

    /** @type {EmberServer|null} */
    this._server = null;

    /** @type {Map<number, Object>} Device ID to tree node references */
    this._deviceNodes = new Map();

    /** @type {Object|null} Root tree structure */
    this._tree = null;

    /** @type {boolean} */
    this._isRunning = false;

    console.log(`[ember+] Provider configured for ${this.address}:${this.port}`);
  }

  /**
   * Starts the Ember+ provider server.
   *
   * @param {Array<Object>} devices - Initial device configurations
   * @returns {Promise<void>}
   */
  async start(devices) {
    if (this._isRunning) {
      console.warn('[ember+] Provider already running');
      return;
    }

    console.log(`[ember+] Starting provider on port ${this.port}`);

    try {
      // Build the tree structure
      this._tree = this._buildTree(devices);

      // Create and initialise the server
      this._server = new EmberServer(this.port, this.address);

      // Handle errors
      this._server.on('error', (error) => {
        console.error(`[ember+] Server error: ${error.message}`);
      });

      this._server.on('clientError', (client, error) => {
        console.error(`[ember+] Client error: ${error.message}`);
      });

      // Handle value change requests from consumers
      this._server.onSetValue = async (parameter, value) => {
        // SuperDash parameters are read-only (monitoring only)
        // Log the attempt but reject the change
        const path = this._getParameterPath(parameter);
        console.log(`[ember+] Rejected setValue request: ${path} = ${value}`);
        return false;
      };

      // Initialise with the tree
      await this._server.init(this._tree);

      this._isRunning = true;
      console.log(`[ember+] Provider running on port ${this.port}`);
      console.log(`[ember+] Exposing ${devices.length} devices via Ember+ tree`);

    } catch (error) {
      console.error(`[ember+] Failed to start provider: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stops the Ember+ provider server.
   */
  stop() {
    if (!this._isRunning) {
      return;
    }

    console.log('[ember+] Stopping provider');

    if (this._server) {
      this._server.discard();
      this._server = null;
    }

    this._deviceNodes.clear();
    this._tree = null;
    this._isRunning = false;

    console.log('[ember+] Provider stopped');
  }

  /**
   * Updates a device's state in the Ember+ tree.
   * Notifies all connected consumers of the change.
   *
   * @param {number} deviceId - Device ID
   * @param {Object} state - New device state
   * @param {string} [state.state] - Play state (play/stop/rec/offline)
   * @param {string} [state.timecode] - Current timecode
   * @param {string} [state.filename] - Current filename
   * @param {boolean} [state.connected] - Connection status
   */
  updateDevice(deviceId, state) {
    if (!this._isRunning || !this._server) {
      return;
    }

    const nodes = this._deviceNodes.get(deviceId);
    if (!nodes) {
      // Device not in tree (may have been added after startup)
      return;
    }

    // Update state parameter
    if (state.state !== undefined && nodes.state) {
      const stateIndex = STATE_TO_INDEX[state.state] ?? STATE_TO_INDEX.offline;
      if (nodes.state.contents.value !== stateIndex) {
        this._server.update(nodes.state, { value: stateIndex });
      }
    }

    // Update timecode parameter
    if (state.timecode !== undefined && nodes.timecode) {
      if (nodes.timecode.contents.value !== state.timecode) {
        this._server.update(nodes.timecode, { value: state.timecode });
      }
    }

    // Update filename parameter
    if (state.filename !== undefined && nodes.filename) {
      if (nodes.filename.contents.value !== state.filename) {
        this._server.update(nodes.filename, { value: state.filename });
      }
    }

    // Update connected parameter
    if (state.connected !== undefined && nodes.connected) {
      if (nodes.connected.contents.value !== state.connected) {
        this._server.update(nodes.connected, { value: state.connected });
      }
    }
  }

  /**
   * Updates the device count in the Info node.
   *
   * @param {number} count - Number of devices
   */
  updateDeviceCount(count) {
    if (!this._isRunning || !this._server || !this._deviceCountNode) {
      return;
    }

    if (this._deviceCountNode.contents.value !== count) {
      this._server.update(this._deviceCountNode, { value: count });
    }
  }

  /**
   * Builds the Ember+ tree structure from device configurations.
   *
   * @param {Array<Object>} devices - Device configurations
   * @returns {Object} Root tree collection
   * @private
   */
  _buildTree(devices) {
    // Node numbering:
    // 1 = SuperDash (root)
    //   1.1 = Info
    //     1.1.1 = Version
    //     1.1.2 = DeviceCount
    //   1.2 = Devices
    //     1.2.1 = Device 1
    //       1.2.1.1 = State
    //       1.2.1.2 = Timecode
    //       1.2.1.3 = Filename
    //       1.2.1.4 = Connected
    //       1.2.1.5 = Type
    //     1.2.2 = Device 2
    //     ...

    // Build Info node children
    const versionParam = new NumberedTreeNodeImpl(
      1, // number within Info
      new ParameterImpl(
        ParameterType.String,
        'Version',           // identifier
        'SuperDash Version', // description
        VERSION,             // value
        undefined,           // maximum
        undefined,           // minimum
        ParameterAccess.Read // access
      )
    );

    const deviceCountParam = new NumberedTreeNodeImpl(
      2, // number within Info
      new ParameterImpl(
        ParameterType.Integer,
        'DeviceCount',
        'Number of configured devices',
        devices.length,
        undefined,
        undefined,
        ParameterAccess.Read
      )
    );

    // Store reference for updates
    this._deviceCountNode = deviceCountParam;

    const infoNode = new NumberedTreeNodeImpl(
      1, // number within root
      new EmberNodeImpl(
        'Info',
        'System Information',
        false, // isRoot
        true   // isOnline
      ),
      { versionParam, deviceCountParam } // children
    );

    // Set parent references
    versionParam.parent = infoNode;
    deviceCountParam.parent = infoNode;

    // Build Devices node with children
    const deviceChildren = {};

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const deviceNumber = i + 1;

      // Create parameters for this device
      const stateParam = new NumberedTreeNodeImpl(
        1,
        new ParameterImpl(
          ParameterType.Enum,
          'State',
          'Playback state',
          STATE_TO_INDEX.stop, // Initial value (index)
          undefined,
          undefined,
          ParameterAccess.Read,
          undefined,       // format
          STATE_ENUM       // enumeration (newline-separated)
        )
      );

      const timecodeParam = new NumberedTreeNodeImpl(
        2,
        new ParameterImpl(
          ParameterType.String,
          'Timecode',
          'Current timecode (HH:MM:SS:FF)',
          '00:00:00:00',
          undefined,
          undefined,
          ParameterAccess.Read
        )
      );

      const filenameParam = new NumberedTreeNodeImpl(
        3,
        new ParameterImpl(
          ParameterType.String,
          'Filename',
          'Current filename',
          '',
          undefined,
          undefined,
          ParameterAccess.Read
        )
      );

      const connectedParam = new NumberedTreeNodeImpl(
        4,
        new ParameterImpl(
          ParameterType.Boolean,
          'Connected',
          'Device connection status',
          false,
          undefined,
          undefined,
          ParameterAccess.Read
        )
      );

      const typeParam = new NumberedTreeNodeImpl(
        5,
        new ParameterImpl(
          ParameterType.String,
          'Type',
          'Device type',
          device.type || 'unknown',
          undefined,
          undefined,
          ParameterAccess.Read
        )
      );

      // Create device node
      const deviceNode = new NumberedTreeNodeImpl(
        deviceNumber,
        new EmberNodeImpl(
          `Device${device.id}`,     // identifier (stable)
          device.name,               // description (display name)
          false,
          true
        ),
        { stateParam, timecodeParam, filenameParam, connectedParam, typeParam }
      );

      // Set parent references
      stateParam.parent = deviceNode;
      timecodeParam.parent = deviceNode;
      filenameParam.parent = deviceNode;
      connectedParam.parent = deviceNode;
      typeParam.parent = deviceNode;

      // Store references for updates
      this._deviceNodes.set(device.id, {
        node: deviceNode,
        state: stateParam,
        timecode: timecodeParam,
        filename: filenameParam,
        connected: connectedParam,
        type: typeParam
      });

      deviceChildren[`device${deviceNumber}`] = deviceNode;
    }

    const devicesNode = new NumberedTreeNodeImpl(
      2, // number within root
      new EmberNodeImpl(
        'Devices',
        'Playout Devices',
        false,
        true
      ),
      deviceChildren
    );

    // Set parent references for device nodes
    for (const key of Object.keys(deviceChildren)) {
      deviceChildren[key].parent = devicesNode;
    }

    // Create root node
    const rootNode = new NumberedTreeNodeImpl(
      1,
      new EmberNodeImpl(
        'SuperDash',
        'SuperDash Playout Monitoring',
        true,  // isRoot
        true   // isOnline
      ),
      { infoNode, devicesNode }
    );

    // Set parent references for top-level children
    infoNode.parent = rootNode;
    devicesNode.parent = rootNode;

    // Return as collection (root level)
    return { rootNode };
  }

  /**
   * Gets the path string for a parameter (for logging).
   *
   * @param {Object} parameter - Parameter tree node
   * @returns {string} Path string
   * @private
   */
  _getParameterPath(parameter) {
    const parts = [];
    let current = parameter;

    while (current) {
      if (current.contents?.identifier) {
        parts.unshift(current.contents.identifier);
      } else if (current.number !== undefined) {
        parts.unshift(String(current.number));
      }
      current = current.parent;
    }

    return parts.join('/');
  }

  /**
   * Returns whether the provider is running.
   *
   * @returns {boolean}
   */
  get isRunning() {
    return this._isRunning;
  }
}

module.exports = EmberPlusProvider;
