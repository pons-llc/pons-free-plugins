(function (root) {
  'use strict';

  const VALID_TRIGGER_MODES = ['SUBMIT', 'MANUAL'];
  const VALID_ORDERS = ['ASC', 'DESC'];
  const VALID_VALUE_TYPES = ['STRING', 'NUMBER'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(ルールの配列)の構造的な不正を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  // ソート済フィールド(sortedFlagFieldCode)はMANUALモードでも任意設定のため必須にしていない
  // (idea.mdの「ソート済フィールド」参照)。
  const validateRules = (rules) => {
    const errors = [];

    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['設定(rules)が配列ではありません。'] };
    }

    rules.forEach((rule, index) => {
      const label = `${index + 1}件目`;

      if (!rule || !isNonEmptyString(rule.subtableFieldCode)) {
        errors.push(`${label}: 対象サブテーブルが選択されていません。`);
      }
      if (!rule || !VALID_TRIGGER_MODES.includes(rule.triggerMode)) {
        errors.push(`${label}: 発動タイミングの指定が不正です。`);
      }

      const sortKeys =
        rule && Array.isArray(rule.sortKeys) ? rule.sortKeys : [];
      if (sortKeys.length === 0) {
        errors.push(`${label}: ソートキーが1つも設定されていません。`);
      }
      sortKeys.forEach((key, keyIndex) => {
        const keyLabel = `${label}のソートキー${keyIndex + 1}件目`;
        if (!key || !isNonEmptyString(key.columnCode)) {
          errors.push(`${keyLabel}: 対象列が選択されていません。`);
        }
        if (!key || !VALID_ORDERS.includes(key.order)) {
          errors.push(`${keyLabel}: 昇順/降順の指定が不正です。`);
        }
        if (!key || !VALID_VALUE_TYPES.includes(key.valueType)) {
          errors.push(`${keyLabel}: 値の型の指定が不正です。`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.SubtableSort = root.SubtableSort || {};
    root.SubtableSort.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
