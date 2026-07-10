(function (global) {
  'use strict';

  // 設定・検索条件・取得・変換・上限判定・書き込みを1回の実行としてつなぐオーケストレーション層。
  // 各ステップの実処理は純粋関数(js/lib/*)またはrecords-client.js/subtable-writer.jsに委譲する。

  const NS = global.RecordsToSubtable;

  // recordApiは kintone.app.record または kintone.mobile.app.record。
  const runImport = async (config, recordApi) => {
    const currentRecord = recordApi.get().record;

    const baseQuery = NS.QueryBuilder.buildQuery(
      config.conditions,
      currentRecord,
    );
    const sourceFieldCodes = config.fieldMappings.map(
      (mapping) => mapping.sourceFieldCode,
    );

    const sourceRecords = await NS.RecordsClient.fetchAllRecords(
      config.sourceAppId,
      baseQuery,
      sourceFieldCodes,
      config.maxRecords,
    );

    const rows = NS.RowMapper.mapRecordsToRows(
      sourceRecords,
      config.fieldMappings,
    );
    const limited = NS.LimitGuard.applyLimit(rows, config.maxRecords);

    // 既存行の扱いは全置換(確定仕様): クリアしてから取得結果で丸ごと上書きする。
    NS.SubtableWriter.replaceSubtableRows(
      recordApi,
      config.subtableFieldCode,
      limited.rows,
    );

    return limited;
  };

  NS.ImportRunner = { runImport };
})(window);
