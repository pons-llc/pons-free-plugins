(function (root) {
  'use strict';

  const OrgAttributes =
    typeof module !== 'undefined' && module.exports
      ? require('./org-attributes')
      : root.OrgLookup.OrgAttributes;

  const VALID_TRIGGERS = ['BUTTON', 'SUBMIT'];
  // 元フィールドは文字列1行または組織選択のみ(元メモ「ユーザーと同様の仕様」、
  // user_info_lookupの「文字列１行またはユーザー選択フィールドから転記する」に相当)。
  const VALID_SOURCE_FIELD_TYPES = ['SINGLE_LINE_TEXT', 'ORGANIZATION_SELECT'];
  // 出力先は文字列フィールドのみ。
  const VALID_DESTINATION_FIELD_TYPES = ['SINGLE_LINE_TEXT'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。fieldInfoByCode({ フィールドコード: { type } })を渡した場合のみ、
  // 元フィールド/出力先フィールドの型チェックを行う(省略時はスキップ)。
  const validateRows = (rows, fieldInfoByCode) => {
    const errors = [];

    if (!Array.isArray(rows)) {
      return { valid: false, errors: ['設定(rows)が配列ではありません。'] };
    }

    const destinationCounts = new Map();
    const spaceCounts = new Map();

    rows.forEach((row, index) => {
      const label = `${index + 1}行目`;

      if (!row || !isNonEmptyString(row.sourceFieldCode)) {
        errors.push(`${label}: 元フィールドが選択されていません。`);
      } else if (
        fieldInfoByCode &&
        fieldInfoByCode[row.sourceFieldCode] &&
        !VALID_SOURCE_FIELD_TYPES.includes(
          fieldInfoByCode[row.sourceFieldCode].type,
        )
      ) {
        errors.push(
          `${label}: 元フィールドは文字列1行または組織選択のみ選択できます。`,
        );
      }

      if (!row || !VALID_TRIGGERS.includes(row.trigger)) {
        errors.push(`${label}: 発動条件の指定が不正です。`);
      } else if (row.trigger === 'BUTTON') {
        if (!isNonEmptyString(row.buttonSpaceElementId)) {
          errors.push(
            `${label}: 発動条件がボタンの場合、設置するスペースフィールドが必要です。`,
          );
        } else {
          spaceCounts.set(
            row.buttonSpaceElementId,
            (spaceCounts.get(row.buttonSpaceElementId) || 0) + 1,
          );
        }
      }

      const mappings = row && Array.isArray(row.mappings) ? row.mappings : [];
      if (mappings.length === 0) {
        errors.push(`${label}: 転記項目が1件も設定されていません。`);
      }
      mappings.forEach((mapping, mappingIndex) => {
        const mappingLabel = `${label}の転記項目${mappingIndex + 1}件目`;
        if (
          !mapping ||
          !OrgAttributes.ATTRIBUTE_KEYS.includes(mapping.attribute)
        ) {
          errors.push(`${mappingLabel}: 項目の指定が不正です。`);
        }
        if (!mapping || !isNonEmptyString(mapping.destinationFieldCode)) {
          errors.push(
            `${mappingLabel}: 出力先フィールドが選択されていません。`,
          );
        } else {
          if (
            fieldInfoByCode &&
            fieldInfoByCode[mapping.destinationFieldCode] &&
            !VALID_DESTINATION_FIELD_TYPES.includes(
              fieldInfoByCode[mapping.destinationFieldCode].type,
            )
          ) {
            errors.push(
              `${mappingLabel}: 出力先フィールドは文字列1行のみ選択できます。`,
            );
          }
          if (
            row &&
            isNonEmptyString(row.sourceFieldCode) &&
            mapping.destinationFieldCode === row.sourceFieldCode
          ) {
            errors.push(
              `${mappingLabel}: 出力先フィールドに元フィールドと同じフィールドは選択できません。`,
            );
          }
          destinationCounts.set(
            mapping.destinationFieldCode,
            (destinationCounts.get(mapping.destinationFieldCode) || 0) + 1,
          );
        }
      });
    });

    destinationCounts.forEach((count, fieldCode) => {
      if (count > 1) {
        errors.push(
          `出力先フィールド「${fieldCode}」が${count}件の転記項目で重複しています。`,
        );
      }
    });

    spaceCounts.forEach((count, spaceElementId) => {
      if (count > 1) {
        errors.push(
          `ボタン設置スペース「${spaceElementId}」が${count}行の設定で重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRows };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.OrgLookup = root.OrgLookup || {};
    root.OrgLookup.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
