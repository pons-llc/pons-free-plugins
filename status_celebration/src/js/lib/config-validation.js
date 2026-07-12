(function (root) {
  'use strict';

  const VALID_SOURCE_TYPES = ['FIELD', 'STATUS'];
  const VALID_PATTERNS = ['KUSUDAMA', 'CRACKER', 'CONFETTI', 'RANDOM'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(お祝いルールの配列)の構造的な不正を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateRules = (rules) => {
    const errors = [];

    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['設定(rules)が配列ではありません。'] };
    }
    if (rules.length === 0) {
      return {
        valid: false,
        errors: ['お祝いルールが1つも設定されていません。'],
      };
    }

    rules.forEach((rule, index) => {
      const label = `${index + 1}件目`;

      if (!rule || !VALID_SOURCE_TYPES.includes(rule.sourceType)) {
        errors.push(`${label}: 対象種別の指定が不正です。`);
        return;
      }
      if (rule.sourceType === 'FIELD' && !isNonEmptyString(rule.fieldCode)) {
        errors.push(`${label}: 対象フィールドが選択されていません。`);
      }

      const triggerValues = Array.isArray(rule.triggerValues)
        ? rule.triggerValues
        : [];
      if (
        triggerValues.length === 0 ||
        !triggerValues.every(isNonEmptyString)
      ) {
        errors.push(`${label}: お祝い対象の値が1つも選択されていません。`);
      }

      if (!VALID_PATTERNS.includes(rule.pattern)) {
        errors.push(`${label}: 演出パターンの指定が不正です。`);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.StatusCelebration = root.StatusCelebration || {};
    root.StatusCelebration.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
