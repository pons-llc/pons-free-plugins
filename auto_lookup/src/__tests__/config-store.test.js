'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns an empty fieldTriggers map when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ fieldTriggers: {} });
  });

  test('returns an empty fieldTriggers map when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ fieldTriggers: {} });
  });

  test('parses a previously saved fieldTriggers JSON string', () => {
    const saved = {
      fieldTriggers: JSON.stringify({
        lookup_customer: ['edit.show'],
        history: ['create.show', 'edit.show'],
      }),
    };
    expect(ConfigStore.load(saved).fieldTriggers).toEqual({
      lookup_customer: ['edit.show'],
      history: ['create.show', 'edit.show'],
    });
  });

  test('falls back to an empty fieldTriggers map when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ fieldTriggers: '{not valid json' })).toEqual({
      fieldTriggers: {},
    });
  });

  test('migrates a config saved before per-field timing existed (targetFieldCodes only, no triggerEvents key) to edit.show for every target field', () => {
    const veryOldSaved = {
      targetFieldCodes: JSON.stringify(['lookup_customer', 'history']),
    };
    expect(ConfigStore.load(veryOldSaved).fieldTriggers).toEqual({
      lookup_customer: ['edit.show'],
      history: ['edit.show'],
    });
  });

  test('migrates a config saved when timing was a single app-wide setting (targetFieldCodes + triggerEvents) by applying it to every target field', () => {
    const appWideTimingSaved = {
      targetFieldCodes: JSON.stringify(['lookup_customer', 'history']),
      triggerEvents: JSON.stringify(['create.show', 'edit.show']),
    };
    expect(ConfigStore.load(appWideTimingSaved).fieldTriggers).toEqual({
      lookup_customer: ['create.show', 'edit.show'],
      history: ['create.show', 'edit.show'],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the fieldTriggers map into a JSON string payload', () => {
    const config = {
      fieldTriggers: {
        lookup_customer: ['edit.show'],
        history: ['create.show', 'edit.show'],
      },
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.fieldTriggers).toBe('string');
    expect(JSON.parse(payload.fieldTriggers)).toEqual(config.fieldTriggers);
  });
});
