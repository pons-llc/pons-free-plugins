(function (root) {
  'use strict';

  // 日本の法人番号は13桁の数字(チェックディジット付き)。無駄なAPI呼び出しを避けるための
  // 簡易な形式チェックのみ行い、チェックディジットの計算検証までは実装しない(idea.md参照)。
  const CORPORATE_NUMBER_PATTERN = /^\d{13}$/;

  const isValidCorporateNumber = (value) =>
    typeof value === 'string' && CORPORATE_NUMBER_PATTERN.test(value);

  const CorporateNumber = { isValidCorporateNumber };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorporateNumber;
  } else {
    root.BizCodeSearch = root.BizCodeSearch || {};
    root.BizCodeSearch.CorporateNumber = CorporateNumber;
  }
})(typeof window !== 'undefined' ? window : globalThis);
