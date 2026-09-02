'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the defaults (targetFieldCodes: [], triggerEvents: [edit.show]) when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({
      targetFieldCodes: [],
      triggerEvents: ['edit.show'],
    });
  });

  test('returns the defaults when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({
      targetFieldCodes: [],
      triggerEvents: ['edit.show'],
    });
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
      triggerEvents: ['edit.show'],
    });
  });

  test('defaults triggerEvents to [edit.show] when a config saved before this feature existed has no triggerEvents key (backward compatibility)', () => {
    const savedByOlderVersion = {
      targetFieldCodes: JSON.stringify(['lookup_customer']),
    };
    expect(ConfigStore.load(savedByOlderVersion).triggerEvents).toEqual([
      'edit.show',
    ]);
  });

  test('parses a previously saved triggerEvents JSON string', () => {
    const saved = {
      targetFieldCodes: JSON.stringify([]),
      triggerEvents: JSON.stringify(['create.show', 'edit.show']),
    };
    expect(ConfigStore.load(saved).triggerEvents).toEqual([
      'create.show',
      'edit.show',
    ]);
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the targetFieldCodes and triggerEvents arrays into JSON string payloads', () => {
    const config = {
      targetFieldCodes: ['lookup_customer'],
      triggerEvents: ['create.show', 'edit.show'],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.targetFieldCodes).toBe('string');
    expect(typeof payload.triggerEvents).toBe('string');
    expect(JSON.parse(payload.targetFieldCodes)).toEqual(
      config.targetFieldCodes,
    );
    expect(JSON.parse(payload.triggerEvents)).toEqual(config.triggerEvents);
  });
});
