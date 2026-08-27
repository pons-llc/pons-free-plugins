(function (global, kintone) {
  'use strict';

  const NS = global.TemplateInsert;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.jsと同じロジック(kintone.app.getFormFields()はPC/モバイル共通。
  // kintone.mobile.app.record.get()/set()もPC版と同じ形式のレコードオブジェクトを扱う)。
  const fieldCatalogPromise = kintone.app
    .getFormFields()
    .then((formFields) => NS.FieldCatalog.buildFieldCatalog(formFields));

  const buildOuterValuesMap = (record, excludeFieldCode) => {
    const map = {};
    Object.keys(record).forEach((code) => {
      if (code === excludeFieldCode) {
        return;
      }
      const field = record[code];
      if (
        !field ||
        !NS.FieldValueFormatter.isPlaceholderEligibleFieldType(field.type)
      ) {
        return;
      }
      map[code] = NS.FieldValueFormatter.formatFieldValueForPlaceholder(field);
    });
    return map;
  };

  const buildRowColumnMapsByTable = (record) => {
    const result = {};
    Object.keys(record).forEach((code) => {
      const field = record[code];
      if (!field || field.type !== 'SUBTABLE' || !Array.isArray(field.value)) {
        return;
      }
      result[code] = field.value.map((row) => {
        const rowMap = {};
        Object.keys(row.value).forEach((columnCode) => {
          rowMap[columnCode] =
            NS.FieldValueFormatter.formatFieldValueForPlaceholder(
              row.value[columnCode],
            );
        });
        return rowMap;
      });
    });
    return result;
  };

  const resolveInsertText = (template, record, fieldCatalog) => {
    const targetField = record[template.targetFieldCode];
    const targetFieldType = targetField ? targetField.type : undefined;
    return NS.TemplateBodyResolver.resolveTemplateBody({
      body: template.body,
      fieldCatalog,
      outerValuesMap: buildOuterValuesMap(record, template.targetFieldCode),
      rowColumnMapsByTable: buildRowColumnMapsByTable(record),
      targetFieldType,
    });
  };

  const insertTemplate = async (template, insertMode) => {
    const record = kintone.mobile.app.record.get().record;
    const targetField = record[template.targetFieldCode];
    if (!targetField) {
      alert('挿入先フィールドが見つかりません。');
      return;
    }

    const fieldCatalog = await fieldCatalogPromise;
    const insertText = resolveInsertText(template, record, fieldCatalog);
    if (!insertText) {
      alert(
        '挿入する内容がありません(対象のテーブルに行が無い可能性があります)。',
      );
      return;
    }

    targetField.value = NS.InsertComposer.composeInsertedValue({
      currentValue: targetField.value,
      insertText,
      targetFieldType: targetField.type,
      mode: insertMode,
    });
    kintone.mobile.app.record.set({ record });
  };

  // 追加(末尾に追記)/上書き(既存値を破棄して置き換え)を切り替えるセレクトを作る。
  // 既定は追加(既存の挙動を維持)。
  const createInsertModeSelectEl = () => {
    const selectEl = document.createElement('select');
    selectEl.className = 'kintoneplugin-select tmpi-insert-mode';
    [
      ['APPEND', '追加'],
      ['OVERWRITE', '上書き'],
    ].forEach(([value, label]) => {
      const optionEl = document.createElement('option');
      optionEl.value = value;
      optionEl.textContent = label;
      selectEl.appendChild(optionEl);
    });
    return selectEl;
  };

  const setupDropdownUi = (spaceEl) => {
    if (config.templates.length === 0) {
      return;
    }

    const selectEl = document.createElement('select');
    selectEl.className = 'kintoneplugin-select tmpi-select';
    config.templates.forEach((template) => {
      const optionEl = document.createElement('option');
      optionEl.value = template.id;
      optionEl.textContent = template.name;
      selectEl.appendChild(optionEl);
    });

    const insertModeSelectEl = createInsertModeSelectEl();

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal tmpi-button';
    buttonEl.textContent = 'テンプレ挿入';
    buttonEl.addEventListener('click', () => {
      const template = config.templates.find((t) => t.id === selectEl.value);
      if (template) {
        insertTemplate(template, insertModeSelectEl.value);
      }
    });

    spaceEl.appendChild(selectEl);
    spaceEl.appendChild(insertModeSelectEl);
    spaceEl.appendChild(buttonEl);
  };

  const setupRadioLinkedUi = (spaceEl) => {
    if (config.templates.length === 0) {
      return null;
    }

    const insertModeSelectEl = createInsertModeSelectEl();

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal tmpi-button';
    buttonEl.textContent = 'テンプレ挿入';
    buttonEl.addEventListener('click', () => {
      const record = kintone.mobile.app.record.get().record;
      const radioField = record[config.radioFieldCode];
      const template = NS.RadioTemplateMapping.resolveTemplateForRadioValue({
        templates: config.templates,
        radioMappings: config.radioMappings,
        radioValue: radioField ? radioField.value : undefined,
      });
      if (!template) {
        alert('現在の選択肢に対応するテンプレートがありません。');
        return;
      }
      insertTemplate(template, insertModeSelectEl.value);
    });

    spaceEl.appendChild(insertModeSelectEl);
    spaceEl.appendChild(buttonEl);

    return (record) => {
      const radioField = record[config.radioFieldCode];
      const template = NS.RadioTemplateMapping.resolveTemplateForRadioValue({
        templates: config.templates,
        radioMappings: config.radioMappings,
        radioValue: radioField ? radioField.value : undefined,
      });
      buttonEl.disabled = !template;
    };
  };

  let updateRadioButtonState = null;

  // モバイルのヘッダー直下の要素取得は`kintone.mobile.app.getHeaderSpaceElement()`であり、
  // PC版の`kintone.app.record.getHeaderMenuSpaceElement()`と異なり`app`直下のAPIで
  // `app.record`配下ではないことに注意(idea.md「モバイル対応」参照、公式ドキュメント
  // 「ヘッダーの下側の要素を取得する」で確認済み)。
  const setupUi = (record) => {
    const spaceEl = kintone.mobile.app.getHeaderSpaceElement();
    if (!spaceEl || spaceEl.dataset.tmpiRendered) {
      return;
    }
    spaceEl.dataset.tmpiRendered = '1';

    if (config.mode === 'RADIO_LINKED') {
      updateRadioButtonState = setupRadioLinkedUi(spaceEl);
      if (updateRadioButtonState) {
        updateRadioButtonState(record);
      }
    } else {
      setupDropdownUi(spaceEl);
    }
  };

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    (event) => {
      setupUi(event.record);
      return event;
    },
  );

  if (config.mode === 'RADIO_LINKED' && config.radioFieldCode) {
    kintone.events.on(
      [
        `mobile.app.record.create.change.${config.radioFieldCode}`,
        `mobile.app.record.edit.change.${config.radioFieldCode}`,
      ],
      (event) => {
        if (updateRadioButtonState) {
          updateRadioButtonState(event.record);
        }
        return event;
      },
    );
  }
})(window, kintone);
