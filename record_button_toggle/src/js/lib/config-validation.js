(function (root) {
  'use strict';

  const ConditionEngine =
    typeof module !== 'undefined' && module.exports
      ? require('./condition-engine')
      : root.RecordButtonToggle.ConditionEngine;

  const ACTIONS = ['SHOW', 'HIDE'];
  const TARGET_BUTTONS = ['ADD', 'EDIT', 'COPY'];
  const EMPTY_OPERATORS = ['IS_EMPTY', 'IS_NOT_EMPTY'];

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

      if (!rule || !TARGET_BUTTONS.includes(rule.targetButton)) {
        errors.push(`${label}: 対象ボタンの指定が不正です。`);
      }

      if (!rule || !ACTIONS.includes(rule.action)) {
        errors.push(`${label}: 動作(表示/非表示)の指定が不正です。`);
      }

      if (!rule || (rule.mode !== 'ALWAYS' && rule.mode !== 'MATCH')) {
        errors.push(`${label}: 条件モードの指定が不正です。`);
        return;
      }

      if (rule.mode === 'ALWAYS') {
        return;
      }

      const children =
        rule.condition && Array.isArray(rule.condition.children)
          ? rule.condition.children
          : [];
      if (children.length === 0) {
        errors.push(`${label}: 条件が1つも設定されていません。`);
      }
      children.forEach((clause, clauseIndex) => {
        const clauseLabel = `${label}の条件${clauseIndex + 1}件目`;

        if (
          !clause ||
          !ConditionEngine.FIELD_TYPES.includes(clause.fieldType)
        ) {
          errors.push(`${clauseLabel}: フィールド種別の指定が不正です。`);
          return;
        }
        if (!isNonEmptyString(clause.fieldCode)) {
          errors.push(`${clauseLabel}: フィールドが選択されていません。`);
        }
        const allowedOperators =
          ConditionEngine.OPERATORS_BY_TYPE[clause.fieldType];
        if (!allowedOperators.includes(clause.operator)) {
          errors.push(`${clauseLabel}: 演算子の指定が不正です。`);
          return;
        }
        if (
          !EMPTY_OPERATORS.includes(clause.operator) &&
          !isNonEmptyString(clause.value)
        ) {
          errors.push(`${clauseLabel}: 比較する値が入力されていません。`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.RecordButtonToggle = root.RecordButtonToggle || {};
    root.RecordButtonToggle.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
