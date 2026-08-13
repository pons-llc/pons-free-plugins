(function (global, kintone) {
  'use strict';

  const NS = global.BulkApproval;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // ページ送り・絞り込み変更のたびに`mobile.app.record.index.show`が再発火してevent.recordsが
  // 更新されるため、ボタンのクリックハンドラーはこの変数を都度参照することで最新の一覧内容を使う
  // (ボタン要素自体は最初の一覧表示時に1回だけ作られ、以降は再生成されないため。idea.md参照)。
  let latestRecords = [];

  const platform = {
    createDialog: (dialogConfig) =>
      kintone.mobile.createBottomSheet(dialogConfig),
    showLoading: () => kintone.mobile.showLoading('VISIBLE'),
    hideLoading: () => kintone.mobile.showLoading('HIDDEN'),
    getRecords: () => latestRecords,
  };

  // 一覧画面: 「(作業者が自分)」一覧を開いているときにのみ一括承認ボタンを表示する
  // (idea.md「対応画面」参照)。
  kintone.events.on('mobile.app.record.index.show', (event) => {
    latestRecords = event.records || [];
    const config = loadConfig();
    NS.BulkApprovalMain.renderButtonIfEligible(
      kintone.mobile.app.getHeaderSpaceElement(),
      config,
      kintone.app.getId(),
      platform,
      event.viewName,
    );
    return event;
  });
})(window, kintone);
