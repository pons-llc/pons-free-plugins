(function (global, kintone) {
  'use strict';

  const NS = global.SidebarToggle;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // kintone.app.record.showSideBar()はPC専用API(cybozu developer networkで確認済み、
  // idea.mdの「使用するJavaScript API」参照)。一致するルールが無い場合は何もしない
  // (kintone既定の表示のまま)。
  const applySideBar = (record) => {
    const matchedRule = NS.RuleMatcher.findMatchingRule(record, config.rules);
    const state = NS.SidebarAction.resolveShowSideBarState(matchedRule);
    if (!state) {
      return;
    }
    kintone.app.record.showSideBar(state);
  };

  kintone.events.on(
    ['app.record.detail.show', 'app.record.edit.show'],
    (event) => {
      applySideBar(event.record);
      return event;
    },
  );

  // 編集画面では、条件に使われているフィールド(STATUS以外)の値変更時に再評価する
  // (idea.mdの「発動する画面・タイミング」参照。プロセス管理ステータスは編集画面中に値が
  // 変わることがないため対象外)。
  const watchedFieldCodes = new Set();
  config.rules.forEach((rule) => {
    if (rule.mode !== 'MATCH' || !rule.condition) {
      return;
    }
    (rule.condition.children || []).forEach((clause) => {
      if (clause.fieldType !== 'STATUS' && clause.fieldCode) {
        watchedFieldCodes.add(clause.fieldCode);
      }
    });
  });

  if (watchedFieldCodes.size > 0) {
    const changeEvents = Array.from(watchedFieldCodes).map(
      (fieldCode) => `app.record.edit.change.${fieldCode}`,
    );
    kintone.events.on(changeEvents, (event) => {
      applySideBar(event.record);
      return event;
    });
  }
})(window, kintone);
