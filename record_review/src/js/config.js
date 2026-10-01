(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.RecordReview;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const saveButtonEl = document.querySelector('.js-save-button');
  const selectAllEl = document.querySelector('.js-select-all');
  const selectNoneEl = document.querySelector('.js-select-none');
  const errorsEl = document.getElementById('js-errors');
  const progressEl = document.getElementById('js-progress');
  const tableStatusEl = document.getElementById('js-table-status');
  const fieldListEl = document.getElementById('js-field-list');
  const tableWarningEl = document.getElementById('js-table-warning');
  const targetListEl = document.getElementById('js-target-list');

  const appId = kintone.app.getId();

  // kintone.app.getFormFields()はREST APIレスポンスのpropertiesと同様の値(フィールドコードをキーにした
  // 平坦なオブジェクト)、kintone.app.getFormLayout()はlayoutと同様の値(レイアウト配列そのもの)を解決する
  // (どちらも{properties}/{layout}でラップされない。CLAUDE.mdの既知の落とし穴、kintone_doc MCPで確認済み)。
  const [existingFields, layout] = await Promise.all([
    kintone.app.getFormFields(),
    kintone.app.getFormLayout(),
  ]);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const showError = (message) => {
    errorsEl.textContent = message;
    errorsEl.hidden = !message;
  };

  const renderTableStatus = () => {
    const current = NS.ReviewTableSpec.currentFieldCodes(
      existingFields,
      config.fieldCodes,
    );
    if (current) {
      tableStatusEl.textContent = `作成済みです(テーブル: ${current.table})。`;
      fieldListEl.textContent = NS.ReviewTableSpec.INNER_FIELDS.map(
        (f) => `${f.label}: ${current[f.key]}`,
      ).join(' / ');
      return;
    }
    tableStatusEl.textContent = '保存すると自動的に作成されます。';
    fieldListEl.textContent = '';
  };

  // 指摘履歴テーブル自身は候補から外す(作成済みならそのコード、未作成なら既定コード)。
  const tableCodeToExclude = () => {
    const current = NS.ReviewTableSpec.currentFieldCodes(
      existingFields,
      config.fieldCodes,
    );
    return current ? current.table : NS.ReviewTableSpec.TABLE_CODE;
  };

  const candidates = NS.TargetFields.listTargetFields(
    existingFields,
    layout,
    tableCodeToExclude(),
  );
  const selectedCodes = new Set(
    NS.TargetFields.resolveTargets(candidates, config.targetFields).map(
      (f) => f.code,
    ),
  );

  const renderTargets = () => {
    targetListEl.textContent = '';
    if (candidates.length === 0) {
      targetListEl.textContent = '指摘できるフィールドがありません。';
      return;
    }
    candidates.forEach((field) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'rrc-target-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'js-target-checkbox';
      checkbox.value = field.code;
      checkbox.checked = selectedCodes.has(field.code);
      const nameEl = document.createElement('span');
      nameEl.textContent = field.label;
      const typeEl = document.createElement('span');
      typeEl.className = 'rrc-target-type';
      typeEl.textContent = field.code;
      const textEl = document.createElement('span');
      textEl.className = 'rrc-target-text';
      textEl.append(nameEl, typeEl);
      labelEl.append(checkbox, textEl);
      targetListEl.appendChild(labelEl);
    });
  };

  const checkboxes = () =>
    Array.from(targetListEl.querySelectorAll('.js-target-checkbox'));

  renderTableStatus();
  renderTargets();

  selectAllEl.addEventListener('click', () => {
    checkboxes().forEach((c) => {
      c.checked = true;
    });
  });
  selectNoneEl.addEventListener('click', () => {
    checkboxes().forEach((c) => {
      c.checked = false;
    });
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + appId + '/plugin/';
  });

  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    showError('');
    tableWarningEl.hidden = true;

    const boxes = checkboxes();
    const checked = boxes.filter((c) => c.checked).map((c) => c.value);
    if (checked.length === 0) {
      showError('指摘できるフィールドを1つ以上選択してください。');
      return;
    }

    saveButtonEl.disabled = true;
    try {
      const spec = NS.ReviewTableSpec.buildReviewTableSpec(existingFields);
      if (spec.warnings.length > 0) {
        tableWarningEl.textContent = spec.warnings.join('\n');
        tableWarningEl.hidden = false;
      }

      if (spec.needsCreate) {
        progressEl.textContent = '指摘履歴テーブルを作成しています...';
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
      // すべて選択されている場合は空配列(= すべて)で保存し、後から追加したフィールドも自動で対象にする。
      config.targetFields = checked.length === boxes.length ? [] : checked;

      kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
        alert('プラグインの設定を保存しました。アプリを更新してください。');
        window.location.href = '../../flow?app=' + appId;
      });
    } catch (err) {
      progressEl.textContent = '';
      showError(
        `指摘履歴テーブルの作成・反映に失敗しました: ${err.message || err}`,
      );
      saveButtonEl.disabled = false;
    }
  });
})(kintone.$PLUGIN_ID);
