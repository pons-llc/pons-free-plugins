(function (root) {
  'use strict';

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(設定行の配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateExtracts = (extracts) => {
    const errors = [];

    if (!Array.isArray(extracts)) {
      return { valid: false, errors: ['設定(extracts)が配列ではありません。'] };
    }

    const targetCounts = new Map();

    extracts.forEach((extract, index) => {
      const label = `${index + 1}件目`;

      if (!extract || !isNonEmptyString(extract.sourceFieldCode)) {
        errors.push(`${label}: 元フィールドが選択されていません。`);
      }

      const targetFieldCodes =
        extract && Array.isArray(extract.targetFieldCodes)
          ? extract.targetFieldCodes.filter(isNonEmptyString)
          : [];
      if (targetFieldCodes.length === 0) {
        errors.push(`${label}: 出力先フィールドが1件も設定されていません。`);
      }
      targetFieldCodes.forEach((code) => {
        targetCounts.set(code, (targetCounts.get(code) || 0) + 1);
        if (extract && code === extract.sourceFieldCode) {
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

  const ConfigValidation = { validateExtracts };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.NumberExtract = root.NumberExtract || {};
    root.NumberExtract.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
