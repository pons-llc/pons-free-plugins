(function (root) {
  'use strict';

  // 同期(取得してUPSERT)フローのオーケストレーション。REST呼び出し自体は関数として注入し、
  // このファイル自体はkintone/ネットワークに依存しない(resolve-org-info.js・bulk-summary.jsと
  // 同じ「取得関数を注入してオーケストレーションだけをテストする」設計)。
  // idea.md「同期(取得してUPSERT)フロー」参照。実際の書き込み(write)は、呼び出し側で
  // kintone.showConfirmDialog()による確認を挟んでから別途runWriteを呼ぶ想定(gatherは読み取りのみ)。

  const PluginRecordMapper =
    typeof module !== 'undefined' && module.exports
      ? require('./plugin-record-mapper.js')
      : root.PluginCatalogBuilder.PluginRecordMapper;

  // 全プラグイン・利用アプリ・アプリ情報を集め、UPSERT用のrecords配列と見積もり値を組み立てる
  // (読み取りのみ、書き込みは行わない)。
  const gather = async ({
    fetchAllPlugins,
    fetchPluginApps,
    fetchAppsInfo,
  }) => {
    const plugins = await fetchAllPlugins();

    const pluginAppsById = {};
    for (const plugin of plugins) {
      pluginAppsById[plugin.id] = await fetchPluginApps(plugin.id);
    }

    const uniqueAppIds = Array.from(
      new Set(
        Object.values(pluginAppsById).flatMap((apps) => apps.map((a) => a.id)),
      ),
    );

    const appInfoById =
      uniqueAppIds.length > 0 ? await fetchAppsInfo(uniqueAppIds) : {};

    const records = PluginRecordMapper.buildUpsertRecords(
      plugins,
      pluginAppsById,
      appInfoById,
    );

    return {
      plugins,
      pluginAppsById,
      appInfoById,
      records,
      estimate: {
        pluginCount: plugins.length,
        uniqueAppCount: uniqueAppIds.length,
        targetRecordCount: records.length,
      },
    };
  };

  // gather()の結果(records)を100件ずつに分割して書き込む。
  const write = async ({ records, putRecordsBatch, chunkSize }) => {
    const chunks = PluginRecordMapper.chunkRecords(records, chunkSize);
    for (const chunk of chunks) {
      await putRecordsBatch(chunk);
    }
    return { writtenCount: records.length, batchCount: chunks.length };
  };

  const SyncOrchestrator = { gather, write };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncOrchestrator;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.SyncOrchestrator = SyncOrchestrator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
