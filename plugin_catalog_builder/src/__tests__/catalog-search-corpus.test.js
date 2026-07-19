const CatalogSearchCorpus = require('../js/lib/catalog-search-corpus.js');

const sampleRecord = (overrides) => ({
  plugin_id: { value: 'p1' },
  plugin_name: { value: 'サンプルプラグイン' },
  plugin_version: { value: '1.0.0' },
  plugin_detail: { value: 'プラグインの説明文' },
  pcb_apps_table: {
    value: [
      {
        value: {
          app_name: { value: 'アプリA' },
          app_id: { value: '1' },
          app_detail: { value: '' },
        },
      },
      {
        value: {
          app_name: { value: 'アプリB' },
          app_id: { value: '2' },
          app_detail: { value: '' },
        },
      },
    ],
  },
  ...overrides,
});

describe('buildCorpusEntry', () => {
  test('プラグイン名・説明・利用アプリ名を1つのテキストにまとめる', () => {
    const entry = CatalogSearchCorpus.buildCorpusEntry(sampleRecord());
    expect(entry.pluginId).toBe('p1');
    expect(entry.appNames).toEqual(['アプリA', 'アプリB']);
    expect(entry.text).toBe(
      'サンプルプラグイン\nプラグインの説明文\n利用アプリ: アプリA、アプリB',
    );
  });

  test('利用アプリが0件なら「利用アプリ:」行を含めない', () => {
    const record = sampleRecord({ pcb_apps_table: { value: [] } });
    const entry = CatalogSearchCorpus.buildCorpusEntry(record);
    expect(entry.text).toBe('サンプルプラグイン\nプラグインの説明文');
    expect(entry.appNames).toEqual([]);
  });

  test('詳細が空文字列でも例外にならない', () => {
    const record = sampleRecord({ plugin_detail: { value: '' } });
    const entry = CatalogSearchCorpus.buildCorpusEntry(record);
    expect(entry.text).toBe('サンプルプラグイン\n利用アプリ: アプリA、アプリB');
  });
});

describe('buildCorpus', () => {
  test('複数レコードをコーパス配列に変換する', () => {
    const corpus = CatalogSearchCorpus.buildCorpus([
      sampleRecord(),
      sampleRecord({ plugin_id: { value: 'p2' } }),
    ]);
    expect(corpus.map((c) => c.pluginId)).toEqual(['p1', 'p2']);
  });

  test('recordsが無い場合は空配列', () => {
    expect(CatalogSearchCorpus.buildCorpus(null)).toEqual([]);
  });
});
