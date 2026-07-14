(function (global, kintone) {
  'use strict';

  const NS = global.BizCodeSearch;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 法人名検索で取得する候補数の上限。gBizINFO側はpage/limitで最大5000件まで指定できるが、
  // よくある社名で大量ヒットするのを避けるため固定値にする(idea.mdの割り切り、self_lookupの
  // 500件上限と同種)。
  const SEARCH_LIMIT = 50;

  // 転記項目の出力先フィールドは常にプラグインが上書きする値なので、追加・編集画面では直接
  // 入力できないようにする(idea.mdの「出力先フィールドの編集禁止」)。
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

  // 法人情報(またはnull)のフィールド値を転記項目に従って現在のレコードへ反映し、
  // kintone.app.record.set()で画面へ書き戻す。
  const applyHojinInfoToRecord = (hojinInfo, lookup) => {
    const fieldValues = NS.GBizFieldMapping.buildFieldValues(
      hojinInfo,
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

  const parseProxyBody = (body) => {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  };

  // kintone.plugin.app.proxy()。successCallback/failureCallbackを省略するとPromiseが返り、
  // 成功時は[body, status, headers]、失敗時はレスポンスボディ(文字列)で棄却される
  // (kintone_doc MCPで確認済み)。
  const callGBiz = (url) =>
    kintone.plugin.app.proxy(PLUGIN_ID, url, 'GET', {}, {});

  // 法人番号→法人情報取得(ボタン1・ボタン2の候補選択後の両方から呼ばれる共通処理)。
  const fetchAndApplyDetail = async (corporateNumber, lookup) => {
    const url = NS.GBizApi.buildDetailUrl(corporateNumber);
    let body;
    try {
      [body] = await callGBiz(url);
    } catch (err) {
      alert(`gBizINFOへのリクエストに失敗しました。\n${err}`);
      return;
    }
    const data = parseProxyBody(body);
    const hojinInfos = data['hojin-infos'] || [];
    if (hojinInfos.length === 0) {
      applyHojinInfoToRecord(null, lookup);
      alert('該当する法人情報が見つかりませんでした。');
      return;
    }
    applyHojinInfoToRecord(hojinInfos[0], lookup);
  };

  const setCorporateNumberFieldValue = (lookup, value) => {
    const current = kintone.app.record.get().record;
    const field = current[lookup.corporateNumberFieldCode];
    if (!field) {
      return;
    }
    field.value = value;
    kintone.app.record.set({ record: current });
  };

  // 「クリア」ボタン。法人番号・法人名フィールドと転記項目の出力先フィールドをすべて空文字列に
  // 戻す(ユーザー確認からの「全部クリア」フィードバック反映。ボタンによる値取得系プラグインだが
  // 取得済みの値を取り消す手段が無かったため追加した)。
  const clearAllFields = (lookup) => {
    const current = kintone.app.record.get().record;
    const corporateNumberField = current[lookup.corporateNumberFieldCode];
    if (corporateNumberField) {
      corporateNumberField.value = '';
    }
    const companyNameField = current[lookup.companyNameFieldCode];
    if (companyNameField) {
      companyNameField.value = '';
    }
    (lookup.fieldMappings || []).forEach((mapping) => {
      const targetField = current[mapping.targetFieldCode];
      if (targetField) {
        targetField.value = '';
      }
    });
    kintone.app.record.set({ record: current });
  };

  const setupNumberButton = (lookup) => {
    if (!lookup.numberButtonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
      lookup.numberButtonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.bcsNumberButtonRendered) {
      return;
    }
    spaceEl.dataset.bcsNumberButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal';
    buttonEl.textContent = '法人番号から取得';

    buttonEl.addEventListener('click', async () => {
      buttonEl.disabled = true;
      try {
        const record = kintone.app.record.get().record;
        const field = record[lookup.corporateNumberFieldCode];
        const corporateNumber = field ? field.value : '';
        if (!NS.CorporateNumber.isValidCorporateNumber(corporateNumber)) {
          alert('法人番号は13桁の数字で入力してください。');
          return;
        }
        await fetchAndApplyDetail(corporateNumber, lookup);
      } finally {
        buttonEl.disabled = false;
      }
    });

    spaceEl.appendChild(buttonEl);
  };

  const setupNameButton = (lookup) => {
    if (!lookup.nameButtonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.app.record.getSpaceElement(
      lookup.nameButtonSpaceElementId,
    );
    if (!spaceEl || spaceEl.dataset.bcsNameButtonRendered) {
      return;
    }
    spaceEl.dataset.bcsNameButtonRendered = '1';

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal';
    buttonEl.textContent = '法人名から検索';

    buttonEl.addEventListener('click', async () => {
      buttonEl.disabled = true;
      try {
        const record = kintone.app.record.get().record;
        const field = record[lookup.companyNameFieldCode];
        // kintone.app.record.set()で値を空文字列にクリアすると、field.valueキー自体が
        // 無くなりundefinedになることがある(クリアボタンで実際に確認済みの挙動)ため、
        // field.valueの存在も確認してから.trim()する。
        const companyName = field && field.value ? field.value.trim() : '';
        if (!companyName) {
          alert('法人名が入力されていません。');
          return;
        }

        const url = NS.GBizApi.buildSearchUrl(companyName, SEARCH_LIMIT);
        let body;
        try {
          [body] = await callGBiz(url);
        } catch (err) {
          alert(`gBizINFOへのリクエストに失敗しました。\n${err}`);
          return;
        }
        const data = parseProxyBody(body);
        const hojinInfos = data['hojin-infos'] || [];

        if (hojinInfos.length === 0) {
          setCorporateNumberFieldValue(lookup, '');
          applyHojinInfoToRecord(null, lookup);
          alert('一致する法人が見つかりませんでした。');
          return;
        }

        NS.ResultModal.showSearchResultModal({
          items: hojinInfos,
          onSelect: async (selectedItem) => {
            setCorporateNumberFieldValue(lookup, selectedItem.corporate_number);
            await fetchAndApplyDetail(selectedItem.corporate_number, lookup);
          },
        });
      } finally {
        buttonEl.disabled = false;
      }
    });

    spaceEl.appendChild(buttonEl);
  };

  const setupClearButton = (lookup) => {
    // 専用のスペースフィールドは設けず、「法人番号から取得」「法人名から検索」ボタンと同じ
    // スペースフィールドの中にそれぞれ追加する(ユーザーフィードバック反映。新たにスペース
    // フィールドを配置する手間を増やさないため)。
    [
      lookup.numberButtonSpaceElementId,
      lookup.nameButtonSpaceElementId,
    ].forEach((spaceElementId) => {
      if (!spaceElementId) {
        return;
      }
      const spaceEl = kintone.app.record.getSpaceElement(spaceElementId);
      if (!spaceEl || spaceEl.dataset.bcsClearButtonRendered) {
        return;
      }
      spaceEl.dataset.bcsClearButtonRendered = '1';

      const buttonEl = document.createElement('button');
      buttonEl.type = 'button';
      buttonEl.className = 'kintoneplugin-button-normal bcs-button-small';
      buttonEl.textContent = 'クリア';

      buttonEl.addEventListener('click', () => {
        if (
          !confirm(
            '法人番号・法人名・転記済みの内容をすべてクリアします。よろしいですか？',
          )
        ) {
          return;
        }
        clearAllFields(lookup);
      });

      spaceEl.appendChild(buttonEl);
    });
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      config.lookups.forEach((lookup) => {
        setupNumberButton(lookup);
        setupNameButton(lookup);
        setupClearButton(lookup);
      });
      return event;
    },
  );

  // レコード一覧画面のインライン編集では、転記項目の出力先フィールドの直接編集を禁止する
  // (self_lookupと同じ方針)。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.lookups.forEach((lookup) => {
      (lookup.fieldMappings || []).forEach((mapping) => {
        const targetField = event.record[mapping.targetFieldCode];
        if (targetField) {
          targetField.disabled = true;
        }
      });
    });
    return event;
  });
})(window, kintone);
