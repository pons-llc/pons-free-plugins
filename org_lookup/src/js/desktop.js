(function (global, kintone) {
  'use strict';

  const NS = global.OrgLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 組織コードから組織1件を取得する(GET /v1/organizations.json、User APIと同じ系統)。
  // 組織を取得するJavaScript APIは存在しない(kintone.user.getOrganizations()はユーザーコードから
  // そのユーザーの所属組織一覧を取得するAPIであり、組織コードから組織そのものを取得する用途には
  // 使えない)ため、CLAUDE.md開発方針3によりkintone自身へのkintone.api()呼び出しのみ許可する。
  const fetchOrgByCode = async (code) => {
    const resp = await kintone.api(
      kintone.api.url('/v1/organizations.json', true),
      'GET',
      {
        codes: [code],
      },
    );
    return (resp.organizations && resp.organizations[0]) || null;
  };

  const applyValuesToRecord = (record, mappings, org, parentOrg) => {
    const fieldValues = NS.OrgAttributeMapping.buildFieldValues(
      org,
      parentOrg,
      mappings,
    );
    Object.keys(fieldValues).forEach((fieldCode) => {
      const field = record[fieldCode];
      if (field) {
        field.value = fieldValues[fieldCode];
      }
    });
  };

  // 出力先フィールドは、行ごとの「編集可能にするか」がオフの場合のみdisabledにする。
  const applyOutputEditability = (record) => {
    config.rows.forEach((row) => {
      if (row.outputEditable) {
        return;
      }
      (row.mappings || []).forEach((mapping) => {
        const field = record[mapping.destinationFieldCode];
        if (field) {
          field.disabled = true;
        }
      });
    });
  };

  // 発動条件が「ボタン押下時」の設定行用に、指定のスペースフィールドへボタンを設置する。
  // ボタンのクリックイベントはkintone.events.on()のイベントハンドラーの外側なので、非同期処理・
  // kintone.app.record.get()/set()の呼び出し制限を受けない(user_info_lookup/self_lookupと同じ理由。
  // change系イベントはPromise非対応のためこの方式にした、idea.md参照)。
  const setupButton = (row) => {
    if (!row.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
      row.buttonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.orglButtonRendered) {
      return;
    }
    spaceEl.dataset.orglButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal orgl-button';
    buttonEl.textContent = '組織情報を取得して反映';

    buttonEl.addEventListener('click', async () => {
      buttonEl.disabled = true;
      try {
        const record = kintone.app.record.get().record;
        const sourceField = record[row.sourceFieldCode];
        const code = NS.SourceValue.extractOrgCode(
          sourceField,
          sourceField ? sourceField.type : undefined,
        );
        if (!code) {
          alert('元フィールドが入力されていません。');
          return;
        }

        let resolved;
        try {
          resolved = await NS.ResolveOrgInfo.resolveOrgInfo(
            code,
            fetchOrgByCode,
          );
        } catch (err) {
          alert(`組織情報の取得に失敗しました: ${err.message}`);
          return;
        }

        const current = kintone.app.record.get().record;
        applyValuesToRecord(
          current,
          row.mappings,
          resolved.org,
          resolved.parentOrg,
        );
        kintone.app.record.set({ record: current });

        if (!resolved.org) {
          alert(
            '該当する組織が見つかりませんでした。出力先フィールドを空にしました。',
          );
        }
      } finally {
        buttonEl.disabled = false;
      }
    });

    spaceEl.appendChild(buttonEl);
  };

  // 元フィールド・出力先フィールドをすべてクリアする(ユーザーフィードバック反映。ボタンによる
  // 値取得系プラグインだが、取得済みの値を取り消す手段が無かったため追加した)。「保存時」発動の
  // 設定行にはボタン自体が無いため対象外。組織選択フィールドは値が配列形式なので空配列にする
  // (source-value.jsのextractOrgCodeと対になる型判定)。
  const clearAllFields = (row) => {
    const current = kintone.app.record.get().record;
    const sourceField = current[row.sourceFieldCode];
    if (sourceField) {
      sourceField.value = sourceField.type === 'ORGANIZATION_SELECT' ? [] : '';
    }
    (row.mappings || []).forEach((mapping) => {
      const field = current[mapping.destinationFieldCode];
      if (field) {
        field.value = '';
      }
    });
    kintone.app.record.set({ record: current });
  };

  // 専用のスペースフィールドは設けず、「組織情報を取得して反映」ボタンと同じスペースフィールドの
  // 中に追加する(ユーザーフィードバック反映)。主ボタンより一回り小さいスタイルにする。
  const setupClearButton = (row) => {
    if (!row.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
      row.buttonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.orglClearButtonRendered) {
      return;
    }
    spaceEl.dataset.orglClearButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal orgl-button-small';
    buttonEl.textContent = 'クリア';

    buttonEl.addEventListener('click', () => {
      if (
        !confirm(
          '元フィールド・転記済みの内容をすべてクリアします。よろしいですか？',
        )
      ) {
        return;
      }
      clearAllFields(row);
    });

    spaceEl.appendChild(buttonEl);
  };

  // 発動条件が「保存時」の設定行を、レコード保存前に処理する。create.submit/edit.submitは
  // Promiseに対応しているため、async関数をそのまま返してよい(change系イベントとは異なる)。
  const applySubmitRows = async (event) => {
    const submitRows = config.rows.filter((row) => row.trigger === 'SUBMIT');
    for (const row of submitRows) {
      const sourceField = event.record[row.sourceFieldCode];
      const code = NS.SourceValue.extractOrgCode(
        sourceField,
        sourceField ? sourceField.type : undefined,
      );
      try {
        const resolved = await NS.ResolveOrgInfo.resolveOrgInfo(
          code,
          fetchOrgByCode,
        );
        applyValuesToRecord(
          event.record,
          row.mappings,
          resolved.org,
          resolved.parentOrg,
        );
      } catch (err) {
        event.error = `組織情報の取得に失敗しました(${row.sourceFieldCode}): ${err.message}`;
        return event;
      }
    }
    return event;
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      applyOutputEditability(event.record);
      config.rows.forEach((row) => {
        if (row.trigger === 'BUTTON') {
          setupButton(row);
          setupClearButton(row);
        }
      });
      return event;
    },
  );

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    applySubmitRows,
  );

  // レコード一覧画面のインライン編集では、元フィールドの直接編集を禁止する。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.rows.forEach((row) => {
      const sourceField = event.record[row.sourceFieldCode];
      if (sourceField) {
        sourceField.disabled = true;
      }
    });
    return event;
  });
})(window, kintone);
