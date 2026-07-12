(function (root) {
  'use strict';

  // 一括実行の書き戻し(PUT /k/v1/records.json)を100件ずつに分割し、
  // revision競合(409)が起きたレコードをスキップして次へ進めるためのロジック
  // (related_record_summaryのjs/lib/batch-writer.jsと同じ設計)。
  //
  // 注意: PUT /k/v1/records.jsonは「1件でも失敗するとリクエスト全体がキャンセルされる」仕様のため、
  // バッチ送信が失敗した場合のみ、そのバッチ内のレコードを1件ずつ個別にPUT /k/v1/record.jsonで
  // 送り直し、競合したものだけを最終的にスキップするフォールバック方式にしている。

  const WRITE_BATCH_SIZE = 100;

  const chunk = (records, size = WRITE_BATCH_SIZE) => {
    const chunks = [];
    for (let i = 0; i < records.length; i += size) {
      chunks.push(records.slice(i, i + size));
    }
    return chunks;
  };

  // kintone REST APIのエラーレスポンス({id, code, message})から、revision競合によるものかどうかを
  // 判定する。正確なcode値はドキュメント上で網羅的に一覧化されていないため、既知の候補コード
  // (GAIA_CO02)とメッセージの文言(「リビジョン」/「revision」を含む)のどちらかに一致すれば
  // 競合とみなすヒューリスティックにしている(実環境での実際のレスポンスを確認・調整すること)。
  const isRevisionConflictError = (error) => {
    if (!error) {
      return false;
    }
    if (error.code === 'GAIA_CO02') {
      return true;
    }
    const message = typeof error.message === 'string' ? error.message : '';
    return (
      message.includes('リビジョン') ||
      message.toLowerCase().includes('revision')
    );
  };

  const writeChunkWithFallback = async (
    records,
    { putBatch, putSingle, isConflictError },
  ) => {
    const conflictCheck = isConflictError || isRevisionConflictError;
    try {
      await putBatch(records);
      return { updated: records.map((r) => r.id), skipped: [] };
    } catch (err) {
      if (!conflictCheck(err)) {
        throw err;
      }
      const updated = [];
      const skipped = [];
      for (const record of records) {
        try {
          await putSingle(record);
          updated.push(record.id);
        } catch (singleErr) {
          if (!conflictCheck(singleErr)) {
            throw singleErr;
          }
          skipped.push({
            id: record.id,
            recordNumber: record.recordNumber,
            reason: singleErr.message || 'revision conflict',
          });
        }
      }
      return { updated, skipped };
    }
  };

  const runAll = async (records, deps) => {
    const chunks = chunk(records, WRITE_BATCH_SIZE);
    const result = { updatedCount: 0, skipped: [] };
    for (const c of chunks) {
      const { updated, skipped } = await writeChunkWithFallback(c, deps);
      result.updatedCount += updated.length;
      result.skipped.push(...skipped);
    }
    return result;
  };

  const buildResultSummary = ({ totalTarget, updatedCount, skipped }) => {
    const lines = [
      `対象レコード数: ${totalTarget}件`,
      `更新に成功したレコード数: ${updatedCount}件`,
      `revision競合によりスキップしたレコード数: ${skipped.length}件`,
    ];
    if (skipped.length > 0) {
      const numbers = skipped
        .map((s) => s.recordNumber)
        .filter((n) => n !== undefined && n !== null)
        .join(', ');
      lines.push(`スキップしたレコード番号: ${numbers}`);
    }
    return lines.join('\n');
  };

  const BatchWriter = {
    WRITE_BATCH_SIZE,
    chunk,
    isRevisionConflictError,
    writeChunkWithFallback,
    runAll,
    buildResultSummary,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchWriter;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.BatchWriter = BatchWriter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
