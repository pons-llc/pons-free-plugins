(function (root) {
  'use strict';

  // サブテーブルの行配列から、`PUT /k/v1/records.json` (upsert: true) に渡す
  // リクエストボディを組み立てる。kintoneは1リクエストあたり最大100件のため、
  // 100件ずつ(既定)に分割した複数のリクエストボディの配列を返す。

  const FieldMapping =
    typeof module !== 'undefined' && module.exports
      ? require('./field-mapping')
      : root.SubtableCrossAppInsert.FieldMapping;

  const DEFAULT_CHUNK_SIZE = 100;

  const chunk = (items, size) => {
    const chunkSize = size > 0 ? size : DEFAULT_CHUNK_SIZE;
    const result = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      result.push(items.slice(i, i + chunkSize));
    }
    return result;
  };

  const buildUpsertRecord = (mapping, sourceRecord, row) => {
    const rowValue = row.value || {};
    const keyValue = FieldMapping.resolveUpdateKeyValue(mapping, rowValue);
    return {
      updateKey: {
        field: mapping.updateKey.destinationFieldCode,
        value: keyValue,
      },
      record: FieldMapping.buildDestinationFields(
        mapping,
        sourceRecord,
        rowValue,
      ),
    };
  };

  const buildRequestBodies = (
    destinationAppId,
    mapping,
    sourceRecord,
    rows,
    chunkSize = DEFAULT_CHUNK_SIZE,
  ) => {
    if (!rows || rows.length === 0) {
      return [];
    }
    const upsertRecords = rows.map((row) =>
      buildUpsertRecord(mapping, sourceRecord, row),
    );
    return chunk(upsertRecords, chunkSize).map((records) => ({
      app: destinationAppId,
      upsert: true,
      records,
    }));
  };

  const UpsertBatch = { chunk, buildRequestBodies, DEFAULT_CHUNK_SIZE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpsertBatch;
  } else {
    root.SubtableCrossAppInsert = root.SubtableCrossAppInsert || {};
    root.SubtableCrossAppInsert.UpsertBatch = UpsertBatch;
  }
})(typeof window !== 'undefined' ? window : globalThis);
