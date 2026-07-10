(function (global, kintone) {
  'use strict';

  const NS = global.TextSplit;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ適用ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show 相当の処理はない。
  const disableTargetFields = (record) => {
    config.splits.forEach((split) => {
      (split.targetFieldCodes || []).forEach((targetFieldCode) => {
        const targetField = record[targetFieldCode];
        if (targetField) {
          targetField.disabled = true;
        }
      });
    });
  };

  const applySplits = (record) => {
    config.splits.forEach((split) => {
      const sourceField = record[split.sourceFieldCode];
      if (!sourceField) {
        return;
      }

      const parts = NS.Split.splitValue(sourceField.value, split);
      const fieldValues = NS.FieldAssign.buildFieldValues(
        parts,
        split.targetFieldCodes,
      );

      Object.keys(fieldValues).forEach((targetFieldCode) => {
        const targetField = record[targetFieldCode];
        if (!targetField) {
          return;
        }
        targetField.value = fieldValues[targetFieldCode];
      });
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
      applySplits(event.record);
      return event;
    },
  );
})(window, kintone);
