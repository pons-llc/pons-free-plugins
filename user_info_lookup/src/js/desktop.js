(function (global, kintone) {
  'use strict';

  const NS = global.UserInfoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // ユーザーコードから、設定行のマッピングが必要とする情報だけを取得する。
  // - REST(User API, GET /v1/users.json): 氏名・メールアドレス等(kintone.user.*に相当するJavaScript
  //   APIが存在しないため、CLAUDE.md開発方針3によりkintone自身へのkintone.api()呼び出しのみ許可)
  // - ORG/GROUP: kintone.user.getOrganizations()/getGroups()(JavaScript API、REST不要。kintone公式
  //   Tips「アンチパターンから学ぶ ユーザーの組織情報とアイコンの取得」で推奨されている実装方法)
  // REST呼び出しの失敗は上位に伝播させる(ボタン押下時のalert、submit時のevent.errorで扱うため)。
  // ORG/GROUPの失敗は転記項目のごく一部にしか影響しないため、ログに残しつつ空扱いにして処理を継続する。
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

  // 出力先フィールドは、行ごとの「編集可能にするか」がオフの場合のみdisabledにする
  // (idea.mdの「挿入先の編集可不可を選べる」)。
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
  // kintone.app.record.get()/set()の呼び出し制限を受けない(self_lookupと同じ理由。change系イベントは
  // Promise非対応のためこの方式にした、README/idea.md参照)。
  const setupButton = (row) => {
    if (!row.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
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
        const record = kintone.app.record.get().record;
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

        const current = kintone.app.record.get().record;
        applyValuesToRecord(
          current,
          row.mappings,
          resolved.userInfo,
          resolved.organizations,
          resolved.groups,
        );
        kintone.app.record.set({ record: current });

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

  // 元フィールド・出力先フィールドをすべてクリアする(ユーザーフィードバック反映。ボタンによる
  // 値取得系プラグインだが、取得済みの値を取り消す手段が無かったため追加した)。「保存時」発動の
  // 設定行にはボタン自体が無いため対象外。ユーザー選択フィールドは値が配列形式なので空配列にする
  // (source-value.jsのextractUserCodeと対になる型判定)。
  const clearAllFields = (row) => {
    const current = kintone.app.record.get().record;
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
    kintone.app.record.set({ record: current });
  };

  // 専用のスペースフィールドは設けず、「ユーザー情報を取得して反映」ボタンと同じスペースフィールドの
  // 中に追加する(ユーザーフィードバック反映)。主ボタンより一回り小さいスタイルにする。
  const setupClearButton = (row) => {
    if (!row.buttonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
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

  // 発動条件が「保存時」の設定行を、レコード保存前に処理する。create.submit/edit.submitは
  // Promiseに対応しているため、async関数をそのまま返してよい(change系イベントとは異なる)。
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

  // レコード一覧画面のインライン編集では、元フィールドの直接編集を禁止する
  // (idea.mdの「一覧画面では元フィールドの編集を不可にする」)。
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
