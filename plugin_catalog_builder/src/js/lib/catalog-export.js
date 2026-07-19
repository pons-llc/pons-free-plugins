(function (root) {
  'use strict';

  // 台帳アプリのレコード(GET /k/v1/records.jsonのrecords[]、フィールドコード→{value}形式)から、
  // ダウンロード用のプレーンなJSON配列を組み立てる。NotebookLM/ChatGPT等の外部AIツールに読み込ませる
  // ことを想定した形(idea.md「ダウンロード機能」参照)。CDN等の外部通信は一切発生しない。
  const buildExportEntries = (records) =>
    (records || []).map((record) => ({
      plugin_id: record.plugin_id.value,
      plugin_name: record.plugin_name.value,
      plugin_version: record.plugin_version.value,
      plugin_detail: record.plugin_detail.value,
      apps: (record.pcb_apps_table.value || []).map((row) => ({
        app_name: row.value.app_name.value,
        app_id: row.value.app_id.value,
        app_detail: row.value.app_detail.value,
      })),
    }));

  const buildExportFileContent = (records) =>
    JSON.stringify(buildExportEntries(records), null, 2);

  const CatalogExport = { buildExportEntries, buildExportFileContent };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatalogExport;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.CatalogExport = CatalogExport;
  }
})(typeof window !== 'undefined' ? window : globalThis);
