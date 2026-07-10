(function (root) {
  'use strict';

  // 一致レコード(REST取得結果の1件、またはnull)+フィールドマッピングから、自レコードへ書き込む
  // 値のオブジェクトを組み立てる。一致レコードがnullのとき、または対象フィールドに値がないときは
  // 空文字列にする(idea.mdの「一致しなかった場合は出力先フィールドを空文字列でクリアする」方針)。
  // 型変換は行わず、他レコードのフィールド値をそのままコピーする。
  const buildFieldValues = (matchedRecord, fieldMappings) => {
    const result = {};
    (fieldMappings || []).forEach((mapping) => {
      if (!mapping || !mapping.targetFieldCode) {
        return;
      }
      const field = matchedRecord
        ? matchedRecord[mapping.sourceFieldCode]
        : undefined;
      result[mapping.targetFieldCode] = field ? field.value : '';
    });
    return result;
  };

  const FieldMapping = { buildFieldValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldMapping;
  } else {
    root.SelfLookup = root.SelfLookup || {};
    root.SelfLookup.FieldMapping = FieldMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
