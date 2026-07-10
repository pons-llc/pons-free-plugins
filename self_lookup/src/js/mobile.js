(function (global, kintone) {
  'use strict';

  const NS = global.SelfLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ適用ロジック(record オブジェクトの形式はPC・モバイルで共通)。
  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show 相当の処理はない。
  const disableTargetFields = (record) => {
    config.lookups.forEach((lookup) => {
      (lookup.fieldMappings || []).forEach((mapping) => {
        const targetField = record[mapping.targetFieldCode];
        if (targetField) {
          targetField.disabled = true;
        }
      });
    });
  };

  const runLookup = async (lookup, record, excludeRecordId) => {
    const sourceField = record[lookup.selfKeyFieldCode];
    if (!sourceField) {
      return;
    }

    const query = NS.QueryBuilder.buildQuery(lookup, record, excludeRecordId);
    let candidateRecords = [];
    try {
      const response = await kintone.api(
        kintone.api.url('/k/v1/records.json', true),
        'GET',
        { app: kintone.app.getId(), query },
      );
      candidateRecords = response.records || [];
    } catch {
      candidateRecords = [];
    }

    const matchedRecord = NS.ClientFilter.pickMatchedRecord(
      candidateRecords,
      lookup,
      record,
    );
    const fieldValues = NS.FieldMapping.buildFieldValues(
      matchedRecord,
      lookup.fieldMappings,
    );

    Object.keys(fieldValues).forEach((targetFieldCode) => {
      const targetField = record[targetFieldCode];
      if (!targetField) {
        return;
      }
      targetField.value = fieldValues[targetFieldCode];
    });
  };

  const applyLookups = (record, excludeRecordId) =>
    Promise.all(
      config.lookups.map((lookup) =>
        runLookup(lookup, record, excludeRecordId),
      ),
    );

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      return event;
    },
  );

  const buildChangeEventTypes = (prefix) => {
    const codes = new Set();
    config.lookups.forEach((lookup) => {
      if (lookup.selfKeyFieldCode) {
        codes.add(lookup.selfKeyFieldCode);
      }
    });
    return Array.from(codes).map((code) => `${prefix}.${code}`);
  };

  const createChangeEventTypes = buildChangeEventTypes(
    'mobile.app.record.create.change',
  );
  const editChangeEventTypes = buildChangeEventTypes(
    'mobile.app.record.edit.change',
  );

  if (createChangeEventTypes.length > 0) {
    kintone.events.on(createChangeEventTypes, async (event) => {
      await applyLookups(event.record, undefined);
      return event;
    });
  }
  if (editChangeEventTypes.length > 0) {
    kintone.events.on(editChangeEventTypes, async (event) => {
      await applyLookups(event.record, event.recordId);
      return event;
    });
  }
})(window, kintone);
