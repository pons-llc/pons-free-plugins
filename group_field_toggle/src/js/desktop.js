(function (global, kintone) {
  'use strict';

  const NS = global.GroupFieldToggle;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const targetFieldCodes = Array.from(
    new Set(config.rules.map((rule) => rule.targetFieldCode).filter(Boolean)),
  );

  // kintone.app.record.setGroupFieldOpen()はレコード詳細・追加・編集・印刷画面(PC)に対応
  // (cybozu developer networkで確認済み、idea.mdの「使用するJavaScript API」参照)。
  // 対象グループフィールドごとに一致するルールを評価し、一致するルールが無いフィールドは
  // 何もしない(kintone既定の開閉状態のまま)。
  const applyGroupFields = (record) => {
    targetFieldCodes.forEach((targetFieldCode) => {
      const matchedRule = NS.RuleMatcher.findMatchingRule(
        record,
        config.rules,
        targetFieldCode,
      );
      const isOpen = NS.GroupFieldAction.resolveIsOpen(matchedRule);
      if (isOpen === null) {
        return;
      }
      kintone.app.record.setGroupFieldOpen(targetFieldCode, isOpen);
    });
  };

  kintone.events.on(
    [
      'app.record.detail.show',
      'app.record.create.show',
      'app.record.edit.show',
      'app.record.print.show',
    ],
    (event) => {
      applyGroupFields(event.record);
      return event;
    },
  );

  // 追加・編集画面では、条件に使われているフィールド(STATUS以外)の値変更時に再評価する
  // (idea.mdの「発動する画面・タイミング」参照。プロセス管理ステータスは追加・編集画面中に値が
  // 変わることがないため対象外。印刷画面には対応するchangeイベントが無いため表示時のみ)。
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
    const changeEvents = Array.from(watchedFieldCodes).flatMap((fieldCode) => [
      `app.record.create.change.${fieldCode}`,
      `app.record.edit.change.${fieldCode}`,
    ]);
    kintone.events.on(changeEvents, (event) => {
      applyGroupFields(event.record);
      return event;
    });
  }
})(window, kintone);
