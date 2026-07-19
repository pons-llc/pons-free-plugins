(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.PluginCatalogBuilder;
  const appId = kintone.app.getId();

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const progressEl = document.getElementById('js-progress');
  const aiSearchEnabledEl = document.querySelector('.js-ai-search-enabled');
  const groupListEl = document.getElementById('js-group-list');
  const groupItemTemplateEl = document.getElementById('js-group-item-template');
  const saveButtonEl = document.querySelector(
    '.kintoneplugin-button-dialog-ok',
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const setProgress = (message) => {
    progressEl.textContent = message || '';
  };

  // GET /v1/groups.json はUser API(Organization APIと同系統、必要なアクセス権なし)。
  // org_lookupのOrganization API呼び出しと同じくkintone.api()経由で叩く(CLAUDE.md方針3)。
  const fetchGroupsPage = ({ size, offset }) =>
    kintone
      .api(kintone.api.url('/v1/groups.json', true), 'GET', { size, offset })
      .then((resp) => resp.groups);

  let groups = [];
  try {
    groups = await NS.GroupDirectory.fetchAllGroups(fetchGroupsPage);
  } catch (err) {
    errorsEl.textContent = `グループ一覧の取得に失敗しました: ${err.message}`;
  }

  aiSearchEnabledEl.checked = !!config.aiSearchEnabled;

  groupListEl.innerHTML = '';
  groups.forEach((group) => {
    const fragment = groupItemTemplateEl.content.cloneNode(true);
    const checkboxEl = fragment.querySelector('.js-group-checkbox');
    const labelEl = fragment.querySelector('.js-group-label');
    checkboxEl.checked = config.syncGroupCodes.includes(group.code);
    checkboxEl.dataset.groupCode = group.code;
    labelEl.textContent = `${group.name} (${group.code})`;
    groupListEl.appendChild(fragment);
  });
  // グループ一覧の取得・描画が完了したことを示すマーカー(成功・失敗どちらでも設定する)。
  // E2Eテストが固定時間の待機ではなくこのマーカーを見て操作するために使う
  // (GET /v1/groups.jsonの非同期処理が終わる前にチェックボックスを操作してしまうと、
  // 意図した状態で保存されない実際の不具合が発生したため)。
  groupListEl.dataset.loaded = '1';

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + appId + '/plugin/';
  });

  // 動作テスト環境(preview)のフィールド一覧+revisionを取得する。
  const fetchPreviewFormFields = () =>
    kintone.api(
      kintone.api.url('/k/v1/preview/app/form/fields.json', true),
      'GET',
      {
        app: appId,
      },
    );

  const addPreviewFormFields = (properties, revision) =>
    kintone.api(
      kintone.api.url('/k/v1/preview/app/form/fields.json', true),
      'POST',
      {
        app: appId,
        revision,
        properties,
      },
    );

  // revisionを省略すると検証されず、その時点のアプリの動作テスト環境(preview)の設定
  // (このあとのkintone.plugin.app.setConfig()を含む)がすべて運用環境へ反映される。
  const deployPreviewSettings = () =>
    kintone.api(
      kintone.api.url('/k/v1/preview/app/deploy.json', true),
      'POST',
      {
        apps: [{ app: appId }],
      },
    );

  const getDeployStatus = async () => {
    const resp = await kintone.api(
      kintone.api.url('/k/v1/preview/app/deploy.json', true),
      'GET',
      { apps: [appId] },
    );
    const entry = resp.apps.find((a) => String(a.app) === String(appId));
    return entry ? entry.status : 'FAIL';
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 台帳アプリに必要なフィールドが不足していれば動作テスト環境(preview)に追加する
  // (この時点ではまだ運用環境へは反映しない。デプロイはsetConfig()のあとにまとめて1回行う、
  // 下記「実際に検証環境で確認した重要な落とし穴」参照)。冪等: 既存フィールドは再作成しない。
  const ensureCatalogFieldsAdded = async () => {
    setProgress('現在のフィールド構成を確認しています…');
    const fieldsResp = await fetchPreviewFormFields();
    const missing = NS.FieldDiff.diffMissingFields(fieldsResp.properties);
    if (missing.length === 0) {
      setProgress('');
      return;
    }

    setProgress(
      `フィールドを追加しています(${missing.map((d) => d.code).join(', ')})…`,
    );
    await addPreviewFormFields(
      NS.FieldDiff.buildAddFieldsPayload(missing),
      fieldsResp.revision,
    );
    setProgress('');
  };

  // 実際に検証環境で確認した重要な落とし穴: kintone.plugin.app.setConfig()で保存した設定値は、
  // フィールド追加などと同じ動作テスト環境(preview)にのみ反映され、GET /k/v1/preview/app/plugin/config.json
  // (検討中の新機能のREST APIだが実体は同じpreview系統)の存在からも分かる通り、レコード一覧・詳細等の
  // 画面(desktop.js側のkintone.plugin.app.getConfig())からは、アプリを実際にデプロイするまで
  // 新しい設定値が見えない(古い値のまま)。setConfig()のコールバックが呼ばれた時点で保存は
  // 完了しているように見えるが、実際の動作確認では「許可グループを外して保存したのに、
  // レコード一覧の同期ボタンが表示されたまま」という不具合として顕在化した。
  // このため、フィールド追加の有無に関わらず、setConfig()のたびに必ずデプロイし、
  // 完了をポーリングしてから画面遷移する(フィールド追加分も同じデプロイでまとめて反映される)。
  const deployAndWait = async () => {
    setProgress('運用環境へ反映しています…');
    await deployPreviewSettings();
    const result = await NS.DeployPoller.pollUntilDeployed({
      getStatus: getDeployStatus,
      wait,
    });
    if (!result.success) {
      throw new Error(
        `アプリ設定の運用環境への反映に失敗しました(status: ${result.status})。` +
          'アプリ管理権限があるか確認し、再度保存してください。',
      );
    }
    setProgress('');
  };

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    errorsEl.textContent = '';

    config.aiSearchEnabled = aiSearchEnabledEl.checked;
    config.syncGroupCodes = Array.from(
      groupListEl.querySelectorAll('.js-group-checkbox:checked'),
    ).map((el) => el.dataset.groupCode);

    saveButtonEl.disabled = true;
    (async () => {
      try {
        await ensureCatalogFieldsAdded();
        await new Promise((resolve) => {
          kintone.plugin.app.setConfig(
            NS.ConfigStore.serialize(config),
            resolve,
          );
        });
        await deployAndWait();
        alert('プラグインの設定を保存しました。');
        window.location.href = '../../flow?app=' + appId;
      } catch (err) {
        setProgress('');
        errorsEl.textContent = `設定の保存を中止しました: ${err.message}`;
      } finally {
        saveButtonEl.disabled = false;
      }
    })();
  });
})(kintone.$PLUGIN_ID);
