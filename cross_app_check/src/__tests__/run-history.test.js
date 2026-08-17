const RunHistory = require('../js/lib/run-history');

const existingRow = (id, runId, runAt, fileKey) => ({
  id,
  value: {
    cac_run_id: { type: 'SINGLE_LINE_TEXT', value: runId },
    cac_run_at: { type: 'SINGLE_LINE_TEXT', value: runAt },
    cac_run_summary: {
      type: 'SINGLE_LINE_TEXT',
      value: '対象10件 / 未提出2件',
    },
    cac_run_file: {
      type: 'FILE',
      value: fileKey
        ? [
            {
              fileKey,
              name: 'cross-app-check.json',
              size: '100',
              contentType: 'application/json',
            },
          ]
        : [],
    },
  },
});

const recordWith = (rows) => ({
  cac_runs: { type: 'SUBTABLE', value: rows },
});

describe('formatSummaryText', () => {
  test('対象件数と未提出件数を1行にまとめる', () => {
    expect(
      RunHistory.formatSummaryText({ baseCount: 120, unsubmittedAny: 34 }),
    ).toBe('対象120件 / 未提出34件');
  });

  test('値が無くても0件として表示する', () => {
    expect(RunHistory.formatSummaryText({})).toBe('対象0件 / 未提出0件');
    expect(RunHistory.formatSummaryText(null)).toBe('対象0件 / 未提出0件');
  });
});

describe('buildRunRow', () => {
  test('新規行はidを持たない(kintoneが新しい行として扱う)', () => {
    const row = RunHistory.buildRunRow({
      runId: 'run-1',
      runAt: '2026-08-18 10:00',
      summaryText: '対象2件 / 未提出1件',
      fileKey: 'temp-key-1',
    });
    expect(row.id).toBeUndefined();
    expect(row.value.cac_run_id.value).toBe('run-1');
    expect(row.value.cac_run_at.value).toBe('2026-08-18 10:00');
    expect(row.value.cac_run_summary.value).toBe('対象2件 / 未提出1件');
    expect(row.value.cac_run_file.value).toEqual([{ fileKey: 'temp-key-1' }]);
  });

  test('fileKeyが無ければ添付は空配列', () => {
    const row = RunHistory.buildRunRow({ runId: 'run-1' });
    expect(row.value.cac_run_file.value).toEqual([]);
  });
});

describe('carryOverRow', () => {
  test('既存行はidと添付ファイルのfileKeyを引き継ぐ', () => {
    const row = RunHistory.carryOverRow(
      existingRow('48290', 'run-0', '2026-08-11 10:00', 'stored-key-0'),
    );
    expect(row.id).toBe('48290');
    expect(row.value.cac_run_id.value).toBe('run-0');
    expect(row.value.cac_run_file.value).toEqual([{ fileKey: 'stored-key-0' }]);
  });

  test('添付が無い行でも落ちない', () => {
    const row = RunHistory.carryOverRow(
      existingRow('1', 'run-0', '2026-08-11 10:00', null),
    );
    expect(row.value.cac_run_file.value).toEqual([]);
  });
});

describe('appendRun', () => {
  const newRow = () =>
    RunHistory.buildRunRow({
      runId: 'run-2',
      runAt: '2026-08-18 10:00',
      summaryText: '対象2件 / 未提出1件',
      fileKey: 'temp-key-2',
    });

  test('新しい行が先頭に来る', () => {
    const rows = RunHistory.appendRun(
      recordWith([existingRow('1', 'run-1', '2026-08-11 10:00', 'k1')]),
      newRow(),
      20,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].value.cac_run_id.value).toBe('run-2');
    expect(rows[1].value.cac_run_id.value).toBe('run-1');
  });

  test('既存行を必ず含める(含めないと消えるため)', () => {
    const rows = RunHistory.appendRun(
      recordWith([
        existingRow('1', 'run-1', '2026-08-11 10:00', 'k1'),
        existingRow('2', 'run-0', '2026-08-04 10:00', 'k0'),
      ]),
      newRow(),
      20,
    );
    expect(rows.map((row) => row.id)).toEqual([undefined, '1', '2']);
    expect(rows[1].value.cac_run_file.value).toEqual([{ fileKey: 'k1' }]);
    expect(rows[2].value.cac_run_file.value).toEqual([{ fileKey: 'k0' }]);
  });

  test('上限を超えたら古い行から落とす', () => {
    const rows = RunHistory.appendRun(
      recordWith([
        existingRow('1', 'run-1', '2026-08-11 10:00', 'k1'),
        existingRow('2', 'run-0', '2026-08-04 10:00', 'k0'),
      ]),
      newRow(),
      2,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].value.cac_run_id.value).toBe('run-2');
    expect(rows[1].value.cac_run_id.value).toBe('run-1');
  });

  test('履歴が空のレコードにも追加できる', () => {
    expect(RunHistory.appendRun({}, newRow(), 20)).toHaveLength(1);
    expect(RunHistory.appendRun(null, newRow(), 20)).toHaveLength(1);
  });

  test('上限が不正なら既定の20件として扱う', () => {
    const many = [];
    for (let i = 0; i < 30; i += 1) {
      many.push(
        existingRow(String(i), `run-${i}`, '2026-08-11 10:00', `k${i}`),
      );
    }
    expect(RunHistory.appendRun(recordWith(many), newRow(), 0)).toHaveLength(
      20,
    );
    expect(
      RunHistory.appendRun(recordWith(many), newRow(), 'abc'),
    ).toHaveLength(20);
  });
});

describe('readRuns', () => {
  test('ドロップダウン用に新しい順で取り出す', () => {
    const runs = RunHistory.readRuns(
      recordWith([
        existingRow('1', 'run-1', '2026-08-04 10:00', 'k1'),
        existingRow('2', 'run-3', '2026-08-18 10:00', 'k3'),
        existingRow('3', 'run-2', '2026-08-11 10:00', 'k2'),
      ]),
    );
    expect(runs.map((run) => run.runId)).toEqual(['run-3', 'run-2', 'run-1']);
    expect(runs[0].fileKey).toBe('k3');
    expect(runs[0].rowId).toBe('2');
    expect(runs[0].summary).toBe('対象10件 / 未提出2件');
  });

  test('履歴が無いレコードでは空配列', () => {
    expect(RunHistory.readRuns({})).toEqual([]);
    expect(RunHistory.readRuns(null)).toEqual([]);
    expect(RunHistory.readRuns(recordWith([]))).toEqual([]);
  });

  test('添付が消されている行でもfileKeyは空文字で返す', () => {
    const runs = RunHistory.readRuns(
      recordWith([existingRow('1', 'run-1', '2026-08-04 10:00', null)]),
    );
    expect(runs[0].fileKey).toBe('');
  });

  test('実行日時が同じなら実行IDの新しい順', () => {
    const runs = RunHistory.readRuns(
      recordWith([
        existingRow('1', '20260818-100000-a', '2026-08-18 10:00', 'k1'),
        existingRow('2', '20260818-100500-b', '2026-08-18 10:00', 'k2'),
      ]),
    );
    expect(runs.map((run) => run.runId)).toEqual([
      '20260818-100500-b',
      '20260818-100000-a',
    ]);
  });
});
