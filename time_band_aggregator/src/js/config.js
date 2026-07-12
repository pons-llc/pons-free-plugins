(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.TimeBandAggregator;

  // 変換元フィールドはDATETIME(日時)・TIME(時刻)のみ選択可能(idea.md「機能概要」)。
  const SOURCE_FIELD_TYPES = ['DATETIME', 'TIME'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const saveButtonEl = document.querySelector('.js-save-button');
  const errorsEl = document.getElementById('js-errors');
  const statusEl = document.getElementById('js-status');
  const rowListEl = document.getElementById('js-row-list');
  const rowAddButtonEl = document.getElementById('js-row-add');
  const rowTemplateEl = document.getElementById('js-row-template');
  const triggerChangeEl = document.querySelector('.js-trigger-change');
  const triggerSubmitEl = document.querySelector('.js-trigger-submit');
  const bulkEnabledEl = document.querySelector('.js-bulk-enabled');
  const bulkGroupCodesEl = document.querySelector('.js-bulk-group-codes');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // {properties: {...}}のようにラップされない)。プラグイン設定画面でも利用できるAPIであることを
  // ドキュメントで確認済み。
  const formFields = await kintone.app.getFormFields();
  const sourceFields = Object.values(formFields).filter((f) =>
    SOURCE_FIELD_TYPES.includes(f.type),
  );
  const fieldInfoByCode = {};
  const fieldLabelByCode = {};
  Object.values(formFields).forEach((f) => {
    fieldInfoByCode[f.code] = { type: f.type };
    fieldLabelByCode[f.code] = f.label;
  });

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

  const renderCreatedFieldsNote = (createdFieldsEl, row) => {
    if (row.dropdownFieldCode && row.numberFieldCode) {
      createdFieldsEl.textContent = `ドロップダウン: ${row.dropdownFieldCode} / 数値: ${row.numberFieldCode}`;
    } else {
      createdFieldsEl.textContent = '(保存時に自動作成されます)';
    }
  };

  const renderRowList = () => {
    rowListEl.innerHTML = '';
    config.rows.forEach((row, rowIndex) => {
      const fragment = rowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-row');
      const sourceFieldEl = rowEl.querySelector('.js-source-field');
      const bandWidthEl = rowEl.querySelector('.js-band-width');
      const createdFieldsEl = rowEl.querySelector('.js-created-fields');
      const removeEl = rowEl.querySelector('.js-row-remove');

      buildOptions(
        sourceFieldEl,
        sourceFields,
        row.sourceFieldCode,
        '(選択してください)',
      );
      bandWidthEl.value = String(row.bandWidthMinutes || 60);
      renderCreatedFieldsNote(createdFieldsEl, row);

      sourceFieldEl.addEventListener('change', () => {
        row.sourceFieldCode = sourceFieldEl.value;
        // 変換元フィールドを変えたら、以前の保存時に決まったフィールドコードは無効になる。
        row.dropdownFieldCode = '';
        row.numberFieldCode = '';
        renderCreatedFieldsNote(createdFieldsEl, row);
      });
      bandWidthEl.addEventListener('change', () => {
        row.bandWidthMinutes = Number(bandWidthEl.value);
      });
      removeEl.addEventListener('click', () => {
        config.rows.splice(rowIndex, 1);
        renderRowList();
      });

      rowListEl.appendChild(fragment);
    });
  };
  renderRowList();

  rowAddButtonEl.addEventListener('click', () => {
    config.rows.push({
      sourceFieldCode: '',
      bandWidthMinutes: 60,
      dropdownFieldCode: '',
      numberFieldCode: '',
    });
    renderRowList();
  });

  triggerChangeEl.checked = config.trigger === 'CHANGE';
  triggerSubmitEl.checked = config.trigger === 'SUBMIT';
  triggerChangeEl.addEventListener('change', () => {
    if (triggerChangeEl.checked) {
      config.trigger = 'CHANGE';
    }
  });
  triggerSubmitEl.addEventListener('change', () => {
    if (triggerSubmitEl.checked) {
      config.trigger = 'SUBMIT';
    }
  });

  bulkEnabledEl.checked = !!config.bulkEnabled;
  bulkGroupCodesEl.value = (config.bulkGroupCodes || []).join(', ');
  bulkGroupCodesEl.disabled = !bulkEnabledEl.checked;
  bulkEnabledEl.addEventListener('change', () => {
    config.bulkEnabled = bulkEnabledEl.checked;
    bulkGroupCodesEl.disabled = !bulkEnabledEl.checked;
  });
  bulkGroupCodesEl.addEventListener('change', () => {
    config.bulkGroupCodes = NS.GroupPermission.parseGroupCodesInput(
      bulkGroupCodesEl.value,
    );
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  const collectErrors = () => {
    const errors = [];
    errors.push(
      ...NS.ConfigValidation.validateRows(config.rows, fieldInfoByCode).errors,
    );
    if (!NS.ConfigValidation.validateTrigger(config.trigger)) {
      errors.push('発動タイミングを選択してください。');
    }
    errors.push(
      ...NS.ConfigValidation.validateBulkGroupCodes(
        config.bulkEnabled,
        config.bulkGroupCodes,
      ).errors,
    );
    return errors;
  };

  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errors = collectErrors();
    if (errors.length > 0) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果のみを表示しており外部入力ではないが、
      // 念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    const { resolvedRows, propertiesToAdd, warnings } =
      NS.FieldSpecBuilder.buildFieldSpecs(config.rows, {
        existingFields: fieldInfoByCode,
        fieldLabelByCode,
      });

    if (warnings.length > 0) {
      const proceed = window.confirm(
        `${warnings.join('\n')}\n\nこの内容で保存を続行しますか?`,
      );
      if (!proceed) {
        return;
      }
    }

    saveButtonEl.disabled = true;
    const appId = kintone.app.getId();

    try {
      if (Object.keys(propertiesToAdd).length > 0) {
        statusEl.textContent = 'フィールドを追加しています...';
        await kintone.api(
          kintone.api.url('/k/v1/preview/app/form/fields.json', true),
          'POST',
          { app: appId, properties: propertiesToAdd },
        );

        statusEl.textContent = 'アプリ設定を運用環境へ反映しています...';
        await kintone.api(
          kintone.api.url('/k/v1/preview/app/deploy.json', true),
          'POST',
          { apps: [{ app: appId }] },
        );

        await NS.DeployPoller.waitForDeploy(appId, {
          getStatus: async () => {
            const resp = await kintone.api(
              kintone.api.url('/k/v1/preview/app/deploy.json', true),
              'GET',
              { apps: [appId] },
            );
            return resp.apps;
          },
          wait: waitMs,
        });
      }

      // configはこの関数の外で再代入されないためrequire-atomic-updatesは誤検知。
      // eslint-disable-next-line require-atomic-updates
      config.rows = resolvedRows;
      statusEl.textContent = '';

      kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + appId;
      });
    } catch (err) {
      statusEl.textContent = '';
      errorsEl.textContent = `フィールドの作成・反映に失敗しました: ${err.message || err}`;
      saveButtonEl.disabled = false;
    }
  });
})(kintone.$PLUGIN_ID);
