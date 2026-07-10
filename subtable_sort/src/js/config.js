(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.SubtableSort;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');
  const sortKeyRowTemplateEl = document.getElementById(
    'js-sortkey-row-template',
  );

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト。SUBTABLEはfieldsに列定義を持つ)を解決する。
  const formFields = await kintone.app.getFormFields();
  const subtableFields = Object.values(formFields).filter(
    (f) => f.type === 'SUBTABLE',
  );
  const flagFieldCandidates = Object.values(formFields).filter(
    (f) => f.type === 'SINGLE_LINE_TEXT',
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

  const renderRuleList = () => {
    ruleListEl.innerHTML = '';
    config.rules.forEach((rule, ruleIndex) => {
      const fragment = ruleRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-rule-row');
      const subtableEl = rowEl.querySelector('.js-rule-subtable');
      const triggerEl = rowEl.querySelector('.js-rule-trigger');
      const flagRowEl = rowEl.querySelector('.js-rule-flag-row');
      const flagEl = rowEl.querySelector('.js-rule-flag');
      const removeEl = rowEl.querySelector('.js-rule-remove');
      const sortKeyListEl = rowEl.querySelector('.js-sortkey-list');
      const sortKeyAddButtonEl = rowEl.querySelector('.js-sortkey-add');

      const applyTriggerVisibility = () => {
        flagRowEl.style.display = rule.triggerMode === 'MANUAL' ? '' : 'none';
      };

      const renderSortKeyList = () => {
        sortKeyListEl.innerHTML = '';
        rule.sortKeys.forEach((key, keyIndex) => {
          const keyFragment = sortKeyRowTemplateEl.content.cloneNode(true);
          const columnEl = keyFragment.querySelector('.js-sortkey-column');
          const orderEl = keyFragment.querySelector('.js-sortkey-order');
          const typeEl = keyFragment.querySelector('.js-sortkey-type');
          const removeKeyEl = keyFragment.querySelector('.js-sortkey-remove');

          buildOptions(
            columnEl,
            subtableColumnsOf(rule.subtableFieldCode),
            key.columnCode,
            '(選択してください)',
          );
          orderEl.value = key.order;
          typeEl.value = key.valueType;

          columnEl.addEventListener('change', () => {
            rule.sortKeys[keyIndex].columnCode = columnEl.value;
          });
          orderEl.addEventListener('change', () => {
            rule.sortKeys[keyIndex].order = orderEl.value;
          });
          typeEl.addEventListener('change', () => {
            rule.sortKeys[keyIndex].valueType = typeEl.value;
          });
          removeKeyEl.addEventListener('click', () => {
            rule.sortKeys.splice(keyIndex, 1);
            renderSortKeyList();
          });

          sortKeyListEl.appendChild(keyFragment);
        });
      };

      buildOptions(
        subtableEl,
        subtableFields,
        rule.subtableFieldCode,
        '(選択してください)',
      );
      triggerEl.value = rule.triggerMode;
      buildOptions(
        flagEl,
        flagFieldCandidates,
        rule.sortedFlagFieldCode,
        '(使用しない)',
      );
      applyTriggerVisibility();
      renderSortKeyList();

      subtableEl.addEventListener('change', () => {
        rule.subtableFieldCode = subtableEl.value;
        rule.sortKeys.forEach((key) => {
          key.columnCode = '';
        });
        renderSortKeyList();
      });
      triggerEl.addEventListener('change', () => {
        rule.triggerMode = triggerEl.value;
        applyTriggerVisibility();
      });
      flagEl.addEventListener('change', () => {
        rule.sortedFlagFieldCode = flagEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.rules.splice(ruleIndex, 1);
        renderRuleList();
      });
      sortKeyAddButtonEl.addEventListener('click', () => {
        rule.sortKeys.push({
          columnCode: '',
          order: 'ASC',
          valueType: 'STRING',
        });
        renderSortKeyList();
      });

      ruleListEl.appendChild(fragment);
    });
  };
  renderRuleList();

  ruleAddButtonEl.addEventListener('click', () => {
    config.rules.push({
      subtableFieldCode: '',
      sortKeys: [],
      triggerMode: 'SUBMIT',
      sortedFlagFieldCode: '',
    });
    renderRuleList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateRules(config.rules);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果(フィールドコードや発動タイミング)のみを
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
