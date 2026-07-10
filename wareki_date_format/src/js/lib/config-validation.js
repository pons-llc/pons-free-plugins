(function (root) {
  'use strict';

  const Wareki =
    typeof module !== 'undefined' && module.exports
      ? require('./wareki')
      : root.WarekiDateFormat.Wareki;

  const VALID_PRESETS = Object.values(Wareki.PRESETS);

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(ペアの配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validatePairs = (pairs) => {
    const errors = [];

    if (!Array.isArray(pairs)) {
      return { valid: false, errors: ['設定(pairs)が配列ではありません。'] };
    }

    pairs.forEach((pair, index) => {
      const label = `${index + 1}件目`;
      if (!pair || !isNonEmptyString(pair.sourceFieldCode)) {
        errors.push(`${label}: 変換元フィールドが選択されていません。`);
      }
      if (!pair || !isNonEmptyString(pair.targetFieldCode)) {
        errors.push(`${label}: 出力先フィールドが選択されていません。`);
      }
      if (!pair || !VALID_PRESETS.includes(pair.preset)) {
        errors.push(`${label}: 書式プリセットの指定が不正です。`);
      }
      if (!pair || typeof pair.zenkaku !== 'boolean') {
        errors.push(`${label}: 全角/半角オプションの指定が不正です。`);
      }
      if (
        pair &&
        isNonEmptyString(pair.sourceFieldCode) &&
        isNonEmptyString(pair.targetFieldCode) &&
        pair.sourceFieldCode === pair.targetFieldCode
      ) {
        errors.push(`${label}: 変換元フィールドと出力先フィールドが同じです。`);
      }
    });

    const targetCounts = new Map();
    pairs.forEach((pair) => {
      if (pair && isNonEmptyString(pair.targetFieldCode)) {
        targetCounts.set(
          pair.targetFieldCode,
          (targetCounts.get(pair.targetFieldCode) || 0) + 1,
        );
      }
    });
    targetCounts.forEach((count, targetFieldCode) => {
      if (count > 1) {
        errors.push(
          `出力先フィールド「${targetFieldCode}」が${count}件のペアで重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validatePairs };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.WarekiDateFormat = root.WarekiDateFormat || {};
    root.WarekiDateFormat.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
