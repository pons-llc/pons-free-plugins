const { validateRules } = require('../js/lib/config-validation');

const FIELD_INFO = {
  text_0: { code: 'text_0', type: 'SINGLE_LINE_TEXT' },
  text_1: { code: 'text_1', type: 'MULTI_LINE_TEXT' },
  number_0: { code: 'number_0', type: 'NUMBER' },
  number_1: { code: 'number_1', type: 'NUMBER' },
  radio_0: {
    code: 'radio_0',
    type: 'RADIO_BUTTON',
    options: {
      選択肢A: { label: '選択肢A', index: '0' },
      選択肢B: { label: '選択肢B', index: '1' },
    },
  },
  checkbox_0: {
    code: 'checkbox_0',
    type: 'CHECK_BOX',
    options: {
      選択肢A: { label: '選択肢A', index: '0' },
      選択肢B: { label: '選択肢B', index: '1' },
    },
  },
  date_0: { code: 'date_0', type: 'DATE' },
  date_1: { code: 'date_1', type: 'DATE' },
  datetime_0: { code: 'datetime_0', type: 'DATETIME' },
  datetime_1: { code: 'datetime_1', type: 'DATETIME' },
  user_0: { code: 'user_0', type: 'USER_SELECT' },
  org_0: { code: 'org_0', type: 'ORGANIZATION_SELECT' },
  group_0: { code: 'group_0', type: 'GROUP_SELECT' },
  status: { code: 'status', type: 'STATUS' },
};

describe('validateRules - 構造チェック(fieldInfoByCode省略時)', () => {
  test('rulesが配列でない場合は無効', () => {
    expect(validateRules(null).valid).toBe(false);
  });

  test('対象フィールド未選択・動作不正はエラー', () => {
    const { valid, errors } = validateRules([
      { targetFieldCode: '', operation: 'INVALID' },
    ]);
    expect(valid).toBe(false);
    expect(
      errors.some((e) => e.includes('対象フィールドが選択されていません')),
    ).toBe(true);
    expect(errors.some((e) => e.includes('動作'))).toBe(true);
  });

  test('CLEARは対象フィールド・動作さえあれば有効(fieldInfoByCode省略時)', () => {
    const { valid } = validateRules([
      { targetFieldCode: 'text_0', operation: 'CLEAR', filter: {} },
    ]);
    expect(valid).toBe(true);
  });
});

describe('validateRules - 意味的チェック(fieldInfoByCode指定時)', () => {
  test('対応外の型・存在しないフィールドはエラー', () => {
    const { valid, errors } = validateRules(
      [{ targetFieldCode: 'status', operation: 'CLEAR', filter: {} }],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('対応していない型');
  });

  test('TEXT: FIXEDで値が空はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'text_0',
          operation: 'SET',
          source: { type: 'FIXED', value: '' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('固定値が入力されていません');
  });

  test('TEXT: COPY_FIELDで互換性の無い型を指定するとエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'text_0',
          operation: 'SET',
          source: { type: 'COPY_FIELD', fieldCode: 'number_0' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('互換性のある型ではありません');
  });

  test('TEXT: COPY_FIELDで文字列系フィールドを指定すると有効', () => {
    const { valid } = validateRules(
      [
        {
          targetFieldCode: 'text_0',
          operation: 'SET',
          source: { type: 'COPY_FIELD', fieldCode: 'text_1' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(true);
  });

  test('NUMBER: FIXEDで数値でない値はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'number_0',
          operation: 'SET',
          source: { type: 'FIXED', value: 'abc' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('数値で指定してください');
  });

  test('CHOICE: 現在の選択肢に無い値を指定するとエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'radio_0',
          operation: 'SET',
          source: { type: 'FIXED', value: '存在しない選択肢' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('現在の選択肢に存在しません');
  });

  test('CHOICE: 現在の選択肢に存在する値は有効', () => {
    const { valid } = validateRules(
      [
        {
          targetFieldCode: 'radio_0',
          operation: 'SET',
          source: { type: 'FIXED', value: '選択肢A' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(true);
  });

  test('MULTI_CHOICE: 1つも選択していない場合はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'checkbox_0',
          operation: 'SET',
          source: { type: 'FIXED', values: [] },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('選択肢が1つも選択されていません');
  });

  test('DATE_TIME: 単位「分数」をDATEに指定するとエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: { type: 'NOW_OFFSET', unit: 'MINUTES', magnitude: 10 },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('日時型の場合のみ');
  });

  test('DATE_TIME: DATETIMEに単位「分数」は有効', () => {
    const { valid } = validateRules(
      [
        {
          targetFieldCode: 'datetime_0',
          operation: 'SET',
          source: { type: 'NOW_OFFSET', unit: 'MINUTES', magnitude: 10 },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(true);
  });

  test('DATE_TIME: 対応外のソース種別はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: { type: 'FIXED', value: '2024-01-01' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('ソース種別が不正');
  });

  test('DATE_TIME: CREATED_TIME_OFFSET/UPDATED_TIME_OFFSETは基準フィールド指定なしで有効', () => {
    const { valid: createdValid } = validateRules(
      [
        {
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: { type: 'CREATED_TIME_OFFSET', unit: 'DAYS', magnitude: 1 },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(createdValid).toBe(true);

    const { valid: updatedValid } = validateRules(
      [
        {
          targetFieldCode: 'datetime_0',
          operation: 'SET',
          source: {
            type: 'UPDATED_TIME_OFFSET',
            unit: 'MINUTES',
            magnitude: 30,
          },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(updatedValid).toBe(true);
  });

  test('DATE_TIME: FIELD_OFFSETで基準フィールド未選択はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: {
            type: 'FIELD_OFFSET',
            fieldCode: '',
            unit: 'DAYS',
            magnitude: 1,
          },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('基準フィールドが選択されていません');
  });

  test('DATE_TIME: FIELD_OFFSETで対象フィールドと型が異なる基準フィールドを指定するとエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: {
            type: 'FIELD_OFFSET',
            fieldCode: 'datetime_0',
            unit: 'DAYS',
            magnitude: 1,
          },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('対象フィールドと同じ型');
  });

  test('DATE_TIME: FIELD_OFFSETで対象フィールドと同じ型の基準フィールドを指定すると有効', () => {
    const { valid } = validateRules(
      [
        {
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: {
            type: 'FIELD_OFFSET',
            fieldCode: 'date_1',
            unit: 'DAYS',
            magnitude: 1,
          },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(true);
  });

  test('USER_SELECT: ACTOR以外はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'user_0',
          operation: 'SET',
          source: { type: 'NEXT_ASSIGNEE' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('ソース種別が不正');
  });

  test('ORGANIZATION_SELECT: FIXED_CODEで値が空はエラー', () => {
    const { valid, errors } = validateRules(
      [
        {
          targetFieldCode: 'org_0',
          operation: 'SET',
          source: { type: 'FIXED_CODE', value: '' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(false);
    expect(errors[0]).toContain('組織コードが入力されていません');
  });

  test('ORGANIZATION_SELECT: ACTOR_PRIMARY_ORGは値なしで有効', () => {
    const { valid } = validateRules(
      [
        {
          targetFieldCode: 'org_0',
          operation: 'SET',
          source: { type: 'ACTOR_PRIMARY_ORG' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(true);
  });

  test('GROUP_SELECT: FIXED_CODEで値ありは有効', () => {
    const { valid } = validateRules(
      [
        {
          targetFieldCode: 'group_0',
          operation: 'SET',
          source: { type: 'FIXED_CODE', value: 'team_leader' },
          filter: {},
        },
      ],
      FIELD_INFO,
    );
    expect(valid).toBe(true);
  });
});
