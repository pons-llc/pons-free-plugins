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

  // kintone.app.getStatus()(JavaScript API)は「利用できる画面」にプラグイン設定画面が
  // 含まれておらず(レコード一覧・追加・編集・詳細・グラフ画面のみ)、設定画面から呼ぶと
  // "kintone.app.getStatus is not a function" になることを実機で確認した。そのため設定画面では
  // REST API(`GET /k/v1/app/status.json`)をkintone.api()経由で呼ぶ
  // (CLAUDE.md開発方針3: JavaScript APIで実現できない場合のみRESTを使い、kintone自身への呼び出しは
  // 生のfetch/XHRではなくkintone.api()を使う)。レスポンスはREST APIドキュメントどおり
  // { enable, states, actions, revision } で返る。プロセス管理を一度も設定していないアプリでは
  // statesがnullになる。
  const processManagement = await kintone.api(
    kintone.api.url('/k/v1/app/status.json', true),
    'GET',
    { app: kintone.app.getId() },
  );
  const statusStepValues = processManagement.states
    ? Object.keys(processManagement.states).sort(
        (a, b) =>
          Number(processManagement.states[a].index) -
          Number(processManagement.states[b].index),
      )
    : [];

  // 対象フィールドの選択肢(値)を、選択肢の並び順(index昇順)で返す。
  const getFieldStepValues = (fieldCode) => {
    const field = sourceFields.find((f) => f.code === fieldCode);
    if (!field || !field.options) {
      return [];
    }
    return Object.keys(field.options).sort(
      (a, b) => Number(field.options[a].index) - Number(field.options[b].index),
    );
  };

  const getStepValues = (widget) =>
    widget.sourceType === 'STATUS'
      ? statusStepValues
      : getFieldStepValues(widget.fieldCode);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildOptions = (
    selectEl,
    items,
    selectedCode,
    placeholder,
    showCode = true,
  ) => {
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
      optionEl.textContent =
        showCode && item.label !== item.code
          ? `${item.label} (${item.code})`
          : item.label;
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
        const stepValues = getStepValues(widget);
        const stepItems = stepValues.map((value) => ({
          code: value,
          label: value,
        }));

        widget.steps.forEach((step, stepIndex) => {
          const stepFragment = stepRowTemplateEl.content.cloneNode(true);
          const valueEl = stepFragment.querySelector('.js-step-value');
          const removeStepEl = stepFragment.querySelector('.js-step-remove');

          // 対象フィールド変更後などで現在の選択肢に含まれない値は、選択肢の先頭に
          // 「選択肢に存在しません」と表示して残す(保存時のバリデーションで気づけるようにするため、
          // 黙って値を消さない)。
          const items =
            step && !stepValues.includes(step)
              ? [
                  { code: step, label: `${step}(選択肢に存在しません)` },
                  ...stepItems,
                ]
              : stepItems;
          buildOptions(valueEl, items, step, '(選択してください)', false);

          valueEl.addEventListener('change', () => {
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
        renderStepList();
      });
      fieldEl.addEventListener('change', () => {
        widget.fieldCode = fieldEl.value;
        renderStepList();
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
