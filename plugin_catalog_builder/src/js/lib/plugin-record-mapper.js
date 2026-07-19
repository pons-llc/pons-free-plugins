(function (root) {
  'use strict';

  // GET /k/v1/plugins.json・GET /k/v1/plugin/apps.json・GET /k/v1/apps.json の3種のレスポンスから、
  // PUT /k/v1/records.json(upsert: true, updateKey: plugin_id)用のrecords配列を組み立てる。
  // idea.md「同期(取得してUPSERT)フロー」参照。

  const NO_APP_INFO_DETAIL = '(アプリ情報を取得できませんでした)';

  // apps.json の1件から app_detail用の説明文を組み立てる。
  const buildAppDetail = (appInfo) => {
    if (!appInfo) {
      return NO_APP_INFO_DETAIL;
    }
    return appInfo.description || '';
  };

  // plugin: { id, name, description, version, isMarketPlugin }
  // pluginAppsById: { [pluginId]: [{ id, name }] }(GET /k/v1/plugin/apps.jsonの結果、app名は常に取得できる)
  // appInfoById: { [appId]: { name, description, spaceId } }(GET /k/v1/apps.jsonの結果。
  //   閲覧権限が無いアプリは含まれないため、該当キーが無いことがある)
  const buildUpsertRecords = (plugins, pluginAppsById, appInfoById) => {
    const appsMap = pluginAppsById || {};
    const infoMap = appInfoById || {};

    return (plugins || []).map((plugin) => {
      const usageApps = appsMap[plugin.id] || [];
      const tableRows = usageApps.map((app) => {
        const info = infoMap[app.id];
        return {
          value: {
            app_name: { value: app.name || '' },
            app_id: { value: String(app.id) },
            app_detail: { value: buildAppDetail(info) },
          },
        };
      });

      return {
        updateKey: { field: 'plugin_id', value: plugin.id },
        record: {
          plugin_name: { value: plugin.name || '' },
          plugin_version: { value: plugin.version || '' },
          plugin_detail: { value: plugin.description || '' },
          pcb_apps_table: { value: tableRows },
        },
      };
    });
  };

  // PUT /k/v1/records.json は1リクエスト最大100件のため、指定件数ずつ分割する。
  const chunkRecords = (records, chunkSize) => {
    const size = chunkSize || 100;
    const chunks = [];
    for (let i = 0; i < records.length; i += size) {
      chunks.push(records.slice(i, i + size));
    }
    return chunks;
  };

  const PluginRecordMapper = {
    buildUpsertRecords,
    chunkRecords,
    NO_APP_INFO_DETAIL,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginRecordMapper;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.PluginRecordMapper = PluginRecordMapper;
  }
})(typeof window !== 'undefined' ? window : globalThis);
