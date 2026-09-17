(function (root) {
  'use strict';

  const CharType =
    typeof module !== 'undefined' && module.exports
      ? require('./char-type')
      : root.InputFormatRule.CharType;

  // 1フィールド分の値をルールに従って検証し、違反があればエラーメッセージ、無ければnullを返す。
  const validateFieldValue = (value, rule) => {
    if (!rule) {
      return null;
    }
    const violated = CharType.detectForbiddenTypes(value, rule.forbid);
    return CharType.buildErrorMessage(violated);
  };

  const findRuleForField = (rules, fieldCode) =>
    (rules || []).find((rule) => rule.fieldCode === fieldCode);

  // レコード全体に対して全ルールを検証する(submit時に使用)。対象フィールドごとに、違反時は
  // エラーメッセージ・違反なしはnullを返す「完全なマップ」にする。値を修正して違反が
  // 無くなった場合に、以前の変更時に設定されたエラーを明示的にクリアできるようにするため
  // (message===nullをそのままrecord[fieldCode].errorに代入すればクリアになる)。
  // 対象フィールドがレコードに存在しない場合(型変更等での不整合)は無視し、例外を投げない。
  const validateRecord = (record, rules) => {
    const fieldMessages = {};
    let hasError = false;
    (rules || []).forEach((rule) => {
      const field = record ? record[rule.fieldCode] : undefined;
      if (!field) {
        return;
      }
      const message = validateFieldValue(field.value, rule);
      fieldMessages[rule.fieldCode] = message;
      if (message) {
        hasError = true;
      }
    });
    return { fieldMessages, hasError };
  };

  const RecordValidator = {
    validateFieldValue,
    findRuleForField,
    validateRecord,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordValidator;
  } else {
    root.InputFormatRule = root.InputFormatRule || {};
    root.InputFormatRule.RecordValidator = RecordValidator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
