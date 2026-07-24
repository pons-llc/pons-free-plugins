(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.SidebarToggle;

  const NO_VALUE_OPERATORS = ['IS_EMPTY', 'IS_NOT_EMPTY'];

  const OPERATOR_LABELS = {
    EQ: '等しい (=)',
    NEQ: '等しくない (≠)',
    GT: 'より大きい (>)',
    GTE: '以上 (>=)',
    LT: 'より小さい (<)',
    LTE: '以下 (<=)',
    CONTAINS: 'を含む',
    NOT_CONTAINS: 'を含まない',
    IS_EMPTY: '空である',
    IS_NOT_EMPTY: '空でない',
  };

  const FIELD_TYPE_LABELS = {
    DATETIME: '日時',
    DATE: '日付',
    TIME: '時刻',
    RADIO_BUTTON: 'ラジオボタン',
    DROP_DOWN: 'ドロップダウン',
    CHECK_BOX: 'チェックボックス',
    STATUS: 'プロセス管理ステータス',
  };

  const DATE_INPUT_TYPE = {
    DATETIME: 'datetime-local',
    DATE: 'date',
    TIME: 'time',
  };

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');
  const clauseRowTemplateEl = document.getElementById('js-clause-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(ラップされない、
  // resp.propertiesではなく戻り値そのものが値であることを実装前にkintoneドキュメントで確認済み)。
  const formFields = await kintone.app.getFormFields();
  const fieldsByType = {};
  Object.values(formFields).forEach((f) => {
    if (!fieldsByType[f.type]) {
      fieldsByType[f.type] = [];
    }
    fieldsByType[f.type].push(f);
  });

  // kintone.app.getStatus()(JavaScript API)はプラグイン設定画面では利用できないため、
  // status_arrowプラグインと同様REST API(GET /k/v1/app/status.json)をkintone.api()経由で呼ぶ。
  const processManagement = await kintone.api(
    kintone.api.url('/k/v1/app/status.json', true),
    'GET',
    { app: kintone.app.getId() },
  );
  const statusStepValues = processManagement.states
    ? Object.keys(processManagement.states).sort(
        (a, b) =>
          processManagement.states[a].index - processManagement.states[b].index,
      )
    : [];

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const getFieldOptionValues = (fieldCode) => {
    const field = Object.values(formFields).find((f) => f.code === fieldCode);
    if (!field || !field.options) {
      return [];
    }
    return Object.keys(field.options).sort(
      (a, b) => Number(field.options[a].index) - Number(field.options[b].index),
    );
  };

  const buildOptions = (selectEl, values, selectedValue, placeholder) => {
    selectEl.innerHTML = '';
    if (placeholder) {
      const placeholderOptionEl = document.createElement('option');
      placeholderOptionEl.value = '';
      placeholderOptionEl.textContent = placeholder;
      selectEl.appendChild(placeholderOptionEl);
    }
    values.forEach((value) => {
      const optionEl = document.createElement('option');
      optionEl.value = value;
      optionEl.textContent = value;
      optionEl.selected = value === selectedValue;
      selectEl.appendChild(optionEl);
    });
  };

  const buildFieldCodeOptions = (selectEl, fieldType, selectedCode) => {
    const items = fieldsByType[fieldType] || [];
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(placeholderOptionEl);
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
      const modeEl = rowEl.querySelector('.js-rule-mode');
      const actionEl = rowEl.querySelector('.js-rule-action');
      const conditionAreaEl = rowEl.querySelector('.js-condition-area');
      const operatorEl = rowEl.querySelector('.js-rule-operator');
      const removeEl = rowEl.querySelector('.js-rule-remove');
      const clauseListEl = rowEl.querySelector('.js-clause-list');
      const clauseAddButtonEl = rowEl.querySelector('.js-clause-add');

      const applyConditionAreaVisibility = () => {
        conditionAreaEl.hidden = rule.mode !== 'MATCH';
      };

      // フィールド種別ごとに演算子(condition-engine.jsのOPERATORS_BY_TYPE)・値入力欄の種類
      // (日時系は日時入力、それ以外は選択肢セレクト)を変える。
      const renderClauseValueControl = (containerEl, clause) => {
        containerEl.innerHTML = '';
        let controlEl;
        if (DATE_INPUT_TYPE[clause.fieldType]) {
          controlEl = document.createElement('input');
          controlEl.type = DATE_INPUT_TYPE[clause.fieldType];
          controlEl.className =
            'kintoneplugin-input-text sbt-clause-value js-clause-value';
          controlEl.value = clause.value || '';
          controlEl.addEventListener('input', () => {
            clause.value = controlEl.value;
          });
        } else {
          controlEl = document.createElement('select');
          controlEl.className =
            'kintoneplugin-select sbt-clause-value js-clause-value';
          const values =
            clause.fieldType === 'STATUS'
              ? statusStepValues
              : getFieldOptionValues(clause.fieldCode);
          buildOptions(controlEl, values, clause.value, '(選択してください)');
          controlEl.addEventListener('change', () => {
            clause.value = controlEl.value;
          });
        }
        controlEl.style.display = NO_VALUE_OPERATORS.includes(clause.operator)
          ? 'none'
          : '';
        containerEl.appendChild(controlEl);
        return controlEl;
      };

      const renderClauseList = () => {
        clauseListEl.innerHTML = '';
        rule.condition.children.forEach((clause, clauseIndex) => {
          const clauseFragment = clauseRowTemplateEl.content.cloneNode(true);
          const fieldTypeEl = clauseFragment.querySelector(
            '.js-clause-field-type',
          );
          const fieldCodeEl = clauseFragment.querySelector('.js-clause-field');
          const clauseOperatorEl = clauseFragment.querySelector(
            '.js-clause-operator',
          );
          const valueContainerEl = clauseFragment.querySelector(
            '.js-clause-value-container',
          );
          const removeClauseEl =
            clauseFragment.querySelector('.js-clause-remove');

          buildOptions(
            fieldTypeEl,
            NS.ConditionEngine.FIELD_TYPES,
            clause.fieldType,
            null,
          );
          Array.from(fieldTypeEl.options).forEach((optionEl) => {
            optionEl.textContent =
              FIELD_TYPE_LABELS[optionEl.value] || optionEl.value;
          });

          const isStatus = () => clause.fieldType === 'STATUS';

          const renderFieldCodeSelect = () => {
            if (isStatus()) {
              fieldCodeEl.innerHTML = '';
              fieldCodeEl.disabled = true;
              fieldCodeEl.style.display = 'none';
              clause.fieldCode = 'ステータス';
            } else {
              fieldCodeEl.disabled = false;
              fieldCodeEl.style.display = '';
              buildFieldCodeOptions(
                fieldCodeEl,
                clause.fieldType,
                clause.fieldCode,
              );
            }
          };

          const renderOperatorSelect = () => {
            const allowed =
              NS.ConditionEngine.OPERATORS_BY_TYPE[clause.fieldType] || [];
            buildOptions(clauseOperatorEl, allowed, clause.operator, null);
            Array.from(clauseOperatorEl.options).forEach((optionEl) => {
              optionEl.textContent =
                OPERATOR_LABELS[optionEl.value] || optionEl.value;
            });
            if (!allowed.includes(clause.operator)) {
              clause.operator = allowed[0];
              clauseOperatorEl.value = clause.operator;
            }
          };

          renderFieldCodeSelect();
          renderOperatorSelect();
          renderClauseValueControl(valueContainerEl, clause);

          fieldTypeEl.addEventListener('change', () => {
            clause.fieldType = fieldTypeEl.value;
            clause.fieldCode = '';
            clause.value = '';
            renderFieldCodeSelect();
            renderOperatorSelect();
            renderClauseValueControl(valueContainerEl, clause);
          });
          fieldCodeEl.addEventListener('change', () => {
            clause.fieldCode = fieldCodeEl.value;
            clause.value = '';
            renderClauseValueControl(valueContainerEl, clause);
          });
          clauseOperatorEl.addEventListener('change', () => {
            clause.operator = clauseOperatorEl.value;
            renderClauseValueControl(valueContainerEl, clause);
          });
          removeClauseEl.addEventListener('click', () => {
            rule.condition.children.splice(clauseIndex, 1);
            renderClauseList();
          });

          clauseListEl.appendChild(clauseFragment);
        });
      };

      modeEl.value = rule.mode;
      actionEl.value = rule.action;
      operatorEl.value = rule.condition.conditionOperator;
      applyConditionAreaVisibility();
      renderClauseList();

      modeEl.addEventListener('change', () => {
        rule.mode = modeEl.value;
        applyConditionAreaVisibility();
      });
      actionEl.addEventListener('change', () => {
        rule.action = actionEl.value;
      });
      operatorEl.addEventListener('change', () => {
        rule.condition.conditionOperator = operatorEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.rules.splice(ruleIndex, 1);
        renderRuleList();
      });
      clauseAddButtonEl.addEventListener('click', () => {
        rule.condition.children.push({
          fieldType: 'RADIO_BUTTON',
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
      mode: 'MATCH',
      condition: { conditionOperator: 'AND', children: [] },
      action: 'CLOSED',
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
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果のみを表示しており、外部からの
      // 入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
