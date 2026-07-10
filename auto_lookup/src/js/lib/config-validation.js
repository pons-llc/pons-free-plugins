(function (root) {
  'use strict';

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(対象フィールドコードの配列)の構造的な不正を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateTargetFieldCodes = (targetFieldCodes) => {
    const errors = [];

    if (!Array.isArray(targetFieldCodes)) {
      return {
        valid: false,
        errors: ['設定(targetFieldCodes)が配列ではありません。'],
      };
    }

    const seen = new Map();
    targetFieldCodes.forEach((code, index) => {
      const label = `${index + 1}件目`;
      if (!isNonEmptyString(code)) {
        errors.push(`${label}: フィールドが選択されていません。`);
        return;
      }
      seen.set(code, (seen.get(code) || 0) + 1);
    });

    seen.forEach((count, code) => {
      if (count > 1) {
        errors.push(
          `フィールド「${code}」が${count}件重複して選択されています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateTargetFieldCodes };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
