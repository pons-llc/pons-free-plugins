(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./match-key'),
      require('./display-value'),
    );
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.Reconcile = factory(
      root.CrossAppCheck.MatchKey,
      root.CrossAppCheck.DisplayValue,
    );
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  function (MatchKey, DisplayValue) {
    'use strict';

    // 基準アプリのレコードを母集団とし、対象アプリそれぞれに同じキーのレコードが
    // 存在するかを突き合わせて「提出済/未提出」の表を組み立てる中核ロジック。
    // kintoneに一切依存しない純粋関数(レコード配列はREST APIの`records`をそのまま渡す)。
    const RESULT_SCHEMA_VERSION = 1;

    const recordId = (record) =>
      record && record.$id && record.$id.value ? String(record.$id.value) : '';

    // 提出日の最大値を求める。
    // DATE("2026-04-01")もDATETIME("2026-04-01T01:00:00Z")も、
    // 同じフィールドの値どうしなら文字列の辞書順比較が日時の大小と一致する。
    const latestDate = (records, dateFieldCode) => {
      if (!dateFieldCode) {
        return null;
      }
      let latest = null;
      (records || []).forEach((record) => {
        const field = record[dateFieldCode];
        if (!field || field.value === null || field.value === undefined) {
          return;
        }
        const text = String(field.value);
        if (text === '') {
          return;
        }
        if (latest === null || text > latest) {
          latest = text;
        }
      });
      return latest;
    };

    // 基準アプリのレコードを、正規化済みキーごとに1行へまとめる。
    // 同じキーのレコードが複数あるとき(重複提出など)は1行に統合し、
    // レコードIDを配列で保持する。キーが空のレコードは突合できないため除外して数える。
    const buildBaseRows = (baseRecords, baseApp) => {
      const rows = [];
      const rowByKey = new Map();
      let skippedNoKey = 0;

      (baseRecords || []).forEach((record) => {
        const key = MatchKey.extractKey(
          record,
          baseApp.keyFieldCode,
          baseApp.keyFieldType,
        );
        if (key === '') {
          skippedNoKey += 1;
          return;
        }
        const existing = rowByKey.get(key);
        if (existing) {
          existing.baseRecordIds.push(recordId(record));
          return;
        }
        const row = {
          key,
          name: DisplayValue.extractDisplayValue(record, baseApp.nameFieldCode),
          baseRecordIds: [recordId(record)],
          targets: [],
        };
        rowByKey.set(key, row);
        rows.push(row);
      });

      return { rows, skippedNoKey };
    };

    const targetLabel = (target) =>
      target.label || target.appName || `アプリ${target.appId}`;

    const buildResult = (params) => {
      const config = params.config;
      const baseApp = config.baseApp;
      const targets = config.targets || [];
      const targetRecordSets = params.targetRecordSets || [];

      const built = buildBaseRows(params.baseRecords, baseApp);
      const rows = built.rows;

      const perTarget = targets.map((target, position) => {
        const keyIndex = MatchKey.indexRecordsByKey(
          targetRecordSets[position] || [],
          target.keyFieldCode,
          target.keyFieldType,
        );
        let submitted = 0;

        rows.forEach((row) => {
          const matched = keyIndex.get(row.key) || [];
          if (matched.length > 0) {
            submitted += 1;
          }
          row.targets.push({
            submitted: matched.length > 0,
            count: matched.length,
            lastDate: latestDate(matched, target.dateFieldCode),
            recordIds: matched.map(recordId).filter((id) => id !== ''),
          });
        });

        return {
          label: targetLabel(target),
          appId: target.appId,
          submitted,
          unsubmitted: rows.length - submitted,
        };
      });

      const unsubmittedAny = rows.filter((row) =>
        row.targets.some((cell) => !cell.submitted),
      ).length;

      return {
        schemaVersion: RESULT_SCHEMA_VERSION,
        runId: params.runId,
        runAt: params.runAt,
        labels: config.labels,
        baseApp: {
          appId: baseApp.appId,
          name: baseApp.appName,
          query: baseApp.query,
          keyFieldCode: baseApp.keyFieldCode,
          nameFieldCode: baseApp.nameFieldCode,
        },
        targets: targets.map((target, position) => ({
          appId: target.appId,
          label: perTarget[position].label,
          query: target.query,
          keyFieldCode: target.keyFieldCode,
          dateFieldCode: target.dateFieldCode,
        })),
        summary: {
          baseCount: rows.length,
          skippedNoKey: built.skippedNoKey,
          unsubmittedAny,
          perTarget,
        },
        rows,
      };
    };

    return {
      RESULT_SCHEMA_VERSION,
      buildResult,
      buildBaseRows,
      latestDate,
    };
  },
);
