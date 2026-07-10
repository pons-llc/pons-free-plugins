(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.SelfLookup;

  // idea.mdの「対応フィールド型のスコープ」参照。kintoneのクエリ言語で=/>/>=等が使えるフィールド型のみ
  // キー・絞り込み条件の対象にする(選択肢系フィールドは対象外)。
  const QUERYABLE_FIELD_TYPES = [
    'SINGLE_LINE_TEXT',
    'NUMBER',
    'DATE',
    'TIME',
    'DATETIME',
    'LINK',
  ];
  // レイアウト専用・値を持たないフィールドタイプはフィールドマッピングの対象から除外する。
  const NON_VALUE_FIELD_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'SPACER',
    'LABEL',
    'HR',
    'CATEGORY',
    'STATUS',
  ];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const lookupListEl = document.getElementById('js-lookup-list');
  const lookupAddButtonEl = document.getElementById('js-lookup-add');
  const lookupRowTemplateEl = document.getElementById('js-lookup-row-template');
  const conditionRowTemplateEl = document.getElementById(
    'js-condition-row-template',
  );
  const mappingRowTemplateEl = document.getElementById(
    'js-mapping-row-template',
  );

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する。同一アプリ内のセルフルックアップなので、
  // 自レコード側・検索先側どちらも同じフィールド一覧から選択肢を組み立てられる。
  const formFields = await kintone.app.getFormFields();
  const queryableFields = Object.values(formFields).filter((f) =>
    QUERYABLE_FIELD_TYPES.includes(f.type),
  );
  const mappableFields = Object.values(formFields).filter(
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

  const renderLookupList = () => {
    lookupListEl.innerHTML = '';
    config.lookups.forEach((lookup, lookupIndex) => {
      const fragment = lookupRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-lookup-row');
      const selfKeyEl = rowEl.querySelector('.js-lookup-self-key');
      const otherKeyEl = rowEl.querySelector('.js-lookup-other-key');
      const removeEl = rowEl.querySelector('.js-lookup-remove');
      const conditionListEl = rowEl.querySelector('.js-condition-list');
      const conditionAddButtonEl = rowEl.querySelector('.js-condition-add');
      const mappingListEl = rowEl.querySelector('.js-mapping-list');
      const mappingAddButtonEl = rowEl.querySelector('.js-mapping-add');

      const renderConditionList = () => {
        conditionListEl.innerHTML = '';
        lookup.conditions.forEach((condition, conditionIndex) => {
          const conditionFragment =
            conditionRowTemplateEl.content.cloneNode(true);
          const fieldEl = conditionFragment.querySelector(
            '.js-condition-field',
          );
          const operatorEl = conditionFragment.querySelector(
            '.js-condition-operator',
          );
          const valueSourceEl = conditionFragment.querySelector(
            '.js-condition-value-source',
          );
          const valueEl = conditionFragment.querySelector(
            '.js-condition-value',
          );
          const selfFieldEl = conditionFragment.querySelector(
            '.js-condition-self-field',
          );
          const removeConditionEl = conditionFragment.querySelector(
            '.js-condition-remove',
          );

          const applyValueSourceVisibility = () => {
            const isFixed = condition.valueSource === 'FIXED';
            valueEl.style.display = isFixed ? '' : 'none';
            selfFieldEl.style.display = isFixed ? 'none' : '';
          };

          buildOptions(
            fieldEl,
            queryableFields,
            condition.fieldCode,
            '(選択してください)',
          );
          operatorEl.value = condition.operator;
          valueSourceEl.value = condition.valueSource;
          valueEl.value = condition.value || '';
          buildOptions(
            selfFieldEl,
            queryableFields,
            condition.selfFieldCode,
            '(選択してください)',
          );
          applyValueSourceVisibility();

          fieldEl.addEventListener('change', () => {
            condition.fieldCode = fieldEl.value;
          });
          operatorEl.addEventListener('change', () => {
            condition.operator = operatorEl.value;
          });
          valueSourceEl.addEventListener('change', () => {
            condition.valueSource = valueSourceEl.value;
            applyValueSourceVisibility();
          });
          valueEl.addEventListener('input', () => {
            condition.value = valueEl.value;
          });
          selfFieldEl.addEventListener('change', () => {
            condition.selfFieldCode = selfFieldEl.value;
          });
          removeConditionEl.addEventListener('click', () => {
            lookup.conditions.splice(conditionIndex, 1);
            renderConditionList();
          });

          conditionListEl.appendChild(conditionFragment);
        });
      };

      const renderMappingList = () => {
        mappingListEl.innerHTML = '';
        lookup.fieldMappings.forEach((mapping, mappingIndex) => {
          const mappingFragment = mappingRowTemplateEl.content.cloneNode(true);
          const sourceEl = mappingFragment.querySelector('.js-mapping-source');
          const targetEl = mappingFragment.querySelector('.js-mapping-target');
          const removeMappingEl =
            mappingFragment.querySelector('.js-mapping-remove');

          buildOptions(
            sourceEl,
            mappableFields,
            mapping.sourceFieldCode,
            '(選択してください)',
          );
          buildOptions(
            targetEl,
            mappableFields,
            mapping.targetFieldCode,
            '(選択してください)',
          );

          sourceEl.addEventListener('change', () => {
            mapping.sourceFieldCode = sourceEl.value;
          });
          targetEl.addEventListener('change', () => {
            mapping.targetFieldCode = targetEl.value;
          });
          removeMappingEl.addEventListener('click', () => {
            lookup.fieldMappings.splice(mappingIndex, 1);
            renderMappingList();
          });

          mappingListEl.appendChild(mappingFragment);
        });
      };

      buildOptions(
        selfKeyEl,
        queryableFields,
        lookup.selfKeyFieldCode,
        '(選択してください)',
      );
      buildOptions(
        otherKeyEl,
        queryableFields,
        lookup.otherKeyFieldCode,
        '(選択してください)',
      );
      renderConditionList();
      renderMappingList();

      selfKeyEl.addEventListener('change', () => {
        lookup.selfKeyFieldCode = selfKeyEl.value;
      });
      otherKeyEl.addEventListener('change', () => {
        lookup.otherKeyFieldCode = otherKeyEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.lookups.splice(lookupIndex, 1);
        renderLookupList();
      });
      conditionAddButtonEl.addEventListener('click', () => {
        lookup.conditions.push({
          fieldCode: '',
          operator: 'EXACT_MATCH',
          valueSource: 'FIXED',
          value: '',
          selfFieldCode: '',
        });
        renderConditionList();
      });
      mappingAddButtonEl.addEventListener('click', () => {
        lookup.fieldMappings.push({ sourceFieldCode: '', targetFieldCode: '' });
        renderMappingList();
      });

      lookupListEl.appendChild(fragment);
    });
  };
  renderLookupList();

  lookupAddButtonEl.addEventListener('click', () => {
    config.lookups.push({
      selfKeyFieldCode: '',
      otherKeyFieldCode: '',
      conditions: [],
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
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや演算子)のみを
      // 表示しており、外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
