'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('load() returns the default ({ rules: [] }) when saved is null/undefined', () => {
    expect(ConfigStore.load(null)).toEqual({ rules: [] });
    expect(ConfigStore.load(undefined)).toEqual({ rules: [] });
  });

  test('load() parses a saved JSON payload', () => {
    const rules = [{ baseFieldCode: 'a', targetFieldCode: 'b' }];
    expect(ConfigStore.load({ rules: JSON.stringify(rules) })).toEqual({
      rules,
    });
  });

  test('load() falls back to the default when the saved payload is malformed JSON', () => {
    expect(ConfigStore.load({ rules: '{not json' })).toEqual({ rules: [] });
  });

  test('serialize() round-trips through load()', () => {
    const config = { rules: [{ baseFieldCode: 'a', targetFieldCode: 'b' }] };
    expect(ConfigStore.load(ConfigStore.serialize(config))).toEqual(config);
  });
});
