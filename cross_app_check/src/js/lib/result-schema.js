(function (root) {
  'use strict';

  // 突合結果JSONの入出力。
  //
  // 【セキュリティ上の前提】添付ファイルはレコードの編集権限を持つ人が差し替えられる。
  // つまりビューワが読むJSONは「信用できない入力」である。
  // 描画に使う前にここで構造と型をすべて検証し、想定外の値は落とす。
  // (`href`に使うレコードIDは数字のみ、といった検証もここで済ませる)
  const SUPPORTED_SCHEMA_VERSION = 1;

  const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  const asText = (value) => {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const asCount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
  };

  // レコードIDはリンクの組み立てに使うため、数字だけからなる文字列のみ通す
  const asRecordIds = (value) =>
    Array.isArray(value)
      ? value.map(asText).filter((id) => /^[0-9]+$/.test(id))
      : [];

  // アプリIDも同様に数字のみ
  const asAppId = (value) => {
    const text = asText(value);
    return /^[0-9]+$/.test(text) ? text : '';
  };

  const sanitizeTargetCell = (raw) => {
    const cell = isPlainObject(raw) ? raw : {};
    const recordIds = asRecordIds(cell.recordIds);
    const count = asCount(cell.count);
    return {
      submitted: cell.submitted === true,
      count,
      lastDate:
        typeof cell.lastDate === 'string' && cell.lastDate !== ''
          ? cell.lastDate
          : null,
      recordIds,
    };
  };

  const sanitizeRow = (raw, targetCount) => {
    const row = isPlainObject(raw) ? raw : {};
    const cells = Array.isArray(row.targets) ? row.targets : [];
    const targets = [];
    for (let i = 0; i < targetCount; i += 1) {
      targets.push(sanitizeTargetCell(cells[i]));
    }
    return {
      key: asText(row.key),
      name: asText(row.name),
      baseRecordIds: asRecordIds(row.baseRecordIds),
      targets,
    };
  };

  const sanitizeTargetMeta = (raw) => {
    const target = isPlainObject(raw) ? raw : {};
    return {
      appId: asAppId(target.appId),
      label: asText(target.label),
      query: asText(target.query),
      keyFieldCode: asText(target.keyFieldCode),
      dateFieldCode: asText(target.dateFieldCode),
    };
  };

  const sanitize = (raw) => {
    const source = isPlainObject(raw) ? raw : {};
    const targets = (Array.isArray(source.targets) ? source.targets : []).map(
      sanitizeTargetMeta,
    );
    const baseApp = isPlainObject(source.baseApp) ? source.baseApp : {};
    const summary = isPlainObject(source.summary) ? source.summary : {};
    const perTargetRaw = Array.isArray(summary.perTarget)
      ? summary.perTarget
      : [];
    const labels = isPlainObject(source.labels) ? source.labels : {};

    const rows = (Array.isArray(source.rows) ? source.rows : []).map((row) =>
      sanitizeRow(row, targets.length),
    );

    return {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      runId: asText(source.runId),
      runAt: asText(source.runAt),
      labels: {
        submitted: asText(labels.submitted) || '提出済',
        unsubmitted: asText(labels.unsubmitted) || '未提出',
      },
      baseApp: {
        appId: asAppId(baseApp.appId),
        name: asText(baseApp.name),
        query: asText(baseApp.query),
        keyFieldCode: asText(baseApp.keyFieldCode),
        nameFieldCode: asText(baseApp.nameFieldCode),
      },
      targets,
      summary: {
        baseCount: asCount(summary.baseCount),
        skippedNoKey: asCount(summary.skippedNoKey),
        unsubmittedAny: asCount(summary.unsubmittedAny),
        perTarget: targets.map((target, position) => {
          const entry = isPlainObject(perTargetRaw[position])
            ? perTargetRaw[position]
            : {};
          return {
            label: asText(entry.label) || target.label,
            appId: target.appId,
            submitted: asCount(entry.submitted),
            unsubmitted: asCount(entry.unsubmitted),
          };
        }),
      },
      rows,
    };
  };

  const serialize = (result) => JSON.stringify(result);

  // JSON文字列を検証済みの結果オブジェクトへ。壊れていれば例外を投げる。
  const parse = (text) => {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('結果ファイルのJSONを読み取れませんでした。');
    }
    if (!isPlainObject(raw)) {
      throw new Error('結果ファイルの形式が正しくありません。');
    }
    if (Number(raw.schemaVersion) !== SUPPORTED_SCHEMA_VERSION) {
      throw new Error(
        `このプラグインが対応していない結果ファイルの形式です(schemaVersion: ${raw.schemaVersion})。`,
      );
    }
    return sanitize(raw);
  };

  const ResultSchema = {
    SUPPORTED_SCHEMA_VERSION,
    serialize,
    parse,
    sanitize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResultSchema;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.ResultSchema = ResultSchema;
  }
})(typeof window !== 'undefined' ? window : globalThis);
