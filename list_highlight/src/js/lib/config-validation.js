(function (root) {
  'use strict';

  const ConditionEngine =
    typeof module !== 'undefined' && module.exports
      ? require('./condition-engine')
      : root.ListHighlight.ConditionEngine;

  const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

      const children =
        rule && rule.condition && Array.isArray(rule.condition.children)
          ? rule.condition.children
          : [];
      if (children.length === 0) {
        errors.push(`${label}: 条件が1つも設定されていません。`);
      }
      children.forEach((clause, clauseIndex) => {
        const clauseLabel = `${label}の条件${clauseIndex + 1}件目`;
        if (!clause || !isNonEmptyString(clause.fieldCode)) {
          errors.push(`${clauseLabel}: フィールドが選択されていません。`);
        }
        if (!clause || !ConditionEngine.OPERATORS.includes(clause.operator)) {
          errors.push(`${clauseLabel}: 演算子の指定が不正です。`);
        }
      });

      if (!rule || !HEX_COLOR_PATTERN.test(rule.backgroundColor || '')) {
        errors.push(
          `${label}: 背景色が正しい形式(#rrggbb)で指定されていません。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.ListHighlight = root.ListHighlight || {};
    root.ListHighlight.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
