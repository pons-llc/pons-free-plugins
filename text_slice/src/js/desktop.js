(function (global, kintone) {
  'use strict';

  const NS = global.TextSlice;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 出力先フィールドは常にプラグインが上書きする値なので、追加・編集画面では直接入力できないように
  // disabledにする(idea.mdの「挿入先の編集を禁止」)。
  const disableTargetFields = (record) => {
    config.slices.forEach((slice) => {
      const targetField = record[slice.targetFieldCode];
      if (targetField) {
        targetField.disabled = true;
      }
    });
  };

  // 元フィールドの値をLEFT/RIGHT/MIDで切り出し、出力先フィールドへ反映する。idea.mdの方針通りsubmitイベントでのみ実行する。
  const applySlices = (record) => {
    config.slices.forEach((slice) => {
      const sourceField = record[slice.sourceFieldCode];
      const targetField = record[slice.targetFieldCode];
      // 元フィールド・出力先フィールドが存在しない(フィールド削除・設定の食い違い等)場合は
      // 何もせず、画面全体をクラッシュさせない。
      if (!sourceField || !targetField) {
        return;
      }
      targetField.value = NS.Slice.applySlice(sourceField.value, slice);
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
      applySlices(event.record);
      return event;
    },
  );

  // レコード一覧画面のインライン編集では、元フィールドの直接編集を禁止する
  // (idea.mdの「元フィールドは一覧からの編集を禁止」)。モバイルにはインライン編集自体が存在しない。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.slices.forEach((slice) => {
      const sourceField = event.record[slice.sourceFieldCode];
      if (sourceField) {
        sourceField.disabled = true;
      }
    });
    return event;
  });
})(window, kintone);
