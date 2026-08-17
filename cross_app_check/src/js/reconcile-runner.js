(function (global) {
  'use strict';

  const NS = global.CrossAppCheck;

  // 突合1回ぶんの流れをまとめた層。
  // データ取得(RecordsClient) → 突合(Reconcile) → JSON化(ResultSchema) →
  // 添付(FileClient) → 履歴テーブルへ追記(RunHistory) の順に呼ぶだけで、
  // 判断ロジックはすべて js/lib 配下の純粋関数側に置いている。
  const run = async (params) => {
    const config = params.config;
    const summaryAppId = params.summaryAppId;
    const summaryRecordId = params.summaryRecordId;
    const onProgress = params.onProgress || (() => {});

    const runId = NS.RunId.createRunId(new Date());
    const runAtIso = NS.RunId.toIsoString(new Date());

    onProgress(
      `基準アプリ(${config.baseApp.appName || config.baseApp.appId})を読み込んでいます...`,
    );
    const base = await NS.RecordsClient.fetchAllRecords(
      config.baseApp.appId,
      config.baseApp.query,
      [config.baseApp.keyFieldCode, config.baseApp.nameFieldCode],
      config.limits.maxBaseRecords,
    );

    // 対象アプリは逐次で読む(並列にするとAPI実行数が一気に跳ねるため)
    const targetRecordSets = [];
    const truncatedTargets = [];
    for (let i = 0; i < config.targets.length; i += 1) {
      const target = config.targets[i];
      onProgress(
        `対象アプリ(${target.label || target.appName || target.appId})を読み込んでいます... [${i + 1}/${config.targets.length}]`,
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
      config,
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

  NS.ReconcileRunner = { run };
})(typeof window !== 'undefined' ? window : globalThis);
