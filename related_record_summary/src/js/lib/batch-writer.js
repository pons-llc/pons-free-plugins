(function (root) {
  'use strict';

  // 一括集計の書き戻し(PUT /k/v1/records.json)を100件ずつに分割し、
  // revision競合(409)が起きたレコードをスキップして次へ進めるためのロジック。
  //
  // 注意(判断記録.md参照): PUT /k/v1/records.jsonは「1件でも失敗するとリクエスト全体が
  // キャンセルされる」仕様のため、100件のバッチ全体を1回のリクエストで送るだけでは
  // 「競合レコードだけスキップして他は反映する」ことができない。
  // そこで、バッチ送信が失敗した場合のみ、そのバッチ内のレコードを1件ずつ個別に
  // PUT /k/v1/record.json で送り直し、競合したものだけを最終的にスキップする
  // フォールバック方式にしている。

  const WRITE_BATCH_SIZE = 100;

  // レコード配列をWRITE_BATCH_SIZE件ずつのチャンクに分割する。
  const chunk = (records, size = WRITE_BATCH_SIZE) => {
    const chunks = [];
    for (let i = 0; i < records.length; i += size) {
      chunks.push(records.slice(i, i + size));
    }
    return chunks;
  };

  // kintone REST APIのエラーレスポンス({id, code, message})から、
  // revision(リビジョン)競合によるものかどうかを判定する。
  // NOTE: revision競合時の正確な code 値はドキュメント上で網羅的に一覧化されていないため、
  // 既知の候補コード(GAIA_CO02)とメッセージの文言(「リビジョン」/「revision」を含む)の
  // どちらかに一致すれば競合とみなすヒューリスティックにしている。
  // 実環境での実際のレスポンスをPuppeteerで確認し、必要なら調整すること(security-checklist.md参照)。
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

  // 1チャンク(最大100件)を書き戻す。バッチ送信が失敗した場合のみ、1件ずつの
  // 個別送信にフォールバックし、競合したレコードだけをskippedとして集計する。
  // 競合以外のエラーはそのまま呼び出し元へ再スローする(想定外の状態で処理を続けない)。
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

  // 対象レコード全体(100件超も可)を、チャンクごとにwriteChunkWithFallbackで書き戻し、
  // 更新件数・スキップ件数/レコード番号一覧を集計する。
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

  // 実行完了後の結果表示用テキストを組み立てる。
  const buildResultSummary = ({ totalTarget, updatedCount, skipped }) => {
    const lines = [
      `対象レコード数: ${totalTarget}件`,
      `集計・更新に成功したレコード数: ${updatedCount}件`,
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
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.BatchWriter = BatchWriter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
