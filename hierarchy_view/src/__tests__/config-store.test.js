'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty config when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({
      parentFieldCode: '',
      matchFieldCode: '',
    });
  });

  test('returns the default empty config when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({
      parentFieldCode: '',
      matchFieldCode: '',
    });
  });

  test('reads previously saved field codes', () => {
    const saved = { parentFieldCode: 'parent_code', matchFieldCode: '$id' };
    expect(ConfigStore.load(saved)).toEqual({
      parentFieldCode: 'parent_code',
      matchFieldCode: '$id',
    });
  });

  test('falls back to an empty string for a missing individual key', () => {
    expect(ConfigStore.load({ parentFieldCode: 'parent_code' })).toEqual({
      parentFieldCode: 'parent_code',
      matchFieldCode: '',
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the config fields as-is (plain strings, no JSON wrapping)', () => {
    const config = { parentFieldCode: 'parent_code', matchFieldCode: '$id' };
    expect(ConfigStore.serialize(config)).toEqual(config);
  });
});
