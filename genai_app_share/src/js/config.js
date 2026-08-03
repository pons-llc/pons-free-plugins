(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.GenaiAppShare;
  const { load, serialize } = NS.ConfigStore;
  const { validate } = NS.ConfigValidation;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const htmlFieldEl = document.querySelector('.js-html-field');
  const cssFieldEl = document.querySelector('.js-css-field');
  const jsFieldEl = document.querySelector('.js-js-field');
  const executionModeEls = document.querySelectorAll('.js-execution-mode');
  const enableReactEl = document.querySelector('.js-enable-react');

  if (!(
    formEl &&
    cancelButtonEl &&
    errorsEl &&
    htmlFieldEl &&
    cssFieldEl &&
    jsFieldEl &&
    executionModeEls.length > 0 &&
    enableReactEl
  )) {
    throw new Error('Required elements do not exist.');
  }

  // kintone.app.getFormFields() は REST APIのレスポンスの `properties` と同様の値そのものを返す
  // (`{ properties: {...} }` のようにラップされない。CLAUDE.md開発方針1の既知の落とし穴を踏まえ確認済み)。
  const formFields = await kintone.app.getFormFields();
  const multiLineTextFields = Object.values(formFields).filter(
    (f) => f.type === 'MULTI_LINE_TEXT',
  );

  const config = load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildOptions = (selectEl, { required, selectedCode }) => {
    selectEl.innerHTML = '';
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = required
      ? '(選択してください)'
      : '(使用しない)';
    selectEl.appendChild(blankOptionEl);
    multiLineTextFields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  buildOptions(htmlFieldEl, {
    required: true,
    selectedCode: config.htmlFieldCode,
  });
  buildOptions(cssFieldEl, {
    required: false,
    selectedCode: config.cssFieldCode,
  });
  buildOptions(jsFieldEl, {
    required: false,
    selectedCode: config.jsFieldCode,
  });

  executionModeEls.forEach((el) => {
    el.checked = el.value === config.executionMode;
  });
  // async関数内でawaitをまたいで代入しているためのeslint誤検知(related_record_summary等の
  // 既存コードと同じ理由で無効化)。
  // eslint-disable-next-line require-atomic-updates
  enableReactEl.checked = config.enableReact;

  const getSelectedExecutionMode = () => {
    const checked = Array.from(executionModeEls).find((el) => el.checked);
    return checked ? checked.value : '';
  };

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const nextConfig = {
      htmlFieldCode: htmlFieldEl.value,
      cssFieldCode: cssFieldEl.value,
      jsFieldCode: jsFieldEl.value,
      executionMode: getSelectedExecutionMode(),
      enableReact: enableReactEl.checked,
    };

    const errors = validate(nextConfig);
    if (errors.length > 0) {
      errorsEl.textContent = errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(serialize(nextConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
