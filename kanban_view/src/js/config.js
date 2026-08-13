(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.KanbanView;
  const ConfigStore = NS.ConfigStore;
  const ConfigValidation = NS.ConfigValidation;

  const DATE_TYPES = ['DATE', 'DATETIME'];
  const GROUPABLE_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];
  const USER_FIELD_TYPES = ['USER_SELECT'];

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

  const allFields = Object.values(formFields).filter(
    (field) => field.type !== 'SUBTABLE',
  );
  const dateFields = fieldsOfType(DATE_TYPES);
  const groupableFields = fieldsOfType(GROUPABLE_TYPES);
  const userFields = fieldsOfType(USER_FIELD_TYPES);
  // kintone.app.getStatus()はプラグイン設定画面では利用できない画面制限があるため
  // (kintoneドキュメントMCPで確認済み。「利用できる画面」にプラグイン設定画面は含まれない)、
  // STATUS/STATUS_ASSIGNEE型のフィールドがgetFormFields()に含まれるかどうかで
  // プロセス管理が有効かどうかを判定する(プロセス管理を有効にするとkintoneが
  // 自動的にこれらの型のフィールドを追加する)。
  const hasStatusField = Object.values(formFields).some(
    (field) => field.type === 'STATUS',
  );
  const hasStatusAssigneeField = Object.values(formFields).some(
    (field) => field.type === 'STATUS_ASSIGNEE',
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
    const groupModeEls = fragment.querySelectorAll('.js-group-mode');
    const groupFieldRowEl = fragment.querySelector('.js-group-field-row');
    const groupFieldEl = fragment.querySelector('.js-group-field');
    const statusGroupNoteEl = fragment.querySelector('.js-status-group-note');
    const assigneeModeEls = fragment.querySelectorAll('.js-assignee-mode');
    const assigneeFieldRowEl = fragment.querySelector('.js-assignee-field-row');
    const assigneeFieldEl = fragment.querySelector('.js-assignee-field');
    const statusAssigneeNoteEl = fragment.querySelector(
      '.js-status-assignee-note',
    );
    const dueFieldEl = fragment.querySelector('.js-due-field');
    const badgeFieldEl = fragment.querySelector('.js-badge-field');
    const hoverFieldsEl = fragment.querySelector('.js-hover-fields');
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

    // グループ分け方法(ラジオ/ドロップダウン or プロセス管理のステータス)
    statusGroupNoteEl.hidden = hasStatusField;
    const updateGroupFieldVisibility = () => {
      groupFieldRowEl.hidden = config.viewConfigs[index].groupMode !== 'FIELD';
    };
    buildFieldOptions(
      groupFieldEl,
      groupableFields,
      viewConfig.groupFieldCode,
      true,
      '(選択してください)',
    );
    groupFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].groupFieldCode = groupFieldEl.value;
    });
    groupModeEls.forEach((inputEl) => {
      inputEl.name = `group-mode-${index}`;
      inputEl.checked = inputEl.value === viewConfig.groupMode;
      inputEl.disabled = inputEl.value === 'STATUS' && !hasStatusField;
      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          config.viewConfigs[index].groupMode = inputEl.value;
          updateGroupFieldVisibility();
        }
      });
    });
    updateGroupFieldVisibility();

    // 担当者の表示元(ユーザー選択フィールド or プロセス管理の作業者)
    statusAssigneeNoteEl.hidden = hasStatusAssigneeField;
    const updateAssigneeFieldVisibility = () => {
      assigneeFieldRowEl.hidden =
        config.viewConfigs[index].assigneeMode !== 'USER_FIELD';
    };
    buildFieldOptions(
      assigneeFieldEl,
      userFields,
      viewConfig.assigneeFieldCode,
      true,
      '(選択してください)',
    );
    assigneeFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].assigneeFieldCode = assigneeFieldEl.value;
    });
    assigneeModeEls.forEach((inputEl) => {
      inputEl.name = `assignee-mode-${index}`;
      inputEl.checked = inputEl.value === viewConfig.assigneeMode;
      inputEl.disabled =
        inputEl.value === 'STATUS_ASSIGNEE' && !hasStatusAssigneeField;
      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          config.viewConfigs[index].assigneeMode = inputEl.value;
          updateAssigneeFieldVisibility();
        }
      });
    });
    updateAssigneeFieldVisibility();

    buildFieldOptions(
      dueFieldEl,
      dateFields,
      viewConfig.dueFieldCode,
      true,
      '(なし・期限を表示しない)',
    );
    dueFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].dueFieldCode = dueFieldEl.value;
    });

    buildFieldOptions(
      badgeFieldEl,
      allFields,
      viewConfig.badgeFieldCode,
      true,
      '(なし)',
    );
    badgeFieldEl.addEventListener('change', () => {
      config.viewConfigs[index].badgeFieldCode = badgeFieldEl.value;
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
