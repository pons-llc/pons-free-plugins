'use strict';

const Model = require('../js/lib/review-model');

const codes = {
  table: 'review_comment_table',
  targetCode: 'rr_target_code',
  targetLabel: 'rr_target_label',
  targetRowId: 'rr_target_row_id',
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
    rr_target_row_id: '',
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

const NOW = '2026-10-01T02:00:00Z';

describe('parseRows', () => {
  test('テーブル行を扱いやすい形に変換する', () => {
    const items = Model.parseRows([row('10', { rr_target_row_id: '55' })], codes);
    expect(items).toEqual([
      {
        rowId: '10',
        targetCode: '氏名',
        targetLabel: '氏名',
        targetRowId: '55',
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

  test('v1のテーブル(対象行IDの列なし)でも読める', () => {
    const r = row('1');
    delete r.value.rr_target_row_id;
    const v1Codes = { ...codes };
    delete v1Codes.targetRowId;
    expect(Model.parseRows([r], v1Codes)[0].targetRowId).toBe('');
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

describe('targetKey / summarizeByTarget', () => {
  test('行指定の指摘は「テーブル#行ID」のキー、それ以外はフィールドコード', () => {
    expect(Model.targetKey('明細', '7')).toBe('明細#7');
    expect(Model.targetKey('氏名', '')).toBe('氏名');
  });

  test('フィールド・行ごとに未解決・解決済みを分け、状態を判定する', () => {
    const items = Model.parseRows(
      [
        row('1'),
        row('2', { rr_status: '解決済み' }),
        row('3', { rr_target_code: '明細', rr_target_row_id: '7' }),
        row('4', {
          rr_target_code: '明細',
          rr_target_row_id: '8',
          rr_status: '解決済み',
        }),
      ],
      codes,
    );
    const summary = Model.summarizeByTarget(items, { 明細: ['7', '8'] });
    expect(summary['氏名'].state).toBe('unresolved');
    expect(summary['氏名'].unresolved.map((i) => i.rowId)).toEqual(['1']);
    expect(summary['氏名'].resolved.map((i) => i.rowId)).toEqual(['2']);
    expect(summary['明細#7'].state).toBe('unresolved');
    expect(summary['明細#8'].state).toBe('resolved');
    expect(summary['明細']).toBeUndefined();
    expect(Model.countUnresolved(items)).toBe(2);
  });

  test('削除された行への指摘はテーブル単位に寄せる(未解決が見えなくならない)', () => {
    const items = Model.parseRows(
      [row('1', { rr_target_code: '明細', rr_target_row_id: '99' })],
      codes,
    );
    const summary = Model.summarizeByTarget(items, { 明細: ['7'] });
    expect(summary['明細'].state).toBe('unresolved');
    expect(summary['明細#99']).toBeUndefined();
  });
});

describe('describeTarget', () => {
  const labelOf = (code) => ({ 明細: '明細', 氏名: '氏名(現在)' })[code];
  const rowIdsByTable = { 明細: ['7', '8'] };

  test('フィールドは現在のラベル、行は「テーブル名 n行目」', () => {
    expect(
      Model.describeTarget({ targetCode: '氏名', targetLabel: '氏名(旧)', targetRowId: '' }, labelOf, rowIdsByTable),
    ).toBe('氏名(現在)');
    expect(
      Model.describeTarget({ targetCode: '明細', targetLabel: '明細 2行目', targetRowId: '8' }, labelOf, rowIdsByTable),
    ).toBe('明細 2行目');
  });

  test('削除済みの行・フィールドは保存時のラベルを使う', () => {
    expect(
      Model.describeTarget({ targetCode: '明細', targetLabel: '明細 3行目', targetRowId: '99' }, labelOf, rowIdsByTable),
    ).toBe('明細 3行目(削除された行)');
    expect(
      Model.describeTarget({ targetCode: '消えた', targetLabel: '旧項目', targetRowId: '' }, labelOf, rowIdsByTable),
    ).toBe('旧項目');
  });
});

describe('rowSummary', () => {
  test('行の値を先頭から最大3つ、短く要約する', () => {
    const tableRow = {
      id: '7',
      value: {
        品名: { type: 'SINGLE_LINE_TEXT', value: 'ボールペン' },
        空: { type: 'SINGLE_LINE_TEXT', value: '' },
        数量: { type: 'NUMBER', value: '12' },
        担当: { type: 'USER_SELECT', value: [{ code: 'sato', name: '佐藤' }] },
        区分: { type: 'CHECK_BOX', value: ['A', 'B'] },
      },
    };
    expect(Model.rowSummary(tableRow)).toBe('ボールペン / 12 / 佐藤');
  });

  test('長い要約は省略記号で切る、値が無ければ空', () => {
    const long = { value: { a: { type: 'X', value: 'あ'.repeat(50) } } };
    expect(Model.rowSummary(long, 10)).toBe(`${'あ'.repeat(10)}…`);
    expect(Model.rowSummary({ value: {} })).toBe('');
  });
});

describe('toKintoneDateTime', () => {
  test('ミリ秒を除いたUTCのISO形式', () => {
    expect(Model.toKintoneDateTime(new Date('2026-10-01T01:02:03.456Z'))).toBe(
      '2026-10-01T01:02:03Z',
    );
  });
});

describe('buildTableForBatch(指摘・解決のまとめて登録)', () => {
  const RESOLVE_AT = '2026-10-02T00:00:00Z';

  test('新しい指摘は末尾にフル値で追加、解決する行はフル値、それ以外の既存行はidのみ', () => {
    const table = Model.buildTableForBatch(
      [row('1'), row('2', { rr_target_row_id: '8' }), row('3')],
      codes,
      {
        comments: [
          { targetCode: '金額', targetLabel: '金額', targetRowId: '', comment: '  税込で記載  ' },
          { targetCode: '明細', targetLabel: '明細 2行目', targetRowId: '8', comment: '単価が違う' },
        ],
        resolutions: [{ rowId: '2', resolution: ' 修正しました ' }],
        userCode: 'tanaka',
        nowIso: RESOLVE_AT,
      },
    );
    expect(table).toHaveLength(5);
    expect(table[0]).toEqual({ id: '1' });
    expect(table[2]).toEqual({ id: '3' });
    expect(table[1]).toEqual({
      id: '2',
      value: {
        rr_target_code: { value: '氏名' },
        rr_target_label: { value: '氏名' },
        rr_target_row_id: { value: '8' },
        rr_pointed_at: { value: '2026-10-01T01:00:00Z' },
        rr_pointed_by: { value: [{ code: 'sato' }] },
        rr_comment: { value: '旧字体で記載してください' },
        rr_status: { value: '解決済み' },
        rr_resolution: { value: '修正しました' },
        rr_resolved_by: { value: [{ code: 'tanaka' }] },
        rr_resolved_at: { value: RESOLVE_AT },
      },
    });
    expect(table[3]).toEqual({
      value: {
        rr_target_code: { value: '金額' },
        rr_target_label: { value: '金額' },
        rr_target_row_id: { value: '' },
        rr_pointed_at: { value: RESOLVE_AT },
        rr_pointed_by: { value: [{ code: 'tanaka' }] },
        rr_comment: { value: '税込で記載' },
        rr_status: { value: '未解決' },
        rr_resolution: { value: '' },
        rr_resolved_by: { value: [] },
        rr_resolved_at: { value: '' },
      },
    });
    expect(table[4].value.rr_target_row_id).toEqual({ value: '8' });
    expect(table[4].value.rr_target_label).toEqual({ value: '明細 2行目' });
  });

  test('複数の指摘をまとめて解決できる', () => {
    const table = Model.buildTableForBatch([row('1'), row('2'), row('3')], codes, {
      comments: [],
      resolutions: [
        { rowId: '1', resolution: 'a' },
        { rowId: '3', resolution: 'c' },
      ],
      userCode: 't',
      nowIso: NOW,
    });
    expect(table.map((r) => (r.value ? r.value.rr_status.value : 'id'))).toEqual([
      '解決済み',
      'id',
      '解決済み',
    ]);
    expect(table[2].value.rr_resolution.value).toBe('c');
  });

  test('内容が空の下書き(指摘・解決とも)は無視し、すべて空ならエラー', () => {
    const table = Model.buildTableForBatch([row('1')], codes, {
      comments: [
        { targetCode: 'a', targetLabel: 'a', comment: ' ' },
        { targetCode: 'b', targetLabel: 'b', comment: 'x' },
      ],
      resolutions: [{ rowId: '1', resolution: '  ' }],
      userCode: 'u',
      nowIso: NOW,
    });
    expect(table).toEqual([
      { id: '1' },
      expect.objectContaining({ value: expect.any(Object) }),
    ]);
    expect(table[1].value.rr_target_code.value).toBe('b');

    expect(() =>
      Model.buildTableForBatch([row('1')], codes, {
        comments: [{ targetCode: 'a', targetLabel: 'a', comment: '   ' }],
        resolutions: [{ rowId: '1', resolution: '' }],
        userCode: 'u',
        nowIso: NOW,
      }),
    ).toThrow('指摘内容・解決内容を入力してください');
    expect(() =>
      Model.buildTableForBatch([], codes, { userCode: 'u', nowIso: NOW }),
    ).toThrow('指摘内容・解決内容を入力してください');
  });

  test('countBatch: 内容のある指摘・解決の件数', () => {
    expect(
      Model.countBatch({
        comments: [{ comment: 'x' }, { comment: ' ' }],
        resolutions: [{ resolution: 'y' }, { resolution: 'z' }],
      }),
    ).toEqual({ comments: 1, resolutions: 2, total: 3 });
  });

  test('v1の設定(対象行IDの列なし)では行IDを送らない', () => {
    const v1Codes = { ...codes };
    delete v1Codes.targetRowId;
    const table = Model.buildTableForBatch([], v1Codes, {
      comments: [{ targetCode: 'a', targetLabel: 'a', targetRowId: '3', comment: 'x' }],
      userCode: 'u',
      nowIso: NOW,
    });
    expect(Object.keys(table[0].value)).not.toContain('undefined');
    expect(table[0].value.rr_target_row_id).toBeUndefined();
  });

  test('解決対象の行が見つからない(他ユーザーが削除済み)ならエラー', () => {
    expect(() =>
      Model.buildTableForBatch([row('1')], codes, {
        resolutions: [{ rowId: '99', resolution: 'x' }],
        userCode: 't',
        nowIso: NOW,
      }),
    ).toThrow('対象の指摘が見つかりません');
  });

  test('既に解決済み(他ユーザーが先に解決)ならエラー', () => {
    expect(() =>
      Model.buildTableForBatch([row('1', { rr_status: '解決済み' })], codes, {
        resolutions: [{ rowId: '1', resolution: 'x' }],
        userCode: 't',
        nowIso: NOW,
      }),
    ).toThrow('既に解決済み');
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
