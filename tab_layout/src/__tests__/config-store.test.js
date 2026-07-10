'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty layouts array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ layouts: [] });
  });

  test('returns the default empty layouts array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ layouts: [] });
  });

  test('parses a previously saved layouts JSON string', () => {
    const saved = {
      layouts: JSON.stringify([
        {
          spaceElementId: 'Space_0',
          defaultTabIndex: 0,
          tabs: [{ label: '基本情報', itemCodes: ['name'] }],
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.layouts).toHaveLength(1);
    expect(config.layouts[0].spaceElementId).toBe('Space_0');
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ layouts: '{not valid json' })).toEqual({
      layouts: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the layouts array into a JSON string payload', () => {
    const config = {
      layouts: [{ spaceElementId: 'Space_0', defaultTabIndex: 0, tabs: [] }],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.layouts).toBe('string');
    expect(JSON.parse(payload.layouts)).toEqual(config.layouts);
  });
});
