(function (root) {
  'use strict';

  // 同期(取得してUPSERT)実行前の確認ダイアログに出す、API実行回数見積もりの計算式。
  // idea.md「同期(取得してUPSERT)フロー」の概算式: プラグイン一覧取得 + プラグインごとの
  // 利用アプリ取得 + アプリ情報取得(100件区切り) + 台帳アプリへの書き込み(100件区切り)。
  const estimateApiCallCount = ({
    pluginCount,
    uniqueAppCount,
    targetRecordCount,
  }) => {
    const pluginListCalls = pluginCount > 0 ? Math.ceil(pluginCount / 100) : 1;
    const pluginAppsCalls = pluginCount;
    const appInfoCalls = Math.ceil(uniqueAppCount / 100);
    const writeCalls = Math.ceil(targetRecordCount / 100);
    return pluginListCalls + pluginAppsCalls + appInfoCalls + writeCalls;
  };

  const buildConfirmMessage = ({
    pluginCount,
    uniqueAppCount,
    targetRecordCount,
  }) => {
    const totalCalls = estimateApiCallCount({
      pluginCount,
      uniqueAppCount,
      targetRecordCount,
    });
    return (
      `対象プラグイン数: ${pluginCount}件\n` +
      `利用アプリ数(延べ、重複除く): ${uniqueAppCount}件\n` +
      `台帳アプリへの書き込みレコード数: ${targetRecordCount}件\n` +
      `概算APIリクエスト回数: 約${totalCalls}回\n\n` +
      '同期を実行しますか?'
    );
  };

  const ApiEstimate = { estimateApiCallCount, buildConfirmMessage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiEstimate;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.ApiEstimate = ApiEstimate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
