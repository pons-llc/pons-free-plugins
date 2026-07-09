(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.FiscalYearNumbering;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const dateSourceRadioEls = document.querySelectorAll('.js-date-source');
  const dateFieldEl = document.querySelector('.js-date-field');
  const eraTableBodyEl = document.getElementById('js-era-table-body');
  const eraAddButtonEl = document.getElementById('js-era-add');
  const eraRowTemplateEl = document.getElementById('js-era-row-template');
  const segmentFieldPickerEl = document.querySelector('.js-segment-field-picker');
  const segmentAddButtonEl = document.getElementById('js-segment-add');
  const segmentListEl = document.getElementById('js-segment-list');
  const segmentRowTemplateEl = document.getElementById('js-segment-row-template');
  const numberFieldEl = document.querySelector('.js-number-field');
  const separatorEl = document.querySelector('.js-separator');
  const sequenceDigitsEl = document.querySelector('.js-sequence-digits');
  const counterAppIdEl = document.querySelector('.js-counter-app-id');
  const bulkGroupCodeEl = document.querySelector('.js-bulk-group-code');

  const { properties: formFields } = await kintone.app.getFormFields();
  const dateFields = Object.values(formFields).filter((f) =>
    ['DATE', 'DATETIME', 'CREATED_TIME'].includes(f.type)
  );
  const choiceFields = Object.values(formFields).filter((f) =>
    ['DROP_DOWN', 'RADIO_BUTTON'].includes(f.type)
  );
  const textFields = Object.values(formFields).filter((f) => f.type === 'SINGLE_LINE_TEXT');

  const buildOptions = (selectEl, fields, selectedCode) => {
    selectEl.innerHTML = '';
    fields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // --- 年度判定の基準日 ---
  dateSourceRadioEls.forEach((el) => {
    el.checked = el.value === config.fiscalYearDateSource;
  });
  buildOptions(dateFieldEl, dateFields, config.fiscalYearDateField);

  // --- 元号テーブル ---
  const renderEraTable = () => {
    eraTableBodyEl.innerHTML = '';
    config.eraTable.forEach((era, index) => {
      const fragment = eraRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-era-row');
      const codeEl = rowEl.querySelector('.js-era-code');
      const labelEl = rowEl.querySelector('.js-era-label');
      const startYearEl = rowEl.querySelector('.js-era-start-year');
      const removeEl = rowEl.querySelector('.js-era-remove');

      codeEl.value = era.code;
      labelEl.value = era.label;
      startYearEl.value = era.startYear;

      codeEl.addEventListener('input', () => {
        config.eraTable[index].code = codeEl.value;
      });
      labelEl.addEventListener('input', () => {
        config.eraTable[index].label = labelEl.value;
      });
      startYearEl.addEventListener('input', () => {
        config.eraTable[index].startYear = Number(startYearEl.value);
      });
      removeEl.addEventListener('click', () => {
        config.eraTable.splice(index, 1);
        renderEraTable();
      });

      eraTableBodyEl.appendChild(rowEl);
    });
  };
  renderEraTable();

  eraAddButtonEl.addEventListener('click', () => {
    config.eraTable.push({ code: '', label: '', startYear: new Date().getFullYear() });
    renderEraTable();
  });

  // --- セグメントフィールド ---
  buildOptions(segmentFieldPickerEl, choiceFields, '');

  const renderSegmentList = () => {
    segmentListEl.innerHTML = '';
    config.segments.forEach((segment, index) => {
      const field = choiceFields.find((f) => f.code === segment.fieldCode);
      if (!field) {
        return;
      }
      const fragment = segmentRowTemplateEl.content.cloneNode(true);
      const sectionEl = fragment.querySelector('.js-segment-title');
      const optionsBodyEl = fragment.querySelector('.js-segment-options');
      const removeEl = fragment.querySelector('.js-segment-remove');

      sectionEl.textContent = `${field.label} (${field.code}) — 並び順: ${segment.order}`;

      Object.values(field.options || {})
        .sort((a, b) => a.index - b.index)
        .forEach((option) => {
          const optionCode = Object.keys(field.options).find(
            (code) => field.options[code] === option
          );
          const rowEl = document.createElement('tr');
          const labelCellEl = document.createElement('td');
          labelCellEl.textContent = `${option.label} (${optionCode})`;
          const overrideCellEl = document.createElement('td');
          const overrideInputEl = document.createElement('input');
          overrideInputEl.type = 'text';
          overrideInputEl.className = 'kintoneplugin-input-text';
          overrideInputEl.value = (segment.optionOverrides || {})[optionCode] || '';
          overrideInputEl.addEventListener('input', () => {
            config.segments[index].optionOverrides = config.segments[index].optionOverrides || {};
            config.segments[index].optionOverrides[optionCode] = overrideInputEl.value;
          });
          overrideCellEl.appendChild(overrideInputEl);
          rowEl.appendChild(labelCellEl);
          rowEl.appendChild(overrideCellEl);
          optionsBodyEl.appendChild(rowEl);
        });

      removeEl.addEventListener('click', () => {
        config.segments.splice(index, 1);
        renderSegmentList();
      });

      segmentListEl.appendChild(fragment);
    });
  };
  renderSegmentList();

  segmentAddButtonEl.addEventListener('click', () => {
    const fieldCode = segmentFieldPickerEl.value;
    if (!fieldCode || config.segments.some((s) => s.fieldCode === fieldCode)) {
      return;
    }
    config.segments.push({
      fieldCode,
      order: config.segments.length + 1,
      optionOverrides: {},
    });
    renderSegmentList();
  });

  // --- 番号フォーマット ---
  buildOptions(numberFieldEl, textFields, config.numberFieldCode);
  separatorEl.value = config.numberFormat.separator;
  sequenceDigitsEl.value = config.numberFormat.sequenceDigits;

  // --- カウンター専用アプリ・一括採番 ---
  counterAppIdEl.value = config.counterAppId;
  bulkGroupCodeEl.value = config.bulkNumberingGroupCode;

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedDateSource = Array.from(dateSourceRadioEls).find((el) => el.checked);
    if (!selectedDateSource || !numberFieldEl.value || !counterAppIdEl.value) {
      alert('必須項目(基準日の種類・採番結果を保存するフィールド・カウンター専用アプリID)を入力してください。');
      return;
    }

    config.fiscalYearDateSource = selectedDateSource.value;
    config.fiscalYearDateField = dateFieldEl.value;
    config.numberFieldCode = numberFieldEl.value;
    config.numberFormat = {
      separator: separatorEl.value || '-',
      sequenceDigits: Number(sequenceDigitsEl.value) || 4,
    };
    config.counterAppId = counterAppIdEl.value;
    config.bulkNumberingGroupCode = bulkGroupCodeEl.value;

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
