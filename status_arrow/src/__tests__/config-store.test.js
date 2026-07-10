'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns the default empty widgets array when saved is null (unconfigured app)', () => {
    expect(ConfigStore.load(null)).toEqual({ widgets: [] });
  });

  test('returns the default empty widgets array when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual({ widgets: [] });
  });

  test('parses a previously saved widgets JSON string', () => {
    const saved = {
      widgets: JSON.stringify([
        {
          sourceType: 'FIELD',
          fieldCode: 'progress',
          steps: ['申請中', '承認中', '完了'],
          design: 'BLUE',
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.widgets).toHaveLength(1);
    expect(config.widgets[0].sourceType).toBe('FIELD');
  });

  test('falls back to the default when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ widgets: '{not valid json' })).toEqual({
      widgets: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes the widgets array into a JSON string payload', () => {
    const config = {
      widgets: [
        {
          sourceType: 'STATUS',
          fieldCode: '',
          steps: ['未処理'],
          design: 'DEFAULT',
        },
      ],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.widgets).toBe('string');
    expect(JSON.parse(payload.widgets)).toEqual(config.widgets);
  });
});
