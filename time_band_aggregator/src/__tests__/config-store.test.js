'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('load()はnull/undefinedでも既定値を返す', () => {
    const expected = {
      rows: [],
      trigger: 'CHANGE',
      bulkEnabled: false,
      bulkGroupCodes: [],
    };
    expect(ConfigStore.load(null)).toEqual(expected);
    expect(ConfigStore.load(undefined)).toEqual(expected);
  });

  test('load()は保存済みJSON文字列をパースする', () => {
    const rows = [
      {
        sourceFieldCode: 'datetime_field',
        bandWidthMinutes: 60,
        dropdownFieldCode: 'datetime_field_timeband',
        numberFieldCode: 'datetime_field_timeband_num',
      },
    ];
    const loaded = ConfigStore.load({
      rows: JSON.stringify(rows),
      trigger: 'SUBMIT',
      bulkEnabled: 'true',
      bulkGroupCodes: JSON.stringify(['group_a']),
    });
    expect(loaded).toEqual({
      rows,
      trigger: 'SUBMIT',
      bulkEnabled: true,
      bulkGroupCodes: ['group_a'],
    });
  });

  test('load()は壊れたJSONを既定値にフォールバックする', () => {
    const loaded = ConfigStore.load({
      rows: '{invalid',
      bulkGroupCodes: '[invalid',
    });
    expect(loaded.rows).toEqual([]);
    expect(loaded.bulkGroupCodes).toEqual([]);
  });

  test('load()はtrigger未指定・不正値をCHANGEにフォールバックする', () => {
    expect(ConfigStore.load({ trigger: 'UNKNOWN' }).trigger).toBe('CHANGE');
    expect(ConfigStore.load({}).trigger).toBe('CHANGE');
  });

  test('serialize()はJSON文字列化・真偽値文字列化したペイロードを返す', () => {
    const config = {
      rows: [{ sourceFieldCode: 'a', bandWidthMinutes: 30 }],
      trigger: 'SUBMIT',
      bulkEnabled: true,
      bulkGroupCodes: ['group_a', 'group_b'],
    };
    expect(ConfigStore.serialize(config)).toEqual({
      rows: JSON.stringify(config.rows),
      trigger: 'SUBMIT',
      bulkEnabled: 'true',
      bulkGroupCodes: JSON.stringify(config.bulkGroupCodes),
    });
  });
});
