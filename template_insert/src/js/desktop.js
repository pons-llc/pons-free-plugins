(function (global, kintone) {
  'use strict';

  const NS = global.TemplateInsert;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // レコード直下のフィールドから、プレースホルダー用の値マップ({フィールドコード: 整形済み文字列})
  // を組み立てる。挿入先フィールド自身は自己参照防止のため除外する(idea.md参照)。
  const buildValuesMap = (record, excludeFieldCode) => {
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

  // サブテーブルの1行分(rowValue: {列コード: フィールド})を、レコード直下の値マップに
  // マージした値マップを作る(idea.mdの「本文中のプレースホルダーには...列コードも使える」)。
  const buildRowValuesMap = (outerValuesMap, rowValue) => {
    const map = Object.assign({}, outerValuesMap);
    Object.keys(rowValue).forEach((code) => {
      map[code] = NS.FieldValueFormatter.formatFieldValueForPlaceholder(
        rowValue[code],
      );
    });
    return map;
  };

  // テンプレートを解決し、挿入先フィールドへ追記する文字列を組み立てる。
  const resolveInsertText = (template, record) => {
    const targetField = record[template.targetFieldCode];
    const targetFieldType = targetField ? targetField.type : undefined;

    if (template.kind === 'SUBTABLE_REPEAT') {
      const tableField = record[template.subtableFieldCode];
      const outerValuesMap = buildValuesMap(record, template.targetFieldCode);
      const rows =
        tableField && Array.isArray(tableField.value) ? tableField.value : [];
      const rowValuesMaps = rows.map((row) =>
        buildRowValuesMap(outerValuesMap, row.value),
      );
      return NS.SubtableTemplate.buildRepeatedTemplateText({
        body: template.body,
        rowValuesMaps,
        targetFieldType,
      });
    }

    const valuesMap = buildValuesMap(record, template.targetFieldCode);
    return NS.PlaceholderResolver.resolveTemplate({
      body: template.body,
      valuesMap,
      targetFieldType,
    });
  };

  const insertTemplate = (template) => {
    const record = kintone.app.record.get().record;
    const targetField = record[template.targetFieldCode];
    if (!targetField) {
      alert('挿入先フィールドが見つかりません。');
      return;
    }

    const insertText = resolveInsertText(template, record);
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
