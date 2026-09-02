(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.AutoLookup;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const lookupFieldListEl = document.getElementById('js-lookup-field-list');
  const subtableListEl = document.getElementById('js-subtable-list');
  const fieldTriggerRowTemplateEl = document.getElementById(
    'js-field-trigger-row-template',
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

  // フィールド(またはサブテーブル)ごとに発動タイミングを2つのチェックボックスで選ぶ。
  const renderFieldTriggerList = (containerEl, items) => {
    containerEl.innerHTML = '';
    items.forEach((item) => {
      const fragment = fieldTriggerRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-field-trigger-row');
      const labelEl = fragment.querySelector('.js-field-trigger-row-label');
      const createShowEl = fragment.querySelector('.js-trigger-create-show');
      const editShowEl = fragment.querySelector('.js-trigger-edit-show');

      rowEl.dataset.fieldCode = item.code;
      labelEl.textContent = `${item.label} (${item.code})`;

      const triggerEvents = config.fieldTriggers[item.code] || [];
      createShowEl.checked = triggerEvents.includes('create.show');
      editShowEl.checked = triggerEvents.includes('edit.show');

      containerEl.appendChild(fragment);
    });
  };

  renderFieldTriggerList(lookupFieldListEl, lookupFields);
  renderFieldTriggerList(subtableListEl, subtablesWithLookup);

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  const collectFieldTriggers = () => {
    const fieldTriggers = {};
    document.querySelectorAll('.js-field-trigger-row').forEach((rowEl) => {
      const triggerEvents = [];
      if (rowEl.querySelector('.js-trigger-create-show').checked) {
        triggerEvents.push('create.show');
      }
      if (rowEl.querySelector('.js-trigger-edit-show').checked) {
        triggerEvents.push('edit.show');
      }
      if (triggerEvents.length > 0) {
        fieldTriggers[rowEl.dataset.fieldCode] = triggerEvents;
      }
    });
    return fieldTriggers;
  };

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const fieldTriggers = collectFieldTriggers();
    const validation = NS.ConfigValidation.validateFieldTriggers(fieldTriggers);
    if (!validation.valid) {
      // チェックボックスの選択結果(フィールドコード・発動タイミング)のみを表示しており、外部からの
      // 入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(
      NS.ConfigStore.serialize({ fieldTriggers }),
      () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + kintone.app.getId();
      },
    );
  });
})(kintone.$PLUGIN_ID);
