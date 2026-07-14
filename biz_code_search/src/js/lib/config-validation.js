(function (root) {
  'use strict';

  const GBizAttributes =
    typeof module !== 'undefined' && module.exports
      ? require('./gbiz-attributes')
      : root.BizCodeSearch.GBizAttributes;

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 出力先・法人番号・法人名フィールドはいずれも文字列(1行)のみを想定する(idea.md参照。
  // 資本金等の数値項目も文字列化して書き込むため、数値フィールドの書式・精度を気にしなくてよい)。
  const isEligibleTextField = (fieldInfo) =>
    !fieldInfo || fieldInfo.type === 'SINGLE_LINE_TEXT';

  // 設定画面の保存前チェック。プラグイン設定(設定行の配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  // fieldInfoByCode(任意、{ フィールドコード: { type } })を渡した場合のみ、文字列(1行)フィールド
  // 制約のチェックを行う(省略時はスキップ)。
  const validateLookups = (lookups, fieldInfoByCode) => {
    const errors = [];

    if (!Array.isArray(lookups)) {
      return { valid: false, errors: ['設定(lookups)が配列ではありません。'] };
    }

    const targetCounts = new Map();
    const spaceCounts = new Map();

    lookups.forEach((lookup, index) => {
      const label = `${index + 1}件目`;

      if (!lookup || !isNonEmptyString(lookup.corporateNumberFieldCode)) {
        errors.push(`${label}: 法人番号フィールドが選択されていません。`);
      } else if (
        fieldInfoByCode &&
        !isEligibleTextField(fieldInfoByCode[lookup.corporateNumberFieldCode])
      ) {
        errors.push(
          `${label}: 法人番号フィールドは文字列(1行)のみ選択できます。`,
        );
      }

      if (!lookup || !isNonEmptyString(lookup.companyNameFieldCode)) {
        errors.push(`${label}: 法人名フィールドが選択されていません。`);
      } else if (
        fieldInfoByCode &&
        !isEligibleTextField(fieldInfoByCode[lookup.companyNameFieldCode])
      ) {
        errors.push(
          `${label}: 法人名フィールドは文字列(1行)のみ選択できます。`,
        );
      }

      if (!lookup || !isNonEmptyString(lookup.numberButtonSpaceElementId)) {
        errors.push(
          `${label}: 「法人番号から取得」ボタンを設置するスペースフィールドが選択されていません。`,
        );
      } else {
        spaceCounts.set(
          lookup.numberButtonSpaceElementId,
          (spaceCounts.get(lookup.numberButtonSpaceElementId) || 0) + 1,
        );
      }

      if (!lookup || !isNonEmptyString(lookup.nameButtonSpaceElementId)) {
        errors.push(
          `${label}: 「法人名から検索」ボタンを設置するスペースフィールドが選択されていません。`,
        );
      } else {
        spaceCounts.set(
          lookup.nameButtonSpaceElementId,
          (spaceCounts.get(lookup.nameButtonSpaceElementId) || 0) + 1,
        );
      }

      const fieldMappings =
        lookup && Array.isArray(lookup.fieldMappings)
          ? lookup.fieldMappings
          : [];
      if (fieldMappings.length === 0) {
        errors.push(`${label}: 転記項目が1件も設定されていません。`);
      }
      fieldMappings.forEach((mapping, mappingIndex) => {
        const mappingLabel = `${label}の転記項目${mappingIndex + 1}件目`;
        if (
          !mapping ||
          !isNonEmptyString(mapping.attribute) ||
          !GBizAttributes.ATTRIBUTE_KEYS.includes(mapping.attribute)
        ) {
          errors.push(`${mappingLabel}: 転記する項目が選択されていません。`);
        }
        if (!mapping || !isNonEmptyString(mapping.targetFieldCode)) {
          errors.push(
            `${mappingLabel}: 出力先フィールドが選択されていません。`,
          );
        } else {
          if (
            lookup &&
            (mapping.targetFieldCode === lookup.corporateNumberFieldCode ||
              mapping.targetFieldCode === lookup.companyNameFieldCode)
          ) {
            errors.push(
              `${mappingLabel}: 出力先フィールドに法人番号・法人名フィールドは選択できません。`,
            );
          }
          if (
            fieldInfoByCode &&
            !isEligibleTextField(fieldInfoByCode[mapping.targetFieldCode])
          ) {
            errors.push(
              `${mappingLabel}: 出力先フィールドは文字列(1行)のみ選択できます。`,
            );
          }
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
          `出力先フィールド「${targetFieldCode}」が${count}件の転記項目で重複しています。`,
        );
      }
    });

    spaceCounts.forEach((count, spaceElementId) => {
      if (count > 1) {
        errors.push(
          `ボタン設置スペース「${spaceElementId}」が${count}件のボタンで重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateLookups };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.BizCodeSearch = root.BizCodeSearch || {};
    root.BizCodeSearch.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
