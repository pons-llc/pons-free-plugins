(function (root) {
  'use strict';

  // 参照先アプリから取得したレコード配列(REST APIレスポンスの records 形式)から、
  // 件数・合計・平均を計算する純粋関数。
  //
  // kintoneのNUMBERフィールドの値は文字列で返るため、集計対象フィールドの値は
  // Numberに変換して計算する。数値化できない・空文字の値は集計から除外する
  // (件数=COUNTには影響しないが、SUM/AVGの分母には含めない)。

  const toNumberOrNull = (rawValue) => {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }
    const n = Number(rawValue);
    return Number.isNaN(n) ? null : n;
  };

  const count = (records) => records.length;

  const numericValues = (records, fieldCode) =>
    records
      .map((record) =>
        record[fieldCode] ? record[fieldCode].value : undefined,
      )
      .map(toNumberOrNull)
      .filter((n) => n !== null);

  const sum = (records, fieldCode) =>
    numericValues(records, fieldCode).reduce((acc, n) => acc + n, 0);

  const average = (records, fieldCode) => {
    const values = numericValues(records, fieldCode);
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((acc, n) => acc + n, 0) / values.length;
  };

  // summaryType: 'COUNT' | 'SUM' | 'AVERAGE'
  const aggregate = (records, summaryType, fieldCode) => {
    switch (summaryType) {
      case 'COUNT':
        return count(records);
      case 'SUM':
        return sum(records, fieldCode);
      case 'AVERAGE':
        return average(records, fieldCode);
      default:
        throw new Error(`未対応の集計種別です: ${summaryType}`);
    }
  };

  const Aggregator = { count, sum, average, aggregate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Aggregator;
  } else {
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.Aggregator = Aggregator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
