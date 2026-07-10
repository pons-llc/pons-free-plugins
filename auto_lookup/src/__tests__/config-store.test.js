'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty targetFieldCodes array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ targetFieldCodes: [] });
  });

  test('returns the default empty targetFieldCodes array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ targetFieldCodes: [] });
  });

  test('parses a previously saved targetFieldCodes JSON string', () => {
    const saved = {
      targetFieldCodes: JSON.stringify(['lookup_customer', 'history']),
    };
    const config = ConfigStore.load(saved);
    expect(config.targetFieldCodes).toEqual(['lookup_customer', 'history']);
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ targetFieldCodes: '{not valid json' })).toEqual({
      targetFieldCodes: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the targetFieldCodes array into a JSON string payload', () => {
    const config = { targetFieldCodes: ['lookup_customer'] };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.targetFieldCodes).toBe('string');
    expect(JSON.parse(payload.targetFieldCodes)).toEqual(
      config.targetFieldCodes,
    );
  });
});
