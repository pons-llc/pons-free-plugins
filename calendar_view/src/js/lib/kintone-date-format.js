(function (root) {
  'use strict';

  // JavaScriptのDateオブジェクトを、kintoneのDATE/DATETIMEフィールドが要求する
  // 文字列形式に変換する(PUT /k/v1/record.json のリクエストボディ用)。
  // DATE: 'YYYY-MM-DD'(ローカル日付)
  // DATETIME: ISO 8601('YYYY-MM-DDTHH:mm:ssZ'、UTC)

  const pad2 = (n) => String(n).padStart(2, '0');

  const formatDateOnly = (date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  const formatDateTime = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  // fieldType: 'DATE' | 'DATETIME'
  const formatForFieldType = (date, fieldType) =>
    fieldType === 'DATE' ? formatDateOnly(date) : formatDateTime(date);

  const KintoneDateFormat = {
    formatDateOnly,
    formatDateTime,
    formatForFieldType,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KintoneDateFormat;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.KintoneDateFormat = KintoneDateFormat;
  }
})(typeof window !== 'undefined' ? window : globalThis);
