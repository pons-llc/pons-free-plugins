((PLUGIN_ID) => {
  'use strict';

  const NS = window.AppSettingsRequest;
  const appId = kintone.app.getId();

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const saveButtonEl = document.querySelector(
    '.kintoneplugin-button-dialog-ok',
  );
  const completeStatusEl = document.querySelector('.js-complete-status');
  const fieldStatusEl = document.getElementById('js-field-status');
  const processStatusEl = document.getElementById('js-process-status');
  const errorsEl = document.getElementById('js-errors');
  const progressEl = document.getElementById('js-progress');

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  completeStatusEl.value = config.completeStatus;

  const setProgress = (message) => {
    progressEl.textContent = message || '';
  };

  const api = (path, method, body) =>
    kintone.api(kintone.api.url(path, true), method, body);

  // REST APIのレスポンスは {properties, revision} / {layout, revision} にラップされている
  // (JavaScript APIのkintone.app.getFormFields()等とは異なる)。
  const fetchPreviewFields = () =>
    api('/k/v1/preview/app/form/fields.json', 'GET', { app: appId });
  const fetchPreviewLayout = () =>
    api('/k/v1/preview/app/form/layout.json', 'GET', { app: appId });
  const fetchPreviewStatus = () =>
    api('/k/v1/preview/app/status.json', 'GET', { app: appId });

  const planOptions = (completeStatus, properties) => ({
    completeStatus,
    creatorFieldCode: NS.FieldDefs.findCreatorFieldCode(properties),
    approverCode: kintone.getLoginUser().code,
  });

  const getDeployStatus = async () => {
    const resp = await api('/k/v1/preview/app/deploy.json', 'GET', {
      apps: [appId],
    });
    const entry = resp.apps.find((a) => String(a.app) === String(appId));
    return entry ? entry.status : 'FAIL';
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // setConfig()で保存した値もフィールドと同じく動作テスト環境(preview)扱いで、デプロイするまで
  // レコード画面からは見えない(plugin_catalog_builderで実環境確認済み)。保存のたびにデプロイする。
  const deployAndWait = async () => {
    setProgress('運用環境へ反映しています…');
    await api('/k/v1/preview/app/deploy.json', 'POST', {
      apps: [{ app: appId }],
    });
    const result = await NS.DeployPoller.pollUntilDeployed({
      getStatus: getDeployStatus,
      wait,
    });
    if (!result.success) {
      throw new Error(
        `運用環境への反映に失敗しました(status: ${result.status})。もう一度お試しください。`,
      );
    }
    setProgress('');
  };

  const PLAN_TEXT = {
    create:
      'プロセス管理: 未設定です。保存時に既定の承認フローを作成してONにします。',
    enable:
      'プロセス管理: OFFです。保存時に現在のステータス・アクションのままONにします。',
    none: 'プロセス管理: ONで、完了ステータスがあります。',
  };

  const showStatus = async () => {
    try {
      const [fieldsResp, layoutResp, statusResp] = await Promise.all([
        fetchPreviewFields(),
        fetchPreviewLayout(),
        fetchPreviewStatus(),
      ]);
      const missing = NS.FieldDefs.diffMissingFields(fieldsResp.properties);
      const hasSpacer = NS.FieldDefs.hasSpacer(
        layoutResp.layout,
        NS.FieldDefs.SPACER_ELEMENT_ID,
      );
      if (missing.length === 0 && hasSpacer) {
        fieldStatusEl.textContent =
          'フィールド: 必要なフィールドとスペースはすべて作成済みです。';
      } else {
        const names = missing.map((d) => d.label);
        if (!hasSpacer) {
          names.push('依頼の入力欄(スペース)');
        }
        fieldStatusEl.textContent = `フィールド: 保存時に作成します(${names.join('、')})。`;
      }
      const plan = NS.ProcessSetup.planProcessSetup(
        statusResp,
        planOptions(
          completeStatusEl.value.trim() || config.completeStatus,
          fieldsResp.properties,
        ),
      );
      processStatusEl.textContent =
        plan.action === 'error'
          ? `プロセス管理: ${plan.error}`
          : PLAN_TEXT[plan.action];
    } catch (err) {
      fieldStatusEl.textContent = `アプリの状態を確認できませんでした: ${NS.ApiPath.describeApiError(err)}`;
    }
    fieldStatusEl.dataset.loaded = '1';
  };

  const createFields = async () => {
    setProgress('現在のフィールド構成を確認しています…');
    const fieldsResp = await fetchPreviewFields();
    const missing = NS.FieldDefs.diffMissingFields(fieldsResp.properties);
    if (missing.length > 0) {
      setProgress(
        `フィールドを追加しています(${missing.map((d) => d.label).join('、')})…`,
      );
      await api('/k/v1/preview/app/form/fields.json', 'POST', {
        app: appId,
        properties: NS.FieldDefs.buildAddFieldsPayload(missing),
      });
    }

    // フィールド追加後のレイアウトを取得する(追加したフィールドはレイアウト末尾に自動配置されている)。
    const layoutResp = await fetchPreviewLayout();
    const nextLayout = NS.FieldDefs.insertSpacerRow(
      layoutResp.layout,
      NS.FieldDefs.SPACER_ELEMENT_ID,
    );
    if (nextLayout !== layoutResp.layout) {
      setProgress('依頼の入力欄(スペース)を追加しています…');
      await api('/k/v1/preview/app/form/layout.json', 'PUT', {
        app: appId,
        layout: nextLayout,
      });
    }
    return fieldsResp.properties;
  };

  const setupProcess = async (completeStatus, properties) => {
    setProgress('プロセス管理の設定を確認しています…');
    const statusResp = await fetchPreviewStatus();
    const plan = NS.ProcessSetup.planProcessSetup(
      statusResp,
      planOptions(completeStatus, properties),
    );
    if (plan.action === 'error') {
      throw new Error(plan.error);
    }
    if (plan.action === 'none') {
      return plan.action;
    }
    setProgress('プロセス管理をONにしています…');
    await api('/k/v1/preview/app/status.json', 'PUT', {
      app: appId,
      ...plan.body,
    });
    return plan.action;
  };

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + appId + '/plugin/';
  });

  completeStatusEl.addEventListener('change', () => {
    showStatus();
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    errorsEl.textContent = '';
    const next = { completeStatus: completeStatusEl.value };
    const errors = NS.ConfigStore.validate(next);
    if (errors.length > 0) {
      errorsEl.textContent = errors.join('\n');
      return;
    }
    const serialized = NS.ConfigStore.serialize(next);
    saveButtonEl.disabled = true;
    (async () => {
      try {
        const properties = await createFields();
        const processAction = await setupProcess(
          serialized.completeStatus,
          properties,
        );
        await new Promise((resolve) => {
          kintone.plugin.app.setConfig(serialized, resolve);
        });
        await deployAndWait();
        alert(
          processAction === 'create'
            ? 'プラグインの設定を保存し、承認フローを作成しました。アプリの設定 → プロセス管理で、承認経路(作業者)を運用に合わせて設定してください。'
            : 'プラグインの設定を保存しました。プロセス管理の承認経路(作業者)が運用に合っているか確認してください。',
        );
        window.location.href = '../../flow?app=' + appId;
      } catch (err) {
        setProgress('');
        errorsEl.textContent = `設定の保存を中止しました: ${NS.ApiPath.describeApiError(err)}`;
        showStatus();
      } finally {
        saveButtonEl.disabled = false;
      }
    })();
  });

  showStatus();
})(kintone.$PLUGIN_ID);
