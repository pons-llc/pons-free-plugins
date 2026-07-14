(function (global, kintone) {
  'use strict';

  const NS = global.FiscalYearNumbering;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // kintone.plugin.app.getConfig()は、画面表示直後の最初の呼び出しでは内部準備が間に合わず
  // null を返すことがある(プラグインが本当に未設定の場合の null と区別がつかない)。
  // 実機検証で、同一ページ内の2つ目以降のイベントでは正しい値が返ることを確認したため、
  // 短い間隔でのリトライにより取得できない場合だけ「未設定」として扱う。
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

  // 採番結果を保存するフィールドは常にプラグインが書き込む値なので、どの画面でも手入力できないように
  // しておく。event.recordを書き換えてreturnするだけ(record.set()は呼ばない)なので、
  // create.showハンドラー内で踏んだ「イベントハンドラー内ではrecord.set()を呼べない」制限には
  // 抵触しない。
  const disableNumberField = (record, config) => {
    const field = record[config.numberFieldCode];
    if (field) {
      field.disabled = true;
    }
  };

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], async (event) => {
    const config = await loadConfig();
    if (isConfigured(config)) {
      disableNumberField(event.record, config);
    }
    return event;
  });

  // 一覧画面のインライン編集(モバイルには存在しないイベントのためdesktop.jsのみ)。
  kintone.events.on('app.record.index.edit.show', async (event) => {
    const config = await loadConfig();
    if (isConfigured(config)) {
      disableNumberField(event.record, config);
    }
    return event;
  });

  // 作成画面の保存: 採番タイミングが「保存時」で、かつ未採番のまま保存されようとしている場合のみ採番する。
  // NOTE: 表示直後(create.show)での先行計算はあえて行わない。computeNext()成功後に
  // kintone.app.record.set()を呼ぶ必要があるが、record.set()は「kintone.events.on()の
  // イベントハンドラー内では実行できません」という制限があり(公式ドキュメント参照)、
  // create.showハンドラー内のPromise.then()から呼ぶとカウンター専用アプリのレコードだけ
  // 消費されて画面には反映されない不具合になることを確認した。
  kintone.events.on('app.record.create.submit', async (event) => {
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

  // 詳細画面: 採番タイミングが「保存時」の場合のみ、外部フォーム等から採番されずに登録された
  // レコードをここで採番し、REST APIで永続化する(event.recordの書き換えは表示のみに影響し、
  // サーバーには保存されないため)。「ボタン押下時」「ステータス変化時」を選んでいる場合は、
  // 管理者が意図したタイミング以外で勝手に採番されないよう、この救済動作自体を行わない。
  kintone.events.on('app.record.detail.show', async (event) => {
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
        kintone.app.record.getHeaderMenuSpaceElement(),
        config,
        appId,
        event.recordId,
        event.record.$revision.value,
        event.record,
        (record) => kintone.app.record.set(record)
      );
    }

    return event;
  });

  // プロセス管理でアクションを実行する前のイベント。採番タイミングが「ステータス変化時」で、
  // かつ変更後のステータスが設定した採番トリガーのステータスと一致する場合にのみ採番する。
  // event.recordを書き換えてreturnすることで、ステータス更新と同じ保存処理の中で反映される
  // (record.set()を使わないため、create.showで踏んだ制限には抵触しない)。
  kintone.events.on('app.record.detail.process.proceed', async (event) => {
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

  // 一覧画面: 採番タイミングが「保存時」の場合のみ、表示中のページに含まれる未採番レコードを採番する
  // (アプリ全体のスキャンはしない)。あわせて、権限のあるグループのメンバーにのみ一括採番ボタンを表示する
  // (一括採番ボタン自体はタイミング設定に関わらず常に使える安全弁)。
  kintone.events.on('app.record.index.show', async (event) => {
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
      kintone.app.getHeaderSpaceElement(),
      config,
      appId
    );

    return event;
  });
})(window, kintone);
