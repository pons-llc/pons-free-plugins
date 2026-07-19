const SyncOrchestrator = require('../js/lib/sync-orchestrator.js');

describe('gather', () => {
  test('プラグイン一覧・利用アプリ・アプリ情報からrecordsと見積もりを組み立てる', async () => {
    const plugins = [
      { id: 'p1', name: 'プラグイン1', description: '説明1', version: '1.0.0' },
      { id: 'p2', name: 'プラグイン2', description: '説明2', version: '2.0.0' },
    ];
    const fetchAllPlugins = jest.fn().mockResolvedValue(plugins);
    const fetchPluginApps = jest.fn((pluginId) => {
      if (pluginId === 'p1')
        return Promise.resolve([{ id: '1', name: 'アプリA' }]);
      return Promise.resolve([
        { id: '1', name: 'アプリA' },
        { id: '2', name: 'アプリB' },
      ]);
    });
    const fetchAppsInfo = jest.fn().mockResolvedValue({
      1: { name: 'アプリA', description: 'Aの説明' },
      2: { name: 'アプリB', description: 'Bの説明' },
    });

    const result = await SyncOrchestrator.gather({
      fetchAllPlugins,
      fetchPluginApps,
      fetchAppsInfo,
    });

    expect(fetchPluginApps).toHaveBeenCalledTimes(2);
    expect(fetchPluginApps).toHaveBeenNthCalledWith(1, 'p1');
    expect(fetchPluginApps).toHaveBeenNthCalledWith(2, 'p2');
    expect(fetchAppsInfo).toHaveBeenCalledWith(['1', '2']);
    expect(result.estimate).toEqual({
      pluginCount: 2,
      uniqueAppCount: 2,
      targetRecordCount: 2,
    });
    expect(result.records[0].updateKey).toEqual({
      field: 'plugin_id',
      value: 'p1',
    });
    expect(result.records[1].record.pcb_apps_table.value.length).toBe(2);
  });

  test('利用アプリが1件も無ければfetchAppsInfoは呼ばれない', async () => {
    const fetchAllPlugins = jest
      .fn()
      .mockResolvedValue([
        { id: 'p1', name: 'X', description: '', version: '1.0' },
      ]);
    const fetchPluginApps = jest.fn().mockResolvedValue([]);
    const fetchAppsInfo = jest.fn();

    const result = await SyncOrchestrator.gather({
      fetchAllPlugins,
      fetchPluginApps,
      fetchAppsInfo,
    });

    expect(fetchAppsInfo).not.toHaveBeenCalled();
    expect(result.estimate).toEqual({
      pluginCount: 1,
      uniqueAppCount: 0,
      targetRecordCount: 1,
    });
  });

  test('複数プラグインが同じアプリを利用する場合、アプリIDの重複を除いてfetchAppsInfoする', async () => {
    const plugins = [
      { id: 'p1', name: 'X', description: '', version: '1.0' },
      { id: 'p2', name: 'Y', description: '', version: '1.0' },
    ];
    const fetchAllPlugins = jest.fn().mockResolvedValue(plugins);
    const fetchPluginApps = jest
      .fn()
      .mockResolvedValue([{ id: '5', name: '共用アプリ' }]);
    const fetchAppsInfo = jest
      .fn()
      .mockResolvedValue({ 5: { name: '共用アプリ', description: '' } });

    const result = await SyncOrchestrator.gather({
      fetchAllPlugins,
      fetchPluginApps,
      fetchAppsInfo,
    });

    expect(fetchAppsInfo).toHaveBeenCalledWith(['5']);
    expect(result.estimate.uniqueAppCount).toBe(1);
  });
});

describe('write', () => {
  test('100件ずつバッチでputRecordsBatchを呼ぶ', async () => {
    const records = Array.from({ length: 150 }, (_, i) => ({ id: i }));
    const putRecordsBatch = jest.fn().mockResolvedValue(undefined);

    const result = await SyncOrchestrator.write({ records, putRecordsBatch });

    expect(putRecordsBatch).toHaveBeenCalledTimes(2);
    expect(putRecordsBatch.mock.calls[0][0].length).toBe(100);
    expect(putRecordsBatch.mock.calls[1][0].length).toBe(50);
    expect(result).toEqual({ writtenCount: 150, batchCount: 2 });
  });

  test('0件ならputRecordsBatchは呼ばれない', async () => {
    const putRecordsBatch = jest.fn();
    const result = await SyncOrchestrator.write({
      records: [],
      putRecordsBatch,
    });
    expect(putRecordsBatch).not.toHaveBeenCalled();
    expect(result).toEqual({ writtenCount: 0, batchCount: 0 });
  });
});
