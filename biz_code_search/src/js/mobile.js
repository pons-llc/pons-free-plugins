(function (global, kintone) {
  'use strict';

  const NS = global.BizCodeSearch;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const SEARCH_LIMIT = 50;

  // desktop.jsと同じロジック(record オブジェクトの形式はPC・モバイルで共通)。
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

  const applyHojinInfoToRecord = (hojinInfo, lookup) => {
    const fieldValues = NS.GBizFieldMapping.buildFieldValues(
      hojinInfo,
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

  const parseProxyBody = (body) => {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  };

  const callGBiz = (url) =>
    kintone.plugin.app.proxy(PLUGIN_ID, url, 'GET', {}, {});

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
    const current = kintone.mobile.app.record.get().record;
    const field = current[lookup.corporateNumberFieldCode];
    if (!field) {
      return;
    }
    field.value = value;
    kintone.mobile.app.record.set({ record: current });
  };

  const setupNumberButton = (lookup) => {
    if (!lookup.numberButtonSpaceElementId) {
      return;
    }
    const spaceEl = kintone.mobile.app.record.getSpaceElement(
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
        const record = kintone.mobile.app.record.get().record;
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
    const spaceEl = kintone.mobile.app.record.getSpaceElement(
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
        const record = kintone.mobile.app.record.get().record;
        const field = record[lookup.companyNameFieldCode];
        const companyName = field ? field.value.trim() : '';
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

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      config.lookups.forEach((lookup) => {
        setupNumberButton(lookup);
        setupNameButton(lookup);
      });
      return event;
    },
  );
})(window, kintone);
