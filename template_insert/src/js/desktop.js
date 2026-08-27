(function (global, kintone) {
  'use strict';

  const NS = global.TemplateInsert;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // フィールドコード→{type, subtableFieldCode}のカタログは、本文中の[[...]]ブロックが
  // どのテーブルの繰り返しかを判定するために必要(idea.md「繰り返しブロック」参照)。
  // テーブルの行数が0件でも判定できるよう、レコードの値ではなくスキーマ
  // (kintone.app.getFormFields())から組み立てる。kintone.events.on()の登録をブロックしない
  // よう、ここではawaitせずPromiseを保持しておき、挿入時に待つ(self_lookupと同じ理由)。
  const fieldCatalogPromise = kintone.app
    .getFormFields()
    .then((formFields) => NS.FieldCatalog.buildFieldCatalog(formFields));

  // レコード直下のフィールドから、プレースホルダー用の値マップ({フィールドコード: 整形済み文字列})
  // を組み立てる。挿入先フィールド自身は自己参照防止のため除外する(idea.md参照)。
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

  // レコード内のすべてのテーブル(SUBTABLE)フィールドについて、行ごとの列値マップの配列を
  // 組み立てる({テーブルのフィールドコード: [{列コード: 整形済み文字列}, ...]})。
  // TemplateBodyResolver.resolveTemplateBody()のrowColumnMapsByTableに渡す。
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

  const insertTemplate = async (template) => {
    const record = kintone.app.record.get().record;
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
    });
    kintone.app.record.set({ record });
  };

  // === 通常モード(ドロップダウン+挿入ボタン) ===
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

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal tmpi-button';
    buttonEl.textContent = '挿入';
    buttonEl.addEventListener('click', () => {
      const template = config.templates.find((t) => t.id === selectEl.value);
      if (template) {
        insertTemplate(template);
      }
    });

    spaceEl.appendChild(selectEl);
    spaceEl.appendChild(buttonEl);
  };

  // === ラジオボタン連動モード(挿入ボタンのみ) ===
  // ボタンのクリックイベントはkintone.events.on()のハンドラーの外側の通常のaddEventListener
  // なので、record.get()/set()の呼び出し制限を受けない(org_lookup/self_lookupと同じ理由)。
  const setupRadioLinkedUi = (spaceEl) => {
    if (config.templates.length === 0) {
      return null;
    }

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal tmpi-button';
    buttonEl.textContent = '挿入';
    buttonEl.addEventListener('click', () => {
      const record = kintone.app.record.get().record;
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
      insertTemplate(template);
    });

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

  const setupUi = (record) => {
    const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
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
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      setupUi(event.record);
      return event;
    },
  );

  if (config.mode === 'RADIO_LINKED' && config.radioFieldCode) {
    kintone.events.on(
      [
        `app.record.create.change.${config.radioFieldCode}`,
        `app.record.edit.change.${config.radioFieldCode}`,
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
