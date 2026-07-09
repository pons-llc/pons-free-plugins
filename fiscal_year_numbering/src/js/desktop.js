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

  // 作成画面: 表示直後に先行計算して画面に反映する。実際に保存されるかどうかは submit イベント側の
  // 安全策(未採番なら再計算)に委ねるため、ここでの結果は「表示のための先行取得」に過ぎない。
  kintone.events.on('app.record.create.show', (event) => {
    const config = loadConfig();
    if (event.record[config.numberFieldCode].value) {
      return event;
    }
    NS.NumberingService.computeNext(config, event.record, kintone.app.getId())
      .then((number) => {
        kintone.app.record.set({
          record: { [config.numberFieldCode]: { value: number } },
        });
      })
      .catch(() => {
        // 表示時点の先行取得の失敗は無視する(保存時にsubmitイベントで再試行される)。
      });
    return event;
  });

  // 作成画面の保存: 未採番のまま保存されようとしている場合のみ採番する(表示時に既に採番済みなら何もしない)。
  kintone.events.on('app.record.create.submit', async (event) => {
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

  // 詳細画面: 外部フォーム等から採番されずに登録されたレコードをここで採番し、REST APIで永続化する
  // (event.recordの書き換えは表示のみに影響し、サーバーには保存されないため)。
  kintone.events.on('app.record.detail.show', async (event) => {
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

  // 一覧画面: 表示中のページに含まれる未採番レコードのみを採番する(アプリ全体のスキャンはしない)。
  // あわせて、権限のあるグループのメンバーにのみ一括採番ボタンを表示する。
  kintone.events.on('app.record.index.show', async (event) => {
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
      kintone.app.getHeaderSpaceElement(),
      config,
      appId
    );

    return event;
  });
})(window, kintone);
