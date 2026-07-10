(function (global, kintone) {
  'use strict';

  const NS = global.SubtableLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ適用ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  const applyLookups = (record) => {
    config.lookups.forEach((lookup) => {
      const subtableField = record[lookup.subtableFieldCode];
      if (!subtableField || !Array.isArray(subtableField.value)) {
        return;
      }

      const matchedRow = NS.RowFinder.findMatchedRow(
        subtableField.value,
        lookup,
      );
      const fieldValues = NS.RowMapper.buildFieldValues(
        matchedRow,
        lookup.fieldMappings,
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
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    (event) => {
      applyLookups(event.record);
      return event;
    },
  );
})(window, kintone);
