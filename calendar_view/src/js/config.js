(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.CalendarView;
  const ConfigStore = NS.ConfigStore;
  const ConfigValidation = NS.ConfigValidation;
  const Grouping = NS.Grouping;

  const DATE_TYPES = ['DATE', 'DATETIME'];
  const GROUPABLE_TYPES = Grouping.GROUPABLE_FIELD_TYPES;
  const COLOR_TYPES = ['STATUS', 'DROP_DOWN', 'RADIO_BUTTON'];
  // 色選択は自由入力(カラーピッカー)にせず、固定パレットからの選択式にする(シンプルさ優先)。
  // NS.ColorAssignment.DEFAULT_PALETTEと同じ配列・同じ順序に日本語ラベルを対応させる。
  const PALETTE_LABELS = [
    '青',
    'オレンジ',
    '緑',
    '紫',
    '赤',
    '緑青',
    '黄',
    '紺',
  ];
  const PALETTE_OPTIONS = NS.ColorAssignment.DEFAULT_PALETTE.map(
    (value, i) => ({
      value,
      label: PALETTE_LABELS[i] || value,
    }),
  );

  const viewIdInputEl = document.querySelector('.js-view-id-input');
  const viewAddButtonEl = document.getElementById('js-view-add');
  const viewConfigListEl = document.getElementById('js-view-config-list');
  const viewConfigTemplateEl = document.getElementById(
    'js-view-config-template',
  );
  const checkboxItemTemplateEl = document.getElementById(
    'js-checkbox-item-template',
  );
  const colorOverrideTemplateEl = document.getElementById(
    'js-color-override-template',
  );
  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');

  // kintone.app.getFormFields() はJavaScript API(REST版のpropertiesと同等の値)。
  // 対象一覧の列挙にあたるREST API(GET /k/v1/app/views.json)は、idea.mdの方針により使わない
  // (一覧IDはユーザーがブラウザURLから直接入力する)。
  const formFields = await kintone.app.getFormFields();

  const fieldsOfType = (types) =>
    Object.values(formFields).filter((field) => types.includes(field.type));

  const dateFields = fieldsOfType(DATE_TYPES);
  const groupableFields = fieldsOfType(GROUPABLE_TYPES);
  const colorFields = fieldsOfType(COLOR_TYPES);
  const allFields = Object.values(formFields).filter(
    (field) => field.type !== 'SUBTABLE',
  );

  const config = ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const fieldLabel = (field) => `${field.label} (${field.code})`;

  const buildFieldOptions = (
    selectEl,
    fields,
    selectedCode,
    allowEmpty,
    emptyLabel,
  ) => {
    selectEl.textContent = '';
    if (allowEmpty) {
      const emptyOptionEl = document.createElement('option');
      emptyOptionEl.value = '';
      emptyOptionEl.textContent = emptyLabel || '(なし)';
      selectEl.appendChild(emptyOptionEl);
    }
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
      const fragment = checkboxItemTemplateEl.content.cloneNode(true);
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

  // DROP_DOWN/RADIO_BUTTONはformFieldsに選択肢(options)が含まれるため列挙できるが、
  // STATUSの選択肢(プロセス管理のステータス名)はJavaScript APIから列挙する手段がなく、
  // REST APIでの列挙は方針上避けるため、値ごとの色指定UIはDROP_DOWN/RADIO_BUTTONのみ対応する
  // (判断記録.md参照)。
  const optionsOf = (field) => {
    if (!field || !field.options) {
      return [];
    }
    return Object.keys(field.options)
      .map((code) => ({ code, label: field.options[code].label || code }))
      .sort(
        (a, b) =>
          Number(field.options[a.code].index) -
          Number(field.options[b.code].index),
      );
  };

  // 値ごとの色は、固定パレットからの選択式にする(自由なカラーピッカーは複雑なので使わない)。
  // 「(自動)」を選ぶとcolorOverridesから該当キーを削除し、自動割り当てにフォールバックする。
  const renderColorOverrides = (rowEl, containerEl, viewConfig, index) => {
    const field = formFields[viewConfig.colorFieldCode];
    const options = optionsOf(field);
    rowEl.hidden = options.length === 0;
    containerEl.textContent = '';
    if (options.length === 0) {
      return;
    }
    options.forEach((opt) => {
      const fragment = colorOverrideTemplateEl.content.cloneNode(true);
      const selectEl = fragment.querySelector('.js-color-override-input');
      const labelEl = fragment.querySelector('.js-color-override-label');
      labelEl.textContent = opt.label;

      const autoOptionEl = document.createElement('option');
      autoOptionEl.value = '';
      autoOptionEl.textContent = '(自動)';
      selectEl.appendChild(autoOptionEl);
      PALETTE_OPTIONS.forEach((paletteOption) => {
        const optionEl = document.createElement('option');
        optionEl.value = paletteOption.value;
        optionEl.textContent = `■ ${paletteOption.label}`;
        optionEl.style.color = paletteOption.value;
        selectEl.appendChild(optionEl);
      });

      const currentOverride = viewConfig.colorOverrides[opt.code];
      selectEl.value = PALETTE_OPTIONS.some((p) => p.value === currentOverride)
        ? currentOverride
        : '';

      selectEl.addEventListener('change', () => {
        if (selectEl.value === '') {
          delete config.viewConfigs[index].colorOverrides[opt.code];
        } else {
          config.viewConfigs[index].colorOverrides[opt.code] = selectEl.value;
        }
      });
      containerEl.appendChild(fragment);
    });
  };

  const viewLabelFor = (viewId) =>
    viewId === 'ALL' ? 'すべて(デフォルト)' : `一覧ID: ${viewId}`;

  const renderViewConfigBlock = (viewConfig, index) => {
    const fragment = viewConfigTemplateEl.content.cloneNode(true);
    const blockEl = fragment.querySelector('.js-view-config-block');
    const titleEl = fragment.querySelector('.js-view-title');
    const titleFieldEl = fragment.querySelector('.js-title-field');
    const startFieldEl = fragment.querySelector('.js-start-field');
    const endFieldEl = fragment.querySelector('.js-end-field');
    const groupFieldEl = fragment.querySelector('.js-group-field');
    const colorFieldEl = fragment.querySelector('.js-color-field');
    const colorOverridesRowEl = fragment.querySelector(
      '.js-color-overrides-row',
    );
    const colorOverridesEl = fragment.querySelector('.js-color-overrides');
    const hoverFieldsEl = fragment.querySelector('.js-hover-fields');
    const viewUnitEls = fragment.querySelectorAll('.js-view-unit');
    const layoutDirectionEls = fragment.querySelectorAll(
      '.js-layout-direction',
    );
    const removeButtonEl = fragment.querySelector('.js-view-remove');

    titleEl.textContent = viewLabelFor(viewConfig.viewId);

    buildFieldOptions(
      titleFieldEl,
      allFields,
      viewConfig.titleFieldCode,
      false,
    );
    titleFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].titleFieldCode = titleFieldEl.value;
    });

    buildFieldOptions(
      startFieldEl,
      dateFields,
      viewConfig.startFieldCode,
      false,
    );
    startFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].startFieldCode = startFieldEl.value;
    });

    buildFieldOptions(
      endFieldEl,
      dateFields,
      viewConfig.endFieldCode,
      true,
      '(なし・開始日時から既定幅で表示)',
    );
    endFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].endFieldCode = endFieldEl.value;
    });

    buildFieldOptions(
      groupFieldEl,
      groupableFields,
      viewConfig.groupFieldCode,
      true,
      '(グループ分けしない)',
    );
    groupFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].groupFieldCode = groupFieldEl.value;
    });

    buildFieldOptions(
      colorFieldEl,
      colorFields,
      viewConfig.colorFieldCode,
      true,
      '(なし・グループ分けフィールドで色分け)',
    );
    colorFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].colorFieldCode = colorFieldEl.value;
      renderColorOverrides(
        colorOverridesRowEl,
        colorOverridesEl,
        config.viewConfigs[index],
        index,
      );
    });
    renderColorOverrides(
      colorOverridesRowEl,
      colorOverridesEl,
      viewConfig,
      index,
    );

    buildCheckboxList(
      hoverFieldsEl,
      allFields,
      viewConfig.hoverFieldCodes,
      () => {
        config.viewConfigs[index].hoverFieldCodes =
          checkedValues(hoverFieldsEl);
      },
    );

    viewUnitEls.forEach((inputEl) => {
      inputEl.name = `view-unit-${index}`;
      inputEl.checked = inputEl.value === viewConfig.defaultViewUnit;
      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          config.viewConfigs[index].defaultViewUnit = inputEl.value;
        }
      });
    });

    layoutDirectionEls.forEach((inputEl) => {
      inputEl.name = `layout-direction-${index}`;
      inputEl.checked = inputEl.value === viewConfig.layoutDirection;
      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          config.viewConfigs[index].layoutDirection = inputEl.value;
        }
      });
    });

    removeButtonEl.addEventListener('click', () => {
      config.viewConfigs.splice(index, 1);
      renderAll();
    });

    return blockEl;
  };

  const renderAll = () => {
    viewConfigListEl.textContent = '';
    config.viewConfigs.forEach((viewConfig, index) => {
      viewConfigListEl.appendChild(renderViewConfigBlock(viewConfig, index));
    });
  };

  viewAddButtonEl.addEventListener('click', () => {
    const raw = viewIdInputEl.value.trim();
    const viewId = raw === '' ? 'ALL' : raw;
    if (config.viewConfigs.some((viewConfig) => viewConfig.viewId === viewId)) {
      alert(`「${viewLabelFor(viewId)}」の設定はすでに追加されています。`);
      return;
    }
    const normalized = ConfigStore.normalizeViewConfig({ viewId });
    config.viewConfigs.push(normalized);
    viewIdInputEl.value = '';
    renderAll();
  });

  renderAll();

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = ConfigValidation.validateViewConfigs(config.viewConfigs);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    kintone.plugin.app.setConfig(ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
