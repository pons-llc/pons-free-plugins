const AppSchema = require('../js/lib/app-schema');

describe('buildFieldProperties', () => {
  test('突合名・突合設定・履歴テーブルを定義する', () => {
    const props = AppSchema.buildFieldProperties();
    expect(props.cac_title.type).toBe('SINGLE_LINE_TEXT');
    // 突合の定義はレコード単位で持つため、JSONを入れる複数行テキストが要る
    expect(props.cac_definition.type).toBe('MULTI_LINE_TEXT');
    expect(props.cac_runs.type).toBe('SUBTABLE');
  });

  test('履歴テーブルの中に結果JSONの添付ファイルフィールドを持つ', () => {
    const inner = AppSchema.buildFieldProperties().cac_runs.fields;
    expect(inner.cac_run_id.type).toBe('SINGLE_LINE_TEXT');
    expect(inner.cac_run_at.type).toBe('SINGLE_LINE_TEXT');
    expect(inner.cac_run_summary.type).toBe('SINGLE_LINE_TEXT');
    expect(inner.cac_run_file.type).toBe('FILE');
  });

  test('各フィールド定義の code はキーと一致する(フィールド追加APIの必須条件)', () => {
    const props = AppSchema.buildFieldProperties();
    Object.keys(props).forEach((code) => {
      expect(props[code].code).toBe(code);
      if (props[code].type === 'SUBTABLE') {
        Object.keys(props[code].fields).forEach((innerCode) => {
          expect(props[code].fields[innerCode].code).toBe(innerCode);
        });
      }
    });
  });
});

describe('missingFieldProperties', () => {
  test('何も無ければ全フィールドを返す', () => {
    const missing = AppSchema.missingFieldProperties({});
    expect(Object.keys(missing).sort()).toEqual([
      'cac_definition',
      'cac_runs',
      'cac_title',
    ]);
  });

  test('既にあるフィールドは返さない(既存には触らない)', () => {
    const missing = AppSchema.missingFieldProperties({
      cac_title: { type: 'SINGLE_LINE_TEXT', code: 'cac_title' },
    });
    expect(Object.keys(missing).sort()).toEqual(['cac_definition', 'cac_runs']);
  });

  test('すべて揃っていれば空オブジェクト', () => {
    const missing = AppSchema.missingFieldProperties(
      AppSchema.buildFieldProperties(),
    );
    expect(Object.keys(missing)).toEqual([]);
  });

  test('引数がnull/undefinedでも落ちない', () => {
    expect(Object.keys(AppSchema.missingFieldProperties(null))).toHaveLength(3);
    expect(
      Object.keys(AppSchema.missingFieldProperties(undefined)),
    ).toHaveLength(3);
  });
});

describe('missingSubtableFieldCodes', () => {
  test('テーブルが無いときは空(テーブルごと追加すればよい)', () => {
    expect(AppSchema.missingSubtableFieldCodes({})).toEqual([]);
  });

  test('テーブルはあるが中のフィールドが欠けている場合を検出する', () => {
    const missing = AppSchema.missingSubtableFieldCodes({
      cac_runs: {
        type: 'SUBTABLE',
        code: 'cac_runs',
        fields: {
          cac_run_id: { type: 'SINGLE_LINE_TEXT', code: 'cac_run_id' },
        },
      },
    });
    expect(missing.sort()).toEqual([
      'cac_run_at',
      'cac_run_file',
      'cac_run_summary',
    ]);
  });

  test('中身が揃っていれば空', () => {
    expect(
      AppSchema.missingSubtableFieldCodes(AppSchema.buildFieldProperties()),
    ).toEqual([]);
  });

  test('同名フィールドがテーブル以外の型で存在する場合は対象外にする', () => {
    expect(
      AppSchema.missingSubtableFieldCodes({
        cac_runs: { type: 'SINGLE_LINE_TEXT', code: 'cac_runs' },
      }),
    ).toEqual([]);
  });
});

describe('hasSpacer / appendSpacerRow', () => {
  const spacerRow = {
    type: 'ROW',
    fields: [{ type: 'SPACER', elementId: 'cac_view' }],
  };

  test('スペースが無ければ false', () => {
    expect(AppSchema.hasSpacer([])).toBe(false);
    expect(
      AppSchema.hasSpacer([
        { type: 'ROW', fields: [{ type: 'SINGLE_LINE_TEXT', code: 'a' }] },
      ]),
    ).toBe(false);
  });

  test('目的の要素IDのスペースがあれば true', () => {
    expect(AppSchema.hasSpacer([spacerRow])).toBe(true);
  });

  test('別の要素IDのスペースは数えない', () => {
    expect(
      AppSchema.hasSpacer([
        { type: 'ROW', fields: [{ type: 'SPACER', elementId: 'other' }] },
      ]),
    ).toBe(false);
  });

  test('グループの中に入れ子になっていても見つける', () => {
    expect(
      AppSchema.hasSpacer([
        { type: 'GROUP', code: 'グループ', layout: [spacerRow] },
      ]),
    ).toBe(true);
  });

  test('layoutがnull/undefinedでも落ちない', () => {
    expect(AppSchema.hasSpacer(null)).toBe(false);
    expect(AppSchema.hasSpacer([{ type: 'GROUP', code: 'g' }])).toBe(false);
  });

  test('appendSpacerRow は末尾に1行足す', () => {
    const layout = [{ type: 'ROW', fields: [] }];
    const next = AppSchema.appendSpacerRow(layout);
    expect(next).toHaveLength(2);
    expect(next[1].fields[0].type).toBe('SPACER');
    expect(next[1].fields[0].elementId).toBe('cac_view');
    // 元の配列は書き換えない
    expect(layout).toHaveLength(1);
  });

  test('appendSpacerRow は既にある場合は何も足さない(冪等)', () => {
    const layout = [spacerRow];
    expect(AppSchema.appendSpacerRow(layout)).toHaveLength(1);
  });
});

describe('isSchemaReady', () => {
  test('フィールドとスペースが揃って初めて true', () => {
    const props = AppSchema.buildFieldProperties();
    const layout = [AppSchema.buildSpacerRow()];

    expect(AppSchema.isSchemaReady(props, layout)).toBe(true);
    expect(AppSchema.isSchemaReady(props, [])).toBe(false);
    expect(AppSchema.isSchemaReady({}, layout)).toBe(false);
  });
});
