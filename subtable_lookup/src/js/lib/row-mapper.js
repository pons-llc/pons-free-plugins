(function (root) {
  'use strict';

  const RowFinder =
    typeof module !== 'undefined' && module.exports
      ? require('./row-finder')
      : root.SubtableLookup.RowFinder;

  // 一致行(またはnull)+フィールドマッピングから、出力先フィールドへ書き込む値のオブジェクトを組み立てる。
  // 一致行がnullのとき、または対象のサブテーブル列に値がないときは空文字列にする
  // (idea.mdの「一致しなかった場合は出力先フィールドを空文字列でクリアする」方針)。
  // 型変換は行わず、サブテーブル列の値をそのままコピーする(CHECK_BOX等の配列値もそのまま渡す)。
  const buildFieldValues = (matchedRow, fieldMappings) => {
    const result = {};
    (fieldMappings || []).forEach((mapping) => {
      if (!mapping || !mapping.targetFieldCode) {
        return;
      }
      const rawValue = matchedRow
        ? RowFinder.getColumnValue(matchedRow, mapping.subtableColumnCode)
        : undefined;
      result[mapping.targetFieldCode] = rawValue === undefined ? '' : rawValue;
    });
    return result;
  };

  const RowMapper = { buildFieldValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RowMapper;
  } else {
    root.SubtableLookup = root.SubtableLookup || {};
    root.SubtableLookup.RowMapper = RowMapper;
  }
})(typeof window !== 'undefined' ? window : globalThis);
