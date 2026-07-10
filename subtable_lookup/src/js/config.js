(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.SubtableLookup;

  // 日付・日時・時刻の型のみ、LATEST/OLDESTモードの検索対象列として選択可能にする
  // (idea.md「LATEST/OLDESTで検索対象列の型をDATE/DATETIME/TIMEに限定」、判断記録.mdの2番参照)。
  const EXTREME_MODE_FIELD_TYPES = ['DATE', 'DATETIME', 'TIME'];
  const CONDITION_FIELD_REQUIRED_MODES = [
    'PARTIAL_MATCH',
    'EXACT_MATCH',
    'LATEST',
    'OLDEST',
  ];
  const VALUE_REQUIRED_MODES = ['PARTIAL_MATCH', 'EXACT_MATCH'];
  const DIRECTIONLESS_MODES = ['TOP_ROW', 'BOTTOM_ROW'];

  // レイアウト専用・値を持たないフィールドタイプは出力先の対象から除外する。
  const NON_VALUE_FIELD_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'SPACER',
    'LABEL',
    'HR',
  ];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const lookupListEl = document.getElementById('js-lookup-list');
  const lookupAddButtonEl = document.getElementById('js-lookup-add');
  const lookupRowTemplateEl = document.getElementById('js-lookup-row-template');
  const mappingRowTemplateEl = document.getElementById(
    'js-mapping-row-template',
  );

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト。SUBTABLEはfieldsに列定義を持つ)を解決する。
  const formFields = await kintone.app.getFormFields();
  const subtableFields = Object.values(formFields).filter(
    (f) => f.type === 'SUBTABLE',
  );
  const outsideFields = Object.values(formFields).filter(
    (f) => !NON_VALUE_FIELD_TYPES.includes(f.type),
  );

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

  const subtableColumnsOf = (subtableFieldCode) => {
    const field = subtableFields.find((f) => f.code === subtableFieldCode);
    return field ? Object.values(field.fields) : [];
  };

  const isExtremeMode = (mode) => mode === 'LATEST' || mode === 'OLDEST';

  const renderLookupList = () => {
    lookupListEl.innerHTML = '';
    config.lookups.forEach((lookup, lookupIndex) => {
      const fragment = lookupRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-lookup-row');
      const subtableEl = rowEl.querySelector('.js-lookup-subtable');
      const modeEl = rowEl.querySelector('.js-lookup-mode');
      const conditionFieldRowEl = rowEl.querySelector(
        '.js-lookup-condition-field-row',
      );
      const conditionFieldEl = rowEl.querySelector(
        '.js-lookup-condition-field',
      );
      const matchValueRowEl = rowEl.querySelector('.js-lookup-match-value-row');
      const matchValueEl = rowEl.querySelector('.js-lookup-match-value');
      const directionRowEl = rowEl.querySelector('.js-lookup-direction-row');
      const directionEl = rowEl.querySelector('.js-lookup-direction');
      const removeEl = rowEl.querySelector('.js-lookup-remove');
      const mappingListEl = rowEl.querySelector('.js-mapping-list');
      const mappingAddButtonEl = rowEl.querySelector('.js-mapping-add');

      const renderConditionFieldOptions = () => {
        const columns = subtableColumnsOf(lookup.subtableFieldCode);
        const candidates = isExtremeMode(lookup.mode)
          ? columns.filter((c) => EXTREME_MODE_FIELD_TYPES.includes(c.type))
          : columns;
        buildOptions(
          conditionFieldEl,
          candidates,
          lookup.conditionFieldCode,
          '(選択してください)',
        );
      };

      const applyModeVisibility = () => {
        const showCondition = CONDITION_FIELD_REQUIRED_MODES.includes(
          lookup.mode,
        );
        const showValue = VALUE_REQUIRED_MODES.includes(lookup.mode);
        const showDirection = !DIRECTIONLESS_MODES.includes(lookup.mode);
        conditionFieldRowEl.style.display = showCondition ? '' : 'none';
        matchValueRowEl.style.display = showValue ? '' : 'none';
        directionRowEl.style.display = showDirection ? '' : 'none';
      };

      const renderMappingList = () => {
        mappingListEl.innerHTML = '';
        lookup.fieldMappings.forEach((mapping, mappingIndex) => {
          const mappingFragment = mappingRowTemplateEl.content.cloneNode(true);
          const mappingRowEl = mappingFragment.querySelector('.js-mapping-row');
          const columnEl = mappingRowEl.querySelector('.js-mapping-column');
          const targetEl = mappingRowEl.querySelector('.js-mapping-target');
          const mappingRemoveEl =
            mappingRowEl.querySelector('.js-mapping-remove');

          buildOptions(
            columnEl,
            subtableColumnsOf(lookup.subtableFieldCode),
            mapping.subtableColumnCode,
            '(選択してください)',
          );
          buildOptions(
            targetEl,
            outsideFields,
            mapping.targetFieldCode,
            '(選択してください)',
          );

          columnEl.addEventListener('change', () => {
            lookup.fieldMappings[mappingIndex].subtableColumnCode =
              columnEl.value;
          });
          targetEl.addEventListener('change', () => {
            lookup.fieldMappings[mappingIndex].targetFieldCode = targetEl.value;
          });
          mappingRemoveEl.addEventListener('click', () => {
            lookup.fieldMappings.splice(mappingIndex, 1);
            renderMappingList();
          });

          mappingListEl.appendChild(mappingFragment);
        });
      };

      buildOptions(
        subtableEl,
        subtableFields,
        lookup.subtableFieldCode,
        '(選択してください)',
      );
      modeEl.value = lookup.mode;
      renderConditionFieldOptions();
      matchValueEl.value = lookup.matchValue || '';
      directionEl.value = lookup.direction;
      applyModeVisibility();
      renderMappingList();

      subtableEl.addEventListener('change', () => {
        lookup.subtableFieldCode = subtableEl.value;
        lookup.conditionFieldCode = '';
        lookup.fieldMappings.forEach((m) => {
          m.subtableColumnCode = '';
        });
        renderConditionFieldOptions();
        renderMappingList();
      });
      modeEl.addEventListener('change', () => {
        lookup.mode = modeEl.value;
        lookup.conditionFieldCode = '';
        renderConditionFieldOptions();
        applyModeVisibility();
      });
      conditionFieldEl.addEventListener('change', () => {
        lookup.conditionFieldCode = conditionFieldEl.value;
      });
      matchValueEl.addEventListener('input', () => {
        lookup.matchValue = matchValueEl.value;
      });
      directionEl.addEventListener('change', () => {
        lookup.direction = directionEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.lookups.splice(lookupIndex, 1);
        renderLookupList();
      });
      mappingAddButtonEl.addEventListener('click', () => {
        lookup.fieldMappings.push({
          subtableColumnCode: '',
          targetFieldCode: '',
        });
        renderMappingList();
      });

      lookupListEl.appendChild(fragment);
    });
  };
  renderLookupList();

  lookupAddButtonEl.addEventListener('click', () => {
    config.lookups.push({
      subtableFieldCode: '',
      mode: 'PARTIAL_MATCH',
      conditionFieldCode: '',
      matchValue: '',
      direction: 'TOP_TO_BOTTOM',
      fieldMappings: [],
    });
    renderLookupList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateLookups(config.lookups);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果(フィールドコードやモード名)のみを表示しており、
      // 外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
