(function (global, kintone) {
  'use strict';

  const NS = global.FiscalYearNumbering;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const loadConfig = () => NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const persistNumber = (appId, recordId, revision, numberFieldCode, number) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      revision,
      record: { [numberFieldCode]: { value: number } },
    });

  kintone.events.on('mobile.app.record.create.show', (event) => {
    const config = loadConfig();
    if (event.record[config.numberFieldCode].value) {
      return event;
    }
    NS.NumberingService.computeNext(config, event.record, kintone.app.getId())
      .then((number) => {
        kintone.mobile.app.record.set({
          record: { [config.numberFieldCode]: { value: number } },
        });
      })
      .catch(() => {
        // 表示時点の先行取得の失敗は無視する(保存時にsubmitイベントで再試行される)。
      });
    return event;
  });

  kintone.events.on('mobile.app.record.create.submit', async (event) => {
    const config = loadConfig();
    if (!event.record[config.numberFieldCode].value) {
      event.record[config.numberFieldCode].value = await NS.NumberingService.computeNext(
        config,
        event.record,
        kintone.app.getId()
      );
    }
    return event;
  });

  kintone.events.on('mobile.app.record.detail.show', async (event) => {
    const config = loadConfig();
    if (event.record[config.numberFieldCode].value) {
      return event;
    }
    const appId = kintone.app.getId();
    const number = await NS.NumberingService.computeNext(config, event.record, appId);
    await persistNumber(
      appId,
      event.recordId,
      event.record.$revision.value,
      config.numberFieldCode,
      number
    );
    event.record[config.numberFieldCode].value = number;
    return event;
  });

  kintone.events.on('mobile.app.record.index.show', async (event) => {
    const config = loadConfig();
    const appId = kintone.app.getId();

    const unnumbered = event.records.filter((r) => !r[config.numberFieldCode].value);
    for (const record of unnumbered) {
      const number = await NS.NumberingService.computeNext(config, record, appId);
      await persistNumber(
        appId,
        record.$id.value,
        record.$revision.value,
        config.numberFieldCode,
        number
      );
      record[config.numberFieldCode].value = number;
    }

    NS.BulkNumbering.renderButtonIfAuthorized(
      kintone.mobile.app.getHeaderSpaceElement(),
      config,
      appId
    );

    return event;
  });
})(window, kintone);
