(function (global, kintone) {
  'use strict';

  const NS = global.TextSplit;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 出力先フィールドは常にプラグインが上書きする値なので、追加・編集画面では直接入力できないように
  // disabledにする(idea.mdの「挿入先の編集を禁止」)。
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

  // 元フィールドの値を分割し、出力先フィールドへ反映する。idea.mdの方針通りsubmitイベントでのみ実行する。
  const applySplits = (record) => {
    config.splits.forEach((split) => {
      const sourceField = record[split.sourceFieldCode];
      // 元フィールドが存在しない(フィールド削除・設定の食い違い等)場合は何もせず、
      // 画面全体をクラッシュさせない。
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
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      return event;
    },
  );

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      applySplits(event.record);
      return event;
    },
  );

  // レコード一覧画面のインライン編集では、元フィールドの直接編集を禁止する
  // (idea.mdの「元フィールドは一覧からの編集を禁止」)。モバイルにはインライン編集自体が存在しない。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.splits.forEach((split) => {
      const sourceField = event.record[split.sourceFieldCode];
      if (sourceField) {
        sourceField.disabled = true;
      }
    });
    return event;
  });
})(window, kintone);
