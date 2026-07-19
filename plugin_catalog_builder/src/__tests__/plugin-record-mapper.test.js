const PluginRecordMapper = require('../js/lib/plugin-record-mapper.js');

describe('buildUpsertRecords', () => {
  test('利用アプリがあり、アプリ情報も取得できる場合', () => {
    const plugins = [
      {
        id: 'p1',
        name: 'サンプルプラグイン',
        description: '説明1',
        version: '1.0.0',
      },
    ];
    const pluginAppsById = { p1: [{ id: '1', name: 'アプリA' }] };
    const appInfoById = {
      1: { name: 'アプリA', description: 'アプリAの説明', spaceId: '2' },
    };

    const records = PluginRecordMapper.buildUpsertRecords(
      plugins,
      pluginAppsById,
      appInfoById,
    );

    expect(records).toEqual([
      {
        updateKey: { field: 'plugin_id', value: 'p1' },
        record: {
          plugin_name: { value: 'サンプルプラグイン' },
          plugin_version: { value: '1.0.0' },
          plugin_detail: { value: '説明1' },
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
        },
      },
    ]);
  });

  test('利用アプリが0件のプラグインはテーブルが空配列になる', () => {
    const plugins = [
      { id: 'p2', name: '未使用プラグイン', description: '', version: '2.0.0' },
    ];
    const records = PluginRecordMapper.buildUpsertRecords(plugins, {}, {});
    expect(records[0].record.pcb_apps_table.value).toEqual([]);
  });

  test('アプリ情報(apps.json)側に閲覧権限が無く含まれない場合、app_detailはフォールバック文言になる', () => {
    const plugins = [
      { id: 'p3', name: 'X', description: '', version: '1.0.0' },
    ];
    const pluginAppsById = { p3: [{ id: '99', name: '権限外アプリ' }] };
    const records = PluginRecordMapper.buildUpsertRecords(
      plugins,
      pluginAppsById,
      {},
    );
    expect(records[0].record.pcb_apps_table.value[0].value).toEqual({
      app_name: { value: '権限外アプリ' },
      app_id: { value: '99' },
      app_detail: { value: PluginRecordMapper.NO_APP_INFO_DETAIL },
    });
  });

  test('plugins/pluginAppsById/appInfoByIdが省略値でも例外にならない', () => {
    expect(PluginRecordMapper.buildUpsertRecords([], null, null)).toEqual([]);
    expect(PluginRecordMapper.buildUpsertRecords(null, null, null)).toEqual([]);
  });
});

describe('chunkRecords', () => {
  test('100件ずつに分割する(デフォルト)', () => {
    const records = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    const chunks = PluginRecordMapper.chunkRecords(records);
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(100);
    expect(chunks[2].length).toBe(50);
  });

  test('件数がchunkSize未満なら1チャンクのみ', () => {
    const records = [{ id: 1 }, { id: 2 }];
    expect(PluginRecordMapper.chunkRecords(records, 100)).toEqual([records]);
  });

  test('空配列なら空配列', () => {
    expect(PluginRecordMapper.chunkRecords([])).toEqual([]);
  });
});
