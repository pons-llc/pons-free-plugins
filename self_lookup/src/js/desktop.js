(function (global, kintone) {
  'use strict';

  const NS = global.SelfLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // モーダルの候補行を「ラベル: 値」形式で表示するため、フィールドコード→ラベルを引けるようにする
  // (kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値を解決する、
  // CLAUDE.mdの既知の落とし穴参照)。kintone.events.on()の登録をブロックしないよう、ここでは
  // awaitせずPromiseを保持しておき、実際に使う(ボタンクリック時)まで待つ。
  const fieldLabelByCodePromise = kintone.app
    .getFormFields()
    .then((formFields) => {
      const map = {};
      Object.values(formFields).forEach((f) => {
        map[f.code] = f.label;
      });
      return map;
    });

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

  // 自レコードの検索キーとなるフィールド(selfKeyFieldCode)のフィールド名を赤字で強調表示する
  // (user-test.mdフィードバック反映「赤くしてほしいのはレコード作成編集画面のキーフィールド」)。
  // create.show/edit.showはPromiseに対応しているため、このハンドラーをasyncにしてよい
  // (change系イベントと異なりThenableエラーにはならない)。
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

  // 一致レコード(またはnull)のフィールド値をフィールドマッピングに従って現在のレコードへ反映し、
  // kintone.app.record.set()で画面へ書き戻す。
  const applyMatchToRecord = (matchedRecord, lookup) => {
    const fieldValues = NS.FieldMapping.buildFieldValues(
      matchedRecord,
      lookup.fieldMappings,
    );
    const current = kintone.app.record.get().record;
    Object.keys(fieldValues).forEach((targetFieldCode) => {
      const targetField = current[targetFieldCode];
      if (!targetField) {
        return;
      }
      targetField.value = fieldValues[targetFieldCode];
    });
    kintone.app.record.set({ record: current });
  };

  // モーダルに表示するフィールドは設定画面で選んだもの(modalFieldCodes)を優先し、未設定なら
  // フィールドマッピングの検索先フィールドにフォールバックする(user-test.mdフィードバック反映)。
  const resolvePreviewFieldCodes = (lookup) =>
    lookup.modalFieldCodes && lookup.modalFieldCodes.length > 0
      ? lookup.modalFieldCodes
      : (lookup.fieldMappings || []).map((mapping) => mapping.sourceFieldCode);

  // ルックアップボタンをスペースフィールドに設置し、クリック時にREST検索→モーダル確認→反映を行う
  // (user-test.mdフィードバック反映、判断記録.md参照)。kintone.events.on()のイベントハンドラーの
  // 外側(クリックイベント)なので、非同期処理・kintone.app.record.get()/set()の呼び出し制限を受けない。
  const setupLookupButton = (lookup) => {
    if (!lookup.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
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
        const record = kintone.app.record.get().record;
        const sourceField = record[lookup.selfKeyFieldCode];
        if (!sourceField || !sourceField.value) {
          alert('自レコードのキーフィールドが入力されていません。');
          return;
        }

        const excludeRecordId = kintone.app.record.getId() || undefined;
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

        // 件数にかかわらず必ずモーダルで内容を確認させてから反映する(自動での即時反映はしない、
        // user-test.mdフィードバック反映「ボタンを押すとモーダルが出ると思っていたが即時反映されていた」)。
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

  // 自レコードの検索キー・転記項目の出力先フィールドをすべて空文字列にクリアする
  // (ユーザーフィードバック反映。ボタンによる値取得系プラグインだが、取得済みの値を
  // 取り消す手段が無かったため追加した)。
  const clearAllFields = (lookup) => {
    const current = kintone.app.record.get().record;
    const selfKeyField = current[lookup.selfKeyFieldCode];
    if (selfKeyField) {
      selfKeyField.value = '';
    }
    (lookup.fieldMappings || []).forEach((mapping) => {
      const targetField = current[mapping.targetFieldCode];
      if (targetField) {
        targetField.value = '';
      }
    });
    kintone.app.record.set({ record: current });
  };

  // 「クリア」ボタン。専用のスペースフィールドは設けず、ルックアップボタンと同じスペース
  // フィールドの中に追加する(ユーザーフィードバック反映。新たにスペースフィールドを
  // 配置する手間を増やさないため)。主ボタンより一回り小さいスタイルにする。
  const setupClearButton = (lookup) => {
    if (!lookup.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
      lookup.buttonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.slkClearButtonRendered) {
      return;
    }
    spaceEl.dataset.slkClearButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal slk-button-small';
    buttonEl.textContent = 'クリア';

    buttonEl.addEventListener('click', () => {
      if (
        !confirm(
          '検索キー・転記済みの内容をすべてクリアします。よろしいですか？',
        )
      ) {
        return;
      }
      clearAllFields(lookup);
    });

    spaceEl.appendChild(buttonEl);
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    async (event) => {
      disableTargetFields(event.record);
      config.lookups.forEach((lookup) => {
        setupLookupButton(lookup);
        setupClearButton(lookup);
      });
      await highlightKeyFields();
      return event;
    },
  );

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
