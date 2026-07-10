(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.AutoLookup;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const lookupFieldListEl = document.getElementById('js-lookup-field-list');
  const subtableListEl = document.getElementById('js-subtable-list');
  const checkboxItemTemplateEl = document.getElementById(
    'js-checkbox-item-template',
  );

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト。ルックアップフィールドはlookupプロパティを持つ)を
  // 解決する。
  const formFields = await kintone.app.getFormFields();
  const lookupFields = Object.values(formFields).filter((f) => f.lookup);
  const subtablesWithLookup = Object.values(formFields).filter(
    (f) =>
      f.type === 'SUBTABLE' && Object.values(f.fields).some((c) => c.lookup),
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const selected = new Set(config.targetFieldCodes);

  const renderCheckboxList = (containerEl, items) => {
    containerEl.innerHTML = '';
    items.forEach((item) => {
      const fragment = checkboxItemTemplateEl.content.cloneNode(true);
      const inputEl = fragment.querySelector('.js-checkbox-input');
      const labelEl = fragment.querySelector('.js-checkbox-label');

      inputEl.checked = selected.has(item.code);
      labelEl.textContent = `${item.label} (${item.code})`;

      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          selected.add(item.code);
        } else {
          selected.delete(item.code);
        }
      });

      containerEl.appendChild(fragment);
    });
  };

  renderCheckboxList(lookupFieldListEl, lookupFields);
  renderCheckboxList(subtableListEl, subtablesWithLookup);

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const targetFieldCodes = Array.from(selected);
    const validation =
      NS.ConfigValidation.validateTargetFieldCodes(targetFieldCodes);
    if (!validation.valid) {
      // チェックボックスの選択結果(フィールドコード)のみを表示しており、外部からの入力ではないが、
      // 念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(
      NS.ConfigStore.serialize({ targetFieldCodes }),
      () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + kintone.app.getId();
      },
    );
  });
})(kintone.$PLUGIN_ID);
