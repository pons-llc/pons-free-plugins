(function (root) {
  'use strict';

  // 実行時点の「現在の値」を、対象フィールドの型(DATE/DATETIME)に応じたkintoneのREST API
  // フィールド値形式の文字列へ変換する純粋関数。idea.md「現在の値のフォーマット」参照。
  // kintoneドキュメントMCP「フィールド形式」で、DATE型は"2012-01-11"(タイムゾーンなしの暦日)、
  // DATETIME型は"2012-01-11T11:30:00Z"(UTC、ミリ秒なしのISO8601)であることを確認済み。

  const pad2 = (n) => String(n).padStart(2, '0');

  // ローカルの年・月・日から組み立てる。date.toISOString().slice(0, 10)は使わない
  // (UTCとして切り出すため、UTCより西のタイムゾーンで夜間に実行すると1日ずれる)。
  const formatDate = (date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  // UTC ISO8601からミリ秒部分を取り除く(field_input_panelのencodeDatetimeLocalと同じ手法)。
  const formatDatetime = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const formatCurrentValue = (date, fieldType) => {
    if (fieldType === 'DATE') {
      return formatDate(date);
    }
    if (fieldType === 'DATETIME') {
      return formatDatetime(date);
    }
    throw new Error(`未対応のフィールド型です: ${fieldType}`);
  };

  const CurrentValueFormatter = {
    formatDate,
    formatDatetime,
    formatCurrentValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrentValueFormatter;
  } else {
    root.AgeGradeFieldUpdate = root.AgeGradeFieldUpdate || {};
    root.AgeGradeFieldUpdate.CurrentValueFormatter = CurrentValueFormatter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
