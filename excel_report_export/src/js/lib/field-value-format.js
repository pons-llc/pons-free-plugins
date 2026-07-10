(function (root) {
  'use strict';

  // kintoneのフィールド値オブジェクト({type, value, ...})を、Excelのセルに書き込める
  // プリミティブ値(文字列・数値・Dateオブジェクト)へ変換する純粋関数。
  // フィールド形式の一覧はkintoneドキュメント「フィールド形式」を参照して実装している。

  const DEFAULT_LIST_SEPARATOR = '\n';

  const stripHtmlTags = (html) =>
    typeof html === 'string' ? html.replace(/<[^>]*>/g, '') : '';

  const toNumberOrKeep = (value) => {
    if (value === '' || value === null || value === undefined) {
      return '';
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
  };

  const dateOnlyToDate = (value) => {
    if (!value) {
      return '';
    }
    const parts = String(value).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      return String(value);
    }
    const [year, month, day] = parts;
    return new Date(Date.UTC(year, month - 1, day));
  };

  const isoToDate = (value) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date;
  };

  const joinNames = (entries, separator) =>
    (entries || []).map((entry) => (entry && entry.name) || '').join(separator);

  const joinStrings = (values, separator) => (values || []).join(separator);

  // typeごとの変換関数テーブル。未対応の型はTABLE_HANDLERSに載せず、デフォルト処理に委ねる。
  const HANDLERS = {
    SINGLE_LINE_TEXT: (value) => value || '',
    MULTI_LINE_TEXT: (value) => value || '',
    RICH_TEXT: (value) => stripHtmlTags(value),
    LINK: (value) => value || '',
    RECORD_NUMBER: (value) => value || '',
    __ID__: (value) => value || '',
    __REVISION__: (value) => value || '',

    NUMBER: (value) => toNumberOrKeep(value),
    CALC: (value) => toNumberOrKeep(value),

    DATE: (value) => dateOnlyToDate(value),
    DATETIME: (value) => isoToDate(value),
    CREATED_TIME: (value) => isoToDate(value),
    UPDATED_TIME: (value) => isoToDate(value),
    TIME: (value) => value || '',

    RADIO_BUTTON: (value) => value || '',
    DROP_DOWN: (value) => value || '',
    STATUS: (value) => value || '',

    CHECK_BOX: (value, sep) => joinStrings(value, sep),
    MULTI_SELECT: (value, sep) => joinStrings(value, sep),
    CATEGORY: (value, sep) => joinStrings(value, sep),

    USER_SELECT: (value, sep) => joinNames(value, sep),
    ORGANIZATION_SELECT: (value, sep) => joinNames(value, sep),
    GROUP_SELECT: (value, sep) => joinNames(value, sep),
    STATUS_ASSIGNEE: (value, sep) => joinNames(value, sep),

    CREATOR: (value) => (value && value.name) || '',
    MODIFIER: (value) => (value && value.name) || '',
  };

  // 値の取得ができない/本ロジックでは扱わないフィールド(サブテーブルは別ロジック、
  // 添付ファイルは別ロジック、装飾フィールドは値そのものが存在しない)。
  const UNSUPPORTED_TYPES = new Set([
    'SUBTABLE',
    'REFERENCE_TABLE',
    'FILE',
    'LABEL',
    'SPACER',
    'HR',
    'GROUP',
  ]);

  const formatFieldValue = (field, options) => {
    if (!field) {
      return null;
    }
    const separator =
      (options && options.listSeparator) || DEFAULT_LIST_SEPARATOR;
    const { type, value } = field;

    if (UNSUPPORTED_TYPES.has(type)) {
      return null;
    }

    const handler = HANDLERS[type];
    if (handler) {
      return handler(value, separator);
    }

    // 未知のtype: プリミティブならそのまま返し、オブジェクト/配列は変換方法が定まらないためnull。
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  };

  const FieldValueFormat = { formatFieldValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldValueFormat;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.FieldValueFormat = FieldValueFormat;
  }
})(typeof window !== 'undefined' ? window : globalThis);
