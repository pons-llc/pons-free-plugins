(function (root) {
  'use strict';

  // SUM集計の対象(集計対象フィールド)として選べるフィールドを判定する。
  //
  // - 数値(NUMBER)フィールドは常に対象。
  // - 計算(CALC)フィールドは、表示書式(format)が数値("NUMBER")または
  //   数値(カンマ区切り、"NUMBER_DIGIT")の場合のみ対象とする。CALCフィールドの値は
  //   REST APIレスポンス上は常に文字列だが、formatが日時/日付/時刻/時間(時分)/時間(日時分)の
  //   場合は"2012-01-11"や"49:30"のような非数値の文字列になり、Number()変換ではNaNになって
  //   aggregator.js側で黙って集計対象から除外されてしまう(kintoneドキュメント「フィールド形式」
  //   の計算フィールドのvalue例で確認済み)。設定画面で選べる時点でこれらを除外し、
  //   「選んだのに常に0/空扱いになる」という分かりにくい状態を防ぐ。
  const NUMERIC_CALC_FORMATS = ['NUMBER', 'NUMBER_DIGIT'];

  const isAggregatableField = (field) => {
    if (!field) {
      return false;
    }
    if (field.type === 'NUMBER') {
      return true;
    }
    return field.type === 'CALC' && NUMERIC_CALC_FORMATS.includes(field.format);
  };

  const filterAggregatableFields = (fields) =>
    (fields || []).filter(isAggregatableField);

  const AggregatableFields = { isAggregatableField, filterAggregatableFields };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AggregatableFields;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.AggregatableFields = AggregatableFields;
  }
})(typeof window !== 'undefined' ? window : globalThis);
