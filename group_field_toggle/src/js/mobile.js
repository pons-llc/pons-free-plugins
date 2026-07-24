(function (global, kintone) {
  'use strict';

  const NS = global.GroupFieldToggle;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const targetFieldCodes = Array.from(
    new Set(config.rules.map((rule) => rule.targetFieldCode).filter(Boolean)),
  );

  // desktop.js と同じロジック(モバイルAPIはkintone.mobile.app.record名前空間になる点、
  // 印刷画面が存在しない点のみ異なる。idea.mdの「使用するJavaScript API」参照)。
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
      kintone.mobile.app.record.setGroupFieldOpen(targetFieldCode, isOpen);
    });
  };

  kintone.events.on(
    [
      'mobile.app.record.detail.show',
      'mobile.app.record.create.show',
      'mobile.app.record.edit.show',
    ],
    (event) => {
      applyGroupFields(event.record);
      return event;
    },
  );

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
      `mobile.app.record.create.change.${fieldCode}`,
      `mobile.app.record.edit.change.${fieldCode}`,
    ]);
    kintone.events.on(changeEvents, (event) => {
      applyGroupFields(event.record);
      return event;
    });
  }
})(window, kintone);
