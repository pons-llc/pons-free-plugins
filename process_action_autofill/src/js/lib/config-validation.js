(function (root) {
  'use strict';

  const FieldEligibility =
    typeof module !== 'undefined' && module.exports
      ? require('./field-eligibility')
      : root.ProcessActionAutofill.FieldEligibility;

  const TEXT_TYPES = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  const NUMBER_TYPES = ['NUMBER'];
  const CHOICE_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];
  const MULTI_CHOICE_TYPES = ['CHECK_BOX', 'MULTI_SELECT'];
  const DATE_TIME_TYPES = ['DATE', 'DATETIME'];
  const UNITS = ['DAYS', 'MINUTES'];
  const OPERATIONS = ['SET', 'CLEAR'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 選択肢系フィールド(RADIO_BUTTON/DROP_DOWN/CHECK_BOX/MULTI_SELECT)の選択肢一覧を、
  // getFormFields()の戻り値のoptionsオブジェクト({ 選択肢: { label, index } })から取り出す。
  const optionLabelsOf = (fieldInfo) =>
    fieldInfo && fieldInfo.options ? Object.keys(fieldInfo.options) : null;

  const validateSourceForSet = (
    label,
    rule,
    targetField,
    fieldInfoByCode,
    errors,
  ) => {
    const targetFieldType = targetField && targetField.type;
    const src = rule.source || {};

    if (
      TEXT_TYPES.includes(targetFieldType) ||
      NUMBER_TYPES.includes(targetFieldType)
    ) {
      if (src.type !== 'FIXED' && src.type !== 'COPY_FIELD') {
        errors.push(
          `${label}: 値のソース種別(固定値/フィールドのコピー)が不正です。`,
        );
        return;
      }
      if (src.type === 'FIXED') {
        if (src.value === undefined || src.value === null || src.value === '') {
          errors.push(`${label}: 固定値が入力されていません。`);
        } else if (
          NUMBER_TYPES.includes(targetFieldType) &&
          !Number.isFinite(parseFloat(src.value))
        ) {
          errors.push(`${label}: 固定値は数値で指定してください。`);
        }
        return;
      }
      if (!isNonEmptyString(src.fieldCode)) {
        errors.push(`${label}: コピー元フィールドが選択されていません。`);
      } else if (fieldInfoByCode) {
        const category = FieldEligibility.categoryOf(targetFieldType);
        const candidateCodes = FieldEligibility.listCopySourceCandidates(
          fieldInfoByCode,
          category,
        ).map((f) => f.code);
        if (!candidateCodes.includes(src.fieldCode)) {
          errors.push(
            `${label}: コピー元フィールド「${src.fieldCode}」は対象フィールドと互換性のある型ではありません。`,
          );
        }
      }
      return;
    }

    if (CHOICE_TYPES.includes(targetFieldType)) {
      if (src.type !== 'FIXED' || !isNonEmptyString(src.value)) {
        errors.push(`${label}: 選択肢が選択されていません。`);
      } else {
        const options = optionLabelsOf(targetField);
        if (options && !options.includes(src.value)) {
          errors.push(
            `${label}: 選択した値「${src.value}」は対象フィールドの現在の選択肢に存在しません。`,
          );
        }
      }
      return;
    }

    if (MULTI_CHOICE_TYPES.includes(targetFieldType)) {
      if (
        src.type !== 'FIXED' ||
        !Array.isArray(src.values) ||
        src.values.length === 0
      ) {
        errors.push(`${label}: 選択肢が1つも選択されていません。`);
      } else {
        const options = optionLabelsOf(targetField);
        if (options) {
          const invalid = src.values.filter((v) => !options.includes(v));
          if (invalid.length > 0) {
            errors.push(
              `${label}: 選択した値(${invalid.join('、')})は対象フィールドの現在の選択肢に存在しません。`,
            );
          }
        }
      }
      return;
    }

    if (DATE_TIME_TYPES.includes(targetFieldType)) {
      if (src.type !== 'NOW_OFFSET') {
        errors.push(`${label}: 値のソース種別が不正です。`);
        return;
      }
      if (!UNITS.includes(src.unit)) {
        errors.push(`${label}: 単位(日数/分数)の指定が不正です。`);
      } else if (src.unit === 'MINUTES' && targetFieldType !== 'DATETIME') {
        errors.push(
          `${label}: 単位「分数」は対象フィールドが日時型の場合のみ選択できます。`,
        );
      }
      if (!Number.isFinite(src.magnitude)) {
        errors.push(`${label}: オフセット値は数値で指定してください。`);
      }
      return;
    }

    if (targetFieldType === 'USER_SELECT') {
      if (src.type !== 'ACTOR') {
        errors.push(`${label}: ユーザーフィールドのソース種別が不正です。`);
      }
      return;
    }

    if (targetFieldType === 'ORGANIZATION_SELECT') {
      if (src.type !== 'FIXED_CODE' && src.type !== 'ACTOR_PRIMARY_ORG') {
        errors.push(`${label}: 組織フィールドのソース種別が不正です。`);
      } else if (src.type === 'FIXED_CODE' && !isNonEmptyString(src.value)) {
        errors.push(`${label}: 組織コードが入力されていません。`);
      }
      return;
    }

    if (targetFieldType === 'GROUP_SELECT') {
      if (src.type !== 'FIXED_CODE') {
        errors.push(`${label}: グループフィールドのソース種別が不正です。`);
      } else if (!isNonEmptyString(src.value)) {
        errors.push(`${label}: グループコードが入力されていません。`);
      }
      return;
    }

    errors.push(`${label}: 対象フィールドの型に対応するソースがありません。`);
  };

  // 設定画面の保存前チェック。fieldInfoByCode({ フィールドコード: getFormFields()の1件 })を渡した
  // 場合のみ、フィールドコードが今も選択可能(対応フィールド型・存在する)かをチェックする
  // (省略時は構造チェックのみ、date_offset_autofillと同じ設計)。
  const validateRules = (rules, fieldInfoByCode) => {
    const errors = [];

    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['設定(rules)が配列ではありません。'] };
    }

    rules.forEach((rule, index) => {
      const label = `${index + 1}件目`;
      const r = rule || {};

      if (!isNonEmptyString(r.targetFieldCode)) {
        errors.push(`${label}: 対象フィールドが選択されていません。`);
      }

      if (!OPERATIONS.includes(r.operation)) {
        errors.push(`${label}: 動作(値を設定/値をクリア)の指定が不正です。`);
      }

      if (!fieldInfoByCode || !isNonEmptyString(r.targetFieldCode)) {
        return;
      }

      const targetField = fieldInfoByCode[r.targetFieldCode];
      if (
        !targetField ||
        !FieldEligibility.SUPPORTED_TYPES.includes(targetField.type)
      ) {
        errors.push(
          `${label}: 対象フィールド「${r.targetFieldCode}」は対応していない型、または存在しません。`,
        );
        return;
      }

      if (r.operation === 'SET') {
        validateSourceForSet(label, r, targetField, fieldInfoByCode, errors);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
