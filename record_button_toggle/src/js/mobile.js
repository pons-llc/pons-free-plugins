(function (global, kintone) {
  'use strict';

  const NS = global.RecordButtonToggle;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.jsと同じロジック(モバイルAPIはkintone.mobile.app名前空間になる点、追加ボタンが
  // 一覧画面専用でグラフ画面が存在しない点、コピーボタンがモバイル非対応な点が異なる。
  // idea.mdの「使用するJavaScript API」参照)。
  const applyButton = (targetButton, record, setState) => {
    const matchedRule = NS.RuleMatcher.findMatchingRule(
      record,
      config.rules,
      targetButton,
    );
    const state = NS.ButtonAction.resolveButtonState(matchedRule);
    if (!state) {
      return;
    }
    setState(state);
  };

  // レコード一覧画面には「今表示している1件のレコード」という概念が無いため、recordにnullを渡す
  // (idea.mdの「レコードの文脈が無い画面での条件評価」参照)。
  kintone.events.on('mobile.app.record.index.show', (event) => {
    applyButton('ADD', null, (state) =>
      kintone.mobile.app.showAddRecordButton(state),
    );
    return event;
  });

  kintone.events.on('mobile.app.record.detail.show', (event) => {
    applyButton('EDIT', event.record, (state) =>
      kintone.mobile.app.record.showEditRecordButton(state),
    );
    return event;
  });
})(window, kintone);
