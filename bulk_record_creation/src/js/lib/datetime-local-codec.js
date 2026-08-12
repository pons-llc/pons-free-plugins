(function (root) {
  'use strict';

  // 確認ダイアログの<input type="datetime-local">と、kintoneのDATETIME値(UTCのISO8601文字列、
  // 例: "2012-01-11T11:30:00Z")との相互変換(bulk_field_update/js/lib/datetime-local-codec.jsと
  // 同じ実装、名前空間のみ変更)。ブラウザのローカルタイムゾーンへの変換はDateオブジェクトに委譲する。

  const pad2 = (n) => String(n).padStart(2, '0');

  // kintoneのDATETIME値(UTC)を、<input type="datetime-local">用のローカル時刻文字列
  // ("YYYY-MM-DDTHH:MM")に変換する。
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
  // kintoneのDATETIME値(UTCのISO8601文字列、秒は00固定)に変換する。
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
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.DatetimeLocalCodec = DatetimeLocalCodec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
