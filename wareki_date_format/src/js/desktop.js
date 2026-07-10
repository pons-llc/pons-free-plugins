(function (global, kintone) {
  'use strict';

  const NS = global.WarekiDateFormat;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む
  // (fiscal_year_numberingのようにハンドラー内で毎回 getConfig() し直す必要はない)。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 設定されているすべてのペアを再計算し、出力先フィールドへ反映する。
  // どの変換元フィールドが変更されたかにかかわらず全ペアを再計算する(純粋な同期関数でコストが低いため、
  // 「変更されたフィールド→対応するペア」の対応管理を省き実装をシンプルにしている。idea.md参照)。
  const recomputeAll = (record) => {
    config.pairs.forEach((pair) => {
      const sourceField = record[pair.sourceFieldCode];
      const targetField = record[pair.targetFieldCode];
      // フィールドコードが存在しない(フィールド削除・設定の食い違い等)場合は何もせず、
      // 画面全体をクラッシュさせない。
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

  // 設定済みのペアの変換元フィールドコードから、重複を除いたイベントタイプの配列を組み立てる。
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
    'app.record.create.change',
  );
  const editChangeEventTypes = buildChangeEventTypes('app.record.edit.change');

  // レコード追加画面: 変換元フィールドの値が変わったら即時反映する。
  if (createChangeEventTypes.length > 0) {
    kintone.events.on(createChangeEventTypes, (event) => {
      recomputeAll(event.record);
      return event;
    });
  }

  // レコード編集画面: 同様に即時反映する。
  if (editChangeEventTypes.length > 0) {
    kintone.events.on(editChangeEventTypes, (event) => {
      recomputeAll(event.record);
      return event;
    });
  }

  // 保存直前にも再計算する保険処理(change イベントが発火しないまま値が入っているケースの安全策。
  // 例: 変換元フィールドにデフォルト値が入っていて、ユーザーが一度もそのフィールドを操作しなかった場合)。
  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      recomputeAll(event.record);
      return event;
    },
  );
})(window, kintone);
