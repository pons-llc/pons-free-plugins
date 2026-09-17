(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.InputFormatRule;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');

  // kintone.app.getFormFields()はREST APIレスポンスのpropertiesと同様の値(フィールドコードを
  // キーにした平坦なオブジェクト)を解決する(ラップされない、resp.propertiesではなく戻り値
  // そのものが値であることを実装前にkintoneドキュメントで確認済み)。対象は文字列1行フィールドの
  // みなので、typeで絞り込む(idea.md「対象フィールド」参照)。
  const formFields = await kintone.app.getFormFields();
  const singleLineTextFields = Object.values(formFields).filter(
    (f) => f.type === 'SINGLE_LINE_TEXT',
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildFieldOptions = (selectEl, selectedCode) => {
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(placeholderOptionEl);
    singleLineTextFields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const renderRuleList = () => {
    ruleListEl.innerHTML = '';
    config.rules.forEach((rule, ruleIndex) => {
      const fragment = ruleRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-rule-row');
      const fieldSelectEl = rowEl.querySelector('.js-rule-field');
      const removeEl = rowEl.querySelector('.js-rule-remove');
      const forbidCheckboxEls = Array.from(
        rowEl.querySelectorAll('.js-rule-forbid'),
      );

      buildFieldOptions(fieldSelectEl, rule.fieldCode);
      forbidCheckboxEls.forEach((checkboxEl) => {
        checkboxEl.checked = !!rule.forbid[checkboxEl.dataset.type];
        checkboxEl.addEventListener('change', () => {
          rule.forbid[checkboxEl.dataset.type] = checkboxEl.checked;
        });
      });

      fieldSelectEl.addEventListener('change', () => {
        rule.fieldCode = fieldSelectEl.value;
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
      fieldCode: '',
      forbid: {
        fullWidthHiragana: false,
        fullWidthKatakana: false,
        halfWidthKatakana: false,
        fullWidthAlnum: false,
        halfWidthAlnum: false,
        fullWidthSymbol: false,
        halfWidthSymbol: false,
      },
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
