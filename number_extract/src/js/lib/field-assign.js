(function (root) {
  'use strict';

  // 抽出結果の配列(parts)を、出力先フィールドの並び(targetFieldCodes)へ先頭から順に割り当てる。
  // partsが足りない分は空文字列でクリアし、partsが多い分ははみ出しとして切り捨てる
  // (idea.mdの可変長割り当てルール、text_splitと同じ設計)。kintoneに依存しない純粋関数。
  const buildFieldValues = (parts, targetFieldCodes) => {
    const result = {};
    (targetFieldCodes || []).forEach((targetFieldCode, index) => {
      if (!targetFieldCode) {
        return;
      }
      result[targetFieldCode] = index < parts.length ? parts[index] : '';
    });
    return result;
  };

  const FieldAssign = { buildFieldValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldAssign;
  } else {
    root.NumberExtract = root.NumberExtract || {};
    root.NumberExtract.FieldAssign = FieldAssign;
  }
})(typeof window !== 'undefined' ? window : globalThis);
