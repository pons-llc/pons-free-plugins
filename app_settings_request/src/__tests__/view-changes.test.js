const ViewChanges = require('../js/lib/view-changes.js');

// GET /k/v1/preview/app/views.json の views(検証環境で確認した形)
const views = {
  '（作業者が自分）': {
    type: 'LIST',
    name: '（作業者が自分）',
    id: '100',
    filterCond: '作業者 in (LOGINUSER())',
    sort: 'レコード番号 desc',
    index: '0',
    fields: ['レコード番号'],
    builtinType: 'ASSIGNEE',
  },
  案件一覧: {
    type: 'LIST',
    name: '案件一覧',
    id: '101',
    filterCond: 'amount > "10"',
    sort: 'amount desc',
    index: '1',
    fields: ['レコード番号', 'title', 'amount'],
  },
  カレンダー: {
    type: 'CALENDAR',
    name: 'カレンダー',
    id: '102',
    filterCond: '',
    sort: '',
    index: '2',
    date: '作成日時',
    title: 'title',
  },
  カスタム: {
    type: 'CUSTOM',
    name: 'カスタム',
    id: '103',
    filterCond: '',
    sort: '',
    index: '3',
    html: '<div></div>',
    pager: true,
    device: 'DESKTOP',
  },
};

const createValue = (overrides = {}) => ({
  name: '新しい一覧',
  filterCond: 'kind in ("B")',
  sort: 'amount desc',
  fields: ['レコード番号', 'title'],
  sourceUrl: '/k/791/?view=20',
  ...overrides,
});

const updateValue = (overrides = {}) => ({
  name: '案件一覧',
  filterCond: 'amount > "20"',
  sort: 'amount asc',
  sourceUrl: '/k/791/?view=101',
  ...overrides,
});

describe('isViewOperation / editableViews', () => {
  test('一覧の変更内容', () => {
    expect(ViewChanges.isViewOperation('viewCreate')).toBe(true);
    expect(ViewChanges.isViewOperation('label')).toBe(false);
  });

  test('修正・削除できるのは標準の一覧(作業者が自分)・カスタマイズ形式以外で、表示順に並べる', () => {
    expect(ViewChanges.editableViews(views).map((v) => v.id)).toEqual([
      '101',
      '102',
    ]);
    expect(ViewChanges.editableViews(undefined)).toEqual([]);
  });
});

describe('validateValue', () => {
  test('作成: 一覧名・表示するフィールドは必須', () => {
    expect(ViewChanges.validateValue('viewCreate', createValue())).toBe('');
    expect(
      ViewChanges.validateValue('viewCreate', createValue({ name: ' ' })),
    ).toMatch(/一覧名/);
    expect(
      ViewChanges.validateValue(
        'viewCreate',
        createValue({ name: 'あ'.repeat(65) }),
      ),
    ).toMatch(/64/);
    expect(
      ViewChanges.validateValue('viewCreate', createValue({ fields: [] })),
    ).toMatch(/フィールド/);
    expect(
      ViewChanges.validateValue('viewCreate', createValue({ fields: [1] })),
    ).not.toBe('');
  });

  test('作成・修正: 条件・並び順は文字列(空はすべてのレコード/指定なし)', () => {
    expect(
      ViewChanges.validateValue(
        'viewCreate',
        createValue({ filterCond: '', sort: '' }),
      ),
    ).toBe('');
    expect(
      ViewChanges.validateValue(
        'viewUpdate',
        updateValue({ filterCond: null }),
      ),
    ).not.toBe('');
  });

  test('修正: 一覧名は必須、表示するフィールドは持たない', () => {
    expect(ViewChanges.validateValue('viewUpdate', updateValue())).toBe('');
    expect(
      ViewChanges.validateValue('viewUpdate', updateValue({ name: '' })),
    ).toMatch(/一覧名/);
  });

  test('削除: nullのみ', () => {
    expect(ViewChanges.validateValue('viewDelete', null)).toBe('');
    expect(ViewChanges.validateValue('viewDelete', {})).not.toBe('');
  });

  test('オブジェクト以外は不可', () => {
    expect(ViewChanges.validateValue('viewCreate', 'x')).not.toBe('');
    expect(ViewChanges.validateValue('viewUpdate', null)).not.toBe('');
  });
});

describe('buildViewsPayload', () => {
  test('作成: 既存の一覧はそのまま、新しい一覧を末尾の表示順で追加する(表形式)', () => {
    const r = ViewChanges.buildViewsPayload(
      {
        operation: 'viewCreate',
        view: { id: '', name: '' },
        before: null,
        after: createValue(),
      },
      views,
    );
    expect(r.ok).toBe(true);
    expect(r.views['案件一覧']).toBe(views['案件一覧']);
    expect(r.views['カスタム']).toBe(views['カスタム']);
    expect(r.views['新しい一覧']).toEqual({
      type: 'LIST',
      name: '新しい一覧',
      index: '4',
      fields: ['レコード番号', 'title'],
      filterCond: 'kind in ("B")',
      sort: 'amount desc',
    });
  });

  test('作成: 既存の一覧と同じ名前は不可', () => {
    const r = ViewChanges.buildViewsPayload(
      {
        operation: 'viewCreate',
        view: { id: '', name: '' },
        before: null,
        after: createValue({ name: '案件一覧' }),
      },
      views,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/同じ名前/);
  });

  test('修正: キーは変更前の名前のまま、名前・条件・並び順だけを変える(IDで対象を探す)', () => {
    const r = ViewChanges.buildViewsPayload(
      {
        operation: 'viewUpdate',
        view: { id: '101', name: '案件一覧' },
        before: {
          name: '案件一覧',
          filterCond: 'amount > "10"',
          sort: 'amount desc',
        },
        after: updateValue({ name: '大口案件' }),
      },
      views,
    );
    expect(r.ok).toBe(true);
    expect(r.views['案件一覧']).toEqual({
      ...views['案件一覧'],
      name: '大口案件',
      filterCond: 'amount > "20"',
      sort: 'amount asc',
    });
    expect(r.notes).toEqual([]);
  });

  test('修正: 依頼後に一覧名が変わっていてもIDで見つけ、変更されていた旨を注記する', () => {
    const renamed = {
      ...views,
      改名後: { ...views['案件一覧'], name: '改名後', sort: 'title asc' },
    };
    delete renamed['案件一覧'];
    const r = ViewChanges.buildViewsPayload(
      {
        operation: 'viewUpdate',
        view: { id: '101', name: '案件一覧' },
        before: {
          name: '案件一覧',
          filterCond: 'amount > "10"',
          sort: 'amount desc',
        },
        after: updateValue(),
      },
      renamed,
    );
    expect(r.ok).toBe(true);
    expect(r.views['改名後'].name).toBe('案件一覧');
    expect(r.notes[0]).toMatch(/依頼後/);
  });

  test('修正: 別の一覧と同じ名前への変更は不可', () => {
    const r = ViewChanges.buildViewsPayload(
      {
        operation: 'viewUpdate',
        view: { id: '101', name: '案件一覧' },
        before: null,
        after: updateValue({ name: 'カレンダー' }),
      },
      views,
    );
    expect(r.ok).toBe(false);
  });

  test('修正・削除: 対象の一覧が無ければエラー', () => {
    ['viewUpdate', 'viewDelete'].forEach((operation) => {
      const r = ViewChanges.buildViewsPayload(
        {
          operation,
          view: { id: '999', name: '消えた一覧' },
          before: null,
          after: operation === 'viewDelete' ? null : updateValue(),
        },
        views,
      );
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/見つかりません/);
    });
  });

  test('修正・削除: 標準の一覧・カスタマイズ形式は不可', () => {
    ['100', '103'].forEach((id) => {
      const r = ViewChanges.buildViewsPayload(
        {
          operation: 'viewDelete',
          view: { id, name: 'x' },
          before: null,
          after: null,
        },
        views,
      );
      expect(r.ok).toBe(false);
    });
  });

  test('削除: 対象の一覧だけを除いて送る', () => {
    const r = ViewChanges.buildViewsPayload(
      {
        operation: 'viewDelete',
        view: { id: '102', name: 'カレンダー' },
        before: null,
        after: null,
      },
      views,
    );
    expect(r.ok).toBe(true);
    expect(Object.keys(r.views)).toEqual([
      '（作業者が自分）',
      '案件一覧',
      'カスタム',
    ]);
  });
});

describe('describe / warningsFor / currentValue', () => {
  test('変更前の値(現在の一覧)', () => {
    expect(ViewChanges.currentValue(views['案件一覧'])).toEqual({
      name: '案件一覧',
      filterCond: 'amount > "10"',
      sort: 'amount desc',
    });
  });

  test('表示用の文言(空の条件・並び順も分かるように)', () => {
    expect(
      ViewChanges.describe(createValue({ filterCond: '', sort: '' })),
    ).toBe(
      [
        '一覧名: 新しい一覧',
        '絞り込み条件: (すべてのレコード)',
        '並び順: (指定なし)',
        '表示するフィールド: レコード番号、title',
      ].join('\n'),
    );
    expect(ViewChanges.describe(null)).toBe('一覧を削除');
  });

  test('削除・修正には警告がある', () => {
    expect(ViewChanges.warningsFor('viewDelete').length).toBeGreaterThan(0);
    expect(ViewChanges.warningsFor('viewUpdate').length).toBeGreaterThan(0);
    expect(ViewChanges.warningsFor('viewCreate')).toEqual([]);
  });
});

describe('listableFields', () => {
  const properties = {
    作成者: { type: 'CREATOR', code: '作成者', label: '作成者' },
    amount: { type: 'NUMBER', code: 'amount', label: '金額' },
    レコード番号: {
      type: 'RECORD_NUMBER',
      code: 'レコード番号',
      label: 'レコード番号',
    },
    grp: { type: 'GROUP', code: 'grp', label: 'グループ' },
    title: { type: 'SINGLE_LINE_TEXT', code: 'title', label: '件名' },
    tbl: { type: 'SUBTABLE', code: 'tbl', label: '明細', fields: {} },
    inner: { type: 'NUMBER', code: 'inner', label: 'グループ内' },
    ステータス: { type: 'STATUS', code: 'ステータス', label: 'ステータス' },
    作業者: { type: 'STATUS_ASSIGNEE', code: '作業者', label: '作業者' },
    カテゴリー: { type: 'CATEGORY', code: 'カテゴリー', label: 'カテゴリー' },
  };
  // GET /k/v1/app/form/layout.json の layout
  const layout = [
    { type: 'ROW', fields: [{ type: 'SINGLE_LINE_TEXT', code: 'title' }] },
    {
      type: 'ROW',
      fields: [
        { type: 'SPACER', elementId: 's' },
        { type: 'NUMBER', code: 'amount' },
      ],
    },
    {
      type: 'GROUP',
      code: 'grp',
      layout: [{ type: 'ROW', fields: [{ type: 'NUMBER', code: 'inner' }] }],
    },
    { type: 'SUBTABLE', code: 'tbl', fields: [] },
  ];

  test('レコード番号を先頭に、フォームの配置順、その後に配置されていないフィールドを並べる', () => {
    const r = ViewChanges.listableFields(properties, layout, false);
    expect(r.fields.map((f) => f.code)).toEqual([
      'レコード番号',
      'title',
      'amount',
      'inner',
      '作成者',
    ]);
  });

  test('初期値でチェックするのはレコード番号とフォームに配置されたフィールド(作成者等は外す)', () => {
    const r = ViewChanges.listableFields(properties, layout, false);
    expect(r.defaultChecked).toEqual([
      'レコード番号',
      'title',
      'amount',
      'inner',
    ]);
  });

  test('グループ・テーブル・カテゴリーは候補にしない。ステータス・作業者はプロセス管理が有効なときだけ', () => {
    const off = ViewChanges.listableFields(
      properties,
      layout,
      false,
    ).fields.map((f) => f.code);
    expect(off).not.toContain('grp');
    expect(off).not.toContain('tbl');
    expect(off).not.toContain('カテゴリー');
    expect(off).not.toContain('ステータス');
    const on = ViewChanges.listableFields(properties, layout, true);
    expect(on.fields.map((f) => f.code)).toEqual(
      expect.arrayContaining(['ステータス', '作業者']),
    );
    expect(on.defaultChecked).toContain('ステータス');
  });

  test('レイアウトが取得できなくても候補は出す', () => {
    const r = ViewChanges.listableFields(properties, null, false);
    expect(r.fields[0].code).toBe('レコード番号');
    expect(r.fields.length).toBe(5);
  });
});
