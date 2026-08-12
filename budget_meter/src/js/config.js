(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.BudgetMeter;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const rowBodyEl = document.getElementById('js-row-body');
  const rowAddButtonEl = document.getElementById('js-row-add');
  const rowTemplateEl = document.getElementById('js-row-template');
  const allViewsGroupCodesEl = document.querySelector(
    '.js-all-views-group-codes',
  );

  const DEFAULT_WARNING_THRESHOLD_PCT = 80;
  const DEFAULT_DANGER_THRESHOLD_PCT = 100;

  // 全一覧(view)の設定を取得するJavaScript APIは無いため、REST APIで取得する
  // (idea.md「API仕様確認」参照。config画面は動作テスト環境の設定を編集する対象なのでpreviewを使う)。
  // 対象は表形式(LIST)の一覧のみに絞り込む(idea.md「対象範囲の制限」)。
  const fetchListViews = async () => {
    const resp = await kintone.api(
      kintone.api.url('/k/v1/preview/app/views.json', true),
      'GET',
      { app: kintone.app.getId(), lang: 'ja' },
    );
    return Object.values(resp.views)
      .filter((view) => view.type === 'LIST')
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((view) => ({ id: String(view.id), name: view.name }));
  };

  // kintone.app.getFormFields() はREST APIレスポンスの `properties` と同様の値を返す
  // (CLAUDE.md既知の落とし穴の通り、戻り値自体がその値でありプロパティ名でラップされない)。
  const formFields = await kintone.app.getFormFields();
  const targetFieldCandidates = NS.AggregatableFields.filterAggregatableFields(
    Object.values(formFields),
  );

  const listViews = await fetchListViews();

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildOptions = (selectEl, items, selectedValue, labelOf) => {
    selectEl.innerHTML = '';
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(blankOptionEl);
    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.value;
      optionEl.textContent = labelOf(item);
      optionEl.selected = item.value === selectedValue;
      selectEl.appendChild(optionEl);
    });
  };

  const renderRows = () => {
    rowBodyEl.innerHTML = '';
    config.rows.forEach((row, index) => {
      const fragment = rowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-row');
      const viewEl = rowEl.querySelector('.js-row-view');
      const fieldEl = rowEl.querySelector('.js-row-field');
      const budgetEl = rowEl.querySelector('.js-row-budget');
      const warningEl = rowEl.querySelector('.js-row-warning');
      const dangerEl = rowEl.querySelector('.js-row-danger');
      const labelEl = rowEl.querySelector('.js-row-label');
      const removeEl = rowEl.querySelector('.js-row-remove');

      buildOptions(
        viewEl,
        listViews.map((v) => ({ value: v.id, name: v.name })),
        row.viewId,
        (v) => v.name,
      );
      buildOptions(
        fieldEl,
        targetFieldCandidates.map((f) => ({ value: f.code, field: f })),
        row.targetFieldCode,
        (v) => `${v.field.label} (${v.field.code})`,
      );
      budgetEl.value = row.budget || '';
      warningEl.value =
        row.warningThresholdPct ?? DEFAULT_WARNING_THRESHOLD_PCT;
      dangerEl.value = row.dangerThresholdPct ?? DEFAULT_DANGER_THRESHOLD_PCT;
      labelEl.value = row.label || '';

      viewEl.addEventListener('change', () => {
        row.viewId = viewEl.value;
        const selected = listViews.find((v) => v.id === viewEl.value);
        row.viewName = selected ? selected.name : '';
      });
      fieldEl.addEventListener('change', () => {
        row.targetFieldCode = fieldEl.value;
      });
      budgetEl.addEventListener('input', () => {
        row.budget = budgetEl.value;
      });
      warningEl.addEventListener('input', () => {
        row.warningThresholdPct = warningEl.value;
      });
      dangerEl.addEventListener('input', () => {
        row.dangerThresholdPct = dangerEl.value;
      });
      labelEl.addEventListener('input', () => {
        row.label = labelEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.rows.splice(index, 1);
        renderRows();
      });

      rowBodyEl.appendChild(rowEl);
    });
  };
  renderRows();
  allViewsGroupCodesEl.value = (config.allViewsGroupCodes || []).join(', ');

  rowAddButtonEl.addEventListener('click', () => {
    config.rows.push({
      viewId: '',
      viewName: '',
      targetFieldCode: '',
      budget: '',
      warningThresholdPct: DEFAULT_WARNING_THRESHOLD_PCT,
      dangerThresholdPct: DEFAULT_DANGER_THRESHOLD_PCT,
      label: '',
    });
    renderRows();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    if (config.rows.length === 0) {
      alert('予算設定を1件以上追加してください。');
      return;
    }

    const allErrors = config.rows.flatMap((row, index) => {
      const errors = NS.RowValidator.validateRow({
        ...row,
        budget: Number(row.budget),
        warningThresholdPct: Number(row.warningThresholdPct),
        dangerThresholdPct: Number(row.dangerThresholdPct),
      });
      return errors.map((message) => `${index + 1}行目: ${message}`);
    });
    if (allErrors.length > 0) {
      alert(allErrors.join('\n'));
      return;
    }

    config.rows = config.rows.map((row) => ({
      ...row,
      budget: Number(row.budget),
      warningThresholdPct: Number(row.warningThresholdPct),
      dangerThresholdPct: Number(row.dangerThresholdPct),
    }));
    config.allViewsGroupCodes = allViewsGroupCodesEl.value
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
