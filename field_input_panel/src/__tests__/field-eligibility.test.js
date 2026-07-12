const FieldEligibility = require('../js/lib/field-eligibility');

describe('isEligibleField', () => {
  test.each(FieldEligibility.ELIGIBLE_TYPES)(
    '対応フィールド型 %s はtrue',
    (type) => {
      expect(FieldEligibility.isEligibleField({ type })).toBe(true);
    },
  );

  test.each([
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'FILE',
    'RICH_TEXT',
    'REFERENCE_TABLE',
    'SUBTABLE',
    'CALC',
    'RECORD_NUMBER',
    'CREATOR',
    'CREATED_TIME',
    'MODIFIER',
    'UPDATED_TIME',
    'STATUS',
    'STATUS_ASSIGNEE',
    'CATEGORY',
    'GROUP',
    'LABEL',
    'SPACER',
    'HR',
  ])('非対応フィールド型 %s はfalse', (type) => {
    expect(FieldEligibility.isEligibleField({ type })).toBe(false);
  });

  test('lookup設定を持つフィールドは、コピー元の型がSINGLE_LINE_TEXTでもfalse', () => {
    expect(
      FieldEligibility.isEligibleField({
        type: 'SINGLE_LINE_TEXT',
        lookup: { relatedApp: { app: '1' } },
      }),
    ).toBe(false);
  });

  test('フィールド情報が無い(undefined)場合はfalse', () => {
    expect(FieldEligibility.isEligibleField(undefined)).toBe(false);
  });
});

describe('listEligibleFields', () => {
  test('対応フィールドのみをcode/label/typeの配列で返す', () => {
    const formFields = {
      text1: { type: 'SINGLE_LINE_TEXT', label: '文字列' },
      user1: { type: 'USER_SELECT', label: 'ユーザー' },
      lookup1: {
        type: 'NUMBER',
        label: 'ルックアップ数値',
        lookup: { relatedApp: { app: '1' } },
      },
    };
    expect(FieldEligibility.listEligibleFields(formFields)).toEqual([
      { code: 'text1', label: '文字列', type: 'SINGLE_LINE_TEXT' },
    ]);
  });

  test('ラベルが無い場合はフィールドコードをラベル代わりに使う', () => {
    const formFields = { text1: { type: 'SINGLE_LINE_TEXT' } };
    expect(FieldEligibility.listEligibleFields(formFields)).toEqual([
      { code: 'text1', label: 'text1', type: 'SINGLE_LINE_TEXT' },
    ]);
  });

  test('formFieldsが未定義でも空配列を返す', () => {
    expect(FieldEligibility.listEligibleFields(undefined)).toEqual([]);
  });
});
