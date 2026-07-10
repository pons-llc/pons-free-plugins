'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty splits array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ splits: [] });
  });

  test('returns the default empty splits array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ splits: [] });
  });

  test('parses a previously saved splits JSON string', () => {
    const saved = {
      splits: JSON.stringify([
        {
          sourceFieldCode: 'address',
          delimiterMode: 'CHARACTERS',
          delimiters: ['-'],
          pattern: '',
          targetFieldCodes: ['chome', 'banchi', 'go'],
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.splits).toHaveLength(1);
    expect(config.splits[0].delimiterMode).toBe('CHARACTERS');
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ splits: '{not valid json' })).toEqual({
      splits: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the splits array into a JSON string payload', () => {
    const config = {
      splits: [
        {
          sourceFieldCode: 'address',
          delimiterMode: 'REGEX',
          delimiters: [],
          pattern: '\\d+',
          targetFieldCodes: ['a', 'b'],
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.splits).toBe('string');
    expect(JSON.parse(payload.splits)).toEqual(config.splits);
  });
});
