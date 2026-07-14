(function (global, kintone) {
  'use strict';

  const NS = global.UserInfoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.jsと同じロジック(kintone.api()/kintone.user.getOrganizations()/getGroups()はPC/モバイル共通)。
  const resolveUserInfo = async (code, mappings) => {
    if (!code) {
      return { userInfo: null, organizations: null, groups: null };
    }

    const needsOrg = mappings.some((m) => m.attribute === 'organizations');
    const needsGroup = mappings.some((m) => m.attribute === 'groups');

    // 転記項目がORG/GROUPのみの設定行でもREST呼び出しは常に行う。kintone.user.getOrganizations()/
    // getGroups()は存在しないユーザーコードでもエラーにならず空配列を返すため、「該当ユーザーなし」を
    // 判定できるのはUser API(REST)の応答だけ(userInfoがnullかどうか)。ここを転記項目次第でスキップすると
    // ユーザーが実在してもuserInfoが常にnullのままになり、下位の「見つかりませんでした」判定が誤発火する
    // (user-test.mdフィードバック反映)。
    const restPromise = kintone
      .api(kintone.api.url('/v1/users.json', true), 'GET', {
        codes: [code],
      })
      .then((resp) => (resp.users && resp.users[0]) || null);
    const orgPromise = needsOrg
      ? kintone.user.getOrganizations(code).catch((err) => {
          console.error('kintone.user.getOrganizations()に失敗しました。', err);
          return null;
        })
      : Promise.resolve(null);
    const groupPromise = needsGroup
      ? kintone.user.getGroups(code).catch((err) => {
          console.error('kintone.user.getGroups()に失敗しました。', err);
          return null;
        })
      : Promise.resolve(null);

    const [userInfo, organizations, groups] = await Promise.all([
      restPromise,
      orgPromise,
      groupPromise,
    ]);
    return { userInfo, organizations, groups };
  };

  const applyValuesToRecord = (
    record,
    mappings,
    userInfo,
    organizations,
    groups,
  ) => {
    const fieldValues = NS.UserAttributeMapping.buildFieldValues(
      userInfo,
      organizations,
      groups,
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
    if (!spaceEl || spaceEl.dataset.uilButtonRendered) {
      return;
    }
    spaceEl.dataset.uilButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal uil-button';
    buttonEl.textContent = 'ユーザー情報を取得して反映';

    buttonEl.addEventListener('click', async () => {
      buttonEl.disabled = true;
      try {
        const record = kintone.mobile.app.record.get().record;
        const sourceField = record[row.sourceFieldCode];
        const code = NS.SourceValue.extractUserCode(
          sourceField,
          sourceField ? sourceField.type : undefined,
        );
        if (!code) {
          alert('元フィールドが入力されていません。');
          return;
        }

        let resolved;
        try {
          resolved = await resolveUserInfo(code, row.mappings);
        } catch (err) {
          alert(`ユーザー情報の取得に失敗しました: ${err.message}`);
          return;
        }

        const current = kintone.mobile.app.record.get().record;
        applyValuesToRecord(
          current,
          row.mappings,
          resolved.userInfo,
          resolved.organizations,
          resolved.groups,
        );
        kintone.mobile.app.record.set({ record: current });

        if (!resolved.userInfo) {
          alert(
            '該当するユーザーが見つかりませんでした。出力先フィールドを空にしました。',
          );
        }
      } finally {
        buttonEl.disabled = false;
      }
    });

    spaceEl.appendChild(buttonEl);
  };

  // desktop.jsと同じ「クリア」ボタン処理。
  const clearAllFields = (row) => {
    const current = kintone.mobile.app.record.get().record;
    const sourceField = current[row.sourceFieldCode];
    if (sourceField) {
      sourceField.value = sourceField.type === 'USER_SELECT' ? [] : '';
    }
    (row.mappings || []).forEach((mapping) => {
      const field = current[mapping.destinationFieldCode];
      if (field) {
        field.value = '';
      }
    });
    kintone.mobile.app.record.set({ record: current });
  };

  // desktop.jsと同じく、専用のスペースフィールドは設けずボタンと同じスペースフィールドの
  // 中に追加する。
  const setupClearButton = (row) => {
    if (!row.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.mobile.app.record.getSpaceElement(
      row.buttonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.uilClearButtonRendered) {
      return;
    }
    spaceEl.dataset.uilClearButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal uil-button-small';
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

  const applySubmitRows = async (event) => {
    const submitRows = config.rows.filter((row) => row.trigger === 'SUBMIT');
    for (const row of submitRows) {
      const sourceField = event.record[row.sourceFieldCode];
      const code = NS.SourceValue.extractUserCode(
        sourceField,
        sourceField ? sourceField.type : undefined,
      );
      try {
        const resolved = await resolveUserInfo(code, row.mappings);
        applyValuesToRecord(
          event.record,
          row.mappings,
          resolved.userInfo,
          resolved.organizations,
          resolved.groups,
        );
      } catch (err) {
        event.error = `ユーザー情報の取得に失敗しました(${row.sourceFieldCode}): ${err.message}`;
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
          setupClearButton(row);
        }
      });
      return event;
    },
  );

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    applySubmitRows,
  );

  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show相当の処理はない
  // (self_lookupと同じ)。
})(window, kintone);
