(function (global, kintone) {
  'use strict';

  const NS = global.BulkFieldUpdate;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const platform = {
    // 書き込む値を対象フィールドごとの編集可能な入力欄として表示するため、テキストのみの
    // kintone.mobile.showConfirmBottomSheet()ではなく、本文を自由に組み立てられる
    // kintone.mobile.createBottomSheet()を使う(kintone.createDialog()のモバイル版)。
    createDialog: (dialogConfig) =>
      kintone.mobile.createBottomSheet(dialogConfig),
    showLoading: () => kintone.mobile.showLoading('VISIBLE'),
    hideLoading: () => kintone.mobile.showLoading('HIDDEN'),
    getQueryCondition: () => kintone.mobile.app.getQueryCondition() || '',
  };

  // 一覧画面: 対象グループのメンバーにのみ一括更新ボタンを表示する。
  kintone.events.on('mobile.app.record.index.show', (event) => {
    const config = loadConfig();
    NS.BulkUpdate.renderButtonIfAuthorized(
      kintone.mobile.app.getHeaderSpaceElement(),
      config,
      kintone.app.getId(),
      platform,
    );
    return event;
  });
})(window, kintone);
