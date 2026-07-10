(function (global, kintone) {
  'use strict';

  const NS = global.NumberExtract;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 元フィールドの値から数字を抽出し、出力先フィールドへ反映する。出力先フィールドはdisabledにせず
  // 常に編集可能なままとする(ユーザー判断・判断記録.mdの6番)。抽出後にユーザーが出力先フィールドを
  // 手で修正しても、このプラグインはsubmit時に再上書きしない(change時のみ再計算する)。
  const applyExtractions = (record) => {
    config.extracts.forEach((extract) => {
      const sourceField = record[extract.sourceFieldCode];
      // 元フィールドが存在しない(フィールド削除・設定の食い違い等)場合は何もせず、
      // 画面全体をクラッシュさせない。
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

  // 設定されている元フィールドコードから、重複を除いたchangeイベントタイプの配列を組み立てる
  // (wareki_date_formatと同じパターン)。どの元フィールドが変更されたかにかかわらず全設定行を
  // 再計算する(純粋な同期処理でコストが低いため、対応管理を省き実装をシンプルにしている)。
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
    'app.record.create.change',
  );
  const editChangeEventTypes = buildChangeEventTypes('app.record.edit.change');

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

  // レコード一覧画面のインライン編集では、元フィールドの直接編集を禁止する
  // (idea.mdの「元フィールドは一覧からの編集を禁止」)。モバイルにはインライン編集自体が存在しない。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.extracts.forEach((extract) => {
      const sourceField = event.record[extract.sourceFieldCode];
      if (sourceField) {
        sourceField.disabled = true;
      }
    });
    return event;
  });
})(window, kintone);
