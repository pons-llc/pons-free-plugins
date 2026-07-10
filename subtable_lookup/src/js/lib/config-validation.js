(function (root) {
  'use strict';

  const RowFinder =
    typeof module !== 'undefined' && module.exports
      ? require('./row-finder')
      : root.SubtableLookup.RowFinder;

  const VALID_MODES = Object.values(RowFinder.MODES);
  const VALUE_REQUIRED_MODES = [
    RowFinder.MODES.PARTIAL_MATCH,
    RowFinder.MODES.EXACT_MATCH,
  ];
  const CONDITION_FIELD_REQUIRED_MODES = [
    RowFinder.MODES.PARTIAL_MATCH,
    RowFinder.MODES.EXACT_MATCH,
    RowFinder.MODES.LATEST,
    RowFinder.MODES.OLDEST,
  ];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(設定行の配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateLookups = (lookups) => {
    const errors = [];

    if (!Array.isArray(lookups)) {
      return { valid: false, errors: ['設定(lookups)が配列ではありません。'] };
    }

    const targetCounts = new Map();

    lookups.forEach((lookup, index) => {
      const label = `${index + 1}件目`;

      if (!lookup || !isNonEmptyString(lookup.subtableFieldCode)) {
        errors.push(`${label}: 対象サブテーブルが選択されていません。`);
      }
      if (!lookup || !VALID_MODES.includes(lookup.mode)) {
        errors.push(`${label}: 検索モードの指定が不正です。`);
        return;
      }

      if (CONDITION_FIELD_REQUIRED_MODES.includes(lookup.mode)) {
        if (!isNonEmptyString(lookup.conditionFieldCode)) {
          errors.push(`${label}: 検索対象列が選択されていません。`);
        }
      }
      if (VALUE_REQUIRED_MODES.includes(lookup.mode)) {
        if (!isNonEmptyString(lookup.matchValue)) {
          errors.push(`${label}: 一致させる値が入力されていません。`);
        }
      }

      if (
        !Array.isArray(lookup.fieldMappings) ||
        lookup.fieldMappings.length === 0
      ) {
        errors.push(
          `${label}: フィールドマッピングが1件も設定されていません。`,
        );
      } else {
        lookup.fieldMappings.forEach((mapping, mappingIndex) => {
          const mappingLabel = `${label}のマッピング${mappingIndex + 1}件目`;
          if (!mapping || !isNonEmptyString(mapping.subtableColumnCode)) {
            errors.push(
              `${mappingLabel}: サブテーブル列が選択されていません。`,
            );
          }
          if (!mapping || !isNonEmptyString(mapping.targetFieldCode)) {
            errors.push(
              `${mappingLabel}: 出力先フィールドが選択されていません。`,
            );
          } else {
            targetCounts.set(
              mapping.targetFieldCode,
              (targetCounts.get(mapping.targetFieldCode) || 0) + 1,
            );
          }
        });
      }
    });

    targetCounts.forEach((count, targetFieldCode) => {
      if (count > 1) {
        errors.push(
          `出力先フィールド「${targetFieldCode}」が${count}件のマッピングで重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateLookups };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.SubtableLookup = root.SubtableLookup || {};
    root.SubtableLookup.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
