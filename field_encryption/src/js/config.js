(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.FieldEncryption;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const targetFieldsEl = document.getElementById('js-target-fields');
  const spaceElementSelectEl = document.getElementById('js-space-element');
  const minLengthEl = document.getElementById('js-min-length');

  // kintone.app.getFormFields() はREST APIレスポンスのpropertiesと同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // {properties: {...}}のようにラップされない)。
  const formFields = await kintone.app.getFormFields();
  const eligibleFields = NS.FieldSelection.filterEligibleFields(formFields);

  // kintone.app.getFormLayout() も同様にREST APIレスポンスのlayoutと同様の値(配列そのもの)を
  // 解決する({layout: [...]}のようにラップされない)。GROUP内も再帰的に走査してSPACERの
  // elementIdを集める(org_lookup/src/js/config.jsのcollectSpaceElementIdsと同じパターン)。
  const collectSpaceElementIds = (layoutRows) => {
    const ids = [];
    (layoutRows || []).forEach((row) => {
      (row.fields || []).forEach((field) => {
        if (field.type === 'SPACER' && field.elementId) {
          ids.push(field.elementId);
        }
      });
      if (row.type === 'GROUP') {
        ids.push(...collectSpaceElementIds(row.layout));
      }
    });
    return ids;
  };
  const formLayout = await kintone.app.getFormLayout();
  const spaceElementIds = collectSpaceElementIds(formLayout);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const renderTargetFields = () => {
    targetFieldsEl.innerHTML = ''; // クリアのみ(挿入する内容は自前で組み立てた要素のみ)
    if (eligibleFields.length === 0) {
      const noneEl = document.createElement('p');
      noneEl.className = 'kintoneplugin-desc';
      noneEl.textContent =
        '文字列(1行)・文字列(複数行)フィールドがこのアプリにありません。';
      targetFieldsEl.appendChild(noneEl);
      return;
    }
    eligibleFields.forEach((field) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'fe-checkbox-item';

      const inputEl = document.createElement('input');
      inputEl.type = 'checkbox';
      inputEl.value = field.code;
      inputEl.checked = config.targetFields.includes(field.code);
      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          if (!config.targetFields.includes(field.code)) {
            config.targetFields.push(field.code);
          }
        } else {
          config.targetFields = config.targetFields.filter(
            (code) => code !== field.code,
          );
        }
      });

      labelEl.appendChild(inputEl);
      labelEl.appendChild(
        document.createTextNode(`${field.label} (${field.code})`),
      );
      targetFieldsEl.appendChild(labelEl);
    });
  };
  renderTargetFields();

  const renderSpaceOptions = () => {
    spaceElementSelectEl.innerHTML = '';
    const placeholderEl = document.createElement('option');
    placeholderEl.value = '';
    placeholderEl.textContent = '(選択してください)';
    spaceElementSelectEl.appendChild(placeholderEl);

    spaceElementIds.forEach((elementId) => {
      const optionEl = document.createElement('option');
      optionEl.value = elementId;
      optionEl.textContent = elementId;
      optionEl.selected = elementId === config.spaceElementId;
      spaceElementSelectEl.appendChild(optionEl);
    });
  };
  renderSpaceOptions();
  spaceElementSelectEl.addEventListener('change', () => {
    config.spaceElementId = spaceElementSelectEl.value;
  });

  minLengthEl.value = config.minPassphraseLength;
  minLengthEl.addEventListener('change', () => {
    config.minPassphraseLength =
      parseInt(minLengthEl.value, 10) ||
      NS.ConfigStore.DEFAULTS.minPassphraseLength;
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const errors = [];
    if (config.targetFields.length === 0) {
      errors.push('①暗号化対象フィールドを1つ以上選択してください。');
    }
    if (!config.spaceElementId) {
      errors.push(
        '②復号ボタンを設置するスペースフィールドを選択してください。',
      );
    }
    if (!(config.minPassphraseLength >= 1)) {
      errors.push('③パスフレーズの最小文字数は1以上を指定してください。');
    }
    if (errors.length > 0) {
      // アプリ管理者自身が選択した値の検証結果のみを表示しており外部入力ではないが、
      // 念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
