(function (root) {
  'use strict';

  // 設定画面の<input type="datetime-local">と、kintoneのDATETIME値(UTCのISO8601文字列、
  // 例: "2012-01-11T11:30:00Z")との相互変換(field_input_panel/js/lib/field-value-codec.jsの
  // decodeDatetimeLocal/encodeDatetimeLocalと同じ手法)。ブラウザのローカルタイムゾーンへの
  // 変換はDateオブジェクトに委譲する。

  const pad2 = (n) => String(n).padStart(2, '0');

  // kintoneのDATETIME値(UTC)を、<input type="datetime-local">用のローカル時刻文字列
  // ("YYYY-MM-DDTHH:MM")に変換する。設定画面へ既存設定を再表示するときに使う。
  const decodeDatetimeLocal = (isoUtcValue) => {
    if (!isoUtcValue) {
      return '';
    }
    const d = new Date(isoUtcValue);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return (
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
      `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    );
  };

  // <input type="datetime-local">のローカル時刻文字列("YYYY-MM-DDTHH:MM")を、
  // kintoneのDATETIME値(UTCのISO8601文字列、秒は00固定)に変換する。設定を保存するときに使う。
  const encodeDatetimeLocal = (localValue) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(
      localValue || '',
    );
    if (!match) {
      return '';
    }
    const [, year, month, day, hour, minute] = match.map(Number);
    const d = new Date(year, month - 1, day, hour, minute, 0, 0);
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  const DatetimeLocalCodec = { decodeDatetimeLocal, encodeDatetimeLocal };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatetimeLocalCodec;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.DatetimeLocalCodec = DatetimeLocalCodec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
