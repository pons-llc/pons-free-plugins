(function (global, kintone) {
  'use strict';

  const NS = global.FiscalYearNumbering;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // desktop.jsと同じ理由(kintone.plugin.app.getConfig()が画面表示直後の最初の呼び出しでは
  // 内部準備が間に合わずnullを返すことがある)でリトライする。
  const loadConfig = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const raw = kintone.plugin.app.getConfig(PLUGIN_ID);
      if (raw) {
        return NS.ConfigStore.load(raw);
      }
      await sleep(200 * (attempt + 1));
    }
    return NS.ConfigStore.load(null);
  };

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

  // desktop.jsと同じ理由(採番結果を保存するフィールドは常にプラグインが書き込む値なので手入力させない)。
  const disableNumberField = (record, config) => {
    const field = record[config.numberFieldCode];
    if (field) {
      field.disabled = true;
    }
  };

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    async (event) => {
      const config = await loadConfig();
      if (isConfigured(config)) {
        disableNumberField(event.record, config);
      }
      return event;
    }
  );

  // NOTE: 表示直後(create.show)での先行計算はあえて行わない。desktop.jsと同じ理由
  // (record.set()をkintone.events.on()のハンドラー内から呼べない制限)で不具合になるため。
  kintone.events.on('mobile.app.record.create.submit', async (event) => {
    const config = await loadConfig();
    if (
      isConfigured(config) &&
      NS.NumberingTrigger.isSaveTrigger(config) &&
      !event.record[config.numberFieldCode].value
    ) {
      event.record[config.numberFieldCode].value = await NS.NumberingService.computeNext(
        config,
        event.record,
        kintone.app.getId()
      );
    }
    return event;
  });

  kintone.events.on('mobile.app.record.detail.show', async (event) => {
    const config = await loadConfig();
    if (!isConfigured(config) || event.record[config.numberFieldCode].value) {
      return event;
    }
    const appId = kintone.app.getId();

    if (NS.NumberingTrigger.isSaveTrigger(config)) {
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
    }

    if (NS.NumberingTrigger.isButtonTrigger(config)) {
      NS.NumberingButton.renderIfNeeded(
        kintone.mobile.app.getHeaderSpaceElement(),
        config,
        appId,
        event.recordId,
        event.record.$revision.value,
        event.record,
        (record) => kintone.mobile.app.record.set(record)
      );
    }

    return event;
  });

  kintone.events.on('mobile.app.record.detail.process.proceed', async (event) => {
    const config = await loadConfig();
    if (
      isConfigured(config) &&
      NS.NumberingTrigger.isStatusTrigger(config, event.nextStatus.value) &&
      !event.record[config.numberFieldCode].value
    ) {
      event.record[config.numberFieldCode].value = await NS.NumberingService.computeNext(
        config,
        event.record,
        kintone.app.getId()
      );
    }
    return event;
  });

  kintone.events.on('mobile.app.record.index.show', async (event) => {
    const config = await loadConfig();
    if (!isConfigured(config)) {
      return event;
    }
    const appId = kintone.app.getId();

    if (NS.NumberingTrigger.isSaveTrigger(config)) {
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
    }

    NS.BulkNumbering.renderButtonIfAuthorized(
      kintone.mobile.app.getHeaderSpaceElement(),
      config,
      appId
    );

    return event;
  });
})(window, kintone);
