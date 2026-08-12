(function (global, kintone) {
  'use strict';

  const NS = global.BulkApproval;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const platform = {
    createDialog: (dialogConfig) => kintone.createDialog(dialogConfig),
    showLoading: () => kintone.showLoading('VISIBLE'),
    hideLoading: () => kintone.showLoading('HIDDEN'),
    getQueryCondition: () => kintone.app.getQueryCondition() || '',
  };

  // 一覧画面: 対象グループのメンバーにのみ一括承認ボタンを表示する(idea.md「対応画面」参照)。
  kintone.events.on('app.record.index.show', (event) => {
    const config = loadConfig();
    NS.BulkApprovalMain.renderButtonIfEligible(
      kintone.app.getHeaderMenuSpaceElement(),
      config,
      kintone.app.getId(),
      platform,
      event.viewType,
    );
    return event;
  });
})(window, kintone);
