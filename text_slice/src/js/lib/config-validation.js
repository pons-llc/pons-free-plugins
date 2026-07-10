(function (root) {
  'use strict';

  const VALID_FUNCS = ['LEFT', 'RIGHT', 'MID'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
  const isPositiveInteger = (v) => Number.isInteger(v) && v > 0;

  // 設定画面の保存前チェック。プラグイン設定(ルールの配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateSlices = (slices) => {
    const errors = [];

    if (!Array.isArray(slices)) {
      return { valid: false, errors: ['設定(slices)が配列ではありません。'] };
    }

    const targetCounts = new Map();

    slices.forEach((slice, index) => {
      const label = `${index + 1}件目`;

      if (!slice || !isNonEmptyString(slice.sourceFieldCode)) {
        errors.push(`${label}: 元フィールドが選択されていません。`);
      }
      if (!slice || !VALID_FUNCS.includes(slice.func)) {
        errors.push(`${label}: 関数の種類の指定が不正です。`);
        return;
      }

      if (!isPositiveInteger(slice.length)) {
        errors.push(
          `${label}: 文字数(length)は1以上の整数で指定してください。`,
        );
      }
      if (slice.func === 'MID' && !isPositiveInteger(slice.start)) {
        errors.push(
          `${label}: 開始位置(start)は1以上の整数で指定してください。`,
        );
      }

      if (!slice || !isNonEmptyString(slice.targetFieldCode)) {
        errors.push(`${label}: 出力先フィールドが選択されていません。`);
      } else {
        targetCounts.set(
          slice.targetFieldCode,
          (targetCounts.get(slice.targetFieldCode) || 0) + 1,
        );
        if (slice.targetFieldCode === slice.sourceFieldCode) {
          errors.push(
            `${label}: 出力先フィールドに元フィールドと同じフィールドを指定できません。`,
          );
        }
      }
    });

    targetCounts.forEach((count, targetFieldCode) => {
      if (count > 1) {
        errors.push(
          `出力先フィールド「${targetFieldCode}」が${count}件のルールで重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateSlices };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.TextSlice = root.TextSlice || {};
    root.TextSlice.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
