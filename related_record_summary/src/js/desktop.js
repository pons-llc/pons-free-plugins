(function (global, kintone) {
  'use strict';

  const NS = global.RelatedRecordSummary;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 集計設定行が1つも無い(＝管理者がこのアプリ向けにまだ設定していない、あるいは
  // getConfig()が取得できなかった)場合は、何もせず処理を抜ける(画面全体をクラッシュさせない)。
  const isConfigured = (config) =>
    Array.isArray(config.rows) && config.rows.length > 0;

  const applyUpdatesToRecord = (record, updates) => {
    Object.keys(updates).forEach((fieldCode) => {
      if (record[fieldCode]) {
        record[fieldCode].value = String(updates[fieldCode]);
      }
    });
  };

  const persistUpdates = (appId, recordId, revision, updates) => {
    const record = {};
    Object.keys(updates).forEach((fieldCode) => {
      record[fieldCode] = { value: String(updates[fieldCode]) };
    });
    return kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      revision,
      record,
    });
  };

  // submit時集計: 保存前に集計を行い、書き込み先フィールドへ反映してから保存する。
  // 参照先アプリの閲覧権限がない等で集計に失敗した場合は保存自体をキャンセルする
  // (falseをreturnすると保存処理をキャンセルできる。判断記録.md参照)。
  const handleSubmit = async (event) => {
    const config = loadConfig();
    if (!config.triggers.onSubmit || !isConfigured(config)) {
      return event;
    }
    try {
      const formFields = await kintone.app.getFormFields();
      const updates = await NS.SummaryService.computeAll(
        config,
        formFields,
        event.record,
      );
      applyUpdatesToRecord(event.record, updates);
      return event;
    } catch (err) {
      global.alert(
        `関連レコードの集計に失敗したため、保存を中止しました: ${err.message}`,
      );
      return false;
    }
  };

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    handleSubmit,
  );

  // 詳細画面ボタン: クリック時にのみ集計を実行し、REST APIで永続化してから画面へ反映する。
  kintone.events.on('app.record.detail.show', (event) => {
    const config = loadConfig();
    if (!config.triggers.onDetailButton || !isConfigured(config)) {
      return event;
    }
    const headerEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!headerEl || headerEl.dataset.rrsDetailButtonRendered) {
      return event;
    }
    headerEl.dataset.rrsDetailButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal rrs-detail-button';
    button.textContent = '関連レコードを集計';
    button.addEventListener('click', async () => {
      button.disabled = true;
      kintone.showLoading('VISIBLE');
      try {
        const appId = kintone.app.getId();
        const formFields = await kintone.app.getFormFields();
        const current = kintone.app.record.get().record;
        const updates = await NS.SummaryService.computeAll(
          config,
          formFields,
          current,
        );
        await persistUpdates(
          appId,
          event.recordId,
          current.$revision.value,
          updates,
        );
        applyUpdatesToRecord(current, updates);
        kintone.app.record.set({ record: current });

        global.alert('集計が完了しました。');
      } catch (err) {
        global.alert(`集計に失敗しました: ${err.message}`);
      } finally {
        kintone.showLoading('HIDDEN');
        button.disabled = false;
      }
    });
    headerEl.appendChild(button);

    return event;
  });

  // 一覧画面: 対象グループのメンバーにのみ一括集計ボタンを表示する。
  kintone.events.on('app.record.index.show', (event) => {
    const config = loadConfig();
    if (!isConfigured(config)) {
      return event;
    }
    NS.BulkSummary.renderButtonIfAuthorized(
      kintone.app.getHeaderMenuSpaceElement(),
      config,
      kintone.app.getId(),
    );
    return event;
  });
})(window, kintone);
