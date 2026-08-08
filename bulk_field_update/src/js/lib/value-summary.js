(function (root) {
  'use strict';

  const FieldEligibility =
    typeof module !== 'undefined' && module.exports
      ? require('./field-eligibility')
      : root.BulkFieldUpdate.FieldEligibility;

  // 最終確認ダイアログに表示する、確定済みの値を人が読める文字列に変換する純粋関数。
  // idea.md「最終確認ダイアログ」参照。選択肢系フィールドはoptionsのlabelを使い、
  // フィールドコードそのものを見せない。
  const isBlank = (value) =>
    value === '' ||
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0);

  const describeValue = (field, value) => {
    if (isBlank(value)) {
      return '(空にする)';
    }
    const kind = FieldEligibility.inputKindOf(field.type);
    const optionLabel = (key) =>
      field.options && field.options[key] ? field.options[key].label : key;

    if (kind === 'SINGLE_CHOICE') {
      return optionLabel(value);
    }
    if (kind === 'MULTI_CHOICE') {
      const values = Array.isArray(value) ? value : [value];
      return values.map(optionLabel).join(', ');
    }
    return String(value);
  };

  // 確定済みのtargets([{fieldCode, value}])を、現在のフォームのフィールド定義
  // (formFieldsByCode)と突き合わせ、最終確認ダイアログ表示用のサマリー配列を返す。
  const buildTargetSummaries = (targets, formFieldsByCode) => {
    const summaries = [];
    (targets || []).forEach((target) => {
      const field = (formFieldsByCode || {})[target.fieldCode];
      if (!field) {
        return;
      }
      summaries.push({
        fieldCode: target.fieldCode,
        label: field.label,
        valueLabel: describeValue(field, target.value),
      });
    });
    return { summaries };
  };

  const ValueSummary = { isBlank, describeValue, buildTargetSummaries };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueSummary;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.ValueSummary = ValueSummary;
  }
})(typeof window !== 'undefined' ? window : globalThis);
