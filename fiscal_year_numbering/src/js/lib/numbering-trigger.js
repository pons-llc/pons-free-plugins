(function (root) {
  'use strict';

  // 採番タイミング(config.numberingTiming)の判定。kintone依存を持たない純粋ロジックとして
  // desktop.js/mobile.jsの各イベントハンドラーから共通で参照する。

  // 未設定(既存の保存済み設定に numberingTiming が無い場合)は 'save' 扱いにする
  // (config-store.jsのDEFAULTSと同じ既定値。後方互換のため)。
  const isSaveTrigger = (config) => (config.numberingTiming || 'save') === 'save';

  const isButtonTrigger = (config) => config.numberingTiming === 'button';

  const isStatusTrigger = (config, nextStatusValue) =>
    config.numberingTiming === 'status' &&
    Boolean(config.numberingStatus) &&
    config.numberingStatus === nextStatusValue;

  const NumberingTrigger = { isSaveTrigger, isButtonTrigger, isStatusTrigger };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NumberingTrigger;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.NumberingTrigger = NumberingTrigger;
  }
})(typeof window !== 'undefined' ? window : globalThis);
