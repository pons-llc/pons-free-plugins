(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.BulkFieldUpdate;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const fieldBodyEl = document.getElementById('js-field-body');
  const noFieldsWarningEl = document.getElementById('js-no-fields-warning');
  const groupCodesEl = document.querySelector('.js-group-codes');

  if (!(
    formEl &&
    cancelButtonEl &&
    fieldBodyEl &&
    noFieldsWarningEl &&
    groupCodesEl
  )) {
    throw new Error('Required elements do not exist.');
  }

  const TYPE_LABELS = {
    SINGLE_LINE_TEXT: '文字列(1行)',
    MULTI_LINE_TEXT: '文字列(複数行)',
    RICH_TEXT: 'リッチエディター',
    NUMBER: '数値',
    CHECK_BOX: 'チェックボックス',
    RADIO_BUTTON: 'ラジオボタン',
    MULTI_SELECT: '複数選択',
    DROP_DOWN: 'ドロップダウン',
    DATE: '日付',
    TIME: '時刻',
    DATETIME: '日時',
    LINK: 'リンク',
  };

  // kintone.app.getFormFields() はREST APIレスポンスのpropertiesプロパティと同様の値
  // (フィールドコードをキーとするオブジェクト)を直接解決する。{ properties: {...} } のように
  // ラップされて返るわけではない(CLAUDE.md「既知の落とし穴」参照、確認済み)。
  const formFields = await kintone.app.getFormFields();
  const eligibleFields = NS.FieldEligibility.listEligibleFields(formFields);

  if (eligibleFields.length === 0) {
    noFieldsWarningEl.style.display = 'block';
  }

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const savedFieldCodes = new Set(config.targetFieldCodes);

  const enabledCheckboxes = {};

  const renderRows = () => {
    fieldBodyEl.innerHTML = '';
    eligibleFields.forEach((field) => {
      const rowEl = document.createElement('tr');
      rowEl.className = 'js-row';

      const enabledCellEl = document.createElement('td');
      const enabledCheckboxEl = document.createElement('input');
      enabledCheckboxEl.type = 'checkbox';
      enabledCheckboxEl.className = 'js-row-enabled';
      enabledCheckboxEl.checked = savedFieldCodes.has(field.code);
      enabledCheckboxes[field.code] = enabledCheckboxEl;
      enabledCellEl.appendChild(enabledCheckboxEl);
      rowEl.appendChild(enabledCellEl);

      const labelCellEl = document.createElement('td');
      labelCellEl.textContent = `${field.label} (${field.code})`;
      if (field.required) {
        const requireEl = document.createElement('span');
        requireEl.className = 'kintoneplugin-require';
        requireEl.textContent = '必須';
        labelCellEl.appendChild(document.createTextNode(' '));
        labelCellEl.appendChild(requireEl);
      }
      rowEl.appendChild(labelCellEl);

      const typeCellEl = document.createElement('td');
      const baseTypeLabel = TYPE_LABELS[field.type] || field.type;
      // ルックアップフィールドはfield.typeがコピー元フィールドの型(文字列1行/数値/リンク)に
      // なっており、種類欄だけでは通常のフィールドと見分けが付かない。一括更新の対象にすると
      // 値の入力欄が出ず「現在の値のまま更新(関連レコードを再取得)」という特別な動作になるため、
      // 「ルックアップ」であることが分かるように表示する(idea.md「ルックアップフィールドの再取得」)。
      typeCellEl.textContent = field.lookup
        ? `ルックアップ・${baseTypeLabel}`
        : baseTypeLabel;
      rowEl.appendChild(typeCellEl);

      fieldBodyEl.appendChild(rowEl);
    });
  };
  renderRows();

  // groupCodesElはトップレベルのconstであり、await後に再代入され得ないため
  // require-atomic-updatesは誤検知。
  // eslint-disable-next-line require-atomic-updates
  groupCodesEl.value = (config.groupCodes || []).join(', ');

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const targetFieldCodes = eligibleFields
      .filter((field) => enabledCheckboxes[field.code].checked)
      .map((field) => field.code);

    const nextConfig = {
      targetFieldCodes,
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
