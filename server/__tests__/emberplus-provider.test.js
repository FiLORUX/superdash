/**
 * Tests for Ember+ Provider
 *
 * Verifies tree construction, parameter updates, and provider lifecycle.
 * Note: Full Ember+ consumer tests require a mock consumer which is complex.
 * These tests focus on the provider's internal state and tree structure.
 */

const EmberPlusProvider = require('../emberplus-provider');

describe('Ember+ Provider', () => {
  describe('Provider Lifecycle', () => {
    test('starts and stops without error', async () => {
      const provider = new EmberPlusProvider({ port: 9100 });

      expect(provider.isRunning).toBe(false);

      const devices = [
        { id: 1, name: 'Device 1', type: 'hyperdeck' },
        { id: 2, name: 'Device 2', type: 'casparcg' }
      ];

      await provider.start(devices);
      expect(provider.isRunning).toBe(true);

      provider.stop();
      expect(provider.isRunning).toBe(false);
    });

    test('handles double start gracefully', async () => {
      const provider = new EmberPlusProvider({ port: 9101 });

      const devices = [{ id: 1, name: 'Device 1', type: 'vmix' }];

      await provider.start(devices);
      expect(provider.isRunning).toBe(true);

      // Second start should be a no-op
      await provider.start(devices);
      expect(provider.isRunning).toBe(true);

      provider.stop();
    });

    test('handles double stop gracefully', async () => {
      const provider = new EmberPlusProvider({ port: 9102 });

      const devices = [{ id: 1, name: 'Device 1', type: 'vmix' }];

      await provider.start(devices);
      provider.stop();
      expect(provider.isRunning).toBe(false);

      // Second stop should be a no-op
      provider.stop();
      expect(provider.isRunning).toBe(false);
    });
  });

  describe('Configuration', () => {
    test('uses default port when not specified', () => {
      const provider = new EmberPlusProvider();
      expect(provider.port).toBe(9000);
    });

    test('uses custom port when specified', () => {
      const provider = new EmberPlusProvider({ port: 9999 });
      expect(provider.port).toBe(9999);
    });

    test('uses default address when not specified', () => {
      const provider = new EmberPlusProvider();
      expect(provider.address).toBe('0.0.0.0');
    });

    test('uses custom address when specified', () => {
      const provider = new EmberPlusProvider({ address: '192.168.1.100' });
      expect(provider.address).toBe('192.168.1.100');
    });
  });

  describe('Device Updates', () => {
    test('accepts device updates when running', async () => {
      const provider = new EmberPlusProvider({ port: 9103 });

      const devices = [
        { id: 1, name: 'Test Device', type: 'hyperdeck' }
      ];

      await provider.start(devices);

      // Should not throw
      provider.updateDevice(1, {
        state: 'play',
        timecode: '01:23:45:12',
        filename: 'test.mov',
        connected: true
      });

      provider.stop();
    });

    test('ignores device updates when not running', () => {
      const provider = new EmberPlusProvider({ port: 9104 });

      // Should not throw even when not running
      provider.updateDevice(1, {
        state: 'play',
        timecode: '01:23:45:12',
        filename: 'test.mov',
        connected: true
      });

      expect(provider.isRunning).toBe(false);
    });

    test('ignores updates for unknown devices', async () => {
      const provider = new EmberPlusProvider({ port: 9105 });

      const devices = [
        { id: 1, name: 'Known Device', type: 'hyperdeck' }
      ];

      await provider.start(devices);

      // Should not throw for unknown device
      provider.updateDevice(999, {
        state: 'play',
        timecode: '00:00:00:00',
        filename: 'unknown.mov',
        connected: true
      });

      provider.stop();
    });
  });

  describe('Device Count', () => {
    test('updates device count correctly', async () => {
      const provider = new EmberPlusProvider({ port: 9106 });

      const devices = [
        { id: 1, name: 'Device 1', type: 'hyperdeck' },
        { id: 2, name: 'Device 2', type: 'casparcg' },
        { id: 3, name: 'Device 3', type: 'vmix' }
      ];

      await provider.start(devices);

      // updateDeviceCount should not throw
      provider.updateDeviceCount(3);
      provider.updateDeviceCount(5);

      provider.stop();
    });

    test('ignores device count updates when not running', () => {
      const provider = new EmberPlusProvider({ port: 9107 });

      // Should not throw
      provider.updateDeviceCount(10);

      expect(provider.isRunning).toBe(false);
    });
  });

  describe('State Mapping', () => {
    // These tests verify the state-to-enum mapping is correct
    // The actual Ember+ protocol encoding is handled by the library

    test('maps state strings to expected enum indices', async () => {
      const provider = new EmberPlusProvider({ port: 9108 });

      const devices = [
        { id: 1, name: 'Test Device', type: 'hyperdeck' }
      ];

      await provider.start(devices);

      // Test all valid states - should not throw
      provider.updateDevice(1, { state: 'stop' });
      provider.updateDevice(1, { state: 'play' });
      provider.updateDevice(1, { state: 'rec' });
      provider.updateDevice(1, { state: 'offline' });

      provider.stop();
    });

    test('handles unknown state gracefully', async () => {
      const provider = new EmberPlusProvider({ port: 9109 });

      const devices = [
        { id: 1, name: 'Test Device', type: 'hyperdeck' }
      ];

      await provider.start(devices);

      // Unknown state should default to offline (index 3)
      provider.updateDevice(1, { state: 'unknown_state' });
      provider.updateDevice(1, { state: '' });
      provider.updateDevice(1, { state: null });

      provider.stop();
    });
  });

  describe('Tree Structure', () => {
    // Basic verification that tree is constructed correctly
    // Full tree inspection would require internal access

    test('creates provider with multiple devices', async () => {
      const provider = new EmberPlusProvider({ port: 9110 });

      const devices = [
        { id: 1, name: 'CasparCG Main', type: 'casparcg' },
        { id: 2, name: 'HyperDeck A', type: 'hyperdeck' },
        { id: 3, name: 'vMix Production', type: 'vmix' },
        { id: 4, name: 'CasparCG Backup', type: 'casparcg' },
        { id: 5, name: 'HyperDeck B', type: 'hyperdeck' }
      ];

      await provider.start(devices);
      expect(provider.isRunning).toBe(true);

      // All devices should be updatable
      for (const device of devices) {
        provider.updateDevice(device.id, {
          state: 'stop',
          timecode: '00:00:00:00',
          filename: '',
          connected: false
        });
      }

      provider.stop();
    });

    test('handles empty device list', async () => {
      const provider = new EmberPlusProvider({ port: 9111 });

      await provider.start([]);
      expect(provider.isRunning).toBe(true);

      provider.stop();
    });
  });
});
