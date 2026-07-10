(function (global, kintone) {
  'use strict';

  const NS = global.WarekiDateFormat;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ再計算ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  const recomputeAll = (record) => {
    config.pairs.forEach((pair) => {
      const sourceField = record[pair.sourceFieldCode];
      const targetField = record[pair.targetFieldCode];
      if (!sourceField || !targetField) {
        return;
      }
      targetField.value = NS.Wareki.format(
        sourceField.type,
        sourceField.value,
        {
          preset: pair.preset,
          zenkaku: pair.zenkaku,
        },
      );
    });
  };

  const buildChangeEventTypes = (prefix) => {
    const codes = new Set();
    config.pairs.forEach((pair) => {
      if (pair.sourceFieldCode) {
        codes.add(pair.sourceFieldCode);
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
      recomputeAll(event.record);
      return event;
    });
  }

  if (editChangeEventTypes.length > 0) {
    kintone.events.on(editChangeEventTypes, (event) => {
      recomputeAll(event.record);
      return event;
    });
  }

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    (event) => {
      recomputeAll(event.record);
      return event;
    },
  );
})(window, kintone);
