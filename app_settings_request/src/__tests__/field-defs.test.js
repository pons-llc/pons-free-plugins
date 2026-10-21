const FieldDefs = require('../js/lib/field-defs.js');

describe('diffMissingFields', () => {
  test('既存のフィールドコードは除く', () => {
    const missing = FieldDefs.diffMissingFields({
      asr_app_id: { type: 'NUMBER' },
      asr_reason: { type: 'MULTI_LINE_TEXT' },
    });
    const codes = missing.map((d) => d.code);
    expect(codes).not.toContain('asr_app_id');
    expect(codes).not.toContain('asr_reason');
    expect(codes).toContain('asr_change_json');
  });

  test('何も無ければ全部', () => {
    expect(FieldDefs.diffMissingFields(undefined).length).toBe(
      FieldDefs.FIELD_DEFINITIONS.length,
    );
  });

  test('すべてのフィールドコードが asr_ で始まる', () => {
    FieldDefs.FIELD_DEFINITIONS.forEach((d) => {
      expect(d.code).toMatch(/^asr_/);
    });
  });
});

describe('buildAddFieldsPayload', () => {
  test('フィールドコードをキーにする', () => {
    const payload = FieldDefs.buildAddFieldsPayload(
      FieldDefs.FIELD_DEFINITIONS.slice(0, 2),
    );
    expect(Object.keys(payload)).toEqual(['asr_app_id', 'asr_app_name']);
  });
});

describe('hasSpacer / insertSpacerRow', () => {
  const ID = FieldDefs.SPACER_ELEMENT_ID;
  const layout = [
    { type: 'ROW', fields: [{ type: 'SINGLE_LINE_TEXT', code: 'x' }] },
    { type: 'ROW', fields: [{ type: 'NUMBER', code: 'asr_app_id' }] },
  ];

  test('グループ内のスペースも見つける', () => {
    expect(
      FieldDefs.hasSpacer(
        [
          {
            type: 'GROUP',
            code: 'g',
            layout: [
              { type: 'ROW', fields: [{ type: 'SPACER', elementId: ID }] },
            ],
          },
        ],
        ID,
      ),
    ).toBe(true);
    expect(FieldDefs.hasSpacer(layout, ID)).toBe(false);
  });

  test('対象アプリIDの行の直前に挿入する', () => {
    const next = FieldDefs.insertSpacerRow(layout, ID);
    expect(next.length).toBe(3);
    expect(next[1].fields[0]).toMatchObject({ type: 'SPACER', elementId: ID });
    expect(next[2]).toBe(layout[1]);
  });

  test('対象アプリIDが無ければ末尾', () => {
    const next = FieldDefs.insertSpacerRow([layout[0]], ID);
    expect(next[1].fields[0].elementId).toBe(ID);
  });

  test('既にあれば同じ配列を返す(冪等)', () => {
    const once = FieldDefs.insertSpacerRow(layout, ID);
    expect(FieldDefs.insertSpacerRow(once, ID)).toBe(once);
  });
});

describe('findCreatorFieldCode', () => {
  test('作成者フィールドのコード', () => {
    expect(
      FieldDefs.findCreatorFieldCode({
        a: { type: 'NUMBER' },
        登録者: { type: 'CREATOR' },
      }),
    ).toBe('登録者');
    expect(FieldDefs.findCreatorFieldCode({})).toBe('');
  });
});
