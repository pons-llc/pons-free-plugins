((PLUGIN_ID) => {
  'use strict';

  const NS = window.NotebooklmExport;
  const { load, toRawConfig } = NS.ConfigStore;
  const { extractRelatedAppIds } = NS.ExtractRelatedAppIds;
  const { traverseApps } = NS.TraverseApps;
  const { collectCustomizeFiles } = NS.CollectCustomizeFiles;
  const { buildAppResult } = NS.BuildAppResult;
  const { renderAppDocument } = NS.RenderAppDocument;
  const { renderMetadataDocument } = NS.RenderMetadataDocument;
  const { buildZip } = NS.BuildZip;

  const MAX_APPS = 30;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const downloadButtonEl = document.querySelector('.js-download-button');
  const errorsEl = document.getElementById('js-errors');
  const progressEl = document.getElementById('js-progress');
  const outputFormatEls = document.querySelectorAll('.js-output-format');

  if (!(
    formEl &&
    cancelButtonEl &&
    downloadButtonEl &&
    errorsEl &&
    progressEl &&
    outputFormatEls.length > 0
  )) {
    throw new Error('Required elements do not exist.');
  }

  const config = load(kintone.plugin.app.getConfig(PLUGIN_ID));
  outputFormatEls.forEach((el) => {
    el.checked = el.value === config.outputFormat;
  });

  const getSelectedOutputFormat = () => {
    const checked = Array.from(outputFormatEls).find((el) => el.checked);
    return checked ? checked.value : 'txt';
  };

  // 個々のREST呼び出しをtry/catchし、成功時は値を、失敗時はメッセージを返す
  // (部分的失敗を許容するオーケストレーション。idea.md「権限に関する重要な制約」参照)。
  const safeApiCall = async (url, params) => {
    try {
      return {
        value: await kintone.api(kintone.api.url(url, true), 'GET', params),
      };
    } catch (err) {
      const message =
        (err && err.message) ||
        (err && err.error && err.error.message) ||
        String(err);
      return { error: message };
    }
  };

  // ファイルダウンロード(GET /k/v1/file.json)はkintone.api()が「利用できないAPI」として
  // 明記しているため、fetch()を使う(宛先は常にkintone自身。idea.md参照)。
  const downloadFileText = async (fileKey) => {
    const resp = await fetch(
      `${kintone.api.url('/k/v1/file.json', true)}?fileKey=${encodeURIComponent(fileKey)}`,
      { method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    );
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return resp.text();
  };

  // 1アプリ分の設計情報(idea.md「取得する設計情報」の12項目 + アプリ基本情報)を取得する。
  // 各項目は個別にtry/catchされているため、この関数自体が例外を投げることはない
  // (関連アプリでアプリ管理権限が無い場合も、design.*Errorに記録して処理を継続する)。
  const fetchAppDesign = async (appId) => {
    const design = {};

    const appInfo = await safeApiCall('/k/v1/app.json', { id: appId });
    if (appInfo.error) {
      design.appInfoError = appInfo.error;
    } else {
      design.appInfo = appInfo.value;
    }

    const fields = await safeApiCall('/k/v1/preview/app/form/fields.json', {
      app: appId,
    });
    if (fields.error) {
      design.fieldsError = fields.error;
    } else {
      design.fields = fields.value.properties;
    }

    const settings = await safeApiCall('/k/v1/preview/app/settings.json', {
      app: appId,
    });
    if (settings.error) design.settingsError = settings.error;
    else design.settings = settings.value;

    const status = await safeApiCall('/k/v1/preview/app/status.json', {
      app: appId,
    });
    if (status.error) design.statusError = status.error;
    else design.status = status.value.states ? status.value : null;

    const customize = await safeApiCall('/k/v1/preview/app/customize.json', {
      app: appId,
    });
    if (customize.error) {
      design.customizeError = customize.error;
    } else {
      design.customize = customize.value;
      design.customizeFiles = await collectCustomizeFiles(
        customize.value,
        downloadFileText,
      );
    }

    const notificationsGeneral = await safeApiCall(
      '/k/v1/preview/app/notifications/general.json',
      { app: appId },
    );
    if (notificationsGeneral.error)
      design.notificationsGeneralError = notificationsGeneral.error;
    else design.notificationsGeneral = notificationsGeneral.value;

    const notificationsPerRecord = await safeApiCall(
      '/k/v1/preview/app/notifications/perRecord.json',
      { app: appId },
    );
    if (notificationsPerRecord.error)
      design.notificationsPerRecordError = notificationsPerRecord.error;
    else design.notificationsPerRecord = notificationsPerRecord.value;

    const notificationsReminder = await safeApiCall(
      '/k/v1/preview/app/notifications/reminder.json',
      { app: appId },
    );
    if (notificationsReminder.error)
      design.notificationsReminderError = notificationsReminder.error;
    else design.notificationsReminder = notificationsReminder.value;

    const acl = await safeApiCall('/k/v1/preview/app/acl.json', { app: appId });
    if (acl.error) design.aclError = acl.error;
    else design.acl = acl.value;

    const recordAcl = await safeApiCall('/k/v1/preview/record/acl.json', {
      app: appId,
    });
    if (recordAcl.error) design.recordAclError = recordAcl.error;
    else design.recordAcl = recordAcl.value;

    // フィールドのアクセス権のみ動作テスト環境のURLが存在しない(idea.md参照)。
    const fieldAcl = await safeApiCall('/k/v1/field/acl.json', { app: appId });
    if (fieldAcl.error) design.fieldAclError = fieldAcl.error;
    else design.fieldAcl = fieldAcl.value;

    const actions = await safeApiCall('/k/v1/preview/app/actions.json', {
      app: appId,
    });
    if (actions.error) design.actionsError = actions.error;
    else design.actions = actions.value;

    const plugins = await safeApiCall('/k/v1/preview/app/plugins.json', {
      app: appId,
    });
    if (plugins.error) design.pluginsError = plugins.error;
    else design.plugins = plugins.value;

    return design;
  };

  const triggerZipDownload = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchorEl = document.createElement('a');
    anchorEl.href = url;
    anchorEl.download = filename;
    document.body.appendChild(anchorEl);
    anchorEl.click();
    anchorEl.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const timestamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
  };

  const runDownload = async () => {
    const ext = getSelectedOutputFormat();
    errorsEl.textContent = '';
    downloadButtonEl.disabled = true;
    kintone.showLoading('VISIBLE');
    try {
      const rootAppId = String(kintone.app.getId());
      const traversal = await traverseApps({
        rootAppId,
        fetchAppDesign,
        extractRelatedAppIds,
        maxApps: MAX_APPS,
        onAppProcessed: (appId, count) => {
          progressEl.textContent = `処理中(${count}件目): アプリID ${appId}`;
        },
      });

      const appResults = traversal.apps.map((a) =>
        buildAppResult(a.appId, a.design || { appInfoError: a.error }),
      );

      const entries = [];
      appResults.forEach((appResult) => {
        entries.push({
          name: `app_${appResult.appId}.${ext}`,
          data: new TextEncoder().encode(renderAppDocument(appResult)),
        });
      });

      const nameByAppId = new Map(
        appResults.map((r) => [r.appId, r.appInfo && r.appInfo.name]),
      );
      const metadata = renderMetadataDocument({
        rootAppId,
        generatedAt: new Date().toISOString(),
        ext,
        apps: traversal.apps.map((a) => ({
          appId: a.appId,
          appInfo: { name: nameByAppId.get(a.appId) },
          error: a.error,
        })),
        edges: traversal.edges,
        skippedCap: traversal.skippedCap,
      });
      entries.unshift({
        name: `metadata.${ext}`,
        data: new TextEncoder().encode(metadata),
      });

      const zipBytes = buildZip(entries);
      triggerZipDownload(
        zipBytes,
        `design_export_app${rootAppId}_${timestamp()}.zip`,
      );
      progressEl.textContent = `完了しました(${appResults.length}件のアプリを処理)。`;
    } catch (err) {
      errorsEl.textContent = `ダウンロードに失敗しました: ${(err && err.message) || err}`;
    } finally {
      kintone.showLoading('HIDDEN');
      downloadButtonEl.disabled = false;
    }
  };

  downloadButtonEl.addEventListener('click', () => {
    runDownload();
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    kintone.plugin.app.setConfig(
      toRawConfig({ outputFormat: getSelectedOutputFormat() }),
      () => {
        window.location.href = '../../flow?app=' + kintone.app.getId();
      },
    );
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });
})(kintone.$PLUGIN_ID);
