(function (global, kintone) {
  'use strict';

  const NS = global.CrossAppCheck;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // プラグイン設定画面が受け持つのは、集計用フィールドの作成と、
  // アプリ全体で共通の既定値(表記・上限)だけ。
  // 「どのアプリをどう突き合わせるか」はレコードごとの設定UI([[definition-editor]])で行う。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const currentAppId = String(kintone.app.getId());

  const dom = {
    form: document.querySelector('.js-submit-settings'),
    cancel: document.querySelector('.js-cancel'),
    schemaCreate: document.querySelector('.js-schema-create'),
    schemaStatus: document.querySelector('.js-schema-status'),
    labelSubmitted: document.querySelector('.js-label-submitted'),
    labelUnsubmitted: document.querySelector('.js-label-unsubmitted'),
    maxBaseRecords: document.querySelector('.js-max-base-records'),
    maxHistoryRows: document.querySelector('.js-max-history-rows'),
  };

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
      '突合設定・突合履歴テーブル・結果表示用のスペースをこのアプリに作成し、アプリの設定を運用環境へ反映します。\n' +
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

  const collectConfig = () =>
    NS.ConfigStore.normalize({
      limits: {
        maxBaseRecords: dom.maxBaseRecords.value,
        maxHistoryRows: dom.maxHistoryRows.value,
      },
      labels: {
        submitted: dom.labelSubmitted.value.trim(),
        unsubmitted: dom.labelUnsubmitted.value.trim(),
      },
    });

  const restore = async () => {
    dom.labelSubmitted.value = config.labels.submitted;
    dom.labelUnsubmitted.value = config.labels.unsubmitted;
    dom.maxBaseRecords.value = config.limits.maxBaseRecords;
    dom.maxHistoryRows.value = config.limits.maxHistoryRows;
    await refreshSchemaStatus();
  };

  dom.schemaCreate.addEventListener('click', onSchemaCreate);
  dom.cancel.addEventListener('click', () => {
    global.location.href = `../../${kintone.app.getId()}/plugin/`;
  });

  dom.form.addEventListener('submit', (event) => {
    event.preventDefault();
    kintone.plugin.app.setConfig(
      NS.ConfigStore.serialize(collectConfig()),
      () => {
        global.location.href = `../../${kintone.app.getId()}/plugin/`;
      },
    );
  });

  restore();
})(typeof window !== 'undefined' ? window : globalThis, kintone);
