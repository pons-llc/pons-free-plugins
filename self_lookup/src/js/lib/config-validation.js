(function (root) {
  'use strict';

  const QueryBuilder =
    typeof module !== 'undefined' && module.exports
      ? require('./query-builder')
      : root.SelfLookup.QueryBuilder;

  const VALID_OPERATORS = Object.values(QueryBuilder.OPERATORS);
  const VALID_VALUE_SOURCES = ['FIXED', 'SELF_FIELD'];

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

      if (!lookup || !isNonEmptyString(lookup.selfKeyFieldCode)) {
        errors.push(
          `${label}: 自レコードのキーフィールドが選択されていません。`,
        );
      }
      if (!lookup || !isNonEmptyString(lookup.otherKeyFieldCode)) {
        errors.push(`${label}: 検索先のキーフィールドが選択されていません。`);
      }

      (lookup && lookup.conditions ? lookup.conditions : []).forEach(
        (condition, conditionIndex) => {
          const conditionLabel = `${label}の絞り込み条件${conditionIndex + 1}件目`;
          if (!condition || !isNonEmptyString(condition.fieldCode)) {
            errors.push(`${conditionLabel}: フィールドが選択されていません。`);
          }
          if (!condition || !VALID_OPERATORS.includes(condition.operator)) {
            errors.push(`${conditionLabel}: 演算子の指定が不正です。`);
            return;
          }
          if (
            !condition ||
            !VALID_VALUE_SOURCES.includes(condition.valueSource)
          ) {
            errors.push(`${conditionLabel}: 値のソースの指定が不正です。`);
            return;
          }
          if (
            condition.valueSource === 'FIXED' &&
            !isNonEmptyString(condition.value)
          ) {
            errors.push(`${conditionLabel}: 固定値が入力されていません。`);
          }
          if (
            condition.valueSource === 'SELF_FIELD' &&
            !isNonEmptyString(condition.selfFieldCode)
          ) {
            errors.push(
              `${conditionLabel}: 参照する自レコードのフィールドが選択されていません。`,
            );
          }
        },
      );

      const fieldMappings =
        lookup && Array.isArray(lookup.fieldMappings)
          ? lookup.fieldMappings
          : [];
      if (fieldMappings.length === 0) {
        errors.push(
          `${label}: フィールドマッピングが1件も設定されていません。`,
        );
      }
      fieldMappings.forEach((mapping, mappingIndex) => {
        const mappingLabel = `${label}のマッピング${mappingIndex + 1}件目`;
        if (!mapping || !isNonEmptyString(mapping.sourceFieldCode)) {
          errors.push(
            `${mappingLabel}: 検索先のフィールドが選択されていません。`,
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
    root.SelfLookup = root.SelfLookup || {};
    root.SelfLookup.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
