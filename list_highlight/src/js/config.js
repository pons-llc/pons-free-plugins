(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.ListHighlight;

  const NO_VALUE_OPERATORS = ['IS_EMPTY', 'IS_NOT_EMPTY'];
  // レイアウト専用・値を持たないフィールドタイプは条件の対象から除外する。
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
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');
  const clauseRowTemplateEl = document.getElementById('js-clause-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する。
  const formFields = await kintone.app.getFormFields();
  const conditionFields = Object.values(formFields).filter(
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

  const renderRuleList = () => {
    ruleListEl.innerHTML = '';
    config.rules.forEach((rule, ruleIndex) => {
      const fragment = ruleRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-rule-row');
      const operatorEl = rowEl.querySelector('.js-rule-operator');
      const colorEl = rowEl.querySelector('.js-rule-color');
      const removeEl = rowEl.querySelector('.js-rule-remove');
      const clauseListEl = rowEl.querySelector('.js-clause-list');
      const clauseAddButtonEl = rowEl.querySelector('.js-clause-add');

      const renderClauseList = () => {
        clauseListEl.innerHTML = '';
        rule.condition.children.forEach((clause, clauseIndex) => {
          const clauseFragment = clauseRowTemplateEl.content.cloneNode(true);
          const fieldEl = clauseFragment.querySelector('.js-clause-field');
          const clauseOperatorEl = clauseFragment.querySelector(
            '.js-clause-operator',
          );
          const valueEl = clauseFragment.querySelector('.js-clause-value');
          const removeClauseEl =
            clauseFragment.querySelector('.js-clause-remove');

          const applyValueVisibility = () => {
            valueEl.style.display = NO_VALUE_OPERATORS.includes(clause.operator)
              ? 'none'
              : '';
          };

          buildOptions(
            fieldEl,
            conditionFields,
            clause.fieldCode,
            '(選択してください)',
          );
          clauseOperatorEl.value = clause.operator;
          valueEl.value = clause.value || '';
          applyValueVisibility();

          fieldEl.addEventListener('change', () => {
            clause.fieldCode = fieldEl.value;
          });
          clauseOperatorEl.addEventListener('change', () => {
            clause.operator = clauseOperatorEl.value;
            applyValueVisibility();
          });
          valueEl.addEventListener('input', () => {
            clause.value = valueEl.value;
          });
          removeClauseEl.addEventListener('click', () => {
            rule.condition.children.splice(clauseIndex, 1);
            renderClauseList();
          });

          clauseListEl.appendChild(clauseFragment);
        });
      };

      operatorEl.value = rule.condition.conditionOperator;
      colorEl.value = rule.backgroundColor || '#ffe0b2';
      renderClauseList();

      operatorEl.addEventListener('change', () => {
        rule.condition.conditionOperator = operatorEl.value;
      });
      colorEl.addEventListener('input', () => {
        rule.backgroundColor = colorEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.rules.splice(ruleIndex, 1);
        renderRuleList();
      });
      clauseAddButtonEl.addEventListener('click', () => {
        rule.condition.children.push({
          fieldCode: '',
          operator: 'EQ',
          value: '',
        });
        renderClauseList();
      });

      ruleListEl.appendChild(fragment);
    });
  };
  renderRuleList();

  ruleAddButtonEl.addEventListener('click', () => {
    config.rules.push({
      condition: { conditionOperator: 'AND', children: [] },
      backgroundColor: '#ffe0b2',
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
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや色コード)のみを
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
