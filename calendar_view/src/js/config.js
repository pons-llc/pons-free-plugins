(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.CalendarView;
  const ConfigStore = NS.ConfigStore;
  const ConfigValidation = NS.ConfigValidation;
  const Grouping = NS.Grouping;

  const DATE_TYPES = ['DATE', 'DATETIME'];
  const GROUPABLE_TYPES = Grouping.GROUPABLE_FIELD_TYPES;

  const viewIdInputEl = document.querySelector('.js-view-id-input');
  const viewAddButtonEl = document.getElementById('js-view-add');
  const viewConfigListEl = document.getElementById('js-view-config-list');
  const viewConfigTemplateEl = document.getElementById(
    'js-view-config-template',
  );
  const checkboxItemTemplateEl = document.getElementById(
    'js-checkbox-item-template',
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
    const hoverFieldsEl = fragment.querySelector('.js-hover-fields');
    const viewUnitEls = fragment.querySelectorAll('.js-view-unit');
    const layoutDirectionEls = fragment.querySelectorAll(
      '.js-layout-direction',
    );
    const enableDragDropEl = fragment.querySelector('.js-enable-drag-drop');
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

    enableDragDropEl.checked = Boolean(viewConfig.enableDragDrop);
    enableDragDropEl.addEventListener('change', () => {
      config.viewConfigs[index].enableDragDrop = enableDragDropEl.checked;
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
