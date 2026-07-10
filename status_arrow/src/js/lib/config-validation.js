(function (root) {
  'use strict';

  const VALID_SOURCE_TYPES = ['FIELD', 'STATUS'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(ウィジェットの配列)の構造的な不正を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateWidgets = (widgets) => {
    const errors = [];

    if (!Array.isArray(widgets)) {
      return { valid: false, errors: ['設定(widgets)が配列ではありません。'] };
    }

    widgets.forEach((widget, index) => {
      const label = `${index + 1}件目`;

      if (!widget || !VALID_SOURCE_TYPES.includes(widget.sourceType)) {
        errors.push(`${label}: 対象種別の指定が不正です。`);
        return;
      }
      if (
        widget.sourceType === 'FIELD' &&
        !isNonEmptyString(widget.fieldCode)
      ) {
        errors.push(`${label}: 対象フィールドが選択されていません。`);
      }

      const steps = Array.isArray(widget.steps) ? widget.steps : [];
      if (steps.length === 0) {
        errors.push(`${label}: 矢羽根のステップが1つも設定されていません。`);
      }
      steps.forEach((step, stepIndex) => {
        if (!isNonEmptyString(step)) {
          errors.push(
            `${label}のステップ${stepIndex + 1}件目: 値が入力されていません。`,
          );
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateWidgets };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.StatusArrow = root.StatusArrow || {};
    root.StatusArrow.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
