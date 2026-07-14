(function (root) {
  'use strict';

  // 法人情報(gBizINFO詳細取得のhojin-infos[0]、またはnull)+転記項目(属性キー→出力先フィールド)から、
  // 出力先フィールドへ書き込む値のオブジェクトを組み立てる。該当法人が無い(hojinInfoがnull)場合、
  // または該当属性の値がnull/undefinedの場合はすべて空文字列にする(idea.mdの「該当なしはクリア」方針)。
  // 出力先フィールドは文字列(1行)のみを想定するため、数値項目(資本金・従業員数・創業年)も
  // 文字列化する(0は空文字列にしない)。
  const buildFieldValues = (hojinInfo, mappings) => {
    const result = {};
    (mappings || []).forEach((mapping) => {
      if (!mapping || !mapping.targetFieldCode) {
        return;
      }
      const value = hojinInfo ? hojinInfo[mapping.attribute] : undefined;
      result[mapping.targetFieldCode] =
        value === null || value === undefined ? '' : String(value);
    });
    return result;
  };

  const GBizFieldMapping = { buildFieldValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GBizFieldMapping;
  } else {
    root.BizCodeSearch = root.BizCodeSearch || {};
    root.BizCodeSearch.GBizFieldMapping = GBizFieldMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
