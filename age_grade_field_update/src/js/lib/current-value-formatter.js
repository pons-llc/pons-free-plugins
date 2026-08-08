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

  // <input type="datetime-local">のvalue形式(ローカル、秒なし)を組み立てる。
  // <input type="date">はformatDate()の"YYYY-MM-DD"がそのまま流用できるため専用関数は不要。
  const toDatetimeLocalInputValue = (date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  // 確認ダイアログの入力欄(<input type="date"|"datetime-local">)に表示する初期値
  // (既定は「今日」だが、確定前にユーザーが編集できる。idea.md「確認ダイアログ・実行」参照)。
  const defaultInputValue = (date, fieldType) => {
    if (fieldType === 'DATE') {
      return formatDate(date);
    }
    if (fieldType === 'DATETIME') {
      return toDatetimeLocalInputValue(date);
    }
    throw new Error(`未対応のフィールド型です: ${fieldType}`);
  };

  // 確認ダイアログの入力欄の値(ユーザーが編集した可能性がある)を、実際に書き込む
  // kintoneのフィールド値形式へ変換する。空文字列(未入力)はnullを返し、呼び出し側で
  // 「値が確定していない」ことを判定できるようにする。
  const valueFromInput = (inputValue, fieldType) => {
    if (!inputValue) {
      return null;
    }
    if (fieldType === 'DATE') {
      return inputValue;
    }
    if (fieldType === 'DATETIME') {
      // <input type="datetime-local">の値("YYYY-MM-DDTHH:mm"、タイムゾーンオフセットなし)は
      // Dateコンストラクターに渡すとローカル時刻として解釈される(ECMA-262の日時文字列仕様)。
      return formatDatetime(new Date(inputValue));
    }
    throw new Error(`未対応のフィールド型です: ${fieldType}`);
  };

  const CurrentValueFormatter = {
    formatDate,
    formatDatetime,
    formatCurrentValue,
    toDatetimeLocalInputValue,
    defaultInputValue,
    valueFromInput,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrentValueFormatter;
  } else {
    root.AgeGradeFieldUpdate = root.AgeGradeFieldUpdate || {};
    root.AgeGradeFieldUpdate.CurrentValueFormatter = CurrentValueFormatter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
