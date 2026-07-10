'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty extracts array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ extracts: [] });
  });

  test('returns the default empty extracts array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ extracts: [] });
  });

  test('parses a previously saved extracts JSON string', () => {
    const saved = {
      extracts: JSON.stringify([
        {
          sourceFieldCode: 'address',
          includeFullWidth: true,
          includeKanji: true,
          targetFieldCodes: ['chome', 'banchi', 'go'],
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.extracts).toHaveLength(1);
    expect(config.extracts[0].includeKanji).toBe(true);
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ extracts: '{not valid json' })).toEqual({
      extracts: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the extracts array into a JSON string payload', () => {
    const config = {
      extracts: [
        {
          sourceFieldCode: 'address',
          includeFullWidth: false,
          includeKanji: false,
          targetFieldCodes: ['a', 'b'],
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.extracts).toBe('string');
    expect(JSON.parse(payload.extracts)).toEqual(config.extracts);
  });
});
