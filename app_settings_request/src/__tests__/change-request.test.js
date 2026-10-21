const ChangeRequest = require('../js/lib/change-request.js');

const properties = {
  title: {
    type: 'SINGLE_LINE_TEXT',
    code: 'title',
    label: '件名',
    noLabel: false,
    required: false,
    minLength: '',
    maxLength: '',
    expression: '',
    unique: false,
    defaultValue: '',
  },
  kind: {
    type: 'DROP_DOWN',
    code: 'kind',
    label: '種別',
    noLabel: false,
    required: false,
    options: {
      A: { label: 'A', index: '0' },
      B: { label: 'B', index: '1' },
    },
    defaultValue: 'A',
  },
  tbl: {
    type: 'SUBTABLE',
    code: 'tbl',
    label: '明細',
    noLabel: false,
    fields: {
      item: {
        type: 'SINGLE_LINE_TEXT',
        code: 'item',
        label: '品名',
        noLabel: false,
        required: false,
        minLength: '',
        maxLength: '',
        expression: '',
        unique: false,
        defaultValue: '',
      },
    },
  },
};

const baseChange = (overrides = {}) =>
  ChangeRequest.buildChange({
    app: { id: '791', name: '案件管理', guestSpaceId: '' },
    field: {
      code: 'title',
      label: '件名',
      type: 'SINGLE_LINE_TEXT',
      subtableCode: '',
    },
    operation: 'required',
    before: false,
    after: true,
    ...overrides,
  });

describe('buildChange / serialize / parseChange', () => {
  test('組み立てたJSONを往復できる', () => {
    const change = baseChange();
    expect(change.format).toBe(ChangeRequest.FORMAT);
    expect(change.version).toBe(1);
    const parsed = ChangeRequest.parseChange(ChangeRequest.serialize(change));
    expect(parsed).toEqual({ ok: true, change });
  });

  test('アプリID・ゲストスペースIDは文字列にそろえる', () => {
    const change = baseChange({
      app: { id: 791, name: 'x', guestSpaceId: 5 },
    });
    expect(change.app).toEqual({ id: '791', name: 'x', guestSpaceId: '5' });
  });

  test('空・JSONでない・形式違いはエラー', () => {
    expect(ChangeRequest.parseChange('').ok).toBe(false);
    expect(ChangeRequest.parseChange('{').ok).toBe(false);
    expect(ChangeRequest.parseChange('[]').ok).toBe(false);
    expect(
      ChangeRequest.parseChange(
        JSON.stringify({ ...baseChange(), format: 'other' }),
      ).ok,
    ).toBe(false);
    expect(
      ChangeRequest.parseChange(JSON.stringify({ ...baseChange(), version: 2 }))
        .ok,
    ).toBe(false);
  });

  test('アプリID・ゲストスペースIDは正の整数のみ(パスに任意文字列を混ぜない)', () => {
    const bad = (app) =>
      ChangeRequest.parseChange(JSON.stringify({ ...baseChange(), app })).ok;
    expect(bad({ id: '0', name: '', guestSpaceId: '' })).toBe(false);
    expect(bad({ id: '1/../2', name: '', guestSpaceId: '' })).toBe(false);
    expect(bad({ id: '1', name: '', guestSpaceId: '../x' })).toBe(false);
    expect(bad({ id: '1', name: '', guestSpaceId: '3' })).toBe(true);
  });

  test('フィールド情報が欠けていればエラー', () => {
    const json = JSON.stringify({
      ...baseChange(),
      field: { code: '', label: '', type: 'X', subtableCode: '' },
    });
    expect(ChangeRequest.parseChange(json).ok).toBe(false);
  });

  test('未知の変更内容・値の型違いはエラー', () => {
    expect(
      ChangeRequest.parseChange(
        JSON.stringify({ ...baseChange(), operation: 'expression' }),
      ).ok,
    ).toBe(false);
    const r = ChangeRequest.parseChange(
      JSON.stringify({ ...baseChange(), after: 'true' }),
    );
    expect(r.ok).toBe(false);
  });

  test('beforeがafterと違う形ならnullにする(表示で落ちないように)', () => {
    const parsed = ChangeRequest.parseChange(
      JSON.stringify({
        ...baseChange({
          operation: 'options',
          before: 'A',
          after: [{ from: 'A', label: 'A' }],
        }),
      }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.change.before).toBeNull();
  });

  test('余計なプロパティは捨てる(APIへ流し込まない)', () => {
    const parsed = ChangeRequest.parseChange(
      JSON.stringify({ ...baseChange(), extra: { evil: true } }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.change.extra).toBeUndefined();
  });
});

describe('buildApplyRequest', () => {
  test('テーブル外のフィールド: 変更するプロパティとtypeだけを送るPUT', () => {
    const r = ChangeRequest.buildApplyRequest(baseChange(), properties);
    expect(r).toEqual({
      ok: true,
      method: 'PUT',
      body: {
        properties: { title: { type: 'SINGLE_LINE_TEXT', required: true } },
      },
      notes: [],
    });
  });

  test('テーブル内のフィールドはSUBTABLEでくるむ', () => {
    const change = baseChange({
      field: {
        code: 'item',
        label: '品名',
        type: 'SINGLE_LINE_TEXT',
        subtableCode: 'tbl',
      },
      operation: 'label',
      before: '品名',
      after: '商品名',
    });
    const r = ChangeRequest.buildApplyRequest(change, properties);
    expect(r.body).toEqual({
      properties: {
        tbl: {
          type: 'SUBTABLE',
          fields: { item: { type: 'SINGLE_LINE_TEXT', label: '商品名' } },
        },
      },
    });
  });

  test('削除はDELETE(テーブル内も内側のフィールドコードを直接指定)', () => {
    const change = baseChange({
      field: {
        code: 'item',
        label: '品名',
        type: 'SINGLE_LINE_TEXT',
        subtableCode: 'tbl',
      },
      operation: 'delete',
      before: null,
      after: null,
    });
    expect(ChangeRequest.buildApplyRequest(change, properties)).toEqual({
      ok: true,
      method: 'DELETE',
      body: { fields: ['item'] },
      notes: [],
    });
  });

  test('選択肢の変更では初期値の補正と注記が付く', () => {
    const change = baseChange({
      field: {
        code: 'kind',
        label: '種別',
        type: 'DROP_DOWN',
        subtableCode: '',
      },
      operation: 'options',
      before: ['A', 'B'],
      after: [
        { from: 'B', label: 'B' },
        { from: '', label: 'C' },
      ],
    });
    const r = ChangeRequest.buildApplyRequest(change, properties);
    expect(r.body.properties.kind).toEqual({
      type: 'DROP_DOWN',
      options: {
        B: { label: 'B', index: '0' },
        C: { label: 'C', index: '1' },
      },
      defaultValue: '',
    });
    expect(r.notes.length).toBe(1);
  });

  test('依頼後に設定が変わっていたら注記する(反映は行う)', () => {
    const change = baseChange({ before: true, after: false });
    const r = ChangeRequest.buildApplyRequest(change, properties);
    expect(r.ok).toBe(true);
    expect(r.notes[0]).toMatch(/依頼後/);
  });

  test('対象フィールドが無くなっていたらエラー', () => {
    const change = baseChange({
      field: {
        code: 'gone',
        label: 'x',
        type: 'SINGLE_LINE_TEXT',
        subtableCode: '',
      },
    });
    const r = ChangeRequest.buildApplyRequest(change, properties);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/見つかりません/);
  });

  test('フィールドの種類が変わっていたらエラー', () => {
    const change = baseChange({
      field: { code: 'title', label: '件名', type: 'NUMBER', subtableCode: '' },
    });
    expect(ChangeRequest.buildApplyRequest(change, properties).error).toMatch(
      /種類/,
    );
  });

  test('現在の定義に照らして不正な値ならエラー(例: 既存コードとの重複)', () => {
    const change = baseChange({
      operation: 'code',
      before: 'title',
      after: 'item',
    });
    const r = ChangeRequest.buildApplyRequest(change, properties);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/既に/);
  });
});

describe('summarize', () => {
  test('選択肢の変更は、変更前を使って削除も表示し、名前変更の警告を出す', () => {
    const s = ChangeRequest.summarize(
      baseChange({
        field: {
          code: 'kind',
          label: '種別',
          type: 'DROP_DOWN',
          subtableCode: '',
        },
        operation: 'options',
        before: ['A', 'B', 'C'],
        after: [
          { from: 'A', label: 'A' },
          { from: 'B', label: 'B2' },
        ],
      }),
    );
    expect(s.beforeText).toBe('A\nB\nC');
    expect(s.afterText).toBe('A\nB → B2(名前を変更)\nC(削除)');
    expect(s.warnings.length).toBe(2);
  });

  test('画面表示用の文言', () => {
    const s = ChangeRequest.summarize(baseChange());
    expect(s).toEqual({
      appText: '案件管理(アプリID: 791)',
      targetLabel: '対象フィールド',
      targetText: '件名(title)',
      operationName: '必須項目の設定',
      beforeText: '任意',
      afterText: '必須',
      warnings: [expect.stringMatching(/入力が必要/)],
    });
  });

  test('テーブル内のフィールドはテーブルコードも出す', () => {
    const s = ChangeRequest.summarize(
      baseChange({
        field: {
          code: 'item',
          label: '品名',
          type: 'SINGLE_LINE_TEXT',
          subtableCode: 'tbl',
        },
      }),
    );
    expect(s.targetText).toBe('テーブル(tbl) > 品名(item)');
  });
});

describe('confirmationText', () => {
  test('モバイルの確認ボトムシート用に、依頼内容・警告・取り消せない旨を1つの文字列にする', () => {
    const text = ChangeRequest.confirmationText(baseChange());
    expect(text).toBe(
      [
        '対象アプリ: 案件管理(アプリID: 791)',
        '対象フィールド: 件名(title)',
        '変更内容: 必須項目の設定',
        '変更前: 任意',
        '変更後: 必須',
        '',
        '※ 既存のレコードで値が空のものは、次に編集して保存するときに入力が必要になります。',
        '',
        'OKを押すと、あなたの権限で対象アプリの設定を変更し、運用環境へ反映(アプリを更新)します。',
      ].join('\n'),
    );
  });

  test('複数行の値(選択肢)は改行して並べる', () => {
    const text = ChangeRequest.confirmationText(
      baseChange({
        field: {
          code: 'kind',
          label: '種別',
          type: 'DROP_DOWN',
          subtableCode: '',
        },
        operation: 'options',
        before: ['A', 'B'],
        after: [
          { from: 'A', label: 'A' },
          { from: 'B', label: 'B2' },
        ],
      }),
    );
    expect(text).toContain('変更前:\nA\nB');
    expect(text).toContain('変更後:\nA\nB → B2(名前を変更)');
  });
});

describe('一覧の変更', () => {
  const app = { id: '791', name: '案件管理', guestSpaceId: '' };
  const createChange = () =>
    ChangeRequest.buildChange({
      app,
      operation: 'viewCreate',
      before: null,
      after: {
        name: '大口案件',
        filterCond: 'amount > "100"',
        sort: 'amount desc',
        fields: ['レコード番号', 'title'],
        sourceUrl: '/k/791/?view=20',
      },
    });
  const updateChange = (overrides = {}) =>
    ChangeRequest.buildChange({
      app,
      view: { id: '101', name: '案件一覧' },
      operation: 'viewUpdate',
      before: { name: '案件一覧', filterCond: '', sort: '' },
      after: {
        name: '案件一覧',
        filterCond: 'amount > "100"',
        sort: 'amount desc',
        sourceUrl: '/k/791/?view=101',
      },
      ...overrides,
    });

  test('作成・修正・削除のJSONを往復できる', () => {
    [
      createChange(),
      updateChange(),
      updateChange({ operation: 'viewDelete', after: null }),
    ].forEach((change) => {
      expect(
        ChangeRequest.parseChange(ChangeRequest.serialize(change)),
      ).toEqual({
        ok: true,
        change,
      });
    });
  });

  test('修正・削除は一覧ID(正の整数)が必須、作成は一覧IDを持たない', () => {
    const bad = (change) =>
      ChangeRequest.parseChange(JSON.stringify(change)).ok;
    expect(bad({ ...updateChange(), view: { id: '', name: 'x' } })).toBe(false);
    expect(bad({ ...updateChange(), view: { id: '1;2', name: 'x' } })).toBe(
      false,
    );
    expect(bad({ ...createChange(), view: { id: '5', name: 'x' } })).toBe(
      false,
    );
  });

  test('一覧の値に余計なプロパティがあっても捨てる(html等をAPIへ流し込まない)', () => {
    const json = JSON.stringify({
      ...createChange(),
      after: { ...createChange().after, type: 'CUSTOM', html: '<script>' },
    });
    const parsed = ChangeRequest.parseChange(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.change.after.type).toBeUndefined();
    expect(parsed.change.after.html).toBeUndefined();
  });

  test('summarize: 対象は一覧、変更前・変更後は一覧の設定', () => {
    const s = ChangeRequest.summarize(updateChange());
    expect(s.targetLabel).toBe('対象の一覧');
    expect(s.targetText).toBe('一覧「案件一覧」');
    expect(s.operationName).toBe('一覧の修正');
    expect(s.beforeText).toContain('(すべてのレコード)');
    expect(s.afterText).toContain('amount > "100"');
    expect(ChangeRequest.summarize(createChange()).targetText).toBe(
      '新しい一覧「大口案件」',
    );
  });

  test('buildViewApplyRequest: 全一覧を送るPUT', () => {
    const r = ChangeRequest.buildViewApplyRequest(updateChange(), {
      案件一覧: {
        type: 'LIST',
        name: '案件一覧',
        id: '101',
        index: '0',
        filterCond: '',
        sort: '',
        fields: ['title'],
      },
    });
    expect(r.ok).toBe(true);
    expect(r.method).toBe('PUT');
    expect(r.body.views['案件一覧'].filterCond).toBe('amount > "100"');
  });
});
