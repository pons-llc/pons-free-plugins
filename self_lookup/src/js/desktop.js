(function (global, kintone) {
  'use strict';

  const NS = global.SelfLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 出力先フィールドは常にプラグインが上書きする値なので、追加・編集画面では直接入力できないように
  // disabledにする(idea.mdの「挿入先の編集を禁止」)。
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

  // 1つの設定行についてREST検索を実行し、一致レコードの値を出力先フィールドへ反映する。
  const runLookup = async (lookup, record, excludeRecordId) => {
    const sourceField = record[lookup.selfKeyFieldCode];
    // 自レコードのキーフィールドが存在しない(フィールド削除・設定の食い違い等)場合は何もしない。
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
      // 検索失敗(権限エラー・ネットワークエラー等)時は「一致なし」として扱い、
      // 出力先フィールドを空文字列でクリアする(画面をクラッシュさせない)。
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
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      return event;
    },
  );

  // 設定されているキーフィールドコードから、重複を除いたchangeイベントタイプの配列を組み立てる
  // (kintone標準のルックアップフィールドが「キー入力欄からフォーカスが外れたとき」に検索する挙動と同様)。
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
    'app.record.create.change',
  );
  const editChangeEventTypes = buildChangeEventTypes('app.record.edit.change');

  if (createChangeEventTypes.length > 0) {
    kintone.events.on(createChangeEventTypes, async (event) => {
      await applyLookups(event.record, undefined);
      return event;
    });
  }
  if (editChangeEventTypes.length > 0) {
    kintone.events.on(editChangeEventTypes, async (event) => {
      // 編集画面ではrecordIdで自分自身を検索結果から除外する(idea.mdの「自己参照の除外」)。
      await applyLookups(event.record, event.recordId);
      return event;
    });
  }

  // レコード一覧画面のインライン編集では、キーフィールドの直接編集を禁止する
  // (idea.mdの「元フィールドは一覧からの編集を禁止」)。モバイルにはインライン編集自体が存在しない。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.lookups.forEach((lookup) => {
      const sourceField = event.record[lookup.selfKeyFieldCode];
      if (sourceField) {
        sourceField.disabled = true;
      }
    });
    return event;
  });
})(window, kintone);
