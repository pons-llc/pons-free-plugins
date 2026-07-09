(function (root) {
  'use strict';

  // 令和(2019年〜)を初期値としてシードする既定の元号テーブル。管理者が設定画面で追加・編集できる。
  const DEFAULT_ERA_TABLE = [{ code: 'R', label: '令和', startYear: 2019 }];

  const matchingEra = (eraTable, fiscalYear) => {
    const sorted = [...eraTable].sort((a, b) => a.startYear - b.startYear);
    let matched = null;
    for (const era of sorted) {
      if (era.startYear <= fiscalYear) {
        matched = era;
      } else {
        break;
      }
    }
    if (!matched) {
      throw new Error(
        `年度${fiscalYear}に該当する元号が元号テーブルに見つかりません。`
      );
    }
    return matched;
  };

  const eraYear = (era, fiscalYear) => fiscalYear - era.startYear + 1;

  const EraTable = { DEFAULT_ERA_TABLE, matchingEra, eraYear };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EraTable;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.EraTable = EraTable;
  }
})(typeof window !== 'undefined' ? window : globalThis);
