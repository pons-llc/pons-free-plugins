(function (root) {
  'use strict';

  // 出力ファイル名テンプレート({フィールドコード}を含む文字列)に差し込むための、
  // フィールドコード→文字列 のマップをレコードから組み立てる。
  // セルへの書き込み(cell-mapping.js/subtable-layout.js)とは異なり、ファイル名には
  // Dateオブジェクトをそのまま使えないため、日付は YYYY-MM-DD の文字列に変換する。

  const { formatFieldValue } =
    typeof module !== 'undefined' && module.exports
      ? require('./field-value-format')
      : root.ExcelReportExport.FieldValueFormat;

  const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

  const extractPlaceholderFieldCodes = (template) => {
    const codes = [];
    const seen = new Set();
    String(template || '').replace(PLACEHOLDER_PATTERN, (match, fieldCode) => {
      if (!seen.has(fieldCode)) {
        seen.add(fieldCode);
        codes.push(fieldCode);
      }
      return match;
    });
    return codes;
  };

  const toDateOnlyString = (date) => date.toISOString().slice(0, 10);

  const stringifyForFileName = (value) => {
    if (value instanceof Date) {
      return toDateOnlyString(value);
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const buildFileNameValues = (template, record, options) => {
    const fieldCodes = extractPlaceholderFieldCodes(template);
    const values = {};
    fieldCodes.forEach((fieldCode) => {
      const field = record ? record[fieldCode] : undefined;
      const formatted = field ? formatFieldValue(field, options) : '';
      values[fieldCode] = stringifyForFileName(formatted);
    });
    return values;
  };

  const RecordValues = { extractPlaceholderFieldCodes, buildFileNameValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordValues;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.RecordValues = RecordValues;
  }
})(typeof window !== 'undefined' ? window : globalThis);
