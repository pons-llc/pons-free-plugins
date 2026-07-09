(function (global, kintone) {
  'use strict';

  const NS = global.FiscalYearNumbering;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const loadConfig = () => NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 必須項目(採番結果を保存するフィールド・カウンター専用アプリID)が未設定の場合は、
  // まだ管理者がこのアプリ向けにプラグインを設定していない(またはgetConfig()が取得できなかった)
  // ということなので、何もせず処理を抜ける(画面全体をクラッシュさせない)。
  const isConfigured = (config) => Boolean(config.numberFieldCode && config.counterAppId);

  const persistNumber = (appId, recordId, revision, numberFieldCode, number) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      revision,
      record: { [numberFieldCode]: { value: number } },
    });

  kintone.events.on('mobile.app.record.create.show', (event) => {
    const config = loadConfig();
    if (!isConfigured(config) || event.record[config.numberFieldCode].value) {
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
    if (isConfigured(config) && !event.record[config.numberFieldCode].value) {
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
    if (!isConfigured(config) || event.record[config.numberFieldCode].value) {
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
    if (!isConfigured(config)) {
      return event;
    }
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
