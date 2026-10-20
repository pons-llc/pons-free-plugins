(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.Genogram;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const jsonFieldEl = document.getElementById('js-json-field');
  const spaceEl = document.getElementById('js-space');
  const hideJsonEl = document.getElementById('js-hide-json');
  const errorsEl = document.getElementById('js-errors');
  const noTextWarningEl = document.getElementById('js-no-text-warning');
  const noSpaceWarningEl = document.getElementById('js-no-space-warning');

  // kintone.app.getFormFields()はREST APIレスポンスのpropertiesと同様の値(フィールドコードをキーにした
  // 平坦なオブジェクト)、kintone.app.getFormLayout()はlayoutと同様の値(レイアウト配列そのもの)を解決する
  // (どちらも{properties}/{layout}でラップされない。CLAUDE.mdの既知の落とし穴、kintone_doc MCPで確認済み)。
  const [fields, layout] = await Promise.all([
    kintone.app.getFormFields(),
    kintone.app.getFormLayout(),
  ]);
  const { textFields, spaces } = NS.ConfigStore.listCandidates(fields, layout);
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const fillSelect = (selectEl, entries, selected) => {
    selectEl.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '(選択してください)';
    selectEl.appendChild(placeholder);
    entries.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      selectEl.appendChild(option);
    });
    // 保存済みの値が今のフォームに無い(削除された)場合は未選択に戻す
    selectEl.value = entries.some(([value]) => value === selected)
      ? selected
      : '';
  };

  fillSelect(
    jsonFieldEl,
    textFields.map((f) => [f.code, `${f.label}(${f.code})`]),
    config.jsonField,
  );
  fillSelect(
    spaceEl,
    spaces.map((id) => [id, id]),
    config.spaceId,
  );
  hideJsonEl.checked = config.hideJsonField;
  noTextWarningEl.hidden = textFields.length > 0;
  noSpaceWarningEl.hidden = spaces.length > 0;

  const showError = (message) => {
    errorsEl.textContent = message;
    errorsEl.hidden = !message;
  };

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const next = {
      jsonField: jsonFieldEl.value,
      spaceId: spaceEl.value,
      hideJsonField: hideJsonEl.checked,
    };
    const errors = [];
    if (!next.jsonField) {
      errors.push('データを保存するフィールドを選択してください。');
    }
    if (!next.spaceId) {
      errors.push('図を表示するスペースフィールドを選択してください。');
    }
    if (errors.length > 0) {
      showError(errors.join('\n'));
      window.scrollTo(0, 0);
      return;
    }
    showError('');
    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(next), () => {
      window.alert('設定を保存しました。アプリを更新すると反映されます。');
      window.location.href = `../../flow?app=${kintone.app.getId()}`;
    });
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = `../../${kintone.app.getId()}/plugin/`;
  });
})(kintone.$PLUGIN_ID);
