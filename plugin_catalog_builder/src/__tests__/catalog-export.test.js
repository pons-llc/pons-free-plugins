const CatalogExport = require('../js/lib/catalog-export.js');

const sampleRecord = (overrides) => ({
  plugin_id: { value: 'p1' },
  plugin_name: { value: 'サンプルプラグイン' },
  plugin_version: { value: '1.0.0' },
  plugin_detail: { value: '説明' },
  pcb_apps_table: {
    value: [
      {
        value: {
          app_name: { value: 'アプリA' },
          app_id: { value: '1' },
          app_detail: { value: 'アプリAの説明' },
        },
      },
    ],
  },
  ...overrides,
});

describe('buildExportEntries', () => {
  test('レコードをプレーンなオブジェクト配列に変換する', () => {
    const entries = CatalogExport.buildExportEntries([sampleRecord()]);
    expect(entries).toEqual([
      {
        plugin_id: 'p1',
        plugin_name: 'サンプルプラグイン',
        plugin_version: '1.0.0',
        plugin_detail: '説明',
        apps: [
          { app_name: 'アプリA', app_id: '1', app_detail: 'アプリAの説明' },
        ],
      },
    ]);
  });

  test('テーブルが空配列のレコードはappsも空配列になる', () => {
    const record = sampleRecord({ pcb_apps_table: { value: [] } });
    expect(CatalogExport.buildExportEntries([record])[0].apps).toEqual([]);
  });

  test('recordsがnull/undefinedでも空配列を返す', () => {
    expect(CatalogExport.buildExportEntries(null)).toEqual([]);
    expect(CatalogExport.buildExportEntries(undefined)).toEqual([]);
  });
});

describe('buildExportFileContent', () => {
  test('整形済みJSON文字列を返す', () => {
    const content = CatalogExport.buildExportFileContent([sampleRecord()]);
    expect(JSON.parse(content)).toEqual(
      CatalogExport.buildExportEntries([sampleRecord()]),
    );
    expect(content).toContain('\n');
  });
});
