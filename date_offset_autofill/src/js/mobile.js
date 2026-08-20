(function (global, kintone) {
  'use strict';

  const NS = global.DateOffsetAutofill;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ適用ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show 相当の処理はない。
  const disableTargetFields = (record) => {
    config.rules.forEach((rule) => {
      const targetField = record[rule.targetFieldCode];
      if (targetField) {
        targetField.disabled = true;
      }
    });
  };

  const applyRules = (record) => {
    config.rules.forEach((rule) => {
      const baseField = record[rule.baseFieldCode];
      const targetField = record[rule.targetFieldCode];
      if (!baseField || !targetField) {
        return;
      }
      const offsetFieldRawValue =
        rule.offsetSource === 'FIELD'
          ? record[rule.offsetFieldCode] && record[rule.offsetFieldCode].value
          : undefined;
      const newValue = NS.OffsetCalculator.computeTargetValue(
        rule,
        baseField.value,
        baseField.type,
        offsetFieldRawValue,
      );
      if (newValue !== null) {
        targetField.value = newValue;
      }
    });
  };

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      return event;
    },
  );

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    (event) => {
      applyRules(event.record);
      return event;
    },
  );
})(window, kintone);
