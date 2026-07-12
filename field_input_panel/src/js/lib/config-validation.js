(function (root) {
  'use strict';

  const FieldEligibility =
    typeof module !== 'undefined' && module.exports
      ? require('./field-eligibility')
      : root.FieldInputPanel.FieldEligibility;

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。fieldInfoByCode({ フィールドコード: { type, lookup } })を渡した場合のみ、
  // フィールドコードが今も選択可能(対応フィールド型・存在する)かをチェックする(省略時はスキップ)。
  const validateButtons = (buttons, fieldInfoByCode) => {
    const errors = [];

    if (!Array.isArray(buttons)) {
      return { valid: false, errors: ['設定(buttons)が配列ではありません。'] };
    }

    if (buttons.length === 0) {
      errors.push('ボタンが1件も設定されていません。');
    }

    buttons.forEach((button, buttonIndex) => {
      const label = `${buttonIndex + 1}番目のボタン`;

      if (!button || !isNonEmptyString(button.label)) {
        errors.push(`${label}: ボタンのラベルが入力されていません。`);
      }

      const items = button && Array.isArray(button.items) ? button.items : [];
      const fieldItems = items.filter((item) => item && item.type === 'FIELD');

      if (fieldItems.length === 0) {
        errors.push(`${label}: フィールドが1件も選択されていません。`);
      }

      const fieldCodeCounts = new Map();
      fieldItems.forEach((item, itemIndex) => {
        const itemLabel = `${label}の${itemIndex + 1}番目の項目`;
        if (!isNonEmptyString(item.fieldCode)) {
          errors.push(`${itemLabel}: フィールドが選択されていません。`);
          return;
        }
        if (
          fieldInfoByCode &&
          !FieldEligibility.isEligibleField(fieldInfoByCode[item.fieldCode])
        ) {
          errors.push(
            `${itemLabel}: 「${item.fieldCode}」は選択できないフィールドです。`,
          );
        }
        fieldCodeCounts.set(
          item.fieldCode,
          (fieldCodeCounts.get(item.fieldCode) || 0) + 1,
        );
      });

      fieldCodeCounts.forEach((count, fieldCode) => {
        if (count > 1) {
          errors.push(
            `${label}: フィールド「${fieldCode}」が重複して選択されています。`,
          );
        }
      });

      items.forEach((item, itemIndex) => {
        if (!item || (item.type !== 'FIELD' && item.type !== 'SPACER')) {
          errors.push(
            `${label}の${itemIndex + 1}番目の項目: 項目の種類が不正です。`,
          );
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateButtons };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.FieldInputPanel = root.FieldInputPanel || {};
    root.FieldInputPanel.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
