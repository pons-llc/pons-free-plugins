(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.GeoCheckin;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const latSelectEl = document.getElementById('js-latitude-field');
  const lngSelectEl = document.getElementById('js-longitude-field');
  const showMapEl = document.getElementById('js-show-map');
  const errorsEl = document.getElementById('js-errors');
  const noNumberWarningEl = document.getElementById('js-no-number-warning');

  if (!(
    formEl &&
    cancelButtonEl &&
    latSelectEl &&
    lngSelectEl &&
    showMapEl &&
    errorsEl &&
    noNumberWarningEl
  )) {
    throw new Error('Required elements do not exist.');
  }

  // kintone.app.getFormFields() は REST APIのレスポンスではなく、その`properties`プロパティと
  // 同様の値(フィールドコードをキーにしたオブジェクトそのもの)を解決する。テーブル内のフィールドは
  // 各SUBTABLEエントリの`.fields`に入れ子で入っており、このObject.keys()の対象には含まれないため、
  // 自然にテーブル内の数値フィールドを除外できる(緯度・経度はテーブル外のフィールドのみを想定)。
  const fields = await kintone.app.getFormFields();
  const numberFieldCodes = Object.keys(fields).filter(
    (code) => fields[code].type === 'NUMBER',
  );

  if (numberFieldCodes.length === 0) {
    noNumberWarningEl.style.display = 'block';
  }

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildSelectOptions = (selectEl, values, selectedValue) => {
    selectEl.innerHTML = '';
    const emptyOptionEl = document.createElement('option');
    emptyOptionEl.value = '';
    emptyOptionEl.textContent =
      values.length === 0
        ? '(数値フィールドがありません)'
        : '(選択してください)';
    selectEl.appendChild(emptyOptionEl);
    values.forEach((value) => {
      const optionEl = document.createElement('option');
      optionEl.value = value;
      optionEl.textContent = value;
      optionEl.selected = value === selectedValue;
      selectEl.appendChild(optionEl);
    });
  };

  buildSelectOptions(latSelectEl, numberFieldCodes, config.latitudeFieldCode);
  buildSelectOptions(lngSelectEl, numberFieldCodes, config.longitudeFieldCode);
  // async関数内でawaitをまたいで代入しているためのeslint誤検知(genai_app_share/related_record_summary
  // 等の既存コードと同じ理由で無効化)。
  // eslint-disable-next-line require-atomic-updates
  showMapEl.checked = config.showMap;

  const fieldInfoByCode = {};
  numberFieldCodes.forEach((code) => {
    fieldInfoByCode[code] = fields[code];
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const newConfig = {
      latitudeFieldCode: latSelectEl.value,
      longitudeFieldCode: lngSelectEl.value,
      showMap: showMapEl.checked,
    };

    const result = NS.ConfigValidation.validateConfig(
      newConfig,
      fieldInfoByCode,
    );
    if (!result.valid) {
      errorsEl.textContent = result.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(newConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });
})(kintone.$PLUGIN_ID);
