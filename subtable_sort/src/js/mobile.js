(function (global, kintone) {
  'use strict';

  const NS = global.SubtableSort;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // MANUALモード(ソート実行ボタン)はkintone.app.record.getHeaderMenuSpaceElement()がPC専用のAPIの
  // ため非対応(idea.mdの「発動タイミング」参照)。モバイルではSUBMITモードのみ動作する。
  const submitRules = config.rules.filter(
    (rule) => rule.triggerMode === 'SUBMIT',
  );

  const applySubmitSort = (record) => {
    submitRules.forEach((rule) => {
      const subtableField = record[rule.subtableFieldCode];
      if (!subtableField || !Array.isArray(subtableField.value)) {
        return;
      }
      subtableField.value = NS.SortComparator.sortRows(
        subtableField.value,
        rule.sortKeys,
      );
    });
  };

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    (event) => {
      applySubmitSort(event.record);
      return event;
    },
  );
})(window, kintone);
