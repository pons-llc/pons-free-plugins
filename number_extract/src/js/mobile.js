(function (global, kintone) {
  'use strict';

  const NS = global.NumberExtract;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ適用ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  // 出力先フィールドはdisabledにせず、change時のみ再計算する(submitでの上書きはしない)。
  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show 相当の処理はない。
  const applyExtractions = (record) => {
    config.extracts.forEach((extract) => {
      const sourceField = record[extract.sourceFieldCode];
      if (!sourceField) {
        return;
      }

      const parts = NS.Extract.extractNumbers(sourceField.value, extract);
      const fieldValues = NS.FieldAssign.buildFieldValues(
        parts,
        extract.targetFieldCodes,
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

  const buildChangeEventTypes = (prefix) => {
    const codes = new Set();
    config.extracts.forEach((extract) => {
      if (extract.sourceFieldCode) {
        codes.add(extract.sourceFieldCode);
      }
    });
    return Array.from(codes).map((code) => `${prefix}.${code}`);
  };

  const createChangeEventTypes = buildChangeEventTypes(
    'mobile.app.record.create.change',
  );
  const editChangeEventTypes = buildChangeEventTypes(
    'mobile.app.record.edit.change',
  );

  if (createChangeEventTypes.length > 0) {
    kintone.events.on(createChangeEventTypes, (event) => {
      applyExtractions(event.record);
      return event;
    });
  }
  if (editChangeEventTypes.length > 0) {
    kintone.events.on(editChangeEventTypes, (event) => {
      applyExtractions(event.record);
      return event;
    });
  }
})(window, kintone);
