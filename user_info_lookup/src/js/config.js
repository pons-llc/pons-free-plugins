(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.UserInfoLookup;

  // idea.mdの「文字列１行またはユーザー選択フィールドから転記する」参照。
  const SOURCE_FIELD_TYPES = ['SINGLE_LINE_TEXT', 'USER_SELECT'];
  // idea.mdの「挿入先は文字列フィールド」参照。
  const DESTINATION_FIELD_TYPES = ['SINGLE_LINE_TEXT'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const rowListEl = document.getElementById('js-row-list');
  const rowAddButtonEl = document.getElementById('js-row-add');
  const rowTemplateEl = document.getElementById('js-row-template');
  const mappingRowTemplateEl = document.getElementById(
    'js-mapping-row-template',
  );

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // {properties: {...}}のようにラップされない)。
  const formFields = await kintone.app.getFormFields();
  const sourceFields = Object.values(formFields).filter((f) =>
    SOURCE_FIELD_TYPES.includes(f.type),
  );
  const destinationFields = Object.values(formFields).filter((f) =>
    DESTINATION_FIELD_TYPES.includes(f.type),
  );
  const fieldInfoByCode = {};
  Object.values(formFields).forEach((f) => {
    fieldInfoByCode[f.code] = { type: f.type };
  });

  // kintone.app.getFormLayout() も同様にREST APIレスポンスのlayoutプロパティと同様の値
  // (配列そのもの)を解決する({layout: [...]}のようにラップされない)。GROUP内のlayoutも
  // 再帰的に走査し、ボタンを設置できるスペースフィールド(SPACER)のelementIdを集める。
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

  const renderRowList = () => {
    rowListEl.innerHTML = '';
    config.rows.forEach((row, rowIndex) => {
      const fragment = rowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-row');
      const sourceFieldEl = rowEl.querySelector('.js-source-field');
      const triggerEl = rowEl.querySelector('.js-trigger');
      const buttonSpaceWrapEl = rowEl.querySelector('.js-button-space-wrap');
      const buttonSpaceEl = rowEl.querySelector('.js-button-space');
      const outputEditableEl = rowEl.querySelector('.js-output-editable');
      const removeEl = rowEl.querySelector('.js-row-remove');
      const mappingListEl = rowEl.querySelector('.js-mapping-list');
      const mappingAddButtonEl = rowEl.querySelector('.js-mapping-add');

      const applyTriggerVisibility = () => {
        buttonSpaceWrapEl.style.display =
          row.trigger === 'BUTTON' ? '' : 'none';
      };

      const renderMappingList = () => {
        mappingListEl.innerHTML = '';
        row.mappings.forEach((mapping, mappingIndex) => {
          const mappingFragment = mappingRowTemplateEl.content.cloneNode(true);
          const attributeEl = mappingFragment.querySelector(
            '.js-mapping-attribute',
          );
          const destinationEl = mappingFragment.querySelector(
            '.js-mapping-destination',
          );
          const removeMappingEl =
            mappingFragment.querySelector('.js-mapping-remove');

          attributeEl.innerHTML = '';
          const placeholderOptionEl = document.createElement('option');
          placeholderOptionEl.value = '';
          placeholderOptionEl.textContent = '(選択してください)';
          attributeEl.appendChild(placeholderOptionEl);
          NS.UserAttributes.ATTRIBUTES.forEach((attribute) => {
            const optionEl = document.createElement('option');
            optionEl.value = attribute.key;
            optionEl.textContent = attribute.label;
            optionEl.selected = attribute.key === mapping.attribute;
            attributeEl.appendChild(optionEl);
          });

          buildOptions(
            destinationEl,
            destinationFields,
            mapping.destinationFieldCode,
            '(選択してください)',
          );

          attributeEl.addEventListener('change', () => {
            mapping.attribute = attributeEl.value;
          });
          destinationEl.addEventListener('change', () => {
            mapping.destinationFieldCode = destinationEl.value;
          });
          removeMappingEl.addEventListener('click', () => {
            row.mappings.splice(mappingIndex, 1);
            renderMappingList();
          });

          mappingListEl.appendChild(mappingFragment);
        });
      };

      buildOptions(
        sourceFieldEl,
        sourceFields,
        row.sourceFieldCode,
        '(選択してください)',
      );
      triggerEl.value = row.trigger;
      buildOptions(
        buttonSpaceEl,
        spaceFields,
        row.buttonSpaceElementId,
        '(選択してください)',
      );
      outputEditableEl.checked = !!row.outputEditable;
      applyTriggerVisibility();
      renderMappingList();

      sourceFieldEl.addEventListener('change', () => {
        row.sourceFieldCode = sourceFieldEl.value;
      });
      triggerEl.addEventListener('change', () => {
        row.trigger = triggerEl.value;
        applyTriggerVisibility();
      });
      buttonSpaceEl.addEventListener('change', () => {
        row.buttonSpaceElementId = buttonSpaceEl.value;
      });
      outputEditableEl.addEventListener('change', () => {
        row.outputEditable = outputEditableEl.checked;
      });
      removeEl.addEventListener('click', () => {
        config.rows.splice(rowIndex, 1);
        renderRowList();
      });
      mappingAddButtonEl.addEventListener('click', () => {
        row.mappings.push({ attribute: '', destinationFieldCode: '' });
        renderMappingList();
      });

      rowListEl.appendChild(fragment);
    });
  };
  renderRowList();

  rowAddButtonEl.addEventListener('click', () => {
    config.rows.push({
      sourceFieldCode: '',
      trigger: 'BUTTON',
      buttonSpaceElementId: '',
      outputEditable: false,
      mappings: [],
    });
    renderRowList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateRows(
      config.rows,
      fieldInfoByCode,
    );
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果のみを表示しており外部入力ではないが、
      // 念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
