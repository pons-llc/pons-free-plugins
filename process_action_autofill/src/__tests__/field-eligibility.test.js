const {
  categoryOf,
  listEligibleFields,
  listCopySourceCandidates,
} = require('../js/lib/field-eligibility');

const FORM_FIELDS = {
  text_0: { type: 'SINGLE_LINE_TEXT', code: 'text_0', label: '文字列' },
  text_1: { type: 'MULTI_LINE_TEXT', code: 'text_1', label: '文字列(複数行)' },
  number_0: { type: 'NUMBER', code: 'number_0', label: '数値' },
  radio_0: { type: 'RADIO_BUTTON', code: 'radio_0', label: 'ラジオ' },
  dropdown_0: {
    type: 'DROP_DOWN',
    code: 'dropdown_0',
    label: 'ドロップダウン',
  },
  checkbox_0: {
    type: 'CHECK_BOX',
    code: 'checkbox_0',
    label: 'チェックボックス',
  },
  multiselect_0: {
    type: 'MULTI_SELECT',
    code: 'multiselect_0',
    label: '複数選択',
  },
  date_0: { type: 'DATE', code: 'date_0', label: '日付' },
  datetime_0: { type: 'DATETIME', code: 'datetime_0', label: '日時' },
  user_0: { type: 'USER_SELECT', code: 'user_0', label: 'ユーザー' },
  org_0: { type: 'ORGANIZATION_SELECT', code: 'org_0', label: '組織' },
  group_0: { type: 'GROUP_SELECT', code: 'group_0', label: 'グループ' },
  // 非対応フィールド(対象に列挙されないことを確認する)
  record_number: { type: 'RECORD_NUMBER', code: 'record_number' },
  status: { type: 'STATUS', code: 'status' },
  assignee: { type: 'STATUS_ASSIGNEE', code: 'assignee' },
  calc_0: { type: 'CALC', code: 'calc_0' },
  file_0: { type: 'FILE', code: 'file_0' },
  category: { type: 'CATEGORY', code: 'category' },
  table_0: { type: 'SUBTABLE', code: 'table_0' },
  // ルックアップ(実体はSINGLE_LINE_TEXTだがlookupプロパティを持つ)
  lookup_0: {
    type: 'SINGLE_LINE_TEXT',
    code: 'lookup_0',
    lookup: { relatedApp: { app: '1' } },
  },
};

describe('categoryOf', () => {
  test('対応フィールド型はカテゴリを返す', () => {
    expect(categoryOf('SINGLE_LINE_TEXT')).toBe('TEXT');
    expect(categoryOf('MULTI_LINE_TEXT')).toBe('TEXT');
    expect(categoryOf('NUMBER')).toBe('NUMBER');
    expect(categoryOf('RADIO_BUTTON')).toBe('CHOICE');
    expect(categoryOf('DROP_DOWN')).toBe('CHOICE');
    expect(categoryOf('CHECK_BOX')).toBe('MULTI_CHOICE');
    expect(categoryOf('MULTI_SELECT')).toBe('MULTI_CHOICE');
    expect(categoryOf('DATE')).toBe('DATE_TIME');
    expect(categoryOf('DATETIME')).toBe('DATE_TIME');
    expect(categoryOf('USER_SELECT')).toBe('USER');
    expect(categoryOf('ORGANIZATION_SELECT')).toBe('ORGANIZATION');
    expect(categoryOf('GROUP_SELECT')).toBe('GROUP');
  });

  test('非対応フィールド型はnullを返す', () => {
    expect(categoryOf('CALC')).toBeNull();
    expect(categoryOf('STATUS')).toBeNull();
  });
});

describe('listEligibleFields', () => {
  test('対応フィールド型のみを抽出する(非対応フィールドは除外)', () => {
    const codes = listEligibleFields(FORM_FIELDS).map((f) => f.code);
    expect(codes.sort()).toEqual(
      [
        'text_0',
        'text_1',
        'number_0',
        'radio_0',
        'dropdown_0',
        'checkbox_0',
        'multiselect_0',
        'date_0',
        'datetime_0',
        'user_0',
        'org_0',
        'group_0',
      ].sort(),
    );
  });

  test('ルックアップフィールドは実体の型が対応型でも除外する', () => {
    const codes = listEligibleFields(FORM_FIELDS).map((f) => f.code);
    expect(codes).not.toContain('lookup_0');
  });
});

describe('listCopySourceCandidates', () => {
  test('TEXTカテゴリはSINGLE_LINE_TEXT/MULTI_LINE_TEXTのみを返す', () => {
    const codes = listCopySourceCandidates(FORM_FIELDS, 'TEXT').map(
      (f) => f.code,
    );
    expect(codes.sort()).toEqual(['text_0', 'text_1']);
  });

  test('NUMBERカテゴリはNUMBERのみを返す', () => {
    const codes = listCopySourceCandidates(FORM_FIELDS, 'NUMBER').map(
      (f) => f.code,
    );
    expect(codes).toEqual(['number_0']);
  });

  test('コピー元候補が無いカテゴリは空配列を返す', () => {
    expect(listCopySourceCandidates(FORM_FIELDS, 'CHOICE')).toEqual([]);
    expect(listCopySourceCandidates(FORM_FIELDS, 'USER')).toEqual([]);
  });

  test('ルックアップフィールドはコピー元候補からも除外する', () => {
    const codes = listCopySourceCandidates(FORM_FIELDS, 'TEXT').map(
      (f) => f.code,
    );
    expect(codes).not.toContain('lookup_0');
  });
});
