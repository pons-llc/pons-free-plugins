(function (root) {
  'use strict';

  // 生成したrecords配列を100件チャンクに分割し、逐次POST /k/v1/records.jsonする。
  // idea.md「実行時UX」参照。secureCodingGuideline「短時間で大量のリクエスト送信を避ける」
  // 「並列で実行するのをなるべく避ける」に従い、Promise.all等の並列実行は行わない(for...of)。
  //
  // POST /k/v1/records.jsonは、bulk_field_updateが使うPUTと異なり「バッチ内で1件でも
  // 失敗すると、そのバッチに含めたレコードの登録はすべてキャンセルされる」全か無かの
  // 挙動である(kintoneドキュメントMCP「複数のレコードを登録する」補足で確認済み)。そのため
  // PUTのような1件ずつのフォールバックは行わず、失敗したバッチはそのまま失敗として記録し、
  // 後続のバッチの送信は継続する(先行して成功したバッチの内容は残る)。
  const CHUNK_SIZE = 100;

  const chunk = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // records: POST /k/v1/records.json用のrecordオブジェクトの配列
  // dependencies.postBatch: (recordsChunk) => Promise<{ ids, revisions }>
  //   (kintone.api()呼び出し自体は呼び出し元(bulk-create.js)が注入する)
  // 戻り値: {
  //   totalCount, createdCount,
  //   batches: [{ startIndex, endIndex, count, status: 'SUCCESS' | 'FAILURE', error? }],
  // }(startIndex/endIndexは0始まりのrecords配列上のインデックス)
  const createAll = async (records, { postBatch }) => {
    const chunks = chunk(records, CHUNK_SIZE);
    const batches = [];
    let createdCount = 0;
    let cursor = 0;

    for (const recordsChunk of chunks) {
      const startIndex = cursor;
      const endIndex = cursor + recordsChunk.length - 1;
      try {
        await postBatch(recordsChunk);
        batches.push({
          startIndex,
          endIndex,
          count: recordsChunk.length,
          status: 'SUCCESS',
        });
        createdCount += recordsChunk.length;
      } catch (err) {
        batches.push({
          startIndex,
          endIndex,
          count: recordsChunk.length,
          status: 'FAILURE',
          error: err.message,
        });
      }
      cursor = endIndex + 1;
    }

    return { totalCount: records.length, createdCount, batches };
  };

  // 実行結果(createAll()の戻り値)を人が読めるサマリー文字列に変換する。
  const buildResultSummary = ({ totalCount, createdCount, batches }) => {
    const lines = [`${totalCount}件中${createdCount}件を作成しました。`];
    const failedBatches = batches.filter((b) => b.status === 'FAILURE');
    failedBatches.forEach((b) => {
      lines.push(
        `${b.startIndex + 1}件目〜${b.endIndex + 1}件目の作成に失敗しました(理由: ${b.error})。`,
      );
    });
    return lines.join('\n');
  };

  const BatchCreator = { createAll, buildResultSummary, CHUNK_SIZE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchCreator;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.BatchCreator = BatchCreator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
