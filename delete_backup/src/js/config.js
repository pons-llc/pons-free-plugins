(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.DeleteBackup;

  const JSON_FIELD_TYPES = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  const ATTACHMENT_FIELD_TYPES = ['FILE'];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const modeZipEl = document.querySelector('.js-mode-zip');
  const modeArchiveEl = document.querySelector('.js-mode-archive');
  const archiveSectionEl = document.querySelector('.js-archive-section');
  const archiveAppIdEl = document.querySelector('.js-archive-app-id');
  const fetchFieldsButtonEl = document.querySelector('.js-fetch-fields');
  const fetchStatusEl = document.querySelector('.js-fetch-status');
  const jsonFieldEl = document.querySelector('.js-json-field');
  const attachmentFieldEl = document.querySelector('.js-attachment-field');

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const applyModeVisibility = () => {
    archiveSectionEl.hidden = config.mode !== 'archive';
  };

  const buildOptions = (selectEl, items, selectedCode) => {
    selectEl.innerHTML = '';
    const placeholderOptionEl = document.createElement('option');
    placeholderOptionEl.value = '';
    placeholderOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(placeholderOptionEl);
    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.code;
      optionEl.textContent = `${item.label} (${item.code})`;
      optionEl.selected = item.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  // アーカイブ先アプリはこのプラグインが動作しているアプリとは別アプリのため、
  // kintone.app.getFormFields()(現在開いているアプリにしか使えないJavaScript API)は使えない。
  // CLAUDE.md開発方針3に従い、kintone自身へのREST呼び出し(kintone.api())でフィールド一覧を取得する。
  const fetchArchiveAppFields = async () => {
    const appId = archiveAppIdEl.value;
    if (!appId || Number(appId) <= 0) {
      fetchStatusEl.textContent = 'アーカイブ先アプリIDを入力してください。';
      return;
    }
    fetchFieldsButtonEl.disabled = true;
    fetchStatusEl.textContent = '取得中...';
    try {
      const resp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET',
        { app: appId },
      );
      const fields = Object.values(resp.properties);
      const jsonFields = fields.filter((f) =>
        JSON_FIELD_TYPES.includes(f.type),
      );
      const attachmentFields = fields.filter((f) =>
        ATTACHMENT_FIELD_TYPES.includes(f.type),
      );
      buildOptions(jsonFieldEl, jsonFields, config.jsonFieldCode);
      buildOptions(
        attachmentFieldEl,
        attachmentFields,
        config.attachmentFieldCode,
      );
      jsonFieldEl.disabled = false;
      attachmentFieldEl.disabled = false;
      fetchStatusEl.textContent = `取得しました(文字列フィールド${jsonFields.length}件、添付ファイルフィールド${attachmentFields.length}件)。`;
    } catch (err) {
      fetchStatusEl.textContent = `フィールドの取得に失敗しました: ${
        (err && err.message) || err
      }`;
    } finally {
      fetchFieldsButtonEl.disabled = false;
    }
  };

  modeZipEl.checked = config.mode === 'zip';
  modeArchiveEl.checked = config.mode === 'archive';
  archiveAppIdEl.value = config.archiveAppId;
  applyModeVisibility();

  modeZipEl.addEventListener('change', () => {
    config.mode = 'zip';
    applyModeVisibility();
  });
  modeArchiveEl.addEventListener('change', () => {
    config.mode = 'archive';
    applyModeVisibility();
  });
  archiveAppIdEl.addEventListener('change', () => {
    config.archiveAppId = archiveAppIdEl.value;
  });
  fetchFieldsButtonEl.addEventListener('click', fetchArchiveAppFields);
  jsonFieldEl.addEventListener('change', () => {
    config.jsonFieldCode = jsonFieldEl.value;
  });
  attachmentFieldEl.addEventListener('change', () => {
    config.attachmentFieldCode = attachmentFieldEl.value;
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateConfig(config);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果のみを表示しており外部入力ではないが、
      // 念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
