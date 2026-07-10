(function (global, kintone) {
  'use strict';

  const NS = global.SelfLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.jsと同じ理由でawaitせずPromiseを保持し、実際に使う(ボタンクリック時)まで待つ
  // (kintone.events.on()の登録をブロックしないため)。
  const fieldLabelByCodePromise = kintone.app
    .getFormFields()
    .then((formFields) => {
      const map = {};
      Object.values(formFields).forEach((f) => {
        map[f.code] = f.label;
      });
      return map;
    });

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

  // desktop.jsと同じ(user-test.mdフィードバック反映)。setFieldStyleはPC/モバイル共通の
  // kintone.app.record.setFieldStyleを使う(モバイル専用APIはない)。
  const highlightKeyFields = () => {
    const style = { label: { color: '#e74c3c', fontWeight: 'bold' } };
    return Promise.all(
      config.lookups.map((lookup) =>
        lookup.selfKeyFieldCode
          ? kintone.app.record
              .setFieldStyle(lookup.selfKeyFieldCode, style)
              .catch(() => {})
          : Promise.resolve(),
      ),
    );
  };

  const applyMatchToRecord = (matchedRecord, lookup) => {
    const fieldValues = NS.FieldMapping.buildFieldValues(
      matchedRecord,
      lookup.fieldMappings,
    );
    const current = kintone.mobile.app.record.get().record;
    Object.keys(fieldValues).forEach((targetFieldCode) => {
      const targetField = current[targetFieldCode];
      if (!targetField) {
        return;
      }
      targetField.value = fieldValues[targetFieldCode];
    });
    kintone.mobile.app.record.set({ record: current });
  };

  const resolvePreviewFieldCodes = (lookup) =>
    lookup.modalFieldCodes && lookup.modalFieldCodes.length > 0
      ? lookup.modalFieldCodes
      : (lookup.fieldMappings || []).map((mapping) => mapping.sourceFieldCode);

  // desktop.jsと同じくボタンクリックで検索・モーダル確認・反映する(kintone.events.on()の外側なので
  // 非同期処理・record.get()/set()の呼び出し制限を受けない)。
  const setupLookupButton = (lookup) => {
    if (!lookup.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.mobile.app.record.getSpaceElement(
      lookup.buttonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.slkButtonRendered) {
      return;
    }
    spaceEl.dataset.slkButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal';
    buttonEl.textContent = '検索して反映';

    buttonEl.addEventListener('click', async () => {
      buttonEl.disabled = true;
      try {
        const record = kintone.mobile.app.record.get().record;
        const sourceField = record[lookup.selfKeyFieldCode];
        if (!sourceField || !sourceField.value) {
          alert('自レコードのキーフィールドが入力されていません。');
          return;
        }

        const excludeRecordId = kintone.mobile.app.record.getId() || undefined;
        const query = NS.QueryBuilder.buildQuery(
          lookup,
          record,
          excludeRecordId,
        );

        let candidateRecords = [];
        try {
          const response = await kintone.api(
            kintone.api.url('/k/v1/records.json', true),
            'GET',
            { app: kintone.app.getId(), query },
          );
          candidateRecords = response.records || [];
        } catch (err) {
          alert(`検索に失敗しました: ${err.message}`);
          return;
        }

        const matchedRecords = NS.ClientFilter.filterMatchedRecords(
          candidateRecords,
          lookup,
          record,
        );

        if (matchedRecords.length === 0) {
          applyMatchToRecord(null, lookup);
          alert('一致するレコードが見つかりませんでした。');
          return;
        }

        const fieldLabelByCode = await fieldLabelByCodePromise;
        NS.LookupUI.showResultModal({
          records: matchedRecords,
          previewFieldCodes: resolvePreviewFieldCodes(lookup),
          fieldLabelByCode,
          onSelect: (selectedRecord) =>
            applyMatchToRecord(selectedRecord, lookup),
        });
      } finally {
        buttonEl.disabled = false;
      }
    });

    spaceEl.appendChild(buttonEl);
  };

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    async (event) => {
      disableTargetFields(event.record);
      config.lookups.forEach((lookup) => setupLookupButton(lookup));
      await highlightKeyFields();
      return event;
    },
  );
})(window, kintone);
