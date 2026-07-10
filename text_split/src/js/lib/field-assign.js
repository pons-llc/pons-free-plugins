(function (root) {
  'use strict';

  // 分割結果の配列(parts)を、出力先フィールドの並び(targetFieldCodes)へ先頭から順に割り当てる。
  // partsが足りない分は空文字列でクリアし(idea.mdの「余った出力先フィールドは空文字列でクリアする」方針)、
  // partsが多い分ははみ出しとして切り捨てる。kintoneに依存しない純粋関数。
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
    root.TextSplit = root.TextSplit || {};
    root.TextSplit.FieldAssign = FieldAssign;
  }
})(typeof window !== 'undefined' ? window : globalThis);
