(function (global, kintone) {
  'use strict';

  const NS = global.RecordButtonToggle;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // ボタンごとにJavaScript APIが異なる(cybozu developer networkで確認済み、
  // idea.mdの「使用するJavaScript API」参照)。一致するルールが無いボタンは何もしない
  // (kintone既定の表示状態のまま)。
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

  // レコード一覧・グラフ画面には「今表示している1件のレコード」という概念が無いため、
  // recordにnullを渡す(idea.mdの「レコードの文脈が無い画面での条件評価」参照。
  // mode: 'MATCH'のルールは一致せず、mode: 'ALWAYS'のルールのみ適用される)。
  kintone.events.on(
    ['app.record.index.show', 'app.record.graph.show'],
    (event) => {
      applyButton('ADD', null, (state) =>
        kintone.app.showAddRecordButton(state),
      );
      return event;
    },
  );

  // レコード詳細画面では表示中のレコードで条件評価する。
  kintone.events.on('app.record.detail.show', (event) => {
    applyButton('ADD', event.record, (state) =>
      kintone.app.showAddRecordButton(state),
    );
    applyButton('EDIT', event.record, (state) =>
      kintone.app.record.showEditRecordButton(state),
    );
    applyButton('COPY', event.record, (state) =>
      kintone.app.record.showDuplicateRecordButton(state),
    );
    return event;
  });

  // レコード詳細画面は表示専用(フィールド編集不可)でchange系イベントが発生しないため、
  // sidebar_toggle/group_field_toggleのような値変更時の再評価は不要(idea.mdの判断記録3番)。
})(window, kintone);
