(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.RadarChartView;
  const ConfigStore = NS.ConfigStore;
  const ConfigValidation = NS.ConfigValidation;
  const MAX_AXIS_SLOTS = ConfigValidation.MAX_AXIS_FIELDS;

  const els = {
    groupingRecordRadio: document.querySelector('.js-grouping-record'),
    groupingFieldRadio: document.querySelector('.js-grouping-field'),
    groupingFieldRow: document.querySelector('.js-grouping-field-row'),
    groupingFieldSelect: document.querySelector('.js-grouping-field-select'),
    axisList: document.querySelector('.js-axis-list'),
    axisItemTemplate: document.getElementById('js-axis-item-template'),
    checkboxItemTemplate: document.getElementById('js-checkbox-item-template'),
    title: document.querySelector('.js-title'),
    scaleDivisions: document.querySelector('.js-scale-divisions'),
    badgeFields: document.querySelector('.js-badge-fields'),
    maxRecords: document.querySelector('.js-max-records'),
    form: document.querySelector('.js-submit-settings'),
    cancelButton: document.querySelector('.js-cancel-button'),
  };

  // kintone.app.getFormFields() はJavaScript API。戻り値そのものがREST版propertiesと
  // 同等の値で、プロパティ名でラップされない(CLAUDE.md記載の既知の落とし穴、確認済み)。
  const formFields = await kintone.app.getFormFields();

  const fieldsOfType = (types) =>
    Object.values(formFields).filter((field) => types.includes(field.type));

  const numberFields = fieldsOfType([ConfigValidation.AXIS_FIELD_TYPE]);
  const groupingFields = fieldsOfType(ConfigValidation.GROUPING_FIELD_TYPES);
  const badgeCandidateFields = Object.values(formFields).filter(
    (field) => field.type !== 'SUBTABLE',
  );

  const config = ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const fieldLabel = (field) => `${field.label} (${field.code})`;

  const buildFieldOptions = (selectEl, fields, selectedCode, emptyLabel) => {
    selectEl.textContent = '';
    const emptyOptionEl = document.createElement('option');
    emptyOptionEl.value = '';
    emptyOptionEl.textContent = emptyLabel;
    selectEl.appendChild(emptyOptionEl);
    fields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = fieldLabel(field);
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const buildCheckboxList = (containerEl, fields, selectedCodes, onChange) => {
    containerEl.textContent = '';
    fields.forEach((field) => {
      const fragment = els.checkboxItemTemplate.content.cloneNode(true);
      const inputEl = fragment.querySelector('.js-checkbox-item-input');
      const labelEl = fragment.querySelector('.js-checkbox-item-label');
      inputEl.value = field.code;
      inputEl.checked = (selectedCodes || []).includes(field.code);
      labelEl.textContent = fieldLabel(field);
      inputEl.addEventListener('change', onChange);
      containerEl.appendChild(fragment);
    });
  };

  const checkedValues = (containerEl) =>
    Array.from(containerEl.querySelectorAll('.js-checkbox-item-input'))
      .filter((inputEl) => inputEl.checked)
      .map((inputEl) => inputEl.value);

  const bindTextInput = (el, get, set) => {
    el.value = get();
    el.addEventListener('change', () => set(el.value));
  };

  const bindNumberInput = (el, get, set, fallback) => {
    el.value = get();
    el.addEventListener('change', () => {
      const parsed = parseInt(el.value, 10);
      set(Number.isFinite(parsed) ? parsed : fallback);
      el.value = get();
    });
  };

  const renderGroupingFieldRow = () => {
    els.groupingFieldRow.hidden = config.groupingType !== 'field';
    buildFieldOptions(
      els.groupingFieldSelect,
      groupingFields,
      config.groupingFieldCode,
      '(選択してください)',
    );
  };

  const wireGroupingControls = () => {
    els.groupingRecordRadio.checked = config.groupingType !== 'field';
    els.groupingFieldRadio.checked = config.groupingType === 'field';
    renderGroupingFieldRow();

    els.groupingRecordRadio.addEventListener('change', () => {
      if (els.groupingRecordRadio.checked) {
        config.groupingType = 'record';
        renderGroupingFieldRow();
      }
    });
    els.groupingFieldRadio.addEventListener('change', () => {
      if (els.groupingFieldRadio.checked) {
        config.groupingType = 'field';
        renderGroupingFieldRow();
      }
    });
    els.groupingFieldSelect.addEventListener('change', () => {
      config.groupingFieldCode = els.groupingFieldSelect.value;
    });
  };

  const wireAxisList = () => {
    els.axisList.textContent = '';
    for (let i = 0; i < MAX_AXIS_SLOTS; i++) {
      const fragment = els.axisItemTemplate.content.cloneNode(true);
      const labelEl = fragment.querySelector('label');
      const selectEl = fragment.querySelector('.js-axis-select');
      const required = i < ConfigValidation.MIN_AXIS_FIELDS;
      const selectId = `js-axis-select-${i}`;
      labelEl.textContent = `軸${i + 1}${required ? '(必須)' : ''}`;
      labelEl.setAttribute('for', selectId);
      selectEl.id = selectId;
      buildFieldOptions(
        selectEl,
        numberFields,
        config.axisFieldCodes[i],
        '(未選択)',
      );
      selectEl.addEventListener('change', () => {
        const selects = Array.from(
          els.axisList.querySelectorAll('.js-axis-select'),
        );
        config.axisFieldCodes = selects
          .map((selEl) => selEl.value)
          .filter((value) => value !== '');
      });
      els.axisList.appendChild(fragment);
    }
  };

  const wireSimpleInputs = () => {
    bindTextInput(
      els.title,
      () => config.title,
      (value) => {
        config.title = value;
      },
    );
    bindNumberInput(
      els.scaleDivisions,
      () => config.scaleDivisions,
      (value) => {
        config.scaleDivisions = value;
      },
      ConfigStore.DEFAULT_SCALE_DIVISIONS,
    );
    bindNumberInput(
      els.maxRecords,
      () => config.maxRecords,
      (value) => {
        config.maxRecords = value;
      },
      ConfigStore.DEFAULT_MAX_RECORDS,
    );
    buildCheckboxList(
      els.badgeFields,
      badgeCandidateFields,
      config.badgeFieldCodes,
      () => {
        config.badgeFieldCodes = checkedValues(els.badgeFields);
      },
    );
  };

  const wireFormActions = () => {
    els.cancelButton.addEventListener('click', () => {
      window.location.href = '../../' + kintone.app.getId() + '/plugin/';
    });

    els.form.addEventListener('submit', (e) => {
      e.preventDefault();

      const validation = ConfigValidation.validateConfig(config, formFields);
      if (!validation.valid) {
        alert(`設定に誤りがあります。\n${validation.errors.join('\n')}`);
        return;
      }

      kintone.plugin.app.setConfig(ConfigStore.serialize(config), () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + kintone.app.getId();
      });
    });
  };

  wireGroupingControls();
  wireAxisList();
  wireSimpleInputs();
  wireFormActions();
})(kintone.$PLUGIN_ID);
