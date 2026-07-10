(function (root) {
  'use strict';

  const VALID_TRIGGER_EVENTS = [
    'CREATE_SUBMIT',
    'EDIT_SUBMIT',
    'INDEX_DELETE_SUBMIT',
    'PROCESS_PROCEED',
  ];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(ルールの配列)の構造的な不正を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateRules = (rules) => {
    const errors = [];

    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['設定(rules)が配列ではありません。'] };
    }

    rules.forEach((rule, index) => {
      const label = `${index + 1}件目`;

      if (!rule || !VALID_TRIGGER_EVENTS.includes(rule.triggerEvent)) {
        errors.push(`${label}: 対象イベントの指定が不正です。`);
      }
      if (!rule || !isNonEmptyString(rule.body)) {
        errors.push(`${label}: ダイアログの本文が入力されていません。`);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.ConfirmModal = root.ConfirmModal || {};
    root.ConfirmModal.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
