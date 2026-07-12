(function (root) {
  'use strict';

  // 複数値を配列で持つフィールド型。
  const ARRAY_TYPES = ['CHECK_BOX', 'MULTI_SELECT'];
  // 空値を`null`で表すフィールド型(「フィールドの値を空に設定する場合」表を参照、確認済み)。
  const NULLABLE_EMPTY_TYPES = ['DATE', 'TIME'];

  const pad2 = (n) => String(n).padStart(2, '0');

  // kintoneのDATETIME値(UTCのISO8601文字列、例: "2012-01-11T11:30:00Z")を、
  // <input type="datetime-local">用のローカル時刻文字列("YYYY-MM-DDTHH:MM")に変換する。
  // ブラウザのローカルタイムゾーン(=ログインユーザーのタイムゾーン)への変換は`Date`オブジェクトに
  // 委譲する(idea.mdの「DATETIMEフィールドのタイムゾーン変換」参照)。
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
      return null;
    }
    const [, year, month, day, hour, minute] = match.map(Number);
    const d = new Date(year, month - 1, day, hour, minute, 0, 0);
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  // record.get()で取得したフィールドの値({ type, value }、未設定フィールドはundefined)を、
  // パネルの入力コントロール用の値(文字列 または 配列)に変換する。
  const decodeFieldValue = (fieldType, fieldValue) => {
    if (ARRAY_TYPES.includes(fieldType)) {
      const value = fieldValue && fieldValue.value;
      return Array.isArray(value) ? value.slice() : [];
    }
    if (fieldType === 'DATETIME') {
      return decodeDatetimeLocal(fieldValue && fieldValue.value);
    }
    const value = fieldValue && fieldValue.value;
    return value != null ? String(value) : '';
  };

  // パネルの入力コントロールの値を、record.set()に渡す`record[fieldCode].value`用の値に変換する。
  const encodeFieldValue = (fieldType, rawValue) => {
    if (ARRAY_TYPES.includes(fieldType)) {
      return Array.isArray(rawValue) ? rawValue.slice() : [];
    }
    if (fieldType === 'DATETIME') {
      return rawValue ? encodeDatetimeLocal(rawValue) : null;
    }
    if (NULLABLE_EMPTY_TYPES.includes(fieldType)) {
      return rawValue === '' || rawValue == null ? null : rawValue;
    }
    return rawValue == null ? '' : rawValue;
  };

  const FieldValueCodec = {
    ARRAY_TYPES,
    NULLABLE_EMPTY_TYPES,
    decodeDatetimeLocal,
    encodeDatetimeLocal,
    decodeFieldValue,
    encodeFieldValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldValueCodec;
  } else {
    root.FieldInputPanel = root.FieldInputPanel || {};
    root.FieldInputPanel.FieldValueCodec = FieldValueCodec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
