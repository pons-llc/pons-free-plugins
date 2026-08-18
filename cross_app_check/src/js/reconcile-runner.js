(function (global) {
  'use strict';

  const NS = global.CrossAppCheck;

  // 突合1回ぶんの流れをまとめた層。
  // データ取得(RecordsClient) → 突合(Reconcile) → JSON化(ResultSchema) →
  // 添付(FileClient) → 履歴テーブルへ追記(RunHistory) の順に呼ぶだけで、
  // 判断ロジックはすべて js/lib 配下の純粋関数側に置いている。
  //
  // 「どのアプリを・どのキーで・どの条件で」はレコード単位の`definition`、
  // 「提出済/未提出の表記」と「上限」はアプリ共通の`config`から受け取る。
  const run = async (params) => {
    const definition = params.definition;
    const config = params.config;
    const summaryAppId = params.summaryAppId;
    const summaryRecordId = params.summaryRecordId;
    const onProgress = params.onProgress || (() => {});

    const runId = NS.RunId.createRunId(new Date());
    const runAtIso = NS.RunId.toIsoString(new Date());
    const baseApp = definition.baseApp;

    onProgress(
      `基準アプリ(${baseApp.appName || baseApp.appId})を読み込んでいます...`,
    );
    const base = await NS.RecordsClient.fetchAllRecords(
      baseApp.appId,
      baseApp.query,
      [baseApp.keyFieldCode, baseApp.nameFieldCode],
      config.limits.maxBaseRecords,
    );

    // 対象アプリは逐次で読む(並列にするとAPI実行数が一気に跳ねるため)
    const targetRecordSets = [];
    const truncatedTargets = [];
    for (let i = 0; i < definition.targets.length; i += 1) {
      const target = definition.targets[i];
      onProgress(
        `対象アプリ(${target.label || target.appName || target.appId})を読み込んでいます... [${i + 1}/${definition.targets.length}]`,
      );
      const fetched = await NS.RecordsClient.fetchAllRecords(
        target.appId,
        target.query,
        [target.keyFieldCode, target.dateFieldCode],
        config.limits.maxBaseRecords,
      );
      targetRecordSets.push(fetched.records);
      if (fetched.truncated) {
        truncatedTargets.push(target.label || target.appName || target.appId);
      }
    }

    onProgress('突合しています...');
    const result = NS.Reconcile.buildResult({
      definition,
      labels: config.labels,
      baseRecords: base.records,
      targetRecordSets,
      runId,
      runAt: runAtIso,
    });

    onProgress('結果を保存しています...');
    const fileKey = await NS.FileClient.uploadJson(
      NS.ResultSchema.serialize(result),
      NS.RunId.buildFileName(runId),
    );

    // 履歴の持ち越しに使うため、直前の状態をAPIで取り直す
    // (画面のイベントオブジェクトのレコードは古い可能性がある)
    const currentRecord = await NS.RecordsClient.fetchRecord(
      summaryAppId,
      summaryRecordId,
    );
    const newRow = NS.RunHistory.buildRunRow({
      runId,
      runAt: NS.RunId.formatLocal(runAtIso),
      summaryText: NS.RunHistory.formatSummaryText(result.summary),
      fileKey,
    });
    const rows = NS.RunHistory.appendRun(
      currentRecord,
      newRow,
      config.limits.maxHistoryRows,
    );

    const record = {};
    record[NS.AppSchema.FIELD_CODES.runs] = { value: rows };
    await NS.RecordsClient.updateRecord(summaryAppId, summaryRecordId, record);

    return {
      result,
      runId,
      baseTruncated: base.truncated,
      truncatedTargets,
    };
  };

  // 突合定義だけをレコードへ保存する(設定UIの「保存」)。
  // 履歴テーブルには触らないので、既存行を持ち越す必要はない。
  const saveDefinition = (summaryAppId, summaryRecordId, definition) => {
    const record = {};
    record[NS.AppSchema.FIELD_CODES.definition] = {
      value: NS.DefinitionStore.serialize(definition),
    };
    return NS.RecordsClient.updateRecord(summaryAppId, summaryRecordId, record);
  };

  NS.ReconcileRunner = { run, saveDefinition };
})(typeof window !== 'undefined' ? window : globalThis);
