(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.AgeGradeFieldUpdate;

  const targetFieldEl = document.querySelector('.js-target-field');
  const queryEl = document.querySelector('.js-query');
  const groupCodesEl = document.querySelector('.js-group-codes');
  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');

  if (!(formEl && cancelButtonEl && targetFieldEl && queryEl && groupCodesEl)) {
    throw new Error('Required elements do not exist.');
  }

  // kintone.app.getFormFields() はREST APIレスポンスのpropertiesプロパティと
  // 同様の値(フィールドコードをキーとするオブジェクト)を直接解決する。
  // { properties: {...} } のようにラップされて返るわけではない(CLAUDE.md「既知の落とし穴」参照、
  // 確認済み)。
  const formFields = await kintone.app.getFormFields();
  const dateFields = Object.values(formFields).filter(
    (field) => field.type === 'DATE' || field.type === 'DATETIME',
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildTargetFieldOptions = () => {
    targetFieldEl.innerHTML = '';
    if (dateFields.length === 0) {
      const optionEl = document.createElement('option');
      optionEl.value = '';
      optionEl.textContent = '(DATE/DATETIME型のフィールドがありません)';
      targetFieldEl.appendChild(optionEl);
      targetFieldEl.disabled = true;
      return;
    }
    targetFieldEl.disabled = false;
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(選択してください)';
    targetFieldEl.appendChild(blankOptionEl);
    dateFields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === config.targetFieldCode;
      targetFieldEl.appendChild(optionEl);
    });
  };
  buildTargetFieldOptions();

  // queryEl/groupCodesElはトップレベルのconstであり、await後に再代入され得ないため
  // require-atomic-updatesは誤検知。
  // eslint-disable-next-line require-atomic-updates
  queryEl.value = config.query || '';
  // eslint-disable-next-line require-atomic-updates
  groupCodesEl.value = (config.groupCodes || []).join(', ');

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const nextConfig = {
      targetFieldCode: targetFieldEl.value,
      query: queryEl.value,
      groupCodes: groupCodesEl.value
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    };

    const { valid, errors } = NS.ConfigValidation.validateConfig(nextConfig);
    if (!valid) {
      alert(errors.join('\n'));
      return;
    }

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(nextConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
