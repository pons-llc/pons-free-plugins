(function (root) {
  'use strict';

  // 会計年度は常に4月始まり(固定)。年度を決定する日付の取得元(作成日時/任意フィールド)は設定で選べる。
  const FISCAL_YEAR_START_MONTH_INDEX = 3; // April, 0-indexed

  const toFiscalYear = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    return month >= FISCAL_YEAR_START_MONTH_INDEX ? year : year - 1;
  };

  const resolveDate = (config, record) => {
    if (config.fiscalYearDateSource === 'FIELD') {
      const field = record[config.fiscalYearDateField];
      const rawValue = field ? field.value : '';
      if (!rawValue) {
        throw new Error(
          `年度判定用フィールド(${config.fiscalYearDateField})の値が空です。`
        );
      }
      return new Date(rawValue);
    }

    const field = record['作成日時'];
    const rawValue = field ? field.value : '';
    if (!rawValue) {
      throw new Error('作成日時の値を取得できませんでした。');
    }
    return new Date(rawValue);
  };

  const FiscalYear = { toFiscalYear, resolveDate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiscalYear;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.FiscalYear = FiscalYear;
  }
})(typeof window !== 'undefined' ? window : globalThis);
