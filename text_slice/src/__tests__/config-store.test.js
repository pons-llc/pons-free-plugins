'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty slices array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ slices: [] });
  });

  test('returns the default empty slices array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ slices: [] });
  });

  test('parses a previously saved slices JSON string', () => {
    const saved = {
      slices: JSON.stringify([
        {
          sourceFieldCode: 'code',
          func: 'LEFT',
          start: 1,
          length: 3,
          targetFieldCode: 'prefix',
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.slices).toHaveLength(1);
    expect(config.slices[0].func).toBe('LEFT');
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ slices: '{not valid json' })).toEqual({
      slices: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the slices array into a JSON string payload', () => {
    const config = {
      slices: [
        {
          sourceFieldCode: 'code',
          func: 'MID',
          start: 2,
          length: 3,
          targetFieldCode: 'middle',
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.slices).toBe('string');
    expect(JSON.parse(payload.slices)).toEqual(config.slices);
  });
});
