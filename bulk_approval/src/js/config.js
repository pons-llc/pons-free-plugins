(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.BulkApproval;

  const displayFieldsEl = document.querySelector('.js-display-fields');
  const groupCodesEl = document.querySelector('.js-group-codes');
  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');

  if (!(formEl && cancelButtonEl && displayFieldsEl && groupCodesEl)) {
    throw new Error('Required elements do not exist.');
  }

  // kintone.app.getFormFields() はREST APIレスポンスのpropertiesプロパティと同様の値
  // (フィールドコードをキーとするオブジェクト)を直接解決する。{ properties: {...} } のように
  // ラップされて返るわけではない(CLAUDE.md「既知の落とし穴」参照、確認済み)。
  const formFields = await kintone.app.getFormFields();
  const eligibleFields =
    NS.DisplayFieldEligibility.listEligibleFields(formFields);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const checkboxes = [];
  const buildDisplayFieldCheckboxes = () => {
    displayFieldsEl.textContent = '';
    if (eligibleFields.length === 0) {
      const noteEl = document.createElement('p');
      noteEl.className = 'bap-empty-note';
      noteEl.textContent = '(表示できるフィールドがありません)';
      displayFieldsEl.appendChild(noteEl);
      return;
    }
    eligibleFields.forEach((field) => {
      const label = document.createElement('label');
      label.className = 'bap-checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = field.code;
      checkbox.checked = config.displayFieldCodes.includes(field.code);
      checkboxes.push(checkbox);

      label.appendChild(checkbox);
      label.appendChild(
        document.createTextNode(`${field.label} (${field.code})`),
      );
      displayFieldsEl.appendChild(label);
    });
  };
  buildDisplayFieldCheckboxes();

  // groupCodesElはトップレベルのconstであり、await後に再代入され得ないため
  // require-atomic-updatesは誤検知。
  // eslint-disable-next-line require-atomic-updates
  groupCodesEl.value = (config.groupCodes || []).join(', ');

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const nextConfig = {
      displayFieldCodes: checkboxes
        .filter((cb) => cb.checked)
        .map((cb) => cb.value),
      groupCodes: groupCodesEl.value
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    };

    const errors = NS.ConfigValidation.validate(nextConfig);
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(nextConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
