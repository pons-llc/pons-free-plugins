const RunId = require('../js/lib/run-id');

describe('createRunId', () => {
  test('実行日時が読み取れる形式で、末尾に識別子が付く', () => {
    const id = RunId.createRunId(new Date(2026, 7, 18, 10, 5, 3), 'ab12');
    expect(id).toBe('20260818-100503-ab12');
  });

  test('乱数を渡さなくても毎回異なるIDになる', () => {
    const date = new Date(2026, 7, 18, 10, 0, 0);
    const ids = new Set();
    for (let i = 0; i < 50; i += 1) {
      ids.add(RunId.createRunId(date));
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('toIsoString', () => {
  test('UTCのISO 8601文字列にする', () => {
    expect(RunId.toIsoString(new Date(Date.UTC(2026, 7, 18, 1, 0, 0)))).toBe(
      '2026-08-18T01:00:00.000Z',
    );
  });
});

describe('formatLocal', () => {
  test('ISO文字列をローカル時刻の「YYYY-MM-DD HH:mm」にする', () => {
    const iso = new Date(2026, 7, 18, 10, 5).toISOString();
    expect(RunId.formatLocal(iso)).toBe('2026-08-18 10:05');
  });

  test('空や不正な値では空文字を返す', () => {
    expect(RunId.formatLocal('')).toBe('');
    expect(RunId.formatLocal(null)).toBe('');
    expect(RunId.formatLocal('これは日付ではない')).toBe('');
  });
});

describe('buildFileName', () => {
  test('実行IDを含む.jsonのファイル名になる', () => {
    expect(RunId.buildFileName('20260818-100503-ab12')).toBe(
      'cross-app-check_20260818-100503-ab12.json',
    );
  });

  test('実行IDが無くてもファイル名として成立する', () => {
    expect(RunId.buildFileName('')).toBe('cross-app-check_run.json');
  });
});
