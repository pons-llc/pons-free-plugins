(function (global, kintone) {
  'use strict';

  const NS = global.AgeGradeFieldUpdate;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const platform = {
    confirm: (dialogConfig) =>
      kintone.mobile.showConfirmBottomSheet(dialogConfig),
    showLoading: () => kintone.mobile.showLoading('VISIBLE'),
    hideLoading: () => kintone.mobile.showLoading('HIDDEN'),
  };

  // 一覧画面: 対象グループのメンバーにのみ一括更新ボタンを表示する(idea.md「対応画面」参照)。
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
