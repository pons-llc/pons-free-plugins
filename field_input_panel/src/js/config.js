(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.FieldInputPanel;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const tabNavEl = document.getElementById('js-tab-nav');
  const buttonAddEl = document.getElementById('js-button-add');
  const noButtonMessageEl = document.getElementById('js-no-button-message');
  const buttonPanelEl = document.getElementById('js-button-panel');
  const buttonPanelTemplateEl = document.getElementById(
    'js-button-panel-template',
  );
  const itemRowTemplateEl = document.getElementById('js-item-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // {properties: {...}}のようにラップされない)。tab_layout/org_lookupの実装と同じ確認済み事項。
  const formFields = await kintone.app.getFormFields();
  const eligibleFields = NS.FieldEligibility.listEligibleFields(formFields);
  const fieldInfoByCode = {};
  Object.keys(formFields).forEach((code) => {
    fieldInfoByCode[code] = formFields[code];
  });

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  let activeButtonIndex = config.buttons.length > 0 ? 0 : -1;

  const buildFieldOptions = (selectEl, selectedCode) => {
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(placeholderOptionEl);
    eligibleFields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const tabLabel = (button, index) => button.label || `ボタン${index + 1}`;

  const renderTabNav = () => {
    tabNavEl.innerHTML = '';
    config.buttons.forEach((button, index) => {
      const tabEl = document.createElement('div');
      tabEl.className =
        'fip-tab' + (index === activeButtonIndex ? ' fip-tab-active' : '');

      const labelEl = document.createElement('span');
      labelEl.textContent = tabLabel(button, index);
      tabEl.appendChild(labelEl);

      const removeEl = document.createElement('span');
      removeEl.className = 'fip-tab-remove';
      removeEl.textContent = '×';
      removeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        config.buttons.splice(index, 1);
        if (activeButtonIndex >= config.buttons.length) {
          activeButtonIndex = config.buttons.length - 1;
        }
        renderAll();
      });
      tabEl.appendChild(removeEl);

      tabEl.addEventListener('click', () => {
        activeButtonIndex = index;
        renderAll();
      });

      tabNavEl.appendChild(tabEl);
    });
  };

  const renderButtonPanel = () => {
    buttonPanelEl.innerHTML = '';
    noButtonMessageEl.hidden = config.buttons.length > 0;

    const button = config.buttons[activeButtonIndex];
    if (!button) {
      return;
    }

    const fragment = buttonPanelTemplateEl.content.cloneNode(true);
    const labelEl = fragment.querySelector('.js-button-label');
    const titleEl = fragment.querySelector('.js-button-title');
    const itemListEl = fragment.querySelector('.js-item-list');
    const addFieldEl = fragment.querySelector('.js-item-add-field');
    const addSpacerEl = fragment.querySelector('.js-item-add-spacer');

    labelEl.value = button.label || '';
    titleEl.value = button.title || '';

    const renderItemList = () => {
      itemListEl.innerHTML = '';
      button.items.forEach((item, itemIndex) => {
        const itemFragment = itemRowTemplateEl.content.cloneNode(true);
        const moveUpEl = itemFragment.querySelector('.js-item-move-up');
        const fieldSelectEl = itemFragment.querySelector(
          '.js-item-field-select',
        );
        const spacerLabelEl = itemFragment.querySelector(
          '.js-item-spacer-label',
        );
        const removeEl = itemFragment.querySelector('.js-item-remove');

        if (item.type === 'FIELD') {
          spacerLabelEl.hidden = true;
          buildFieldOptions(fieldSelectEl, item.fieldCode);
          fieldSelectEl.addEventListener('change', () => {
            item.fieldCode = fieldSelectEl.value;
          });
        } else {
          fieldSelectEl.hidden = true;
        }

        moveUpEl.style.visibility = itemIndex === 0 ? 'hidden' : 'visible';
        moveUpEl.addEventListener('click', () => {
          if (itemIndex === 0) {
            return;
          }
          const items = button.items;
          [items[itemIndex - 1], items[itemIndex]] = [
            items[itemIndex],
            items[itemIndex - 1],
          ];
          renderItemList();
        });

        removeEl.addEventListener('click', () => {
          button.items.splice(itemIndex, 1);
          renderItemList();
        });

        itemListEl.appendChild(itemFragment);
      });
    };
    renderItemList();

    labelEl.addEventListener('input', () => {
      button.label = labelEl.value;
      renderTabNav();
    });
    titleEl.addEventListener('input', () => {
      button.title = titleEl.value;
    });
    addFieldEl.addEventListener('click', () => {
      button.items.push({ type: 'FIELD', fieldCode: '' });
      renderItemList();
    });
    addSpacerEl.addEventListener('click', () => {
      button.items.push({ type: 'SPACER' });
      renderItemList();
    });

    buttonPanelEl.appendChild(fragment);
  };

  const renderAll = () => {
    renderTabNav();
    renderButtonPanel();
  };
  renderAll();

  buttonAddEl.addEventListener('click', () => {
    config.buttons.push({ label: '', title: '', items: [] });
    activeButtonIndex = config.buttons.length - 1;
    renderAll();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateButtons(
      config.buttons,
      fieldInfoByCode,
    );
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(ボタンラベルやフィールドコード)
      // のみを表示しており外部入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
