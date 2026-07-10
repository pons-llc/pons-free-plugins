(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.SubtableCrossAppInsert;

  const OPERATOR_LABELS = {
    EQ: '等しい (=)',
    NEQ: '等しくない (≠)',
    GT: 'より大きい (>)',
    GTE: '以上 (>=)',
    LT: 'より小さい (<)',
    LTE: '以下 (<=)',
    CONTAINS: 'を含む',
    NOT_CONTAINS: 'を含まない',
    IS_EMPTY: '空である',
    IS_NOT_EMPTY: '空でない',
  };

  // レイアウト専用・値を持たないフィールドタイプはマッピング/条件の対象から除外する。
  const NON_VALUE_FIELD_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'SPACER',
    'LABEL',
    'HR',
  ];
  const SUCCESS_FIELD_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'DROP_DOWN',
    'RADIO_BUTTON',
  ];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const subtableSelectEl = document.querySelector('.js-subtable-select');
  const destinationAppIdEl = document.querySelector('.js-destination-app-id');
  const fetchDestinationButtonEl = document.querySelector(
    '.js-fetch-destination-fields',
  );
  const destinationFetchStatusEl = document.querySelector(
    '.js-destination-fetch-status',
  );
  const mappingBodyEl = document.getElementById('js-mapping-body');
  const mappingAddButtonEl = document.getElementById('js-mapping-add');
  const mappingRowTemplateEl = document.getElementById(
    'js-mapping-row-template',
  );
  const updateKeyColumnEl = document.querySelector('.js-update-key-column');
  const updateKeyDestEl = document.querySelector('.js-update-key-dest');
  const conditionOperatorEl = document.querySelector('.js-condition-operator');
  const conditionBodyEl = document.getElementById('js-condition-body');
  const conditionAddButtonEl = document.getElementById('js-condition-add');
  const conditionRowTemplateEl = document.getElementById(
    'js-condition-row-template',
  );
  const triggerSubmitEl = document.getElementById('js-trigger-submit');
  const triggerManualEl = document.getElementById('js-trigger-manual');
  const manualSpaceIdEl = document.querySelector('.js-manual-space-id');
  const successEnabledEl = document.getElementById('js-success-enabled');
  const successFieldEl = document.querySelector('.js-success-field');
  const successValueEl = document.querySelector('.js-success-value');

  // kintone.app.getFormFields() は REST APIのレスポンスと同様の値
  // (フィールドコードをキーにした平坦なオブジェクト。SUBTABLEはfieldsに列定義を持つ)を解決する。
  const formFields = await kintone.app.getFormFields();
  const subtableFields = Object.values(formFields).filter(
    (f) => f.type === 'SUBTABLE',
  );
  const outsideFields = Object.values(formFields).filter(
    (f) => !NON_VALUE_FIELD_TYPES.includes(f.type),
  );
  const successFieldCandidates = outsideFields.filter((f) =>
    SUCCESS_FIELD_TYPES.includes(f.type),
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 転送先アプリのフィールド一覧(取得できるまでは空)。
  let destinationFields = {};

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

  const currentSubtableColumns = () => {
    const field = subtableFields.find((f) => f.code === config.subtableCode);
    return field ? Object.values(field.fields) : [];
  };

  const destinationFieldList = () => Object.values(destinationFields);

  // --- 対象サブテーブル ---
  buildOptions(subtableSelectEl, subtableFields, config.subtableCode);
  subtableSelectEl.addEventListener('change', () => {
    config.subtableCode = subtableSelectEl.value;
    renderMappingRows();
    renderUpdateKeySelects();
  });

  // --- 転送先アプリ ---
  destinationAppIdEl.value = config.destinationAppId;

  const fetchDestinationFields = async () => {
    const appId = destinationAppIdEl.value.trim();
    if (!appId) {
      destinationFetchStatusEl.textContent =
        '転送先アプリIDを入力してください。';
      return;
    }
    destinationFetchStatusEl.textContent = '取得中...';
    try {
      const resp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET',
        {
          app: appId,
        },
      );
      destinationFields = resp.properties || {};
      destinationFetchStatusEl.textContent = `${Object.keys(destinationFields).length}件のフィールドを取得しました。`;
      renderMappingRows();
      renderUpdateKeySelects();
      buildOptions(
        successFieldEl,
        successFieldCandidates,
        config.successActionFieldCode,
      );
    } catch (err) {
      destinationFields = {};
      destinationFetchStatusEl.textContent = `取得に失敗しました: ${(err && err.message) || err}`;
    }
  };
  fetchDestinationButtonEl.addEventListener('click', () => {
    fetchDestinationFields();
  });

  // --- フィールドマッピング ---
  const renderMappingRows = () => {
    mappingBodyEl.innerHTML = '';
    config.fieldMappings.forEach((mapping, index) => {
      const fragment = mappingRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-mapping-row');
      const typeEl = rowEl.querySelector('.js-mapping-source-type');
      const sourceFieldEl = rowEl.querySelector('.js-mapping-source-field');
      const destFieldEl = rowEl.querySelector('.js-mapping-dest-field');
      const removeEl = rowEl.querySelector('.js-mapping-remove');

      typeEl.value = mapping.sourceType;

      const renderSourceFieldOptions = () => {
        const items =
          typeEl.value === 'SUBTABLE_COLUMN'
            ? currentSubtableColumns()
            : outsideFields;
        buildOptions(sourceFieldEl, items, mapping.sourceCode);
      };
      renderSourceFieldOptions();
      buildOptions(
        destFieldEl,
        destinationFieldList(),
        mapping.destinationFieldCode,
        '(先に転送先フィールドを取得してください)',
      );

      typeEl.addEventListener('change', () => {
        config.fieldMappings[index].sourceType = typeEl.value;
        config.fieldMappings[index].sourceCode = '';
        renderSourceFieldOptions();
      });
      sourceFieldEl.addEventListener('change', () => {
        config.fieldMappings[index].sourceCode = sourceFieldEl.value;
      });
      destFieldEl.addEventListener('change', () => {
        config.fieldMappings[index].destinationFieldCode = destFieldEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.fieldMappings.splice(index, 1);
        renderMappingRows();
      });

      mappingBodyEl.appendChild(rowEl);
    });
  };
  renderMappingRows();

  mappingAddButtonEl.addEventListener('click', () => {
    config.fieldMappings.push({
      sourceType: 'SUBTABLE_COLUMN',
      sourceCode: '',
      destinationFieldCode: '',
    });
    renderMappingRows();
  });

  // --- 更新キー(UPSERT) ---
  const renderUpdateKeySelects = () => {
    buildOptions(
      updateKeyColumnEl,
      currentSubtableColumns(),
      config.updateKey.subtableColumnCode,
    );
    buildOptions(
      updateKeyDestEl,
      destinationFieldList(),
      config.updateKey.destinationFieldCode,
      '(先に転送先フィールドを取得してください)',
    );
  };
  renderUpdateKeySelects();
  updateKeyColumnEl.addEventListener('change', () => {
    config.updateKey.subtableColumnCode = updateKeyColumnEl.value;
  });
  updateKeyDestEl.addEventListener('change', () => {
    config.updateKey.destinationFieldCode = updateKeyDestEl.value;
  });

  // --- 発動条件 ---
  conditionOperatorEl.value = config.condition.conditionOperator || 'AND';

  const renderConditionRows = () => {
    conditionBodyEl.innerHTML = '';
    (config.condition.children || []).forEach((clause, index) => {
      const fragment = conditionRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-condition-row');
      const fieldEl = rowEl.querySelector('.js-condition-field');
      const operatorEl = rowEl.querySelector('.js-condition-operator-select');
      const valueEl = rowEl.querySelector('.js-condition-value');
      const removeEl = rowEl.querySelector('.js-condition-remove');

      buildOptions(fieldEl, outsideFields, clause.fieldCode);

      operatorEl.innerHTML = '';
      Object.keys(OPERATOR_LABELS).forEach((op) => {
        const optionEl = document.createElement('option');
        optionEl.value = op;
        optionEl.textContent = OPERATOR_LABELS[op];
        optionEl.selected = op === clause.operator;
        operatorEl.appendChild(optionEl);
      });

      valueEl.value = clause.value || '';

      fieldEl.addEventListener('change', () => {
        config.condition.children[index].fieldCode = fieldEl.value;
      });
      operatorEl.addEventListener('change', () => {
        config.condition.children[index].operator = operatorEl.value;
      });
      valueEl.addEventListener('input', () => {
        config.condition.children[index].value = valueEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.condition.children.splice(index, 1);
        renderConditionRows();
      });

      conditionBodyEl.appendChild(rowEl);
    });
  };
  renderConditionRows();

  conditionAddButtonEl.addEventListener('click', () => {
    config.condition.children = config.condition.children || [];
    config.condition.children.push({
      type: 'clause',
      fieldCode: '',
      operator: 'EQ',
      value: '',
    });
    renderConditionRows();
  });

  // --- 実行タイミング ---
  triggerSubmitEl.checked = config.triggerOnSubmit;
  triggerManualEl.checked = config.triggerOnManual;
  manualSpaceIdEl.value = config.manualSpaceElementId;

  // --- 転送成功時アクション ---
  successEnabledEl.checked = config.successActionEnabled;
  buildOptions(
    successFieldEl,
    successFieldCandidates,
    config.successActionFieldCode,
  );
  successValueEl.value = config.successActionValue;

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    config.condition.conditionOperator = conditionOperatorEl.value;

    const hasValidMapping = config.fieldMappings.some(
      (m) => m.sourceCode && m.destinationFieldCode,
    );
    const hasValidUpdateKey =
      config.updateKey.subtableColumnCode &&
      config.updateKey.destinationFieldCode;

    if (
      !config.subtableCode ||
      !config.destinationAppId ||
      !hasValidMapping ||
      !hasValidUpdateKey
    ) {
      alert(
        '必須項目(対象サブテーブル・転送先アプリID・フィールドマッピング(1件以上)・更新キー)をすべて入力してください。',
      );
      return;
    }

    config.destinationAppId = destinationAppIdEl.value.trim();
    config.triggerOnSubmit = triggerSubmitEl.checked;
    config.triggerOnManual = triggerManualEl.checked;
    config.manualSpaceElementId = manualSpaceIdEl.value.trim();
    config.successActionEnabled = successEnabledEl.checked;
    config.successActionFieldCode = successFieldEl.value;
    config.successActionValue = successValueEl.value;

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
