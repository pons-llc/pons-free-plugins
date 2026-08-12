(function (root) {
  'use strict';

  // 予算設定行1件のバリデーション。設定画面の保存時に使う。
  //
  // 戻り値はエラーメッセージの配列(空配列 = 妥当)。
  const validateRow = (row) => {
    const errors = [];
    if (!row.viewId) {
      errors.push('対象の一覧を選択してください');
    }
    if (!row.targetFieldCode) {
      errors.push('集計対象フィールドを選択してください');
    }

    const budget = Number(row.budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      errors.push('予算額は0より大きい数値を入力してください');
    }

    const warning = Number(row.warningThresholdPct);
    if (!Number.isFinite(warning) || warning < 0) {
      errors.push('警告しきい値(%)は0以上の数値を入力してください');
    }

    const danger = Number(row.dangerThresholdPct);
    if (!Number.isFinite(danger) || danger < 0) {
      errors.push('危険しきい値(%)は0以上の数値を入力してください');
    }

    if (
      Number.isFinite(warning) &&
      Number.isFinite(danger) &&
      warning > danger
    ) {
      errors.push('警告しきい値(%)は危険しきい値(%)以下にしてください');
    }

    return errors;
  };

  const isValidRow = (row) => validateRow(row).length === 0;

  const RowValidator = { validateRow, isValidRow };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RowValidator;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.RowValidator = RowValidator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
