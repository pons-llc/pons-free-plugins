'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty lookups array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ lookups: [] });
  });

  test('returns the default empty lookups array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ lookups: [] });
  });

  test('parses a previously saved lookups JSON string', () => {
    const saved = {
      lookups: JSON.stringify([
        {
          selfKeyFieldCode: 'customer_code',
          otherKeyFieldCode: 'code',
          conditions: [],
          fieldMappings: [
            { sourceFieldCode: 'name', targetFieldCode: 'customer_name' },
          ],
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.lookups).toHaveLength(1);
    expect(config.lookups[0].selfKeyFieldCode).toBe('customer_code');
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ lookups: '{not valid json' })).toEqual({
      lookups: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the lookups array into a JSON string payload', () => {
    const config = {
      lookups: [
        {
          selfKeyFieldCode: 'customer_code',
          otherKeyFieldCode: 'code',
          conditions: [],
          fieldMappings: [],
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.lookups).toBe('string');
    expect(JSON.parse(payload.lookups)).toEqual(config.lookups);
  });
});
