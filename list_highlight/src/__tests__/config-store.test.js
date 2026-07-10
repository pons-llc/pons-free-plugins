'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty rules array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ rules: [] });
  });

  test('returns the default empty rules array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ rules: [] });
  });

  test('parses a previously saved rules JSON string', () => {
    const saved = {
      rules: JSON.stringify([
        {
          condition: {
            conditionOperator: 'AND',
            children: [
              { fieldCode: 'status', operator: 'EQ', value: '対応中' },
            ],
          },
          backgroundColor: '#ff0000',
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].backgroundColor).toBe('#ff0000');
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ rules: '{not valid json' })).toEqual({
      rules: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the rules array into a JSON string payload', () => {
    const config = {
      rules: [
        {
          condition: { conditionOperator: 'AND', children: [] },
          backgroundColor: '#00ff00',
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.rules).toBe('string');
    expect(JSON.parse(payload.rules)).toEqual(config.rules);
  });
});
