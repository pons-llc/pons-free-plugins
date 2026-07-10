'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('load()はnull/undefinedでも既定値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ rows: [] });
    expect(ConfigStore.load(undefined)).toEqual({ rows: [] });
  });

  test('load()は保存済みJSON文字列をパースする', () => {
    const rows = [
      {
        sourceFieldCode: 'user_code',
        trigger: 'SUBMIT',
        buttonSpaceElementId: '',
        outputEditable: false,
        mappings: [{ attribute: 'name', destinationFieldCode: 'name_out' }],
      },
    ];
    const loaded = ConfigStore.load({ rows: JSON.stringify(rows) });
    expect(loaded.rows).toEqual(rows);
  });

  test('load()は壊れたJSONを既定値にフォールバックする', () => {
    expect(ConfigStore.load({ rows: '{invalid' })).toEqual({ rows: [] });
  });

  test('serialize()はJSON文字列化したペイロードを返す', () => {
    const config = { rows: [{ sourceFieldCode: 'a' }] };
    expect(ConfigStore.serialize(config)).toEqual({
      rows: JSON.stringify(config.rows),
    });
  });
});
