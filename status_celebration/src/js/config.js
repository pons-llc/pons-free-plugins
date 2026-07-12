(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.StatusCelebration;

  const SOURCE_FIELD_TYPES = ['DROP_DOWN', 'RADIO_BUTTON'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');
  const checkboxItemTemplateEl = document.getElementById(
    'js-checkbox-item-template',
  );

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(status_arrowで確認済みの仕様、
  // CLAUDE.md「既知の落とし穴」参照。プロパティ名でラップされない)。
  const formFields = await kintone.app.getFormFields();
  const sourceFields = Object.values(formFields).filter((f) =>
    SOURCE_FIELD_TYPES.includes(f.type),
  );

  // kintone.app.getStatus()(JavaScript API)はプラグイン設定画面では利用できない
  // (利用できる画面はレコード一覧・追加・編集・詳細・グラフ画面のみ、status_arrowで実機確認済み)ため、
  // 設定画面ではREST API(`GET /k/v1/app/status.json`)をkintone.api()経由で呼ぶ
  // (CLAUDE.md開発方針3)。レスポンスはREST APIドキュメントどおり
  // { enable, states, actions, revision } で返り、プロセス管理未設定のアプリではstatesがnullになる。
  const processManagement = await kintone.api(
    kintone.api.url('/k/v1/app/status.json', true),
    'GET',
    { app: kintone.app.getId() },
  );
  const statusValues = processManagement.states
    ? Object.keys(processManagement.states).sort(
        (a, b) =>
          Number(processManagement.states[a].index) -
          Number(processManagement.states[b].index),
      )
    : [];

  // 対象フィールドの選択肢(値)を、選択肢の並び順(index昇順)で返す。
  const getFieldValues = (fieldCode) => {
    const field = sourceFields.find((f) => f.code === fieldCode);
    if (!field || !field.options) {
      return [];
    }
    return Object.keys(field.options).sort(
      (a, b) => Number(field.options[a].index) - Number(field.options[b].index),
    );
  };

  const getAvailableValues = (rule) =>
    rule.sourceType === 'STATUS'
      ? statusValues
      : getFieldValues(rule.fieldCode);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildFieldOptions = (selectEl, items, selectedCode) => {
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(placeholderOptionEl);

    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.code;
      optionEl.textContent =
        item.label !== item.code ? `${item.label} (${item.code})` : item.label;
      optionEl.selected = item.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const renderRuleList = () => {
    ruleListEl.innerHTML = '';
    config.rules.forEach((rule, ruleIndex) => {
      const fragment = ruleRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-rule-row');
      const sourceTypeEl = rowEl.querySelector('.js-rule-source-type');
      const fieldRowEl = rowEl.querySelector('.js-rule-field-row');
      const fieldEl = rowEl.querySelector('.js-rule-field');
      const triggerValuesEl = rowEl.querySelector('.js-rule-trigger-values');
      const patternEl = rowEl.querySelector('.js-rule-pattern');
      const messageEl = rowEl.querySelector('.js-rule-message');
      const removeEl = rowEl.querySelector('.js-rule-remove');

      const applySourceTypeVisibility = () => {
        fieldRowEl.style.display = rule.sourceType === 'FIELD' ? '' : 'none';
      };

      // お祝い対象の値(複数選択)をチェックボックス一覧として描画する。対象種別・対象フィールドの
      // 変更で選択肢に含まれなくなった値も、黙って消さず「(選択肢に存在しません)」付きで残し、
      // 管理者が意図して外せるようにする(status_arrowのステップ表示と同じ考え方、idea.md参照)。
      const renderTriggerValues = () => {
        triggerValuesEl.innerHTML = '';
        const availableValues = getAvailableValues(rule);
        const staleValues = rule.triggerValues.filter(
          (v) => !availableValues.includes(v),
        );
        const items = [
          ...availableValues.map((v) => ({ value: v, label: v })),
          ...staleValues.map((v) => ({
            value: v,
            label: `${v}(選択肢に存在しません)`,
          })),
        ];

        if (items.length === 0) {
          const noteEl = document.createElement('p');
          noteEl.className = 'stc-cfg-empty-note';
          noteEl.textContent = '対象フィールドに選択肢がありません。';
          triggerValuesEl.appendChild(noteEl);
          return;
        }

        items.forEach((item) => {
          const itemFragment = checkboxItemTemplateEl.content.cloneNode(true);
          const inputEl = itemFragment.querySelector('.js-checkbox-input');
          const labelEl = itemFragment.querySelector('.js-checkbox-label');
          inputEl.checked = rule.triggerValues.includes(item.value);
          labelEl.textContent = item.label;
          inputEl.addEventListener('change', () => {
            if (inputEl.checked) {
              if (!rule.triggerValues.includes(item.value)) {
                rule.triggerValues.push(item.value);
              }
            } else {
              rule.triggerValues = rule.triggerValues.filter(
                (v) => v !== item.value,
              );
            }
          });
          triggerValuesEl.appendChild(itemFragment);
        });
      };

      sourceTypeEl.value = rule.sourceType;
      buildFieldOptions(fieldEl, sourceFields, rule.fieldCode);
      patternEl.value = rule.pattern;
      messageEl.value = rule.message;
      applySourceTypeVisibility();
      renderTriggerValues();

      sourceTypeEl.addEventListener('change', () => {
        rule.sourceType = sourceTypeEl.value;
        rule.triggerValues = [];
        applySourceTypeVisibility();
        renderTriggerValues();
      });
      fieldEl.addEventListener('change', () => {
        rule.fieldCode = fieldEl.value;
        rule.triggerValues = [];
        renderTriggerValues();
      });
      patternEl.addEventListener('change', () => {
        rule.pattern = patternEl.value;
      });
      messageEl.addEventListener('input', () => {
        rule.message = messageEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.rules.splice(ruleIndex, 1);
        renderRuleList();
      });

      ruleListEl.appendChild(fragment);
    });
  };
  renderRuleList();

  ruleAddButtonEl.addEventListener('click', () => {
    config.rules.push({
      sourceType: 'FIELD',
      fieldCode: '',
      triggerValues: [],
      pattern: 'KUSUDAMA',
      message: '',
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
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや選択肢文字列)のみを
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
