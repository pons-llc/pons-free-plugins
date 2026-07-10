(function (root) {
  'use strict';

  const VALID_MODES = ['CHARACTERS', 'REGEX'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  const isCompilableRegExp = (pattern) => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  };

  // 設定画面の保存前チェック。プラグイン設定(設定行の配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateSplits = (splits) => {
    const errors = [];

    if (!Array.isArray(splits)) {
      return { valid: false, errors: ['設定(splits)が配列ではありません。'] };
    }

    const targetCounts = new Map();

    splits.forEach((split, index) => {
      const label = `${index + 1}件目`;

      if (!split || !isNonEmptyString(split.sourceFieldCode)) {
        errors.push(`${label}: 元フィールドが選択されていません。`);
      }
      if (!split || !VALID_MODES.includes(split.delimiterMode)) {
        errors.push(`${label}: 区切りモードの指定が不正です。`);
        return;
      }

      if (split.delimiterMode === 'CHARACTERS') {
        const delimiters = Array.isArray(split.delimiters)
          ? split.delimiters.filter(isNonEmptyString)
          : [];
        if (delimiters.length === 0) {
          errors.push(`${label}: 区切り文字が1件も設定されていません。`);
        }
      }
      if (split.delimiterMode === 'REGEX') {
        if (!isNonEmptyString(split.pattern)) {
          errors.push(`${label}: 正規表現パターンが入力されていません。`);
        } else if (!isCompilableRegExp(split.pattern)) {
          errors.push(`${label}: 正規表現パターンの構文が不正です。`);
        }
      }

      const targetFieldCodes = Array.isArray(split.targetFieldCodes)
        ? split.targetFieldCodes.filter(isNonEmptyString)
        : [];
      if (targetFieldCodes.length === 0) {
        errors.push(`${label}: 出力先フィールドが1件も設定されていません。`);
      }
      targetFieldCodes.forEach((code) => {
        targetCounts.set(code, (targetCounts.get(code) || 0) + 1);
        if (split && code === split.sourceFieldCode) {
          errors.push(
            `${label}: 出力先フィールドに元フィールドと同じフィールドを指定できません。`,
          );
        }
      });
    });

    targetCounts.forEach((count, targetFieldCode) => {
      if (count > 1) {
        errors.push(
          `出力先フィールド「${targetFieldCode}」が${count}件の設定行で重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateSplits };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.TextSplit = root.TextSplit || {};
    root.TextSplit.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
