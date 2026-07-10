(function (global) {
  'use strict';

  const NS = global.RelatedRecordSummary;

  // config.rows の1行(集計設定)を、自アプリのフィールド設定(formFields, kintone.app.getFormFields()の
  // 戻り値)と対象レコード(sourceRecord)から実際に集計し、書き込む値を返す。
  //
  // formFields[row.referenceFieldCode].referenceTable が null の場合、参照先アプリに
  // 閲覧・追加・アプリ管理権限のいずれも無いことを意味する(REST APIドキュメントに明記)。
  // このケースはエラーとして呼び出し元に伝播させ、書き込みを中止させる(idea.md参照)。
  const computeRow = async (row, formFields, sourceRecord) => {
    const fieldDef = formFields[row.referenceFieldCode];
    const referenceTable = fieldDef && fieldDef.referenceTable;
    if (!referenceTable) {
      throw new Error(
        `関連レコード一覧フィールド(${row.referenceFieldCode})の設定を取得できませんでした。参照先アプリの閲覧権限がない可能性があります。`,
      );
    }

    const conditionFieldCode = referenceTable.condition.field;
    const matchField = sourceRecord[conditionFieldCode];
    const matchValue = matchField ? matchField.value : '';
    const matchFieldDef = formFields[conditionFieldCode];
    const isNumericMatchField = Boolean(
      matchFieldDef && matchFieldDef.type === 'NUMBER',
    );

    const query = NS.QueryBuilder.build(referenceTable, {
      matchValue,
      isNumericMatchField,
      exclusionCond: row.exclusionCond || '',
    });
    const relatedAppId = referenceTable.relatedApp.app;

    if (row.summaryType === 'COUNT') {
      return NS.RelatedRecordClient.fetchCount(relatedAppId, query);
    }
    const records = await NS.RelatedRecordClient.fetchRecordsForAggregation(
      relatedAppId,
      query,
      row.targetFieldCode,
    );
    return NS.Aggregator.aggregate(
      records,
      row.summaryType,
      row.targetFieldCode,
    );
  };

  // config.rows すべてを集計し、{ 書き込み先フィールドコード: 値 } のオブジェクトを返す。
  // rowsは逐次実行する(secureCodingGuidelineの「並列実行をなるべく避ける」に対応)。
  const computeAll = async (config, formFields, sourceRecord) => {
    const updates = {};
    for (const row of config.rows) {
      updates[row.writeFieldCode] = await computeRow(
        row,
        formFields,
        sourceRecord,
      );
    }
    return updates;
  };

  NS.SummaryService = { computeRow, computeAll };
})(window);
