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
          subtableFieldCode: 'history',
          mode: 'LATEST',
          conditionFieldCode: 'inspection_date',
          matchValue: '',
          direction: 'TOP_TO_BOTTOM',
          fieldMappings: [
            { subtableColumnCode: 'result', targetFieldCode: 'latest_result' },
          ],
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.lookups).toHaveLength(1);
    expect(config.lookups[0].mode).toBe('LATEST');
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
          subtableFieldCode: 'history',
          mode: 'TOP_ROW',
          conditionFieldCode: '',
          matchValue: '',
          direction: 'TOP_TO_BOTTOM',
          fieldMappings: [],
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.lookups).toBe('string');
    expect(JSON.parse(payload.lookups)).toEqual(config.lookups);
  });
});
