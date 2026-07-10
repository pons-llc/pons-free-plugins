const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('空/未保存の設定は既定値を返す', () => {
    const config = ConfigStore.load({});
    expect(config.templateSource).toEqual({
      appId: '',
      recordId: '',
      fieldCode: '',
    });
    expect(config.mappings).toEqual([]);
    expect(config.subtables).toEqual([]);
    expect(config.fileNameTemplate).toBe('report');
    expect(config.bulkDownloadLimit).toBe(100);
  });

  test('getConfig()がnull/undefinedを返す場合も例外にせず既定値にする', () => {
    expect(() => ConfigStore.load(null)).not.toThrow();
    expect(ConfigStore.load(null)).toEqual(ConfigStore.load({}));
    expect(() => ConfigStore.load(undefined)).not.toThrow();
  });

  test('保存済み設定はそのまま読み込む(serialize/loadの往復でデータが失われない)', () => {
    const original = {
      templateSource: { appId: '12', recordId: '3', fieldCode: 'attachment' },
      mappings: [
        { sheetName: '請求書', cellAddress: 'B2', fieldCode: 'customer_name' },
      ],
      subtables: [
        {
          tableFieldCode: 'detail',
          sheetName: '明細',
          startRow: 6,
          maxRows: 20,
          columns: [{ column: 'A', fieldCode: 'item_name' }],
        },
      ],
      fileNameTemplate: '{customer_name}_請求書',
      bulkDownloadLimit: 50,
    };
    const serialized = ConfigStore.serialize(original);
    const loaded = ConfigStore.load(serialized);
    expect(loaded).toEqual(original);
  });

  test('壊れたJSON文字列が保存されていても例外にせず既定値にフォールバックする', () => {
    const config = ConfigStore.load({
      mappings: '{不正なJSON',
      subtables: 'also broken',
    });
    expect(config.mappings).toEqual([]);
    expect(config.subtables).toEqual([]);
  });
});

describe('ConfigStore.serialize', () => {
  test('setConfig()に渡せる、値がすべて文字列のオブジェクトを返す', () => {
    const config = ConfigStore.load({});
    const serialized = ConfigStore.serialize(config);
    Object.values(serialized).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });
});
