(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.ApprovalHistory;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const saveButtonEl = document.querySelector('.js-save-button');
  const errorsEl = document.getElementById('js-errors');
  const progressEl = document.getElementById('js-progress');
  const processWarningEl = document.getElementById('js-process-warning');
  const processStatusEl = document.getElementById('js-process-status');
  const tableStatusEl = document.getElementById('js-table-status');
  const fieldListEl = document.getElementById('js-field-list');
  const tableWarningEl = document.getElementById('js-table-warning');

  const appId = kintone.app.getId();

  // kintone.app.getFormFields()はREST APIレスポンスのpropertiesと同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴参照、
  // {properties: {...}}のようにラップされない)。プラグイン設定画面でも利用できるAPIであることを
  // ドキュメントで確認済み。
  const existingFields = await kintone.app.getFormFields();

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const renderProcessStatus = async () => {
    try {
      const status = await kintone.api(
        kintone.api.url('/k/v1/preview/app/status.json', true),
        'GET',
        { app: appId },
      );
      if (!status.enable) {
        processWarningEl.style.display = '';
      }
      processStatusEl.textContent = status.enable
        ? 'プロセス管理: 有効'
        : 'プロセス管理: 無効';
    } catch {
      // アプリ管理権限が無い場合など、確認自体に失敗しても保存はブロックしない。
      processStatusEl.textContent =
        'プロセス管理の状態を確認できませんでした。';
    }
  };

  const renderTableStatus = () => {
    const current = NS.ApprovalTableSpec.currentFieldCodes(
      existingFields,
      config.fieldCodes,
    );
    if (current) {
      tableStatusEl.textContent = `作成済みです(テーブル: ${current.table})。`;
      fieldListEl.textContent = `現在のステータス: ${current.statusBefore} / 次のステータス: ${current.statusAfter} / 実行ユーザー: ${current.executedBy} / 役職: ${current.executedByTitle} / 実行日時: ${current.executedAt}`;
      tableWarningEl.style.display = 'none';
      return;
    }
    tableStatusEl.textContent = '保存すると自動的に作成されます。';
    fieldListEl.textContent = '';
  };

  await renderProcessStatus();
  renderTableStatus();

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + appId + '/plugin/';
  });

  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    errorsEl.textContent = '';
    tableWarningEl.style.display = 'none';
    saveButtonEl.disabled = true;

    try {
      const spec = NS.ApprovalTableSpec.buildApprovalTableSpec(existingFields);

      if (spec.warnings.length > 0) {
        tableWarningEl.textContent = spec.warnings.join('\n');
        tableWarningEl.style.display = '';
      }

      if (spec.needsCreate) {
        progressEl.textContent = 'サブテーブルを作成しています...';
        await kintone.api(
          kintone.api.url('/k/v1/preview/app/form/fields.json', true),
          'POST',
          { app: appId, properties: spec.propertiesToAdd },
        );

        progressEl.textContent = 'アプリ設定を運用環境へ反映しています...';
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

      progressEl.textContent = '';
      config.fieldCodes = spec.fieldCodes;

      kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + appId;
      });
    } catch (err) {
      progressEl.textContent = '';
      errorsEl.textContent = `サブテーブルの作成・反映に失敗しました: ${err.message || err}`;
      saveButtonEl.disabled = false;
    }
  });
})(kintone.$PLUGIN_ID);
