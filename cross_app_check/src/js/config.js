(function (global, kintone, $) {
  'use strict';

  const NS = global.CrossAppCheck;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const currentAppId = String(kintone.app.getId());

  // アプリIDごとのフィールド一覧のキャッシュ(同じアプリを何度も取りに行かない)
  const fieldsCache = {};

  const dom = {
    form: document.querySelector('.js-submit-settings'),
    cancel: document.querySelector('.js-cancel'),
    error: document.querySelector('.js-config-error'),
    schemaCreate: document.querySelector('.js-schema-create'),
    schemaStatus: document.querySelector('.js-schema-status'),
    baseAppId: document.querySelector('.js-base-app-id'),
    baseAppFetch: document.querySelector('.js-base-app-fetch'),
    baseAppStatus: document.querySelector('.js-base-app-status'),
    baseKeyField: document.querySelector('.js-base-key-field'),
    baseNameField: document.querySelector('.js-base-name-field'),
    baseQuery: document.querySelector('.js-base-query'),
    targetList: document.querySelector('#js-target-list'),
    targetAdd: document.querySelector('#js-target-add'),
    targetTemplate: document.querySelector('#js-target-row-template'),
    labelSubmitted: document.querySelector('.js-label-submitted'),
    labelUnsubmitted: document.querySelector('.js-label-unsubmitted'),
    maxBaseRecords: document.querySelector('.js-max-base-records'),
    maxHistoryRows: document.querySelector('.js-max-history-rows'),
  };

  const setError = (messages) => {
    if (!messages || messages.length === 0) {
      dom.error.textContent = '';
      dom.error.hidden = true;
      return;
    }
    dom.error.textContent = messages.join(' / ');
    dom.error.hidden = false;
  };

  // 別アプリのフィールド一覧を取得する。
  // 基準アプリ・対象アプリはこのプラグインが動作しているアプリとは別アプリなので、
  // kintone.app.getFormFields()(現在開いているアプリ専用のJavaScript API)は使えない。
  // CLAUDE.md開発方針3に従い、kintone自身へのREST呼び出しをkintone.api()経由で行う。
  const fetchFields = async (appId) => {
    if (fieldsCache[appId]) {
      return fieldsCache[appId];
    }
    const resp = await kintone.api(
      kintone.api.url('/k/v1/app/form/fields.json', true),
      'GET',
      { app: appId },
    );
    // eslint-disable-next-line require-atomic-updates
    fieldsCache[appId] = resp.properties || {};
    return fieldsCache[appId];
  };

  // 選択肢を作る。テーブル(SUBTABLE)の中のフィールドは1レコード1値にならないので除く。
  const buildOptions = (selectEl, fields, selectedCode, placeholder) => {
    selectEl.textContent = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = placeholder || '(選択してください)';
    selectEl.appendChild(blank);

    fields.forEach((field) => {
      const option = document.createElement('option');
      option.value = field.code;
      option.textContent = `${field.label} (${field.code})`;
      if (field.code === selectedCode) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  };

  const selectableFields = (properties, predicate) =>
    Object.values(properties || {})
      .filter((field) => field.type !== 'SUBTABLE')
      .filter((field) => predicate(field.type))
      .sort((a, b) => (a.label > b.label ? 1 : -1));

  // 表示名は「値が1つ読めれば何でもよい」ので、装飾系フィールド以外を広く許可する
  const NON_VALUE_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'LABEL',
    'SPACER',
    'HR',
    'CATEGORY',
    'STATUS_ASSIGNEE',
    'FILE',
  ];
  const isDisplayableType = (type) => NON_VALUE_TYPES.indexOf(type) === -1;

  // --- 集計用フィールド ---

  const refreshSchemaStatus = async () => {
    dom.schemaStatus.textContent = '確認中...';
    try {
      const state = await NS.SchemaWriter.inspect(currentAppId);
      if (state.ready) {
        dom.schemaStatus.textContent = '作成済みです。';
        dom.schemaCreate.disabled = true;
        return;
      }
      dom.schemaCreate.disabled = false;
      const missing = state.missingFields.slice();
      if (!state.hasSpacer) {
        missing.push('結果表示用のスペース');
      }
      dom.schemaStatus.textContent = `未作成です(不足: ${missing.join(', ')})。`;
    } catch (err) {
      dom.schemaCreate.disabled = false;
      dom.schemaStatus.textContent = `状態を確認できませんでした: ${(err && err.message) || err}`;
    }
  };

  const onSchemaCreate = async () => {
    const agreed = global.confirm(
      '「突合履歴」テーブルと結果表示用のスペースをこのアプリに作成し、アプリの設定を運用環境へ反映します。\n' +
        '動作テスト環境に未反映の変更がある場合、それらも同時に公開されます。実行しますか?',
    );
    if (!agreed) {
      return;
    }
    dom.schemaCreate.disabled = true;
    dom.schemaStatus.textContent =
      '作成しています...(アプリの反映に数十秒かかることがあります)';
    try {
      await NS.SchemaWriter.ensureSchema(currentAppId);
      dom.schemaStatus.textContent = '作成しました。';
      await refreshSchemaStatus();
    } catch (err) {
      dom.schemaCreate.disabled = false;
      dom.schemaStatus.textContent = `作成に失敗しました: ${(err && err.message) || err}`;
    }
  };

  // --- 基準アプリ ---

  const loadBaseFields = async (appId, options) => {
    const keep = options && options.keepSelection;
    if (!appId) {
      dom.baseKeyField.disabled = true;
      dom.baseNameField.disabled = true;
      dom.baseAppStatus.textContent = '';
      return;
    }
    dom.baseAppStatus.textContent = '読み込み中...';
    try {
      const properties = await fetchFields(appId);
      buildOptions(
        dom.baseKeyField,
        selectableFields(properties, NS.MatchKey.isSelectableKeyType),
        keep ? config.baseApp.keyFieldCode : '',
      );
      buildOptions(
        dom.baseNameField,
        selectableFields(properties, isDisplayableType),
        keep ? config.baseApp.nameFieldCode : '',
        '(なし)',
      );
      dom.baseKeyField.disabled = false;
      dom.baseNameField.disabled = false;
      dom.baseAppStatus.textContent = `${Object.keys(properties).length}件のフィールドを読み込みました。`;
    } catch {
      dom.baseKeyField.disabled = true;
      dom.baseNameField.disabled = true;
      dom.baseAppStatus.textContent =
        'フィールドを読み込めませんでした。アプリIDとアクセス権を確認してください。';
    }
  };

  // --- 対象アプリ ---

  const renumberTargets = () => {
    Array.from(dom.targetList.querySelectorAll('.js-target-row')).forEach(
      (row, position) => {
        row.querySelector('.js-target-title').textContent =
          `対象アプリ${position + 1}`;
      },
    );
  };

  const loadTargetFields = async (rowEl, appId, selected) => {
    const keyEl = rowEl.querySelector('.js-target-key-field');
    const dateEl = rowEl.querySelector('.js-target-date-field');
    const statusEl = rowEl.querySelector('.js-target-app-status');

    if (!appId) {
      keyEl.disabled = true;
      dateEl.disabled = true;
      statusEl.textContent = '';
      return;
    }
    statusEl.textContent = '読み込み中...';
    try {
      const properties = await fetchFields(appId);
      buildOptions(
        keyEl,
        selectableFields(properties, NS.MatchKey.isSelectableKeyType),
        (selected && selected.keyFieldCode) || '',
      );
      buildOptions(
        dateEl,
        selectableFields(properties, NS.MatchKey.isSelectableDateType),
        (selected && selected.dateFieldCode) || '',
        '(なし)',
      );
      keyEl.disabled = false;
      dateEl.disabled = false;
      statusEl.textContent = `${Object.keys(properties).length}件のフィールドを読み込みました。`;
    } catch {
      keyEl.disabled = true;
      dateEl.disabled = true;
      statusEl.textContent =
        'フィールドを読み込めませんでした。アプリIDとアクセス権を確認してください。';
    }
  };

  const addTargetRow = (target) => {
    const fragment = dom.targetTemplate.content.cloneNode(true);
    const rowEl = fragment.querySelector('.js-target-row');

    const appIdEl = rowEl.querySelector('.js-target-app-id');
    const labelEl = rowEl.querySelector('.js-target-label');
    const queryEl = rowEl.querySelector('.js-target-query');

    if (target) {
      appIdEl.value = target.appId || '';
      labelEl.value = target.label || '';
      queryEl.value = target.query || '';
    }

    rowEl
      .querySelector('.js-target-app-fetch')
      .addEventListener('click', () => {
        loadTargetFields(rowEl, appIdEl.value.trim(), null);
      });
    rowEl.querySelector('.js-target-remove').addEventListener('click', () => {
      rowEl.remove();
      renumberTargets();
    });

    dom.targetList.appendChild(fragment);
    renumberTargets();

    if (target && target.appId) {
      loadTargetFields(rowEl, target.appId, target);
    }
    return rowEl;
  };

  // --- 画面 -> 設定 ---

  const collectConfig = () => {
    const targets = Array.from(
      dom.targetList.querySelectorAll('.js-target-row'),
    ).map((rowEl) => ({
      appId: rowEl.querySelector('.js-target-app-id').value.trim(),
      appName: '',
      label: rowEl.querySelector('.js-target-label').value.trim(),
      keyFieldCode: rowEl.querySelector('.js-target-key-field').value,
      keyFieldType: fieldTypeOf(
        rowEl.querySelector('.js-target-app-id').value.trim(),
        rowEl.querySelector('.js-target-key-field').value,
      ),
      dateFieldCode: rowEl.querySelector('.js-target-date-field').value,
      query: rowEl.querySelector('.js-target-query').value.trim(),
    }));

    const baseAppId = dom.baseAppId.value.trim();
    return NS.ConfigStore.normalize({
      baseApp: {
        appId: baseAppId,
        appName: '',
        keyFieldCode: dom.baseKeyField.value,
        keyFieldType: fieldTypeOf(baseAppId, dom.baseKeyField.value),
        nameFieldCode: dom.baseNameField.value,
        query: dom.baseQuery.value.trim(),
      },
      targets,
      limits: {
        maxBaseRecords: dom.maxBaseRecords.value,
        maxHistoryRows: dom.maxHistoryRows.value,
      },
      labels: {
        submitted: dom.labelSubmitted.value.trim(),
        unsubmitted: dom.labelUnsubmitted.value.trim(),
      },
    });
  };

  // 突合キーの正規化方法(数値扱いか文字列扱いか)を決めるためにフィールドタイプも保存する
  function fieldTypeOf(appId, fieldCode) {
    if (!appId || !fieldCode) {
      return '';
    }
    const properties = fieldsCache[appId];
    if (!properties || !properties[fieldCode]) {
      return '';
    }
    return properties[fieldCode].type;
  }

  // アプリ名は結果一覧の見出しに使うので、保存時にまとめて解決する
  const resolveAppNames = async (collected) => {
    const appIds = [collected.baseApp.appId]
      .concat(collected.targets.map((target) => target.appId))
      .filter((appId) => appId);
    if (appIds.length === 0) {
      return collected;
    }
    try {
      const resp = await kintone.api(
        kintone.api.url('/k/v1/apps.json', true),
        'GET',
        {
          ids: Array.from(new Set(appIds)),
        },
      );
      const nameById = {};
      (resp.apps || []).forEach((app) => {
        nameById[String(app.appId)] = app.name;
      });
      collected.baseApp.appName = nameById[collected.baseApp.appId] || '';
      collected.targets.forEach((target) => {
        target.appName = nameById[target.appId] || '';
      });
    } catch {
      // アプリ名が取れなくても突合自体はできるので、ここでは失敗させない
    }
    return collected;
  };

  // --- 初期化 ---

  const restore = async () => {
    dom.baseAppId.value = config.baseApp.appId;
    dom.baseQuery.value = config.baseApp.query;
    dom.labelSubmitted.value = config.labels.submitted;
    dom.labelUnsubmitted.value = config.labels.unsubmitted;
    dom.maxBaseRecords.value = config.limits.maxBaseRecords;
    dom.maxHistoryRows.value = config.limits.maxHistoryRows;

    config.targets.forEach((target) => {
      addTargetRow(target);
    });
    if (config.targets.length === 0) {
      addTargetRow(null);
    }

    if (config.baseApp.appId) {
      await loadBaseFields(config.baseApp.appId, { keepSelection: true });
    }
    await refreshSchemaStatus();
  };

  dom.schemaCreate.addEventListener('click', onSchemaCreate);
  dom.baseAppFetch.addEventListener('click', () => {
    loadBaseFields(dom.baseAppId.value.trim(), { keepSelection: false });
  });
  dom.targetAdd.addEventListener('click', () => {
    addTargetRow(null);
  });
  dom.cancel.addEventListener('click', () => {
    global.location.href = `../../${kintone.app.getId()}/plugin/`;
  });

  dom.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const collected = collectConfig();
    const validation = NS.ConfigValidation.validate(collected, currentAppId);
    if (!validation.ok) {
      setError(validation.errors);
      return;
    }
    setError(null);

    await resolveAppNames(collected);
    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(collected), () => {
      global.location.href = `../../${kintone.app.getId()}/plugin/`;
    });
  });

  restore();
})(typeof window !== 'undefined' ? window : globalThis, kintone, null);
