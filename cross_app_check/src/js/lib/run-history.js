(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./app-schema'));
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.RunHistory = factory(root.CrossAppCheck.AppSchema);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (AppSchema) {
  'use strict';

  // 集計アプリの「突合履歴」テーブル(cac_runs)の読み書きを組み立てる純ロジック。
  //
  // 【重要】レコード更新APIでサブテーブルを更新するときは、既存の全行をリクエストに含める
  // 必要がある(含めなかった行は削除される)。行の`id`と、既存行に添付済みのファイルの
  // `fileKey`もそのまま持ち越さないと、過去の結果ファイルが消えてしまう。
  const CODES = AppSchema.FIELD_CODES;

  const textOf = (row, code) => {
    const field = row && row.value ? row.value[code] : null;
    return field && field.value !== null && field.value !== undefined
      ? String(field.value)
      : '';
  };

  const firstFile = (row) => {
    const field = row && row.value ? row.value[CODES.runFile] : null;
    const files = field && Array.isArray(field.value) ? field.value : [];
    return files.length > 0 ? files[0] : null;
  };

  // レコードから履歴の一覧(ドロップダウン用)を取り出す。新しい順に並べる。
  const readRuns = (record) => {
    const table = record ? record[CODES.runs] : null;
    const rows = table && Array.isArray(table.value) ? table.value : [];
    return sortDesc(
      rows.map((row) => {
        const file = firstFile(row);
        return {
          rowId: row.id ? String(row.id) : '',
          runId: textOf(row, CODES.runId),
          runAt: textOf(row, CODES.runAt),
          summary: textOf(row, CODES.runSummary),
          fileKey: file && file.fileKey ? String(file.fileKey) : '',
          fileName: file && file.name ? String(file.name) : '',
        };
      }),
    );
  };

  // 実行日時→実行IDの順で新しい順に並べる(どちらも辞書順で時系列と一致する形式)
  function sortDesc(runs) {
    return runs.slice().sort((a, b) => {
      if (a.runAt !== b.runAt) {
        return a.runAt < b.runAt ? 1 : -1;
      }
      if (a.runId !== b.runId) {
        return a.runId < b.runId ? 1 : -1;
      }
      return 0;
    });
  }

  // サブテーブルに出す概要文
  const formatSummaryText = (summary) => {
    const source = summary || {};
    const baseCount = Number(source.baseCount) || 0;
    const unsubmitted = Number(source.unsubmittedAny) || 0;
    return `対象${baseCount}件 / 未提出${unsubmitted}件`;
  };

  // 新しく追加する1行(idを持たないので新規行として扱われる)
  const buildRunRow = (params) => {
    const row = { value: {} };
    row.value[CODES.runId] = { value: String(params.runId || '') };
    row.value[CODES.runAt] = { value: String(params.runAt || '') };
    row.value[CODES.runSummary] = { value: String(params.summaryText || '') };
    row.value[CODES.runFile] = {
      value: params.fileKey ? [{ fileKey: String(params.fileKey) }] : [],
    };
    return row;
  };

  // 既存行を更新リクエスト用に作り直す。
  // `id`と添付ファイルの`fileKey`を引き継がないと、行や過去の結果ファイルが消える。
  const carryOverRow = (existingRow) => {
    const file = firstFile(existingRow);
    const row = {
      value: {},
    };
    if (existingRow && existingRow.id) {
      row.id = String(existingRow.id);
    }
    row.value[CODES.runId] = { value: textOf(existingRow, CODES.runId) };
    row.value[CODES.runAt] = { value: textOf(existingRow, CODES.runAt) };
    row.value[CODES.runSummary] = {
      value: textOf(existingRow, CODES.runSummary),
    };
    row.value[CODES.runFile] = {
      value: file && file.fileKey ? [{ fileKey: String(file.fileKey) }] : [],
    };
    return row;
  };

  // 新しい行を先頭に足し、上限を超えた古い行を落とした「テーブル全体の値」を返す。
  // (kintone公式が「1つのテーブルに大量の行を追加しない」と明記しているため上限を設ける)
  const appendRun = (record, newRow, maxHistoryRows) => {
    const table = record ? record[CODES.runs] : null;
    const existingRows = table && Array.isArray(table.value) ? table.value : [];
    const carried = existingRows.map(carryOverRow);
    const limit =
      Number.isFinite(Number(maxHistoryRows)) && Number(maxHistoryRows) > 0
        ? Math.floor(Number(maxHistoryRows))
        : 20;
    return [newRow].concat(carried).slice(0, limit);
  };

  return {
    readRuns,
    sortDesc,
    formatSummaryText,
    buildRunRow,
    carryOverRow,
    appendRun,
  };
});
