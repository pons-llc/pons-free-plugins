(function (root) {
  'use strict';

  // 台帳アプリのレコードから、簡易AI検索(ベクトル検索)用のコーパスエントリを組み立てる。
  // site/js/ai-search.jsのコーパス(window.__PLUGIN_CORPUS__)と同じ「1件=1passageテキスト」の
  // 考え方を、静的データではなくこのアプリの実レコードに置き換えたもの(idea.md参照)。
  const buildCorpusEntry = (record) => {
    const appNames = (record.pcb_apps_table.value || [])
      .map((row) => row.value.app_name.value)
      .filter(Boolean);
    const text = [
      record.plugin_name.value,
      record.plugin_detail.value,
      appNames.length > 0 ? `利用アプリ: ${appNames.join('、')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      pluginId: record.plugin_id.value,
      name: record.plugin_name.value,
      version: record.plugin_version.value,
      description: record.plugin_detail.value,
      appNames,
      text,
    };
  };

  const buildCorpus = (records) => (records || []).map(buildCorpusEntry);

  const CatalogSearchCorpus = { buildCorpusEntry, buildCorpus };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatalogSearchCorpus;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.CatalogSearchCorpus = CatalogSearchCorpus;
  }
})(typeof window !== 'undefined' ? window : globalThis);
