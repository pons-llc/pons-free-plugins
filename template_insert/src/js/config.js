(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.TemplateInsert;

  const TARGET_FIELD_TYPES = ['MULTI_LINE_TEXT', 'RICH_TEXT'];

  const queryElements = () => ({
    formEl: document.querySelector('.js-submit-settings'),
    cancelButtonEl: document.querySelector('.js-cancel-button'),
    errorsEl: document.getElementById('js-errors'),
    warningsEl: document.getElementById('js-warnings'),
    modeEl: document.querySelector('.js-mode'),
    radioFieldRowEl: document.querySelector('.js-radio-field-row'),
    radioFieldEl: document.querySelector('.js-radio-field'),
    templateListEl: document.getElementById('js-template-list'),
    templateAddButtonEl: document.getElementById('js-template-add'),
    templateRowTemplateEl: document.getElementById('js-template-row-template'),
    radioMappingSectionEl: document.querySelector('.js-radio-mapping-section'),
    radioMappingListEl: document.getElementById('js-radio-mapping-list'),
    radioMappingRowTemplateEl: document.getElementById(
      'js-radio-mapping-row-template',
    ),
  });

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // {properties: {...}}のようにラップされない)。テーブル内側のフィールドは、そのテーブルの
  // フィールド自身が持つ`fields`プロパティにネストされる(トップレベルには出てこない)ことを
  // REST APIドキュメントで確認済み。
  const buildFieldCatalogs = (formFields) => {
    const topLevelFields = Object.values(formFields);
    return {
      // js/lib/config-validation.jsへ渡すフィールドコード→{type, subtableFieldCode}のカタログ
      // (js/lib/field-catalog.js参照)。
      fieldCatalog: NS.FieldCatalog.buildFieldCatalog(formFields),
      targetFieldOptions: topLevelFields.filter((f) =>
        TARGET_FIELD_TYPES.includes(f.type),
      ),
      subtableFieldOptions: topLevelFields.filter((f) => f.type === 'SUBTABLE'),
      radioFieldOptions: topLevelFields.filter(
        (f) => f.type === 'RADIO_BUTTON',
      ),
      placeholderFieldOptions: topLevelFields.filter((f) =>
        NS.FieldValueFormatter.isPlaceholderEligibleFieldType(f.type),
      ),
    };
  };

  const {
    formEl,
    cancelButtonEl,
    errorsEl,
    warningsEl,
    modeEl,
    radioFieldRowEl,
    radioFieldEl,
    templateListEl,
    templateAddButtonEl,
    templateRowTemplateEl,
    radioMappingSectionEl,
    radioMappingListEl,
    radioMappingRowTemplateEl,
  } = queryElements();

  const formFields = await kintone.app.getFormFields();
  const {
    fieldCatalog,
    targetFieldOptions,
    subtableFieldOptions,
    radioFieldOptions,
    placeholderFieldOptions,
  } = buildFieldCatalogs(formFields);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // このアプリにラジオボタンフィールドが1つも無い場合、ラジオボタン連動モード自体を
  // 選択できないようにする(idea.md「エッジケース」参照)。
  const radioLinkedOptionEl = modeEl.querySelector(
    'option[value="RADIO_LINKED"]',
  );
  if (radioFieldOptions.length === 0) {
    radioLinkedOptionEl.disabled = true;
    if (config.mode === 'RADIO_LINKED') {
      config.mode = 'DROPDOWN';
    }
  }

  const buildOptions = (selectEl, items, selectedValue, placeholder) => {
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
      optionEl.selected = item.code === selectedValue;
      selectEl.appendChild(optionEl);
    });
  };

  // プレースホルダー選択は、レコード直下の項目と、各サブテーブルの列を<optgroup>で分けて
  // 表示する(idea.md「繰り返しブロック([[ ]]構文)」参照。テーブルの列は[[ ]]で囲んだ
  // 部分に使うことで、そのテーブルの行を繰り返す対象になる)。挿入先フィールド自身は
  // 自己参照防止のため候補から除く。
  const buildPlaceholderOptions = (selectEl, excludeFieldCode) => {
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(フィールドを選択)';
    selectEl.appendChild(placeholderOptionEl);

    const recordGroupEl = document.createElement('optgroup');
    recordGroupEl.label = 'レコードの項目';
    placeholderFieldOptions
      .filter((f) => f.code !== excludeFieldCode)
      .forEach((f) => {
        const optionEl = document.createElement('option');
        optionEl.value = f.code;
        optionEl.textContent = `${f.label} (${f.code})`;
        recordGroupEl.appendChild(optionEl);
      });
    selectEl.appendChild(recordGroupEl);

    subtableFieldOptions.forEach((tableField) => {
      const tableGroupEl = document.createElement('optgroup');
      tableGroupEl.label = `テーブル: ${tableField.label}`;
      Object.values(tableField.fields).forEach((column) => {
        const optionEl = document.createElement('option');
        optionEl.value = column.code;
        optionEl.textContent = `${column.label} (${column.code})`;
        tableGroupEl.appendChild(optionEl);
      });
      selectEl.appendChild(tableGroupEl);
    });
  };

  const applyModeVisibility = () => {
    const isRadioLinked = config.mode === 'RADIO_LINKED';
    radioFieldRowEl.style.display = isRadioLinked ? '' : 'none';
    radioMappingSectionEl.style.display = isRadioLinked ? '' : 'none';
  };

  // ラジオボタンの選択肢とconfig.radioMappingsを同期する。選択肢の順序で並べ直し、
  // 選択肢が無くなったマッピングは捨て、新しい選択肢には空のマッピングを追加する。
  const syncRadioMappings = () => {
    const radioField = formFields[config.radioFieldCode];
    if (!radioField || radioField.type !== 'RADIO_BUTTON') {
      config.radioMappings = [];
      return;
    }
    const optionValues = Object.keys(radioField.options).sort(
      (a, b) =>
        Number(radioField.options[a].index) -
        Number(radioField.options[b].index),
    );
    const existingByOption = {};
    config.radioMappings.forEach((m) => {
      existingByOption[m.optionValue] = m;
    });
    config.radioMappings = optionValues.map(
      (optionValue) =>
        existingByOption[optionValue] || { optionValue, templateId: '' },
    );
  };

  // 本文のテキストエリアで選択中の範囲を[[ ]]で囲む(繰り返しブロックの指定を補助する)。
  // 選択範囲が無い場合はカーソル位置に[[]]を挿入し、カーソルをその内側に置く。
  const wrapSelectionWithRepeatBrackets = (bodyEl, template) => {
    const start = bodyEl.selectionStart || 0;
    const end = bodyEl.selectionEnd || 0;
    const selected = bodyEl.value.slice(start, end);
    const wrapped = `[[${selected}]]`;
    bodyEl.value =
      bodyEl.value.slice(0, start) + wrapped + bodyEl.value.slice(end);
    template.body = bodyEl.value;
    bodyEl.focus();
    if (selected) {
      bodyEl.setSelectionRange(start, start + wrapped.length);
    } else {
      bodyEl.setSelectionRange(start + 2, start + 2);
    }
  };

  const bindTemplateRowFields = (rowEl, template, index) => {
    const nameEl = rowEl.querySelector('.js-template-name');
    const targetEl = rowEl.querySelector('.js-template-target');
    const bodyEl = rowEl.querySelector('.js-template-body');
    const placeholderFieldEl = rowEl.querySelector(
      '.js-template-placeholder-field',
    );
    const placeholderInsertButtonEl = rowEl.querySelector(
      '.js-template-placeholder-insert',
    );
    const wrapRepeatButtonEl = rowEl.querySelector('.js-template-wrap-repeat');
    const removeEl = rowEl.querySelector('.js-template-remove');

    nameEl.value = template.name || '';
    buildOptions(
      targetEl,
      targetFieldOptions,
      template.targetFieldCode,
      '(選択してください)',
    );
    bodyEl.value = template.body || '';
    buildPlaceholderOptions(placeholderFieldEl, template.targetFieldCode);

    nameEl.addEventListener('input', () => {
      template.name = nameEl.value;
    });
    targetEl.addEventListener('change', () => {
      template.targetFieldCode = targetEl.value;
      buildPlaceholderOptions(placeholderFieldEl, template.targetFieldCode);
    });
    bodyEl.addEventListener('input', () => {
      template.body = bodyEl.value;
    });
    placeholderInsertButtonEl.addEventListener('click', () => {
      const code = placeholderFieldEl.value;
      if (!code) {
        return;
      }
      const token = `{${code}}`;
      const start = bodyEl.selectionStart || 0;
      const end = bodyEl.selectionEnd || 0;
      bodyEl.value =
        bodyEl.value.slice(0, start) + token + bodyEl.value.slice(end);
      template.body = bodyEl.value;
      const caret = start + token.length;
      bodyEl.focus();
      bodyEl.setSelectionRange(caret, caret);
    });
    wrapRepeatButtonEl.addEventListener('click', () => {
      wrapSelectionWithRepeatBrackets(bodyEl, template);
    });
    removeEl.addEventListener('click', () => {
      config.templates.splice(index, 1);
      renderTemplateList();
      renderRadioMappingList();
    });
  };

  const renderTemplateList = () => {
    templateListEl.innerHTML = '';
    config.templates.forEach((template, index) => {
      const fragment = templateRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-template-row');
      bindTemplateRowFields(rowEl, template, index);
      templateListEl.appendChild(fragment);
    });
  };

  const renderRadioMappingList = () => {
    syncRadioMappings();
    radioMappingListEl.innerHTML = '';
    if (config.mode !== 'RADIO_LINKED') {
      return;
    }
    const radioField = formFields[config.radioFieldCode];
    if (!radioField) {
      return;
    }
    config.radioMappings.forEach((mapping) => {
      const fragment = radioMappingRowTemplateEl.content.cloneNode(true);
      const labelEl = fragment.querySelector('.js-radio-mapping-option-label');
      const templateEl = fragment.querySelector('.js-radio-mapping-template');

      const optionInfo = radioField.options[mapping.optionValue];
      labelEl.textContent = optionInfo ? optionInfo.label : mapping.optionValue;

      buildOptions(
        templateEl,
        config.templates.map((t) => ({
          code: t.id,
          label: t.name || '(名称未設定)',
        })),
        mapping.templateId,
        '(挿入しない)',
      );
      templateEl.addEventListener('change', () => {
        mapping.templateId = templateEl.value;
      });

      radioMappingListEl.appendChild(fragment);
    });
  };

  const initUi = () => {
    buildOptions(
      radioFieldEl,
      radioFieldOptions,
      config.radioFieldCode,
      '(選択してください)',
    );
    modeEl.value = config.mode;
    applyModeVisibility();
    renderTemplateList();
    renderRadioMappingList();

    if (targetFieldOptions.length === 0) {
      warningsEl.textContent =
        'このアプリには文字列(複数行)・リッチエディターフィールドが無いため、テンプレートを追加できません。';
      templateAddButtonEl.disabled = true;
    }
  };
  initUi();

  modeEl.addEventListener('change', () => {
    config.mode = modeEl.value;
    applyModeVisibility();
    renderRadioMappingList();
  });
  radioFieldEl.addEventListener('change', () => {
    config.radioFieldCode = radioFieldEl.value;
    renderRadioMappingList();
  });

  templateAddButtonEl.addEventListener('click', () => {
    config.templates.push({
      id: NS.ConfigStore.createTemplateId(),
      name: '',
      targetFieldCode: '',
      body: '',
    });
    renderTemplateList();
    renderRadioMappingList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateConfig(config, fieldCatalog);
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
