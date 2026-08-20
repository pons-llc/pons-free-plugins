(function (root) {
  'use strict';

  const UNITS = ['DAYS', 'SECONDS'];
  const OFFSET_SOURCES = ['FIXED', 'FIELD'];
  const DATE_TYPES = ['DATE', 'DATETIME'];
  const NUMERIC_CALC_FORMATS = ['NUMBER', 'NUMBER_DIGIT'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  const isNumericOffsetField = (fieldInfo) => {
    if (!fieldInfo) {
      return false;
    }
    if (fieldInfo.type === 'NUMBER') {
      return true;
    }
    return (
      fieldInfo.type === 'CALC' &&
      NUMERIC_CALC_FORMATS.includes(fieldInfo.format)
    );
  };

  // 設定画面の保存前チェック。fieldInfoByCode({ フィールドコード: { type, format } })を渡した場合のみ、
  // フィールドコードが今も選択可能(対応フィールド型・存在する)かをチェックする(省略時は構造チェックのみ)。
  const validateRules = (rules, fieldInfoByCode) => {
    const errors = [];

    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['設定(rules)が配列ではありません。'] };
    }

    const targetCounts = new Map();

    rules.forEach((rule, index) => {
      const label = `${index + 1}件目`;
      const r = rule || {};

      if (!isNonEmptyString(r.baseFieldCode)) {
        errors.push(`${label}: 基準フィールドが選択されていません。`);
      }
      if (!isNonEmptyString(r.targetFieldCode)) {
        errors.push(`${label}: 出力先フィールドが選択されていません。`);
      } else {
        targetCounts.set(
          r.targetFieldCode,
          (targetCounts.get(r.targetFieldCode) || 0) + 1,
        );
        if (r.targetFieldCode === r.baseFieldCode) {
          errors.push(
            `${label}: 出力先フィールドに基準フィールドと同じフィールドを指定できません。`,
          );
        }
      }

      if (!UNITS.includes(r.unit)) {
        errors.push(`${label}: 単位(日数/秒数)の指定が不正です。`);
      }

      if (!OFFSET_SOURCES.includes(r.offsetSource)) {
        errors.push(`${label}: オフセット値の種類の指定が不正です。`);
      } else if (r.offsetSource === 'FIXED') {
        if (!Number.isFinite(r.fixedValue)) {
          errors.push(`${label}: 固定値は数値で指定してください。`);
        }
      } else if (r.offsetSource === 'FIELD') {
        if (!isNonEmptyString(r.offsetFieldCode)) {
          errors.push(
            `${label}: オフセット参照フィールドが選択されていません。`,
          );
        }
      }

      if (!fieldInfoByCode) {
        return;
      }

      const baseField = fieldInfoByCode[r.baseFieldCode];
      const targetField = fieldInfoByCode[r.targetFieldCode];

      if (isNonEmptyString(r.baseFieldCode)) {
        if (!baseField || !DATE_TYPES.includes(baseField.type)) {
          errors.push(
            `${label}: 基準フィールド「${r.baseFieldCode}」は日付/日時型ではありません。`,
          );
        }
      }

      if (
        isNonEmptyString(r.targetFieldCode) &&
        r.targetFieldCode !== r.baseFieldCode
      ) {
        if (!targetField || !DATE_TYPES.includes(targetField.type)) {
          errors.push(
            `${label}: 出力先フィールド「${r.targetFieldCode}」は日付/日時型ではありません。`,
          );
        } else if (baseField && targetField.type !== baseField.type) {
          errors.push(
            `${label}: 基準フィールドと出力先フィールドの型(日付/日時)が一致していません。`,
          );
        }
      }

      if (r.unit === 'SECONDS' && baseField && baseField.type !== 'DATETIME') {
        errors.push(
          `${label}: 単位「秒数」は基準フィールドが日時型の場合のみ選択できます。`,
        );
      }

      if (
        r.offsetSource === 'FIELD' &&
        isNonEmptyString(r.offsetFieldCode) &&
        !isNumericOffsetField(fieldInfoByCode[r.offsetFieldCode])
      ) {
        errors.push(
          `${label}: オフセット参照フィールド「${r.offsetFieldCode}」は数値フィールド、または表示書式が数値の計算フィールドではありません。`,
        );
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

  const ConfigValidation = { validateRules, isNumericOffsetField };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.DateOffsetAutofill = root.DateOffsetAutofill || {};
    root.DateOffsetAutofill.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
