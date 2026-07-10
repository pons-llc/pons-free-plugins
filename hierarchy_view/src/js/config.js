(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.HierarchyView;

  const KEY_FIELD_TYPES = ['SINGLE_LINE_TEXT', 'NUMBER'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const parentFieldEl = document.querySelector('.js-parent-field');
  const matchFieldEl = document.querySelector('.js-match-field');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する。
  const formFields = await kintone.app.getFormFields();
  const keyFields = Object.values(formFields).filter((f) =>
    KEY_FIELD_TYPES.includes(f.type),
  );
  // レコード番号(システム項目$id相当)は通常のフィールド一覧には含まれないため、
  // 固定の選択肢として別途用意する(idea.mdの「照合対象フィールド」参照)。
  const matchFieldCandidates = [
    { code: '$id', label: 'レコード番号($id)' },
    ...keyFields,
  ];

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

  buildOptions(
    parentFieldEl,
    keyFields,
    config.parentFieldCode,
    '(選択してください)',
  );
  buildOptions(
    matchFieldEl,
    matchFieldCandidates,
    config.matchFieldCode,
    '(選択してください)',
  );

  parentFieldEl.addEventListener('change', () => {
    config.parentFieldCode = parentFieldEl.value;
  });
  matchFieldEl.addEventListener('change', () => {
    config.matchFieldCode = matchFieldEl.value;
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateConfig(config);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果(フィールドコード)のみを表示しており、
      // 外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
