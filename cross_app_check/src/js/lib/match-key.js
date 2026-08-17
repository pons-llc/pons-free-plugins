(function (root) {
  'use strict';

  // 突合キーの正規化。
  // 数値フィールド同士は「1」と「01」「1.0」を同一とみなしたいが、
  // 文字列フィールド(宛名番号など先頭ゼロに意味がある)では絶対に落としてはいけない。
  // そのためフィールドタイプを見て正規化方法を切り替える。
  const NUMERIC_TYPES = ['NUMBER', 'CALC', 'RECORD_NUMBER'];

  const isNumericType = (fieldType) => NUMERIC_TYPES.indexOf(fieldType) !== -1;

  // 突合キーとして使えるフィールドタイプ。
  // 複数値をとるフィールド(チェックボックス・ユーザー選択等)は
  // 「1レコード＝1キー」にならないため対象外にする。
  const SELECTABLE_KEY_TYPES = [
    'SINGLE_LINE_TEXT',
    'NUMBER',
    'CALC',
    'LINK',
    'RECORD_NUMBER',
    'DROP_DOWN',
    'RADIO_BUTTON',
  ];

  const isSelectableKeyType = (fieldType) =>
    SELECTABLE_KEY_TYPES.indexOf(fieldType) !== -1;

  // 提出日として使えるフィールドタイプ
  const SELECTABLE_DATE_TYPES = [
    'DATE',
    'DATETIME',
    'CREATED_TIME',
    'UPDATED_TIME',
  ];

  const isSelectableDateType = (fieldType) =>
    SELECTABLE_DATE_TYPES.indexOf(fieldType) !== -1;

  const normalizeKey = (rawValue, fieldType) => {
    if (rawValue === null || rawValue === undefined) {
      return '';
    }
    // 配列(複数値フィールド)は突合キーにできないので空扱いにする
    if (Array.isArray(rawValue)) {
      return '';
    }
    const text = String(rawValue).trim();
    if (text === '') {
      return '';
    }
    if (isNumericType(fieldType)) {
      const num = Number(text);
      return Number.isFinite(num) ? String(num) : '';
    }
    return text;
  };

  // kintoneのレコードオブジェクトから正規化済みキーを取り出す
  const extractKey = (record, fieldCode, fieldType) => {
    if (!record || !fieldCode) {
      return '';
    }
    const field = record[fieldCode];
    if (!field) {
      return '';
    }
    return normalizeKey(field.value, fieldType);
  };

  // 同じキーのレコードをまとめた Map を作る(キー -> レコード配列)
  const indexRecordsByKey = (records, fieldCode, fieldType) => {
    const index = new Map();
    (records || []).forEach((record) => {
      const key = extractKey(record, fieldCode, fieldType);
      if (key === '') {
        return;
      }
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(record);
    });
    return index;
  };

  const MatchKey = {
    NUMERIC_TYPES,
    SELECTABLE_KEY_TYPES,
    SELECTABLE_DATE_TYPES,
    isNumericType,
    isSelectableKeyType,
    isSelectableDateType,
    normalizeKey,
    extractKey,
    indexRecordsByKey,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MatchKey;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.MatchKey = MatchKey;
  }
})(typeof window !== 'undefined' ? window : globalThis);
