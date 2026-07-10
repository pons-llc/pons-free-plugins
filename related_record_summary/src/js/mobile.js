(function (global, kintone) {
  'use strict';

  const NS = global.RelatedRecordSummary;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

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
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    handleSubmit,
  );

  kintone.events.on('mobile.app.record.detail.show', (event) => {
    const config = loadConfig();
    if (!config.triggers.onDetailButton || !isConfigured(config)) {
      return event;
    }
    const headerEl = kintone.mobile.app.getHeaderSpaceElement();
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
      kintone.mobile.showLoading('VISIBLE');
      try {
        const appId = kintone.app.getId();
        const formFields = await kintone.app.getFormFields();
        const current = kintone.mobile.app.record.get().record;
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
        kintone.mobile.app.record.set({ record: current });

        global.alert('集計が完了しました。');
      } catch (err) {
        global.alert(`集計に失敗しました: ${err.message}`);
      } finally {
        kintone.mobile.showLoading('HIDDEN');
        button.disabled = false;
      }
    });
    headerEl.appendChild(button);

    return event;
  });

  kintone.events.on('mobile.app.record.index.show', (event) => {
    const config = loadConfig();
    if (!isConfigured(config)) {
      return event;
    }
    NS.BulkSummary.renderButtonIfAuthorized(
      kintone.mobile.app.getHeaderSpaceElement(),
      config,
      kintone.app.getId(),
    );
    return event;
  });
})(window, kintone);
