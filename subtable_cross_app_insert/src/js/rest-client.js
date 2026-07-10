(function (global, kintone) {
  'use strict';

  const NS = global.SubtableCrossAppInsert;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  // config.subtableCode/updateKey/fieldMappings から UPSERT用のマッピング情報を組み立てる。
  const toMapping = (config) => ({
    updateKey: config.updateKey,
    fieldMappings: config.fieldMappings,
  });

  // サブテーブルの行を転送先アプリへUPSERTで書き込む。
  // kintoneセキュアコーディングガイドライン(短時間で大量のリクエストを避ける/並列実行を避ける)に
  // したがい、100件ずつのリクエストを並列ではなく逐次(for...of)実行する。
  // 途中のリクエストが失敗した場合、それ以前のリクエストは既に反映済みであるため、
  // エラーオブジェクトに`completedChunks`(成功済みのリクエスト数)を積んで再送出する。
  const pushRows = async (config, sourceRecord, rows) => {
    const mapping = toMapping(config);
    const bodies = NS.UpsertBatch.buildRequestBodies(
      config.destinationAppId,
      mapping,
      sourceRecord,
      rows,
    );

    let completedChunks = 0;
    for (const body of bodies) {
      try {
        await kintone.api(recordsUrl(), 'PUT', body);
        completedChunks += 1;
      } catch (err) {
        const wrapped = new Error(
          `転送先アプリへのUPSERTに失敗しました(${completedChunks}/${bodies.length}件分のリクエストは成功済み): ${err.message || err}`,
        );
        wrapped.cause = err;
        wrapped.completedChunks = completedChunks;
        wrapped.totalChunks = bodies.length;
        throw wrapped;
      }
    }

    return {
      totalChunks: bodies.length,
      completedChunks,
      transferredRowCount: rows.length,
    };
  };

  // 転送成功時アクション: 自レコードの指定フィールドへ値を書き込む(手動転送時のみ。
  // submit時は同一イベント内でevent.recordを書き換えるため、この関数は使わない)。
  const updateSelfField = (appId, recordId, revision, fieldCode, value) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      revision,
      record: { [fieldCode]: { value } },
    });

  const RestClient = { pushRows, updateSelfField, toMapping };

  NS.RestClient = RestClient;
})(window, kintone);
