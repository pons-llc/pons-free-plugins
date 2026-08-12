(function (root) {
  'use strict';

  // 一覧の絞り込み条件に該当するレコード配列(REST APIレスポンスの records 形式)から、
  // 集計対象フィールドの合計値を計算する純粋関数。
  //
  // kintoneのNUMBERフィールドの値は文字列で返るため、Numberに変換して合計する。
  // 数値化できない値・空文字の値・フィールド自体が存在しないレコードは合計から除外する
  // (0として加算するのではなく無視する)。

  const toNumberOrNull = (rawValue) => {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }
    const n = Number(rawValue);
    return Number.isNaN(n) ? null : n;
  };

  const numericValues = (records, fieldCode) =>
    records
      .map((record) =>
        record[fieldCode] ? record[fieldCode].value : undefined,
      )
      .map(toNumberOrNull)
      .filter((n) => n !== null);

  const sum = (records, fieldCode) =>
    numericValues(records, fieldCode).reduce((acc, n) => acc + n, 0);

  const Aggregator = { sum };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Aggregator;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.Aggregator = Aggregator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
