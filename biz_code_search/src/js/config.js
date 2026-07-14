(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.BizCodeSearch;

  // 出力先・法人番号・法人名フィールドはいずれも文字列(1行)のみ選択可とする
  // (config-validation.jsのisEligibleTextFieldと同じ制約、idea.md参照)。
  const TEXT_FIELD_TYPES = ['SINGLE_LINE_TEXT'];

  // kintone.app.getFormFields() は REST APIレスポンスのpropertiesと同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // 実際にkintone_doc MCPで確認済み)。
  const formFields = await kintone.app.getFormFields();
  const textFields = Object.values(formFields).filter((f) =>
    TEXT_FIELD_TYPES.includes(f.type),
  );
  const fieldInfoByCode = {};
  Object.values(formFields).forEach((f) => {
    fieldInfoByCode[f.code] = { type: f.type };
  });

  // kintone.app.getFormLayout() はREST APIレスポンスのlayoutプロパティと同様の値(配列そのもの)を
  // 解決する({layout: [...]}のようにラップされない)。GROUP内のlayoutも再帰的に走査し、ボタンを
  // 設置できるスペースフィールド(SPACER)のelementIdを集める。
  const collectSpaceElementIds = (layoutRows) => {
    const ids = [];
    (layoutRows || []).forEach((row) => {
      (row.fields || []).forEach((field) => {
        if (field.type === 'SPACER' && field.elementId) {
          ids.push(field.elementId);
        }
      });
      if (row.type === 'GROUP') {
        ids.push(...collectSpaceElementIds(row.layout));
      }
    });
    return ids;
  };
  const formLayout = await kintone.app.getFormLayout();
  const spaceFields = collectSpaceElementIds(formLayout).map((elementId) => ({
    code: elementId,
    label: elementId,
  }));

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const lookupListEl = document.getElementById('js-lookup-list');
  const lookupAddButtonEl = document.getElementById('js-lookup-add');
  const lookupRowTemplateEl = document.getElementById('js-lookup-row-template');
  const mappingRowTemplateEl = document.getElementById(
    'js-mapping-row-template',
  );
  const apiTokenInputEl = document.getElementById('js-api-token');
  const tokenStatusEl = document.getElementById('js-token-status');

  tokenStatusEl.textContent = config.apiTokenConfigured
    ? 'APIトークンは設定済みです。'
    : 'APIトークンが未設定です。上の欄に入力して保存してください。';

  const buildOptions = (selectEl, items, selectedCode, placeholder) => {
    selectEl.innerHTML = '';
    if (placeholder) {
      const placeholderOptionEl = document.createElement('option');
      placeholderOptionEl.value = '';
      placeholderOptionEl.textContent = placeholder;
      selectEl.appendChild(placeholderOptionEl);
    }
    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.code;
      optionEl.textContent = `${item.label} (${item.code})`;
      optionEl.selected = item.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const buildAttributeOptions = (selectEl, selectedKey) => {
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(placeholderOptionEl);
    NS.GBizAttributes.ATTRIBUTES.forEach((attribute) => {
      const optionEl = document.createElement('option');
      optionEl.value = attribute.key;
      optionEl.textContent = attribute.label;
      optionEl.selected = attribute.key === selectedKey;
      selectEl.appendChild(optionEl);
    });
  };

  const renderLookupList = () => {
    lookupListEl.innerHTML = '';
    config.lookups.forEach((lookup, lookupIndex) => {
      const fragment = lookupRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-lookup-row');
      const corporateNumberEl = rowEl.querySelector(
        '.js-lookup-corporate-number',
      );
      const companyNameEl = rowEl.querySelector('.js-lookup-company-name');
      const numberButtonSpaceEl = rowEl.querySelector(
        '.js-lookup-number-button-space',
      );
      const nameButtonSpaceEl = rowEl.querySelector(
        '.js-lookup-name-button-space',
      );
      const removeEl = rowEl.querySelector('.js-lookup-remove');
      const mappingListEl = rowEl.querySelector('.js-mapping-list');
      const mappingAddButtonEl = rowEl.querySelector('.js-mapping-add');

      const renderMappingList = () => {
        mappingListEl.innerHTML = '';
        lookup.fieldMappings.forEach((mapping, mappingIndex) => {
          const mappingFragment = mappingRowTemplateEl.content.cloneNode(true);
          const attributeEl = mappingFragment.querySelector(
            '.js-mapping-attribute',
          );
          const targetEl = mappingFragment.querySelector('.js-mapping-target');
          const removeMappingEl =
            mappingFragment.querySelector('.js-mapping-remove');

          buildAttributeOptions(attributeEl, mapping.attribute);
          buildOptions(
            targetEl,
            textFields,
            mapping.targetFieldCode,
            '(選択してください)',
          );

          attributeEl.addEventListener('change', () => {
            mapping.attribute = attributeEl.value;
          });
          targetEl.addEventListener('change', () => {
            mapping.targetFieldCode = targetEl.value;
          });
          removeMappingEl.addEventListener('click', () => {
            lookup.fieldMappings.splice(mappingIndex, 1);
            renderMappingList();
          });

          mappingListEl.appendChild(mappingFragment);
        });
      };

      buildOptions(
        corporateNumberEl,
        textFields,
        lookup.corporateNumberFieldCode,
        '(選択してください)',
      );
      buildOptions(
        companyNameEl,
        textFields,
        lookup.companyNameFieldCode,
        '(選択してください)',
      );
      buildOptions(
        numberButtonSpaceEl,
        spaceFields,
        lookup.numberButtonSpaceElementId,
        '(選択してください)',
      );
      buildOptions(
        nameButtonSpaceEl,
        spaceFields,
        lookup.nameButtonSpaceElementId,
        '(選択してください)',
      );
      renderMappingList();

      corporateNumberEl.addEventListener('change', () => {
        lookup.corporateNumberFieldCode = corporateNumberEl.value;
      });
      companyNameEl.addEventListener('change', () => {
        lookup.companyNameFieldCode = companyNameEl.value;
      });
      numberButtonSpaceEl.addEventListener('change', () => {
        lookup.numberButtonSpaceElementId = numberButtonSpaceEl.value;
      });
      nameButtonSpaceEl.addEventListener('change', () => {
        lookup.nameButtonSpaceElementId = nameButtonSpaceEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.lookups.splice(lookupIndex, 1);
        renderLookupList();
      });
      mappingAddButtonEl.addEventListener('click', () => {
        lookup.fieldMappings.push({ attribute: '', targetFieldCode: '' });
        renderMappingList();
      });

      lookupListEl.appendChild(fragment);
    });
  };
  renderLookupList();

  lookupAddButtonEl.addEventListener('click', () => {
    config.lookups.push({
      corporateNumberFieldCode: '',
      companyNameFieldCode: '',
      numberButtonSpaceElementId: '',
      nameButtonSpaceElementId: '',
      fieldMappings: [],
    });
    renderLookupList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  // 外部APIの実行に必要な情報をプラグインへ保存するAPI。プラグインの設定画面でのみ実行できる。
  // GBizApi.BASE_URLは詳細取得・検索のどちらのURLとも前方一致するため、この1回の呼び出しだけで
  // 両方のkintone.plugin.app.proxy()呼び出しにヘッダーが付加される(idea.md参照)。
  const saveApiToken = (token) =>
    new Promise((resolve) => {
      kintone.plugin.app.setProxyConfig(
        NS.GBizApi.BASE_URL,
        'GET',
        { 'X-hojinInfo-api-token': token },
        {},
        () => resolve(),
      );
    });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateLookups(
      config.lookups,
      fieldInfoByCode,
    );
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや属性キー)のみを
      // 表示しており、外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    const tokenInputValue = apiTokenInputEl.value.trim();

    const proceedToSave = async () => {
      if (tokenInputValue) {
        await saveApiToken(tokenInputValue);
        config.apiTokenConfigured = true;
      }
      kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + kintone.app.getId();
      });
    };
    proceedToSave();
  });
})(kintone.$PLUGIN_ID);
