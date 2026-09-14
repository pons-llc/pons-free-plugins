const { resolveSetValue } = require('../js/lib/value-resolver');

describe('resolveSetValue - TEXT/NUMBER', () => {
  test('FIXEDは固定値をそのまま文字列で返す', () => {
    expect(
      resolveSetValue(
        'SINGLE_LINE_TEXT',
        { type: 'FIXED', value: 'こんにちは' },
        {},
      ),
    ).toBe('こんにちは');
    expect(resolveSetValue('NUMBER', { type: 'FIXED', value: '123' }, {})).toBe(
      '123',
    );
  });

  test('FIXEDで値が空ならnull', () => {
    expect(
      resolveSetValue('SINGLE_LINE_TEXT', { type: 'FIXED', value: '' }, {}),
    ).toBeNull();
    expect(
      resolveSetValue(
        'SINGLE_LINE_TEXT',
        { type: 'FIXED', value: undefined },
        {},
      ),
    ).toBeNull();
  });

  test('COPY_FIELDはrecordから値を読み取る', () => {
    const context = {
      record: { text_0: { type: 'SINGLE_LINE_TEXT', value: 'コピー元の値' } },
    };
    expect(
      resolveSetValue(
        'MULTI_LINE_TEXT',
        { type: 'COPY_FIELD', fieldCode: 'text_0' },
        context,
      ),
    ).toBe('コピー元の値');
  });

  test('COPY_FIELDでコピー元フィールドがrecordに存在しない場合はnull', () => {
    expect(
      resolveSetValue(
        'SINGLE_LINE_TEXT',
        { type: 'COPY_FIELD', fieldCode: 'missing' },
        { record: {} },
      ),
    ).toBeNull();
  });
});

describe('resolveSetValue - CHOICE', () => {
  test('FIXEDは選択肢の文字列をそのまま返す', () => {
    expect(
      resolveSetValue('RADIO_BUTTON', { type: 'FIXED', value: '選択肢A' }, {}),
    ).toBe('選択肢A');
    expect(
      resolveSetValue('DROP_DOWN', { type: 'FIXED', value: '選択肢B' }, {}),
    ).toBe('選択肢B');
  });

  test('ソース種別が不正な場合はnull', () => {
    expect(
      resolveSetValue(
        'RADIO_BUTTON',
        { type: 'COPY_FIELD', fieldCode: 'x' },
        {},
      ),
    ).toBeNull();
  });
});

describe('resolveSetValue - MULTI_CHOICE', () => {
  test('FIXEDは選択肢の配列をコピーして返す(参照を渡さない)', () => {
    const values = ['選択肢A', '選択肢B'];
    const result = resolveSetValue('CHECK_BOX', { type: 'FIXED', values }, {});
    expect(result).toEqual(values);
    expect(result).not.toBe(values);
  });

  test('valuesが配列でない場合はnull', () => {
    expect(
      resolveSetValue(
        'MULTI_SELECT',
        { type: 'FIXED', values: 'not-array' },
        {},
      ),
    ).toBeNull();
  });
});

describe('resolveSetValue - DATE/DATETIME', () => {
  test('NOW_OFFSETはcomputeNowOffsetValueへ委譲する', () => {
    const computeNowOffsetValue = jest.fn().mockReturnValue('2024-01-08');
    const context = { computeNowOffsetValue };
    const result = resolveSetValue(
      'DATE',
      { type: 'NOW_OFFSET', unit: 'DAYS', magnitude: 7 },
      context,
    );
    expect(result).toBe('2024-01-08');
    expect(computeNowOffsetValue).toHaveBeenCalledWith('DATE', 7, 'DAYS');
  });

  test('ソース種別がNOW_OFFSETでない場合はnull', () => {
    expect(
      resolveSetValue('DATE', { type: 'FIXED', value: '2024-01-01' }, {}),
    ).toBeNull();
  });

  test('computeNowOffsetValueが注入されていない場合はnull', () => {
    expect(
      resolveSetValue(
        'DATE',
        { type: 'NOW_OFFSET', unit: 'DAYS', magnitude: 1 },
        {},
      ),
    ).toBeNull();
  });
});

describe('resolveSetValue - USER_SELECT', () => {
  test('ACTORはログインユーザーのcodeを[{code}]形式で返す', () => {
    expect(
      resolveSetValue(
        'USER_SELECT',
        { type: 'ACTOR' },
        { loginUserCode: 'sato' },
      ),
    ).toEqual([{ code: 'sato' }]);
  });

  test('loginUserCodeが無い場合はnull', () => {
    expect(resolveSetValue('USER_SELECT', { type: 'ACTOR' }, {})).toBeNull();
  });
});

describe('resolveSetValue - ORGANIZATION_SELECT', () => {
  test('FIXED_CODEは固定コードを[{code}]形式で返す', () => {
    expect(
      resolveSetValue(
        'ORGANIZATION_SELECT',
        { type: 'FIXED_CODE', value: 'kaihatsu' },
        {},
      ),
    ).toEqual([{ code: 'kaihatsu' }]);
  });

  test('ACTOR_PRIMARY_ORGはcontext.primaryOrgCodeを使う', () => {
    expect(
      resolveSetValue(
        'ORGANIZATION_SELECT',
        { type: 'ACTOR_PRIMARY_ORG' },
        { primaryOrgCode: 'jinji' },
      ),
    ).toEqual([{ code: 'jinji' }]);
  });

  test('ACTOR_PRIMARY_ORGで優先する組織が無い場合はnull', () => {
    expect(
      resolveSetValue(
        'ORGANIZATION_SELECT',
        { type: 'ACTOR_PRIMARY_ORG' },
        { primaryOrgCode: null },
      ),
    ).toBeNull();
  });
});

describe('resolveSetValue - GROUP_SELECT', () => {
  test('FIXED_CODEは固定コードを[{code}]形式で返す', () => {
    expect(
      resolveSetValue(
        'GROUP_SELECT',
        { type: 'FIXED_CODE', value: 'project_manager' },
        {},
      ),
    ).toEqual([{ code: 'project_manager' }]);
  });

  test('値が空の場合はnull', () => {
    expect(
      resolveSetValue('GROUP_SELECT', { type: 'FIXED_CODE', value: '' }, {}),
    ).toBeNull();
  });
});

describe('resolveSetValue - 対応外の型', () => {
  test('対応外のtargetFieldTypeはnullを返す', () => {
    expect(
      resolveSetValue('CALC', { type: 'FIXED', value: '1' }, {}),
    ).toBeNull();
  });
});
