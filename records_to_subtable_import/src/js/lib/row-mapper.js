(function (root) {
  'use strict';

  // 取得元アプリのレコード配列(REST APIの`records`、フィールドコード -> {type, value})を、
  // フィールドマッピング設定に従ってサブテーブルの行(value配列)へ変換する純粋関数。
  // 型の組み合わせが妥当かどうかの判定はtype-compatibility.jsが別途担当し、
  // ここでは「その組み合わせで実際にどう値を作るか」だけを扱う。

  const TEXT_TARGET_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'RICH_TEXT',
  ];

  // 文字列系フィールドへ変換するときの値の整形。
  // 配列(チェックボックス等)はカンマ区切りに、オブジェクト({code,name}等)はnameかcodeを、
  // null/undefinedは空文字列にする。
  const stringifyForTextTarget = (raw) => {
    if (raw === null || raw === undefined) {
      return '';
    }
    if (Array.isArray(raw)) {
      return raw
        .map((item) =>
          item && typeof item === 'object'
            ? item.name || item.code || ''
            : String(item),
        )
        .join(', ');
    }
    if (typeof raw === 'object') {
      return raw.name || raw.code || '';
    }
    return String(raw);
  };

  // 1つのフィールドマッピングについて、サブテーブル列にセットする値(そのフィールドのvalue)を決める。
  const resolveTargetValue = (sourceField, targetFieldType) => {
    const raw = sourceField ? sourceField.value : undefined;
    if (TEXT_TARGET_TYPES.includes(targetFieldType)) {
      return stringifyForTextTarget(raw);
    }
    // 型が一致する(あるいは互換性チェックを通過した)組み合わせは、値をそのままコピーする。
    return raw === undefined ? '' : raw;
  };

  // 1件の取得元レコードから、サブテーブル1行分のvalueオブジェクト({フィールドコード: {type, value}})を作る。
  const mapRecordToRowValue = (sourceRecord, fieldMappings) => {
    const value = {};
    (fieldMappings || []).forEach((mapping) => {
      const sourceField = sourceRecord
        ? sourceRecord[mapping.sourceFieldCode]
        : undefined;
      value[mapping.targetFieldCode] = {
        type: mapping.targetFieldType,
        value: resolveTargetValue(sourceField, mapping.targetFieldType),
      };
    });
    return value;
  };

  // 取得元レコード配列全体をサブテーブルの行配列(kintone.app.record.set()にそのまま渡せる形式)に変換する。
  // 新規行として追加するため、行の`id`は付与しない
  // (REST APIの仕様上、idを指定しない行は新規行として扱われる。JavaScript APIのset()もget()と
  // 同じ形式を受け付けるため、既存行のidと衝突しないよう意図的に省略している)。
  const mapRecordsToRows = (sourceRecords, fieldMappings) =>
    (sourceRecords || []).map((sourceRecord) => ({
      value: mapRecordToRowValue(sourceRecord, fieldMappings),
    }));

  const RowMapper = {
    mapRecordToRowValue,
    mapRecordsToRows,
    stringifyForTextTarget,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RowMapper;
  } else {
    root.RecordsToSubtable = root.RecordsToSubtable || {};
    root.RecordsToSubtable.RowMapper = RowMapper;
  }
})(typeof window !== 'undefined' ? window : globalThis);
