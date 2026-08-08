(function (global, kintone) {
  'use strict';

  const NS = global.BulkFieldUpdate;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const platform = {
    // 書き込む値を対象フィールドごとの編集可能な入力欄として表示するため、テキストのみの
    // kintone.showConfirmDialog()ではなく、本文を自由に組み立てられるkintone.createDialog()を使う。
    createDialog: (dialogConfig) => kintone.createDialog(dialogConfig),
    showLoading: () => kintone.showLoading('VISIBLE'),
    hideLoading: () => kintone.showLoading('HIDDEN'),
    getQueryCondition: () => kintone.app.getQueryCondition() || '',
  };

  // 一覧画面: 対象グループのメンバーにのみ一括更新ボタンを表示する。
  kintone.events.on('app.record.index.show', (event) => {
    const config = loadConfig();
    NS.BulkUpdate.renderButtonIfAuthorized(
      kintone.app.getHeaderMenuSpaceElement(),
      config,
      kintone.app.getId(),
      platform,
    );
    return event;
  });
})(window, kintone);
