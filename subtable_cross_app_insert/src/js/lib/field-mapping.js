(function (root) {
  'use strict';

  // サブテーブルの1行(rowValue) + テーブル外のフィールド(sourceRecord)から、
  // 転送先アプリのレコードフィールド値({ fieldCode: { value } })を組み立てる。
  // kintoneに依存しない純粋関数。

  const resolveSourceValue = (fieldMapping, sourceRecord, rowValue) => {
    const bucket =
      fieldMapping.sourceType === 'SUBTABLE_COLUMN' ? rowValue : sourceRecord;
    const field = bucket ? bucket[fieldMapping.sourceCode] : undefined;
    return field ? field.value : '';
  };

  const resolveUpdateKeyValue = (mapping, rowValue) => {
    const field = rowValue
      ? rowValue[mapping.updateKey.subtableColumnCode]
      : undefined;
    return field ? field.value : '';
  };

  const buildDestinationFields = (mapping, sourceRecord, rowValue) => {
    const fields = {};
    (mapping.fieldMappings || []).forEach((fieldMapping) => {
      fields[fieldMapping.destinationFieldCode] = {
        value: resolveSourceValue(fieldMapping, sourceRecord, rowValue),
      };
    });

    // 更新キーの転送先フィールドは、fieldMappingsに含まれていなくても必ず値を入れる
    // (UPSERTの整合性のため、キー値は常にサブテーブル列の値そのものを使う)。
    if (mapping.updateKey && mapping.updateKey.destinationFieldCode) {
      fields[mapping.updateKey.destinationFieldCode] = {
        value: resolveUpdateKeyValue(mapping, rowValue),
      };
    }

    return fields;
  };

  const FieldMapping = { buildDestinationFields, resolveUpdateKeyValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldMapping;
  } else {
    root.SubtableCrossAppInsert = root.SubtableCrossAppInsert || {};
    root.SubtableCrossAppInsert.FieldMapping = FieldMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
