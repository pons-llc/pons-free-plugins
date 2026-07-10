// フィールドタイプごとに、kintoneクエリの書き方(演算子と関数一覧)で利用できる演算子のみを提示する。
// is/is not(空欄判定)は値を伴わない特殊な記法のため、本プラグインのMVPでは対象外にしている。
// (config.js内でしか使わないが、IIFEの外に置くことで純粋な補助関数群をトップレベルの
// クロージャ状態から切り離し、初期化処理本体(下のIIFE)を見通しよく保つ。)
const OPERATORS_BY_FIELD_TYPE = {
  SINGLE_LINE_TEXT: ['=', '!=', 'like', 'not like', 'in', 'not in'],
  LINK: ['=', '!=', 'like', 'not like', 'in', 'not in'],
  RECORD_NUMBER: ['=', '!=', 'in', 'not in'],
  MULTI_LINE_TEXT: ['like', 'not like'],
  RICH_TEXT: ['like', 'not like'],
  NUMBER: ['=', '!=', '>', '<', '>=', '<=', 'in', 'not in'],
  CALC: ['=', '!=', '>', '<', '>=', '<=', 'in', 'not in'],
  DATE: ['=', '!=', '>', '<', '>=', '<='],
  TIME: ['=', '!=', '>', '<', '>=', '<='],
  DATETIME: ['=', '!=', '>', '<', '>=', '<='],
  CREATED_TIME: ['=', '!=', '>', '<', '>=', '<='],
  UPDATED_TIME: ['=', '!=', '>', '<', '>=', '<='],
  DROP_DOWN: ['in', 'not in'],
  RADIO_BUTTON: ['in', 'not in'],
  CHECK_BOX: ['in', 'not in'],
  MULTI_SELECT: ['in', 'not in'],
  USER_SELECT: ['in', 'not in'],
  ORGANIZATION_SELECT: ['in', 'not in'],
  GROUP_SELECT: ['in', 'not in'],
  CREATOR: ['in', 'not in'],
  MODIFIER: ['in', 'not in'],
};
const DEFAULT_OPERATORS = OPERATORS_BY_FIELD_TYPE.SINGLE_LINE_TEXT;
const SET_OPERATORS = ['in', 'not in'];

// SUBTABLEフィールドは取得元・検索条件のフィールドとして選べない(サブテーブル内の値は
// in/not inでの特殊な指定が必要になり、本プラグインのMVPでは対象外にしているため)。
const flattenSelectableFields = (properties) => {
  const result = {};
  Object.keys(properties || {}).forEach((code) => {
    const field = properties[code];
    if (field.type === 'SUBTABLE') {
      return;
    }
    result[code] = { code: field.code, label: field.label, type: field.type };
  });
  return result;
};

// 選択肢の描画。selectEl.innerHTMLへの代入は「空にするだけ」で外部入力を差し込まないため安全
// (実際の選択肢はcreateElement + textContentで追加する。fiscal_year_numberingと同じ方針)。
const buildOptions = (selectEl, fields, selectedCode, placeholderLabel) => {
  selectEl.innerHTML = '';
  if (placeholderLabel) {
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = placeholderLabel;
    selectEl.appendChild(placeholderOptionEl);
  }
  fields.forEach((field) => {
    const optionEl = document.createElement('option');
    optionEl.value = field.code;
    optionEl.textContent = `${field.label} (${field.code}) [${field.type}]`;
    optionEl.selected = field.code === selectedCode;
    selectEl.appendChild(optionEl);
  });
};

const populateOperatorSelect = (selectEl, operators, selectedOperator) => {
  selectEl.innerHTML = '';
  operators.forEach((operator) => {
    const optionEl = document.createElement('option');
    optionEl.value = operator;
    optionEl.textContent = operator;
    optionEl.selected = operator === selectedOperator;
    selectEl.appendChild(optionEl);
  });
};

const toggleValueInputs = (valueSource, constantEl, fieldEl) => {
  const isRecordField = valueSource === 'RECORD_FIELD';
  constantEl.style.display = isRecordField ? 'none' : '';
  fieldEl.style.display = isRecordField ? '' : 'none';
};

// in/not inのときはカンマ区切り入力を配列に変換する(QueryBuilder.formatValueの仕様に合わせる)。
const parseConstantValue = (raw, operator) => {
  if (SET_OPERATORS.includes(operator)) {
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return raw;
};

const stringifyConstantValue = (value) =>
  Array.isArray(value) ? value.join(', ') : value || '';

(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.RecordsToSubtable;

  // DOM要素の参照を1つのオブジェクトにまとめている(初期化処理本体のstatement数を抑えるため)。
  const dom = {
    form: document.querySelector('.js-submit-settings'),
    cancelButton: document.querySelector('.js-cancel-button'),
    sourceAppId: document.querySelector('.js-source-app-id'),
    sourceAppFetch: document.querySelector('.js-source-app-fetch'),
    sourceAppStatus: document.querySelector('.js-source-app-status'),
    conditionBody: document.getElementById('js-condition-body'),
    conditionAdd: document.getElementById('js-condition-add'),
    conditionRowTemplate: document.getElementById('js-condition-row-template'),
    subtableField: document.querySelector('.js-subtable-field'),
    mappingBody: document.getElementById('js-mapping-body'),
    mappingAdd: document.getElementById('js-mapping-add'),
    mappingRowTemplate: document.getElementById('js-mapping-row-template'),
    maxRecords: document.querySelector('.js-max-records'),
    buttonLabel: document.querySelector('.js-button-label'),
  };

  const state = {
    sourceFields: {}, // fieldCode -> {code,label,type}(取得元アプリのフィールド)
    ownFields: {}, // fieldCode -> {code,label,type}(このアプリのフィールド。自レコード参照用)
    subtableColumns: {}, // fieldCode -> {code,label,type}(選択中のサブテーブルの列)
  };

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const renderCompatMessage = (compatEl, sourceType, targetType) => {
    compatEl.textContent = '';
    compatEl.classList.remove('rtsi-note-error');
    if (!sourceType || !targetType) {
      compatEl.textContent = '取得元・サブテーブル列の両方を選択してください';
      return;
    }
    const result = NS.TypeCompatibility.check(sourceType, targetType);
    if (!result.compatible) {
      compatEl.textContent = result.reason;
      compatEl.classList.add('rtsi-note-error');
      return;
    }
    compatEl.textContent = result.warning || '互換性OK';
  };

  const renderConditions = () => {
    dom.conditionBody.innerHTML = '';
    const sourceFieldList = Object.values(state.sourceFields);
    const ownFieldList = Object.values(state.ownFields);

    config.conditions.forEach((condition, index) => {
      const fragment = dom.conditionRowTemplate.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-condition-row');
      const fieldEl = rowEl.querySelector('.js-cond-field');
      const operatorEl = rowEl.querySelector('.js-cond-operator');
      const valueSourceEls = rowEl.querySelectorAll('.js-cond-value-source');
      const valueConstantEl = rowEl.querySelector('.js-cond-value-constant');
      const valueFieldEl = rowEl.querySelector('.js-cond-value-field');
      const removeEl = rowEl.querySelector('.js-condition-remove');

      buildOptions(fieldEl, sourceFieldList, condition.fieldCode, '-- 選択 --');
      const operators =
        OPERATORS_BY_FIELD_TYPE[condition.fieldType] || DEFAULT_OPERATORS;
      populateOperatorSelect(operatorEl, operators, condition.operator);
      buildOptions(
        valueFieldEl,
        ownFieldList,
        condition.sourceFieldCode,
        '-- 選択 --',
      );

      const valueSource = condition.valueSource || 'CONSTANT';
      valueSourceEls.forEach((el) => {
        el.checked = el.value === valueSource;
      });
      valueConstantEl.value =
        valueSource === 'RECORD_FIELD'
          ? ''
          : stringifyConstantValue(condition.value);
      toggleValueInputs(valueSource, valueConstantEl, valueFieldEl);

      fieldEl.addEventListener('change', () => {
        config.conditions[index].fieldCode = fieldEl.value;
        const newType = (state.sourceFields[fieldEl.value] || {}).type;
        config.conditions[index].fieldType = newType;
        const newOperators =
          OPERATORS_BY_FIELD_TYPE[newType] || DEFAULT_OPERATORS;
        populateOperatorSelect(operatorEl, newOperators, newOperators[0]);
        config.conditions[index].operator = operatorEl.value;
      });
      operatorEl.addEventListener('change', () => {
        config.conditions[index].operator = operatorEl.value;
        config.conditions[index].value = parseConstantValue(
          valueConstantEl.value,
          operatorEl.value,
        );
      });
      valueSourceEls.forEach((el) => {
        el.addEventListener('change', () => {
          if (!el.checked) {
            return;
          }
          config.conditions[index].valueSource = el.value;
          toggleValueInputs(el.value, valueConstantEl, valueFieldEl);
        });
      });
      valueConstantEl.addEventListener('input', () => {
        config.conditions[index].value = parseConstantValue(
          valueConstantEl.value,
          operatorEl.value,
        );
      });
      valueFieldEl.addEventListener('change', () => {
        config.conditions[index].sourceFieldCode = valueFieldEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.conditions.splice(index, 1);
        renderConditions();
      });

      dom.conditionBody.appendChild(rowEl);
    });
  };

  const renderMappings = () => {
    dom.mappingBody.innerHTML = '';
    const sourceFieldList = Object.values(state.sourceFields);
    const targetFieldList = Object.values(state.subtableColumns);

    config.fieldMappings.forEach((mapping, index) => {
      const fragment = dom.mappingRowTemplate.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-mapping-row');
      const sourceEl = rowEl.querySelector('.js-map-source');
      const targetEl = rowEl.querySelector('.js-map-target');
      const compatEl = rowEl.querySelector('.js-map-compat');
      const removeEl = rowEl.querySelector('.js-mapping-remove');

      buildOptions(
        sourceEl,
        sourceFieldList,
        mapping.sourceFieldCode,
        '-- 選択 --',
      );
      buildOptions(
        targetEl,
        targetFieldList,
        mapping.targetFieldCode,
        '-- 選択 --',
      );

      const updateCompat = () => {
        const sourceType = (state.sourceFields[mapping.sourceFieldCode] || {})
          .type;
        const targetType = (
          state.subtableColumns[mapping.targetFieldCode] || {}
        ).type;
        renderCompatMessage(compatEl, sourceType, targetType);
      };
      updateCompat();

      sourceEl.addEventListener('change', () => {
        config.fieldMappings[index].sourceFieldCode = sourceEl.value;
        config.fieldMappings[index].sourceFieldType = (
          state.sourceFields[sourceEl.value] || {}
        ).type;
        updateCompat();
      });
      targetEl.addEventListener('change', () => {
        config.fieldMappings[index].targetFieldCode = targetEl.value;
        config.fieldMappings[index].targetFieldType = (
          state.subtableColumns[targetEl.value] || {}
        ).type;
        updateCompat();
      });
      removeEl.addEventListener('click', () => {
        config.fieldMappings.splice(index, 1);
        renderMappings();
      });

      dom.mappingBody.appendChild(rowEl);
    });
  };

  // --- 取得元アプリ ---
  const fetchSourceFields = async (appId) => {
    const resp = await kintone.api(
      kintone.api.url('/k/v1/app/form/fields.json', true),
      'GET',
      {
        app: appId,
      },
    );
    return flattenSelectableFields(resp.properties);
  };

  const loadSourceFields = async (appId) => {
    if (!appId) {
      state.sourceFields = {};
      dom.sourceAppStatus.textContent = '';
      renderConditions();
      renderMappings();
      return;
    }
    try {
      state.sourceFields = await fetchSourceFields(appId);
      dom.sourceAppStatus.textContent = `${Object.keys(state.sourceFields).length}件のフィールドを読み込みました。`;
    } catch {
      state.sourceFields = {};
      dom.sourceAppStatus.textContent =
        'フィールドの読み込みに失敗しました。アプリIDやアクセス権を確認してください。';
    }
    renderConditions();
    renderMappings();
  };

  dom.sourceAppId.value = config.sourceAppId;
  dom.sourceAppFetch.addEventListener('click', async () => {
    config.sourceAppId = dom.sourceAppId.value.trim();
    dom.sourceAppStatus.textContent = '読み込み中...';
    await loadSourceFields(config.sourceAppId);
  });

  // --- このアプリのフィールド(自レコード参照・サブテーブル選択用) ---
  // kintone.app.getFormFields()は同一アプリのフィールド取得なので、JavaScript APIを優先する
  // (CLAUDE.md開発方針3)。取得元アプリ(別アプリ)はJS APIが存在しないためREST APIを使う。
  const ownFormFields = await kintone.app.getFormFields();
  state.ownFields = flattenSelectableFields(ownFormFields);
  const subtableProperties = Object.values(ownFormFields).filter(
    (f) => f.type === 'SUBTABLE',
  );
  const subtableOptionList = subtableProperties.map((f) => ({
    code: f.code,
    label: f.label,
    type: f.type,
  }));

  buildOptions(
    dom.subtableField,
    subtableOptionList,
    config.subtableFieldCode,
    '-- 選択 --',
  );

  const updateSubtableColumns = () => {
    const selected = subtableProperties.find(
      (f) => f.code === dom.subtableField.value,
    );
    state.subtableColumns = selected
      ? flattenSelectableFields(selected.fields)
      : {};
  };
  updateSubtableColumns();

  dom.subtableField.addEventListener('change', () => {
    config.subtableFieldCode = dom.subtableField.value;
    updateSubtableColumns();
    renderMappings();
  });

  // --- 検索条件・マッピングの追加ボタン ---
  dom.conditionAdd.addEventListener('click', () => {
    const firstField = Object.values(state.sourceFields)[0];
    const fieldType = firstField ? firstField.type : 'SINGLE_LINE_TEXT';
    config.conditions.push({
      fieldCode: firstField ? firstField.code : '',
      fieldType,
      operator: (OPERATORS_BY_FIELD_TYPE[fieldType] || DEFAULT_OPERATORS)[0],
      valueSource: 'CONSTANT',
      value: '',
      sourceFieldCode: '',
    });
    renderConditions();
  });

  dom.mappingAdd.addEventListener('click', () => {
    config.fieldMappings.push({
      sourceFieldCode: '',
      sourceFieldType: '',
      targetFieldCode: '',
      targetFieldType: '',
    });
    renderMappings();
  });

  // --- 実行設定 ---
  dom.maxRecords.value = config.maxRecords;
  dom.buttonLabel.value = config.buttonLabel;

  // --- 初期表示 ---
  if (config.sourceAppId) {
    dom.sourceAppStatus.textContent = '読み込み中...';
    await loadSourceFields(config.sourceAppId);
  } else {
    renderConditions();
    renderMappings();
  }

  dom.cancelButton.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (
      !config.sourceAppId ||
      !config.subtableFieldCode ||
      config.fieldMappings.length === 0
    ) {
      alert(
        '必須項目(取得元アプリID・書き込み先サブテーブル・フィールドマッピング1件以上)を入力してください。',
      );
      return;
    }

    const incompatible = config.fieldMappings.find((mapping) => {
      if (!mapping.sourceFieldCode || !mapping.targetFieldCode) {
        return true;
      }
      const result = NS.TypeCompatibility.check(
        mapping.sourceFieldType,
        mapping.targetFieldType,
      );
      return !result.compatible;
    });
    if (incompatible) {
      alert(
        '互換性のないフィールドマッピングがあります。マッピングの内容を見直してください。',
      );
      return;
    }

    const maxRecords = Number(dom.maxRecords.value);
    config.maxRecords =
      Number.isFinite(maxRecords) && maxRecords > 0
        ? maxRecords
        : NS.ConfigStore.DEFAULTS.maxRecords;
    config.buttonLabel =
      dom.buttonLabel.value || NS.ConfigStore.DEFAULTS.buttonLabel;

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
