(function (global, kintone) {
  'use strict';

  const NS = global.SubtableLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 設定されているすべての設定行を処理し、一致行の値を出力先フィールドへ反映する。
  // idea.mdの方針通り、submitイベントでのみ動作する(change/showでの先行計算は行わない)。
  const applyLookups = (record) => {
    config.lookups.forEach((lookup) => {
      const subtableField = record[lookup.subtableFieldCode];
      // 対象サブテーブルが存在しない(フィールド削除・設定の食い違い等)場合は何もせず、
      // 画面全体をクラッシュさせない。
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
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      applyLookups(event.record);
      return event;
    },
  );
})(window, kintone);
