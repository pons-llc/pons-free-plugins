(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.StatusArrow;

  const SOURCE_FIELD_TYPES = ['DROP_DOWN', 'RADIO_BUTTON'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const widgetListEl = document.getElementById('js-widget-list');
  const widgetAddButtonEl = document.getElementById('js-widget-add');
  const widgetRowTemplateEl = document.getElementById('js-widget-row-template');
  const stepRowTemplateEl = document.getElementById('js-step-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する。
  const formFields = await kintone.app.getFormFields();
  const sourceFields = Object.values(formFields).filter((f) =>
    SOURCE_FIELD_TYPES.includes(f.type),
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

  const renderWidgetList = () => {
    widgetListEl.innerHTML = '';
    config.widgets.forEach((widget, widgetIndex) => {
      const fragment = widgetRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-widget-row');
      const sourceTypeEl = rowEl.querySelector('.js-widget-source-type');
      const fieldRowEl = rowEl.querySelector('.js-widget-field-row');
      const fieldEl = rowEl.querySelector('.js-widget-field');
      const designEl = rowEl.querySelector('.js-widget-design');
      const removeEl = rowEl.querySelector('.js-widget-remove');
      const stepListEl = rowEl.querySelector('.js-step-list');
      const stepAddButtonEl = rowEl.querySelector('.js-step-add');

      const applySourceTypeVisibility = () => {
        fieldRowEl.style.display = widget.sourceType === 'FIELD' ? '' : 'none';
      };

      const renderStepList = () => {
        stepListEl.innerHTML = '';
        widget.steps.forEach((step, stepIndex) => {
          const stepFragment = stepRowTemplateEl.content.cloneNode(true);
          const valueEl = stepFragment.querySelector('.js-step-value');
          const removeStepEl = stepFragment.querySelector('.js-step-remove');

          valueEl.value = step;
          valueEl.addEventListener('input', () => {
            widget.steps[stepIndex] = valueEl.value;
          });
          removeStepEl.addEventListener('click', () => {
            widget.steps.splice(stepIndex, 1);
            renderStepList();
          });

          stepListEl.appendChild(stepFragment);
        });
      };

      sourceTypeEl.value = widget.sourceType;
      buildOptions(
        fieldEl,
        sourceFields,
        widget.fieldCode,
        '(選択してください)',
      );
      designEl.value = widget.design;
      applySourceTypeVisibility();
      renderStepList();

      sourceTypeEl.addEventListener('change', () => {
        widget.sourceType = sourceTypeEl.value;
        applySourceTypeVisibility();
      });
      fieldEl.addEventListener('change', () => {
        widget.fieldCode = fieldEl.value;
      });
      designEl.addEventListener('change', () => {
        widget.design = designEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.widgets.splice(widgetIndex, 1);
        renderWidgetList();
      });
      stepAddButtonEl.addEventListener('click', () => {
        widget.steps.push('');
        renderStepList();
      });

      widgetListEl.appendChild(fragment);
    });
  };
  renderWidgetList();

  widgetAddButtonEl.addEventListener('click', () => {
    config.widgets.push({
      sourceType: 'FIELD',
      fieldCode: '',
      steps: [],
      design: 'DEFAULT',
    });
    renderWidgetList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateWidgets(config.widgets);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードやステップ文字列)のみを
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
