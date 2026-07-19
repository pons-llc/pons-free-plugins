'use strict';

const Core = require('../js/lib/analysis-core');

const layoutRow = (code, question, type) => ({
  value: {
    insert_column: { value: code },
    question: { value: question },
    field_type: { value: type },
  },
});

describe('shouldIgnoreField', () => {
  test('予備フィールド・管理用・システム・対象外タイプを除外する', () => {
    expect(Core.shouldIgnoreField('text_1', 'SINGLE_LINE_TEXT')).toBe(true);
    expect(Core.shouldIgnoreField('multi_text_2', 'MULTI_LINE_TEXT')).toBe(
      true,
    );
    expect(Core.shouldIgnoreField('number_1', 'NUMBER')).toBe(true);
    expect(Core.shouldIgnoreField('json', 'MULTI_LINE_TEXT')).toBe(true);
    expect(Core.shouldIgnoreField('lookup', 'NUMBER')).toBe(true);
    expect(Core.shouldIgnoreField('deadline', 'DATETIME')).toBe(true);
    expect(Core.shouldIgnoreField('answer_status', 'RADIO_BUTTON')).toBe(false);
    expect(
      Core.shouldIgnoreField('answer_department', 'ORGANIZATION_SELECT'),
    ).toBe(false);
    expect(Core.shouldIgnoreField('$id', '__ID__')).toBe(true);
    expect(Core.shouldIgnoreField('related', 'REFERENCE_TABLE')).toBe(true);
    expect(Core.shouldIgnoreField('ステータス', 'STATUS')).toBe(false);
    expect(Core.shouldIgnoreField('作成日時', 'CREATED_TIME')).toBe(false);
  });
});

describe('buildMergedLayout / buildTargetColumns', () => {
  const baseLayout = [layoutRow('text_1', '氏名', '文字列')];
  const properties = {
    text_1: { type: 'SINGLE_LINE_TEXT', label: '予備 文字列1' },
    text_2: { type: 'SINGLE_LINE_TEXT', label: '予備 文字列2' },
    json: { type: 'MULTI_LINE_TEXT', label: 'JSON' },
    ステータス: { type: 'STATUS', label: 'ステータス' },
    作成日時: { type: 'CREATED_TIME', label: '作成日時' },
  };

  test('フォーム定義を先頭に、未使用の実フィールドだけを後ろに足す', () => {
    const merged = Core.buildMergedLayout(baseLayout, properties);
    const codes = merged.map((r) => r.value.insert_column.value);
    expect(codes).toEqual(['text_1', 'ステータス', '作成日時']);
    // フォーム定義側のラベルが優先される
    expect(merged[0].value.question.value).toBe('氏名');
    // 実フィールド側は日本語タイプ名に変換される
    expect(merged[1].value.field_type.value).toBe('ステータス');
  });

  test('buildTargetColumnsは{label, f_code}の配列を返す', () => {
    expect(Core.buildTargetColumns(baseLayout, properties)).toEqual([
      { label: '氏名', f_code: 'text_1' },
      { label: 'ステータス', f_code: 'ステータス' },
      { label: '作成日時', f_code: '作成日時' },
    ]);
  });
});

describe('parseCommaSeparated', () => {
  test('半角・全角カンマ・読点で分解する', () => {
    expect(Core.parseCommaSeparated('A,B、C，D')).toEqual(['A', 'B', 'C', 'D']);
    expect(Core.parseCommaSeparated(' A , ,B ')).toEqual(['A', 'B']);
    expect(Core.parseCommaSeparated('')).toEqual([]);
    expect(Core.parseCommaSeparated(null)).toEqual([]);
  });
});

describe('formatFieldValue', () => {
  test('日時系はJST表記にする', () => {
    const formatted = Core.formatFieldValue('DATETIME', '2026-07-19T01:00:00Z');
    expect(formatted).toContain('2026/07/19');
    expect(formatted).toContain('10:00'); // UTC+9
  });

  test('配列・オブジェクト・リッチテキストを表示用文字列にする', () => {
    expect(Core.formatFieldValue('CHECK_BOX', ['A', 'B'])).toBe('A, B');
    expect(
      Core.formatFieldValue('USER_SELECT', [{ name: '田中', code: 't' }]),
    ).toBe('田中');
    expect(Core.formatFieldValue('CREATOR', { name: '佐藤', code: 's' })).toBe(
      '佐藤',
    );
    expect(Core.formatFieldValue('RICH_TEXT', '<p>こん<b>にちは</b></p>')).toBe(
      'こん にちは',
    );
    expect(Core.formatFieldValue('SUBTABLE', [])).toBe('（テーブルデータ）');
    expect(Core.formatFieldValue('SINGLE_LINE_TEXT', null)).toBe('');
  });
});

describe('normalizeRecords', () => {
  test('レコードを表示文字列の行に変換し$idを付ける', () => {
    const rows = Core.normalizeRecords([
      {
        $id: { type: '__ID__', value: '1' },
        text_1: { type: 'SINGLE_LINE_TEXT', value: 'abc' },
        checks: { type: 'CHECK_BOX', value: ['A'] },
      },
    ]);
    expect(rows[0].$id).toBe('1');
    expect(rows[0].text_1).toBe('abc');
    expect(rows[0].checks).toBe('A');
  });
});

describe('applyFilters', () => {
  const configMap = {
    name: { label: '氏名', type: '文字列' },
    count: { label: '件数', type: '数値' },
    tags: { label: 'タグ', type: 'チェックボックス' },
    day: { label: '日付', type: '日付' },
  };
  const rows = [
    { $id: '1', name: '田中', count: '10', tags: 'A, B', day: '2026/07/01' },
    { $id: '2', name: '佐藤', count: '5', tags: 'B', day: '2026/07/10' },
    { $id: '3', name: '', count: '', tags: '', day: '' },
  ];
  const active = ['name', 'count', 'tags', 'day'];

  test('文字列は完全一致', () => {
    const out = Core.applyFilters(
      rows,
      { name: { operator: 'eq', value: '田中' } },
      active,
      {},
      configMap,
    );
    expect(out.map((r) => r.$id)).toEqual(['1']);
  });

  test('数値は数値比較', () => {
    const out = Core.applyFilters(
      rows,
      { count: { operator: 'gte', value: '6' } },
      active,
      {},
      configMap,
    );
    expect(out.map((r) => r.$id)).toEqual(['1']);
  });

  test('数値に解釈できない行はマッチしない', () => {
    const out = Core.applyFilters(
      rows,
      { count: { operator: 'lte', value: '100' } },
      active,
      {},
      configMap,
    );
    expect(out.map((r) => r.$id)).toEqual(['1', '2']);
  });

  test('blank演算子は空欄のみ', () => {
    const out = Core.applyFilters(
      rows,
      { name: { operator: 'blank', value: '' } },
      active,
      {},
      configMap,
    );
    expect(out.map((r) => r.$id)).toEqual(['3']);
  });

  test('チェックボックスのAND/OR', () => {
    const and = Core.applyFilters(
      rows,
      { tags: { operator: '', value: ['A', 'B'] } },
      active,
      {},
      configMap,
    );
    expect(and.map((r) => r.$id)).toEqual(['1']);
    const or = Core.applyFilters(
      rows,
      { tags: { operator: '', value: ['A', 'B'] } },
      active,
      { tags: 'OR' },
      configMap,
    );
    expect(or.map((r) => r.$id)).toEqual(['1', '2']);
  });

  test('日付は表記ゆれ(スラッシュ)を吸収して比較し、入力値の桁で前方一致する', () => {
    const out = Core.applyFilters(
      rows,
      { day: { operator: 'gte', value: '2026-07-05' } },
      active,
      {},
      configMap,
    );
    expect(out.map((r) => r.$id)).toEqual(['2']);
    const eq = Core.applyFilters(
      rows,
      { day: { operator: 'eq', value: '2026-07-01' } },
      active,
      {},
      configMap,
    );
    expect(eq.map((r) => r.$id)).toEqual(['1']);
  });

  test('activeFilterKeysに無いフィルターは無視される', () => {
    const out = Core.applyFilters(
      rows,
      { name: { operator: 'eq', value: '田中' } },
      ['count'],
      {},
      configMap,
    );
    expect(out).toHaveLength(3);
  });
});

describe('groupLabel', () => {
  test('日時は日単位、時刻は時単位に丸める', () => {
    expect(Core.groupLabel('2026/07/19 10:30', '日時')).toBe('2026/07/19');
    expect(Core.groupLabel('2026-07-19', '日付')).toBe('2026/07/19');
    expect(Core.groupLabel('10:30', '時刻')).toBe('10:00');
    expect(Core.groupLabel('', '日時')).toBe('(空白)');
    expect(Core.groupLabel('A', '文字列')).toBe('A');
  });
});

describe('aggregateCategory', () => {
  const configMap = {
    pref: { label: '都道府県', type: 'ドロップダウン' },
    tags: { label: 'タグ', type: 'チェックボックス' },
    amount: { label: '金額', type: '数値' },
  };
  const rows = [
    { pref: '東京', tags: 'A,B', amount: '10' },
    { pref: '東京', tags: 'A', amount: '20' },
    { pref: '大阪', tags: '', amount: '5' },
    { pref: '', tags: '', amount: '' },
  ];

  test('件数集計は値の大きい順', () => {
    const agg = Core.aggregateCategory(
      rows,
      'pref',
      configMap.pref,
      '_count',
      'sum',
      configMap,
      20,
    );
    expect(agg.labels).toEqual(['東京', '大阪', '(空白)']);
    expect(agg.values).toEqual([2, 1, 1]);
  });

  test('チェックボックスは値ごとに展開して数える', () => {
    const agg = Core.aggregateCategory(
      rows,
      'tags',
      configMap.tags,
      '_count',
      'sum',
      configMap,
      20,
    );
    expect(agg.labels).toEqual(['A', '(空白)', 'B']);
    expect(agg.values).toEqual([2, 2, 1]);
  });

  test('数値の合計・平均', () => {
    const sum = Core.aggregateCategory(
      rows,
      'pref',
      configMap.pref,
      'amount',
      'sum',
      configMap,
      20,
    );
    expect(sum.labels[0]).toBe('東京');
    expect(sum.values[0]).toBe(30);
    const avg = Core.aggregateCategory(
      rows,
      'pref',
      configMap.pref,
      'amount',
      'avg',
      configMap,
      20,
    );
    expect(avg.values[avg.labels.indexOf('東京')]).toBe(15);
  });

  test('limitで上位のみに絞る', () => {
    const agg = Core.aggregateCategory(
      rows,
      'pref',
      configMap.pref,
      '_count',
      'sum',
      configMap,
      1,
    );
    expect(agg.labels).toEqual(['東京']);
  });
});

describe('aggregateTimeline', () => {
  const configMap = {
    day: { label: '回答日', type: '日付' },
    tags: { label: 'タグ', type: 'チェックボックス' },
    amount: { label: '金額', type: '数値' },
  };
  const rows = [
    { day: '2026-07-01', tags: 'A', amount: '10' },
    { day: '2026-07-01', tags: 'B', amount: '30' },
    { day: '2026-07-02', tags: 'A,B', amount: '5' },
  ];

  test('レコード数の時系列はラベル昇順の単一系列', () => {
    const t = Core.aggregateTimeline(
      rows,
      'day',
      configMap.day,
      '_count',
      'sum',
      configMap,
    );
    expect(t.buckets).toEqual(['2026/07/01', '2026/07/02']);
    expect(t.isCategorical).toBe(false);
    expect(t.datasets).toHaveLength(1);
    expect(t.datasets[0].data).toEqual([2, 1]);
  });

  test('カテゴリ測定値は選択肢ごとの系列になる', () => {
    const t = Core.aggregateTimeline(
      rows,
      'day',
      configMap.day,
      'tags',
      'sum',
      configMap,
    );
    expect(t.isCategorical).toBe(true);
    expect(t.datasets.map((d) => d.label)).toEqual(['A', 'B']);
    expect(t.datasets[0].data).toEqual([1, 1]);
    expect(t.datasets[1].data).toEqual([1, 1]);
  });

  test('数値測定値の平均', () => {
    const t = Core.aggregateTimeline(
      rows,
      'day',
      configMap.day,
      'amount',
      'avg',
      configMap,
    );
    expect(t.datasets[0].data).toEqual([20, 5]);
  });
});

describe('buildCsv', () => {
  test('カンマ・引用符・改行をRFC4180風にエスケープする', () => {
    const layout = [
      layoutRow('text_1', '氏名', '文字列'),
      layoutRow('text_2', 'メモ', '文字列'),
    ];
    const csv = Core.buildCsv(
      [
        { $id: '1', text_1: '田中, 太郎', text_2: 'say "hi"\n2行目' },
        { $id: '2', text_1: '', text_2: undefined },
      ],
      layout,
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ID,氏名,メモ');
    expect(csv).toContain('"田中, 太郎"');
    expect(csv).toContain('"say ""hi""');
    expect(lines[lines.length - 1]).toBe('2,,');
  });
});
