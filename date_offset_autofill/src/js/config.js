(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.DateOffsetAutofill;

  const DATE_FIELD_TYPES = ['DATE', 'DATETIME'];
  const NUMERIC_CALC_FORMATS = ['NUMBER', 'NUMBER_DIGIT'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴、
  // {properties: {...}}のようにラップされない。text_slice/org_lookupと同じ確認方法)。
  const formFields = await kintone.app.getFormFields();
  const dateFields = Object.values(formFields).filter((f) =>
    DATE_FIELD_TYPES.includes(f.type),
  );
  const offsetFields = Object.values(formFields).filter(
    (f) =>
      f.type === 'NUMBER' ||
      (f.type === 'CALC' && NUMERIC_CALC_FORMATS.includes(f.format)),
  );
  const fieldInfoByCode = {};
  Object.keys(formFields).forEach((code) => {
    fieldInfoByCode[code] = formFields[code];
  });

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
      const baseEl = rowEl.querySelector('.js-rule-base');
      const unitEl = rowEl.querySelector('.js-rule-unit');
      const sourceFixedEl = rowEl.querySelector('.js-rule-source-fixed');
      const sourceFieldEl = rowEl.querySelector('.js-rule-source-field');
      const fixedRowEl = rowEl.querySelector('.js-rule-fixed-row');
      const fixedValueEl = rowEl.querySelector('.js-rule-fixed-value');
      const offsetFieldRowEl = rowEl.querySelector('.js-rule-offset-field-row');
      const offsetFieldEl = rowEl.querySelector('.js-rule-offset-field');
      const calcCautionEl = rowEl.querySelector('.js-rule-calc-caution');
      const targetEl = rowEl.querySelector('.js-rule-target');
      const removeEl = rowEl.querySelector('.js-rule-remove');

      const applySourceVisibility = () => {
        const isFixed = rule.offsetSource === 'FIXED';
        fixedRowEl.style.display = isFixed ? '' : 'none';
        offsetFieldRowEl.style.display = isFixed ? 'none' : '';
      };

      // オフセット参照フィールドが計算(CALC)フィールドの場合、一覧画面のインライン編集では
      // 再計算されない(desktop.jsのisUnreliableInlineEditOffsetによりスキップされる)ため、
      // 同じ判定関数を使って設定画面にもその旨のcautionを表示する(idea.md「一覧インライン編集
      // 固有の注意点」参照)。
      const applyCalcCautionVisibility = () => {
        const offsetFieldInfo = fieldInfoByCode[rule.offsetFieldCode];
        const isUnreliable = NS.OffsetCalculator.isUnreliableInlineEditOffset(
          rule,
          offsetFieldInfo && offsetFieldInfo.type,
        );
        calcCautionEl.hidden = !isUnreliable;
      };

      buildOptions(
        baseEl,
        dateFields,
        rule.baseFieldCode,
        '(選択してください)',
      );
      unitEl.value = rule.unit || 'DAYS';
      sourceFixedEl.checked = rule.offsetSource === 'FIXED';
      sourceFieldEl.checked = rule.offsetSource === 'FIELD';
      fixedValueEl.value =
        rule.fixedValue === null || rule.fixedValue === undefined
          ? ''
          : rule.fixedValue;
      buildOptions(
        offsetFieldEl,
        offsetFields,
        rule.offsetFieldCode,
        '(選択してください)',
      );
      buildOptions(
        targetEl,
        dateFields,
        rule.targetFieldCode,
        '(選択してください)',
      );
      applySourceVisibility();
      applyCalcCautionVisibility();

      baseEl.addEventListener('change', () => {
        rule.baseFieldCode = baseEl.value;
      });
      unitEl.addEventListener('change', () => {
        rule.unit = unitEl.value;
      });
      sourceFixedEl.addEventListener('change', () => {
        if (sourceFixedEl.checked) {
          rule.offsetSource = 'FIXED';
          applySourceVisibility();
          applyCalcCautionVisibility();
        }
      });
      sourceFieldEl.addEventListener('change', () => {
        if (sourceFieldEl.checked) {
          rule.offsetSource = 'FIELD';
          applySourceVisibility();
          applyCalcCautionVisibility();
        }
      });
      fixedValueEl.addEventListener('input', () => {
        rule.fixedValue =
          fixedValueEl.value === '' ? null : parseFloat(fixedValueEl.value);
      });
      offsetFieldEl.addEventListener('change', () => {
        rule.offsetFieldCode = offsetFieldEl.value;
        applyCalcCautionVisibility();
      });
      targetEl.addEventListener('change', () => {
        rule.targetFieldCode = targetEl.value;
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
      baseFieldCode: '',
      unit: 'DAYS',
      offsetSource: 'FIXED',
      fixedValue: null,
      offsetFieldCode: '',
      targetFieldCode: '',
    });
    renderRuleList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateRules(
      config.rules,
      fieldInfoByCode,
    );
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや数値)のみを
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
