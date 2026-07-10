(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.GanttChartView;
  const PagingQuery = NS.PagingQuery;
  const ConfigStore = NS.ConfigStore;
  const GROUPABLE_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'DROP_DOWN',
    'RADIO_BUTTON',
  ];
  const COLOR_TYPES = [
    'DROP_DOWN',
    'RADIO_BUTTON',
    'CHECK_BOX',
    'MULTI_SELECT',
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'STATUS',
  ];
  const DATE_TYPES = ['DATE', 'DATETIME'];

  const viewPickerEl = document.querySelector('.js-view-picker');
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

  // 一覧の列挙(GET /k/v1/app/views.json)はJavaScript APIに相当するものがないため、
  // kintone自身へのREST呼び出しに限りkintone.api()を使う(CLAUDE.md方針3)。
  const fetchApiViews = async () => {
    const resp = await kintone.api(
      kintone.api.url('/k/v1/app/views.json', true),
      'GET',
      {
        app: kintone.app.getId(),
      },
    );
    return Object.keys(resp.views).map((name) => {
      const view = resp.views[name];
      return { id: view.id, name: view.name, type: view.type };
    });
  };

  // kintone.app.getFormFields() はJavaScript API(REST版のpropertiesと同等の値)。
  const [apiViews, formFields] = await Promise.all([
    fetchApiViews(),
    kintone.app.getFormFields(),
  ]);

  const fieldsOfType = (types) =>
    Object.values(formFields).filter((field) => types.includes(field.type));

  const dateFields = fieldsOfType(DATE_TYPES);
  const colorFields = fieldsOfType(COLOR_TYPES);
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

  const viewLabelFor = (viewId) => {
    const selectable = PagingQuery.buildSelectableViews(apiViews);
    const found = selectable.find((view) => view.id === String(viewId));
    return found ? found.name : String(viewId);
  };

  const renderViewPicker = () => {
    const selectable = PagingQuery.buildSelectableViews(apiViews);
    const configuredIds = config.viewConfigs.map((viewConfig) =>
      String(viewConfig.viewId),
    );
    const remaining = selectable.filter(
      (view) => !configuredIds.includes(view.id),
    );

    viewPickerEl.textContent = '';
    remaining.forEach((view) => {
      const optionEl = document.createElement('option');
      optionEl.value = view.id;
      optionEl.textContent = view.name;
      viewPickerEl.appendChild(optionEl);
    });
    viewAddButtonEl.disabled = remaining.length === 0;
  };

  const renderViewConfigBlock = (viewConfig, index) => {
    const fragment = viewConfigTemplateEl.content.cloneNode(true);
    const blockEl = fragment.querySelector('.js-view-config-block');
    const titleEl = fragment.querySelector('.js-view-title');
    const startFieldEl = fragment.querySelector('.js-start-field');
    const endFieldEl = fragment.querySelector('.js-end-field');
    const barFieldsEl = fragment.querySelector('.js-bar-fields');
    const colorFieldEl = fragment.querySelector('.js-color-field');
    const defaultGroupFieldEl = fragment.querySelector(
      '.js-default-group-field',
    );
    const allowedGroupFieldsEl = fragment.querySelector(
      '.js-allowed-group-fields',
    );
    const enableFullFetchEl = fragment.querySelector('.js-enable-full-fetch');
    const maxRecordsEl = fragment.querySelector('.js-max-records');
    const removeButtonEl = fragment.querySelector('.js-view-remove');

    titleEl.textContent = viewLabelFor(viewConfig.viewId);

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
      '(なし・開始日と同じ1日幅)',
    );
    endFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].endFieldCode = endFieldEl.value;
    });

    buildCheckboxList(barFieldsEl, allFields, viewConfig.barFieldCodes, () => {
      config.viewConfigs[index].barFieldCodes = checkedValues(barFieldsEl);
    });

    buildFieldOptions(
      colorFieldEl,
      colorFields,
      viewConfig.colorFieldCode,
      true,
      '(色分けしない)',
    );
    colorFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].colorFieldCode = colorFieldEl.value;
    });

    const refreshDefaultGroupOptions = () => {
      const allowedCodes = checkedValues(allowedGroupFieldsEl);
      const candidates = groupableFields.filter((field) =>
        allowedCodes.includes(field.code),
      );
      buildFieldOptions(
        defaultGroupFieldEl,
        candidates,
        config.viewConfigs[index].groupFieldCode,
        true,
        '(グループ分けしない)',
      );
    };

    buildCheckboxList(
      allowedGroupFieldsEl,
      groupableFields,
      viewConfig.allowedGroupFieldCodes,
      () => {
        config.viewConfigs[index].allowedGroupFieldCodes =
          checkedValues(allowedGroupFieldsEl);
        if (
          !config.viewConfigs[index].allowedGroupFieldCodes.includes(
            config.viewConfigs[index].groupFieldCode,
          )
        ) {
          config.viewConfigs[index].groupFieldCode = '';
        }
        refreshDefaultGroupOptions();
      },
    );
    refreshDefaultGroupOptions();
    defaultGroupFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].groupFieldCode = defaultGroupFieldEl.value;
    });

    enableFullFetchEl.checked = Boolean(viewConfig.enableFullFetch);
    enableFullFetchEl.addEventListener('change', () => {
      config.viewConfigs[index].enableFullFetch = enableFullFetchEl.checked;
    });

    maxRecordsEl.value = viewConfig.maxRecords;
    maxRecordsEl.addEventListener('change', () => {
      const parsed = parseInt(maxRecordsEl.value, 10);
      config.viewConfigs[index].maxRecords =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : ConfigStore.DEFAULT_MAX_RECORDS;
      maxRecordsEl.value = config.viewConfigs[index].maxRecords;
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
    renderViewPicker();
  };

  viewAddButtonEl.addEventListener('click', () => {
    const viewId = viewPickerEl.value;
    if (
      !viewId ||
      config.viewConfigs.some(
        (viewConfig) => String(viewConfig.viewId) === viewId,
      )
    ) {
      return;
    }
    const normalized = ConfigStore.normalizeViewConfig({
      viewId,
      viewName: viewLabelFor(viewId),
    });
    config.viewConfigs.push(normalized);
    renderAll();
  });

  renderAll();

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    for (const viewConfig of config.viewConfigs) {
      if (!viewConfig.startFieldCode) {
        alert(
          `「${viewLabelFor(viewConfig.viewId)}」の開始日フィールドを設定してください。`,
        );
        return;
      }
      const validation = NS.Grouping.validateGroupConfig(
        viewConfig.groupFieldCode,
        viewConfig.allowedGroupFieldCodes,
        formFields,
      );
      if (!validation.valid) {
        alert(
          `「${viewLabelFor(viewConfig.viewId)}」のグループ分け設定に誤りがあります。\n${validation.errors.join('\n')}`,
        );
        return;
      }
    }

    kintone.plugin.app.setConfig(ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
