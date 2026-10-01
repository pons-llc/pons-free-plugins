'use strict';

const Model = require('../js/lib/review-model');

const codes = {
  table: 'review_comment_table',
  targetCode: 'rr_target_code',
  targetLabel: 'rr_target_label',
  pointedAt: 'rr_pointed_at',
  pointedBy: 'rr_pointed_by',
  comment: 'rr_comment',
  status: 'rr_status',
  resolution: 'rr_resolution',
  resolvedBy: 'rr_resolved_by',
  resolvedAt: 'rr_resolved_at',
};

const row = (id, overrides = {}) => {
  const v = {
    rr_target_code: '氏名',
    rr_target_label: '氏名',
    rr_pointed_at: '2026-10-01T01:00:00Z',
    rr_pointed_by: [{ code: 'sato', name: '佐藤' }],
    rr_comment: '旧字体で記載してください',
    rr_status: '未解決',
    rr_resolution: '',
    rr_resolved_by: [],
    rr_resolved_at: '',
    ...overrides,
  };
  const value = {};
  Object.keys(v).forEach((k) => {
    value[k] = { type: 'X', value: v[k] };
  });
  return { id, value };
};

describe('parseRows', () => {
  test('テーブル行を扱いやすい形に変換する', () => {
    const items = Model.parseRows([row('10')], codes);
    expect(items).toEqual([
      {
        rowId: '10',
        targetCode: '氏名',
        targetLabel: '氏名',
        pointedAt: '2026-10-01T01:00:00Z',
        pointedBy: { code: 'sato', name: '佐藤' },
        comment: '旧字体で記載してください',
        status: '未解決',
        resolved: false,
        resolution: '',
        resolvedBy: null,
        resolvedAt: '',
      },
    ]);
  });

  test('空行(対象フィールド・指摘内容が無い行)は無視する', () => {
    const items = Model.parseRows(
      [row('1', { rr_target_code: '', rr_comment: '' }), row('2')],
      codes,
    );
    expect(items.map((i) => i.rowId)).toEqual(['2']);
  });

  test('テーブルがnull/undefinedでも空配列', () => {
    expect(Model.parseRows(undefined, codes)).toEqual([]);
  });

  test('解決状況が解決済み以外(空含む)は未解決扱い', () => {
    const items = Model.parseRows(
      [row('1', { rr_status: '' }), row('2', { rr_status: '解決済み' })],
      codes,
    );
    expect(items.map((i) => i.resolved)).toEqual([false, true]);
  });
});

describe('summarizeByField', () => {
  test('フィールドごとに未解決・解決済みを分け、状態を判定する', () => {
    const items = Model.parseRows(
      [
        row('1'),
        row('2', { rr_status: '解決済み' }),
        row('3', { rr_target_code: '住所', rr_status: '解決済み' }),
      ],
      codes,
    );
    const summary = Model.summarizeByField(items);
    expect(summary['氏名'].state).toBe('unresolved');
    expect(summary['氏名'].unresolved.map((i) => i.rowId)).toEqual(['1']);
    expect(summary['氏名'].resolved.map((i) => i.rowId)).toEqual(['2']);
    expect(summary['住所'].state).toBe('resolved');
    expect(Model.countUnresolved(items)).toBe(1);
  });
});

describe('toKintoneDateTime', () => {
  test('ミリ秒を除いたUTCのISO形式', () => {
    expect(Model.toKintoneDateTime(new Date('2026-10-01T01:02:03.456Z'))).toBe(
      '2026-10-01T01:02:03Z',
    );
  });
});

describe('buildTableForAdd', () => {
  test('既存行はidのみ、新規行は末尾にフル値で追加する', () => {
    const table = Model.buildTableForAdd([row('1'), row('2')], codes, {
      targetCode: '金額',
      targetLabel: '金額',
      comment: '  税込で記載  ',
      userCode: 'suzuki',
      nowIso: '2026-10-01T02:00:00Z',
    });
    expect(table).toEqual([
      { id: '1' },
      { id: '2' },
      {
        value: {
          rr_target_code: { value: '金額' },
          rr_target_label: { value: '金額' },
          rr_pointed_at: { value: '2026-10-01T02:00:00Z' },
          rr_pointed_by: { value: [{ code: 'suzuki' }] },
          rr_comment: { value: '税込で記載' },
          rr_status: { value: '未解決' },
          rr_resolution: { value: '' },
          rr_resolved_by: { value: [] },
          rr_resolved_at: { value: '' },
        },
      },
    ]);
  });

  test('指摘内容が空ならエラー', () => {
    expect(() =>
      Model.buildTableForAdd([], codes, {
        targetCode: '金額',
        targetLabel: '金額',
        comment: '   ',
        userCode: 'suzuki',
        nowIso: '2026-10-01T02:00:00Z',
      }),
    ).toThrow('指摘内容を入力してください');
  });
});

describe('buildTableForResolve', () => {
  test('対象行だけ解決情報を入れたフル値、他はidのみ', () => {
    const table = Model.buildTableForResolve([row('1'), row('2')], codes, {
      rowId: '2',
      resolution: '修正しました',
      userCode: 'tanaka',
      nowIso: '2026-10-02T00:00:00Z',
    });
    expect(table[0]).toEqual({ id: '1' });
    expect(table[1]).toEqual({
      id: '2',
      value: {
        rr_target_code: { value: '氏名' },
        rr_target_label: { value: '氏名' },
        rr_pointed_at: { value: '2026-10-01T01:00:00Z' },
        rr_pointed_by: { value: [{ code: 'sato' }] },
        rr_comment: { value: '旧字体で記載してください' },
        rr_status: { value: '解決済み' },
        rr_resolution: { value: '修正しました' },
        rr_resolved_by: { value: [{ code: 'tanaka' }] },
        rr_resolved_at: { value: '2026-10-02T00:00:00Z' },
      },
    });
  });

  test('対象行が見つからない(他ユーザーが削除済み)ならエラー', () => {
    expect(() =>
      Model.buildTableForResolve([row('1')], codes, {
        rowId: '99',
        resolution: 'x',
        userCode: 'tanaka',
        nowIso: '2026-10-02T00:00:00Z',
      }),
    ).toThrow('対象の指摘が見つかりません');
  });

  test('既に解決済みならエラー', () => {
    expect(() =>
      Model.buildTableForResolve([row('1', { rr_status: '解決済み' })], codes, {
        rowId: '1',
        resolution: 'x',
        userCode: 'tanaka',
        nowIso: '2026-10-02T00:00:00Z',
      }),
    ).toThrow('既に解決済み');
  });

  test('解決内容が空ならエラー', () => {
    expect(() =>
      Model.buildTableForResolve([row('1')], codes, {
        rowId: '1',
        resolution: ' ',
        userCode: 'tanaka',
        nowIso: '2026-10-02T00:00:00Z',
      }),
    ).toThrow('解決内容を入力してください');
  });
});

describe('formatDateTime', () => {
  test('ローカル時刻のYYYY/MM/DD HH:mm', () => {
    const d = new Date('2026-10-01T01:02:03Z');
    const pad = (n) => String(n).padStart(2, '0');
    const expected = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(Model.formatDateTime('2026-10-01T01:02:03Z')).toBe(expected);
  });

  test('空や不正値は空文字', () => {
    expect(Model.formatDateTime('')).toBe('');
    expect(Model.formatDateTime('abc')).toBe('');
  });
});
