(function (global, kintone) {
  'use strict';

  const NS = global.TextSlice;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ適用ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show 相当の処理はない。
  const disableTargetFields = (record) => {
    config.slices.forEach((slice) => {
      const targetField = record[slice.targetFieldCode];
      if (targetField) {
        targetField.disabled = true;
      }
    });
  };

  const applySlices = (record) => {
    config.slices.forEach((slice) => {
      const sourceField = record[slice.sourceFieldCode];
      const targetField = record[slice.targetFieldCode];
      if (!sourceField || !targetField) {
        return;
      }
      targetField.value = NS.Slice.applySlice(sourceField.value, slice);
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
      applySlices(event.record);
      return event;
    },
  );
})(window, kintone);
