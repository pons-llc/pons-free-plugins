(function (global, kintone) {
  'use strict';

  const NS = global.BulkRecordCreation;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const platform = {
    // kintone.createDialog()のモバイル版。config引数の形・戻り値は共通(desktop.jsのコメント参照)。
    createDialog: (dialogConfig) =>
      kintone.mobile.createBottomSheet(dialogConfig),
    showLoading: () => kintone.mobile.showLoading('VISIBLE'),
    hideLoading: () => kintone.mobile.showLoading('HIDDEN'),
  };

  // 一覧画面: 対象グループのメンバーにのみ一括作成ボタンを表示する。
  kintone.events.on('mobile.app.record.index.show', (event) => {
    const config = loadConfig();
    NS.BulkCreate.renderButtonIfAuthorized(
      kintone.mobile.app.getHeaderSpaceElement(),
      config,
      kintone.app.getId(),
      platform,
    );
    return event;
  });
})(window, kintone);
