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
          triggerEvent: 'EDIT_SUBMIT',
          title: '確認',
          body: '保存しますか?',
          okButtonText: '',
          cancelButtonText: '',
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].triggerEvent).toBe('EDIT_SUBMIT');
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
          triggerEvent: 'PROCESS_PROCEED',
          title: '',
          body: '{action}を実行しますか?',
          okButtonText: '実行',
          cancelButtonText: 'やめる',
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.rules).toBe('string');
    expect(JSON.parse(payload.rules)).toEqual(config.rules);
  });
});
