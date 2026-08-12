(function (global, kintone) {
  'use strict';

  const NS = global.BulkRecordCreation;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const platform = {
    // 対象者選択・繰り返し設定など自由なレイアウトの入力欄を組み立てるため、テキストのみの
    // kintone.showConfirmDialog()ではなく、本文を自由に組み立てられるkintone.createDialog()を使う。
    createDialog: (dialogConfig) => kintone.createDialog(dialogConfig),
    showLoading: () => kintone.showLoading('VISIBLE'),
    hideLoading: () => kintone.showLoading('HIDDEN'),
  };

  // 一覧画面: 対象グループのメンバーにのみ一括作成ボタンを表示する。
  kintone.events.on('app.record.index.show', (event) => {
    const config = loadConfig();
    NS.BulkCreate.renderButtonIfAuthorized(
      kintone.app.getHeaderMenuSpaceElement(),
      config,
      kintone.app.getId(),
      platform,
    );
    return event;
  });
})(window, kintone);
