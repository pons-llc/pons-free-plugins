(function (root) {
  'use strict';

  // 一括承認の書き戻し(PUT /k/v1/records/status.json)を100件ずつに分割して実行するロジック。
  // age_grade_field_update/bulk_field_updateのbatch-writer.jsを移植したうえで、
  // 「非競合エラーもスキップして続行する」点だけ本プラグイン固有に変更している
  // (idea.md「実行」の「他プラグインとの相違点」参照。承認作業では他ユーザーに先に処理された等の
  // 正常な業務エラーが起こりうるため、1件のエラーで全体を中断しない設計にしている)。
  //
  // 注意: PUT /k/v1/records/status.jsonも他の複数件書き込みAPIと同様「1件でも失敗すると
  // リクエスト全体が失敗する」前提で設計する。バッチ送信が失敗した場合のみ、そのバッチ内の
  // レコードを1件ずつ PUT /k/v1/record/status.json で送り直し、失敗したものだけをスキップする。

  const WRITE_BATCH_SIZE = 100;

  const chunk = (records, size = WRITE_BATCH_SIZE) => {
    const chunks = [];
    for (let i = 0; i < records.length; i += size) {
      chunks.push(records.slice(i, i + size));
    }
    return chunks;
  };

  // records: [{ id, revision, action }]
  // deps: { putBatch(records): Promise, putSingle(record): Promise }
  const writeChunkWithFallback = async (records, { putBatch, putSingle }) => {
    try {
      await putBatch(records);
      return { updated: records.map((r) => r.id), skipped: [] };
    } catch {
      const updated = [];
      const skipped = [];
      for (const record of records) {
        try {
          await putSingle(record);
          updated.push(record.id);
        } catch (singleErr) {
          skipped.push({
            id: record.id,
            reason: singleErr.message || 'unknown error',
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

  // 実行完了後の結果表示用テキストを組み立てる。
  // ineligibleCount: partitionForAction()で最初から対象外にしたレコード数(idea.md参照)。
  const buildResultSummary = ({
    totalTarget,
    updatedCount,
    skipped,
    ineligibleCount,
  }) => {
    const lines = [
      `実行対象レコード数: ${totalTarget}件`,
      `実行に成功したレコード数: ${updatedCount}件`,
      `実行に失敗しスキップしたレコード数: ${skipped.length}件`,
    ];
    if (ineligibleCount) {
      lines.push(
        `選択されていたが対象外だったレコード数: ${ineligibleCount}件`,
      );
    }
    if (skipped.length > 0) {
      const reasons = skipped.map((s) => `${s.id}(${s.reason})`).join(', ');
      lines.push(`スキップしたレコード: ${reasons}`);
    }
    return lines.join('\n');
  };

  const BatchWriter = {
    WRITE_BATCH_SIZE,
    chunk,
    writeChunkWithFallback,
    runAll,
    buildResultSummary,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchWriter;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.BatchWriter = BatchWriter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
