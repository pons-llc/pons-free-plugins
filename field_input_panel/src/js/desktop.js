(function (global, kintone) {
  'use strict';

  const NS = global.FieldInputPanel;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  // フィールドコード→フィールドのプロパティ(type/options等)。app.record.create.show/edit.show
  // イベントの中でkintone.app.getFormFields()を呼ぶ(Promise対応イベントなので await できる)。
  let fieldInfoByCode = null;

  const FLOATING_BUTTONS_ID = 'fip-floating-buttons';
  const PANEL_ID = 'fip-panel';

  const removeExisting = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.remove();
    }
  };

  const sortedOptions = (options) =>
    Object.keys(options || {})
      .map((key) => ({
        key,
        label: options[key].label,
        index: Number(options[key].index),
      }))
      .sort((a, b) => a.index - b.index);

  // ラジオボタン/チェックボックス/複数選択共通の選択肢リストDOMを組み立てる。
  const buildOptionListControl = (fieldProp, inputType, name, isChecked) => {
    const el = document.createElement('div');
    el.className = 'fip-option-list';
    sortedOptions(fieldProp.options).forEach((option) => {
      const labelEl = document.createElement('label');
      const inputEl = document.createElement('input');
      inputEl.type = inputType;
      if (name) {
        inputEl.name = name;
      }
      inputEl.value = option.key;
      inputEl.checked = isChecked(option.key);
      labelEl.appendChild(inputEl);
      labelEl.appendChild(document.createTextNode(` ${option.label}`));
      el.appendChild(labelEl);
    });
    return el;
  };

  const buildDropDownControl = (fieldProp, initialValue) => {
    const el = document.createElement('select');
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(未選択)';
    el.appendChild(blankOptionEl);
    sortedOptions(fieldProp.options).forEach((option) => {
      const optionEl = document.createElement('option');
      optionEl.value = option.key;
      optionEl.textContent = option.label;
      optionEl.selected = option.key === initialValue;
      el.appendChild(optionEl);
    });
    return { el, getValue: () => el.value };
  };

  // フィールド型ごとに入力コントロールを組み立てる。戻り値のgetValue()は、
  // js/lib/field-value-codec.jsのencodeFieldValue()にそのまま渡せる形式(文字列 または 配列)を返す。
  const buildFieldControl = (fieldCode, fieldProp, initialValue) => {
    const type = fieldProp.type;

    if (type === 'MULTI_LINE_TEXT') {
      const el = document.createElement('textarea');
      el.rows = 3;
      el.value = initialValue;
      return { el, getValue: () => el.value };
    }

    if (type === 'DATE' || type === 'TIME' || type === 'DATETIME') {
      const el = document.createElement('input');
      el.type = { DATE: 'date', TIME: 'time', DATETIME: 'datetime-local' }[
        type
      ];
      el.value = initialValue;
      return { el, getValue: () => el.value };
    }

    if (type === 'DROP_DOWN') {
      return buildDropDownControl(fieldProp, initialValue);
    }

    if (type === 'RADIO_BUTTON') {
      const name = `fip-radio-${fieldCode}-${Math.random().toString(36).slice(2)}`;
      const el = buildOptionListControl(
        fieldProp,
        'radio',
        name,
        (key) => key === initialValue,
      );
      return {
        el,
        getValue: () => {
          const checked = el.querySelector('input:checked');
          return checked ? checked.value : '';
        },
      };
    }

    if (type === 'CHECK_BOX' || type === 'MULTI_SELECT') {
      const el = buildOptionListControl(fieldProp, 'checkbox', null, (key) =>
        initialValue.includes(key),
      );
      return {
        el,
        getValue: () =>
          Array.from(el.querySelectorAll('input:checked')).map(
            (input) => input.value,
          ),
      };
    }

    // SINGLE_LINE_TEXT / NUMBER / LINK
    const el = document.createElement('input');
    el.type = 'text';
    el.value = initialValue;
    return { el, getValue: () => el.value };
  };

  const closePanel = () => {
    removeExisting(PANEL_ID);
    document
      .querySelectorAll('.fip-floating-button-active')
      .forEach((el) => el.classList.remove('fip-floating-button-active'));
  };

  const openPanel = (button, floatingButtonEl) => {
    closePanel();
    floatingButtonEl.classList.add('fip-floating-button-active');

    const record = kintone.app.record.get().record;

    const panelEl = document.createElement('div');
    panelEl.id = PANEL_ID;
    panelEl.className = 'fip-panel';

    const headerEl = document.createElement('div');
    headerEl.className = 'fip-panel-header';
    const titleEl = document.createElement('span');
    titleEl.textContent = button.title || button.label;
    const closeIconEl = document.createElement('span');
    closeIconEl.className = 'fip-panel-close';
    closeIconEl.textContent = '×';
    closeIconEl.addEventListener('click', closePanel);
    headerEl.appendChild(titleEl);
    headerEl.appendChild(closeIconEl);
    panelEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'fip-panel-body';

    const controls = [];
    button.items.forEach((item) => {
      if (item.type === 'SPACER') {
        const spacerEl = document.createElement('div');
        spacerEl.className = 'fip-panel-spacer';
        bodyEl.appendChild(spacerEl);
        return;
      }

      const fieldProp = fieldInfoByCode[item.fieldCode];
      if (!fieldProp) {
        return;
      }

      const initialValue = NS.FieldValueCodec.decodeFieldValue(
        fieldProp.type,
        record[item.fieldCode],
      );
      const control = buildFieldControl(
        item.fieldCode,
        fieldProp,
        initialValue,
      );

      const fieldWrapEl = document.createElement('div');
      fieldWrapEl.className = 'fip-panel-field';
      // E2Eテスト(Puppeteer)から特定のフィールドの入力コントロールを一意に特定できるようにする
      // (見た目には影響しないdata属性)。
      fieldWrapEl.dataset.fieldCode = item.fieldCode;
      const labelEl = document.createElement('label');
      labelEl.textContent = fieldProp.label || item.fieldCode;
      fieldWrapEl.appendChild(labelEl);
      fieldWrapEl.appendChild(control.el);
      bodyEl.appendChild(fieldWrapEl);

      controls.push({
        fieldCode: item.fieldCode,
        type: fieldProp.type,
        control,
      });
    });
    panelEl.appendChild(bodyEl);

    const footerEl = document.createElement('div');
    footerEl.className = 'fip-panel-footer';

    const closeButtonEl = document.createElement('button');
    closeButtonEl.type = 'button';
    closeButtonEl.className = 'kintoneplugin-button-normal';
    closeButtonEl.textContent = '閉じる';
    closeButtonEl.addEventListener('click', closePanel);

    const applyButtonEl = document.createElement('button');
    applyButtonEl.type = 'button';
    applyButtonEl.className = 'kintoneplugin-button-dialog-ok';
    applyButtonEl.textContent = '反映';
    applyButtonEl.addEventListener('click', () => {
      const current = kintone.app.record.get().record;
      controls.forEach(({ fieldCode, type, control }) => {
        const field = current[fieldCode];
        if (field) {
          field.value = NS.FieldValueCodec.encodeFieldValue(
            type,
            control.getValue(),
          );
        }
      });
      kintone.app.record.set({ record: current });
      closePanel();
    });

    footerEl.appendChild(closeButtonEl);
    footerEl.appendChild(applyButtonEl);
    panelEl.appendChild(footerEl);

    document.body.appendChild(panelEl);
  };

  const renderFloatingButtons = () => {
    removeExisting(FLOATING_BUTTONS_ID);
    closePanel();

    if (config.buttons.length === 0) {
      return;
    }

    const containerEl = document.createElement('div');
    containerEl.id = FLOATING_BUTTONS_ID;
    containerEl.className = 'fip-floating-buttons';

    config.buttons.forEach((button) => {
      const buttonEl = document.createElement('button');
      buttonEl.type = 'button';
      buttonEl.className = 'fip-floating-button';
      buttonEl.textContent = button.label;

      // フローティングボタンのクリックイベントはkintone.events.on()のハンドラーの外側なので、
      // record.get()/record.set()の呼び出し制限を受けない(idea.md「初期値の取得と反映」参照)。
      buttonEl.addEventListener('click', () => {
        if (buttonEl.classList.contains('fip-floating-button-active')) {
          closePanel();
          return;
        }
        openPanel(button, buttonEl);
      });

      containerEl.appendChild(buttonEl);
    });

    document.body.appendChild(containerEl);
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    async (event) => {
      // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
      // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
      // {properties: {...}}のようにラップされない)。config.jsと同じ確認済み事項。
      fieldInfoByCode = await kintone.app.getFormFields();
      renderFloatingButtons();
      return event;
    },
  );
})(window, kintone);
