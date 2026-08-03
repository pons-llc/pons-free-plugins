(function (root) {
  'use strict';

  // 保存前の設定バリデーション。HTMLフィールド未選択、CSS/JS/HTMLフィールドの重複選択、
  // 実行方式の不正値をエラーにする(idea.md「設定画面」参照)。エラーが無ければ空配列を返す。
  const EXECUTION_MODES = ['blob', 'data'];

  const validate = (config) => {
    const errors = [];
    if (!config.htmlFieldCode) {
      errors.push('HTMLフィールドを選択してください。');
    }

    const selected = [
      config.htmlFieldCode,
      config.cssFieldCode,
      config.jsFieldCode,
    ].filter((code) => code);
    const hasDuplicate = new Set(selected).size !== selected.length;
    if (hasDuplicate) {
      errors.push(
        'HTML/CSS/JSフィールドに同じフィールドを重複して指定することはできません。',
      );
    }

    if (!EXECUTION_MODES.includes(config.executionMode)) {
      errors.push('実行方式を選択してください。');
    }

    return errors;
  };

  const ConfigValidation = { validate, EXECUTION_MODES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.GenaiAppShare = root.GenaiAppShare || {};
    root.GenaiAppShare.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
