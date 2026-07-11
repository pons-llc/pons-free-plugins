(function (global, kintone) {
  'use strict';

  const NS = global.OrgLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.jsと同じロジック(kintone.api()はPC/モバイル共通)。
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

  // desktop.jsと同じくボタンクリックで取得・反映する(kintone.events.on()の外側なので、非同期処理・
  // record.get()/set()の呼び出し制限を受けない)。
  const setupButton = (row) => {
    if (!row.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.mobile.app.record.getSpaceElement(
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
        const record = kintone.mobile.app.record.get().record;
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

        const current = kintone.mobile.app.record.get().record;
        applyValuesToRecord(
          current,
          row.mappings,
          resolved.org,
          resolved.parentOrg,
        );
        kintone.mobile.app.record.set({ record: current });

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
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    (event) => {
      applyOutputEditability(event.record);
      config.rows.forEach((row) => {
        if (row.trigger === 'BUTTON') {
          setupButton(row);
        }
      });
      return event;
    },
  );

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    applySubmitRows,
  );

  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show相当の処理はない。
})(window, kintone);
