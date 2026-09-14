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
  const makeCalcSpies = () => ({
    computeInstantOffsetValue: jest.fn().mockReturnValue('2024-01-08'),
    computeFieldOffsetValue: jest.fn().mockReturnValue('2024-02-01'),
  });

  test('NOW_OFFSETはnowMsをcomputeInstantOffsetValueへ渡して委譲する', () => {
    const spies = makeCalcSpies();
    const context = { nowMs: 1000, ...spies };
    const result = resolveSetValue(
      'DATE',
      { type: 'NOW_OFFSET', unit: 'DAYS', magnitude: 7 },
      context,
    );
    expect(result).toBe('2024-01-08');
    expect(spies.computeInstantOffsetValue).toHaveBeenCalledWith(
      1000,
      'DATE',
      7,
      'DAYS',
    );
  });

  test('CREATED_TIME_OFFSETはrecordからCREATED_TIME型フィールドを探し、その瞬間を基準に計算する', () => {
    const spies = makeCalcSpies();
    const context = {
      record: {
        作成日時: { type: 'CREATED_TIME', value: '2024-01-01T00:00:00Z' },
        text_0: { type: 'SINGLE_LINE_TEXT', value: 'x' },
      },
      ...spies,
    };
    const result = resolveSetValue(
      'DATETIME',
      { type: 'CREATED_TIME_OFFSET', unit: 'DAYS', magnitude: 3 },
      context,
    );
    expect(result).toBe('2024-01-08');
    expect(spies.computeInstantOffsetValue).toHaveBeenCalledWith(
      new Date('2024-01-01T00:00:00Z').getTime(),
      'DATETIME',
      3,
      'DAYS',
    );
  });

  test('UPDATED_TIME_OFFSETはrecordからUPDATED_TIME型フィールドを探す', () => {
    const spies = makeCalcSpies();
    const context = {
      record: {
        更新日時: { type: 'UPDATED_TIME', value: '2024-05-01T00:00:00Z' },
      },
      ...spies,
    };
    resolveSetValue(
      'DATE',
      { type: 'UPDATED_TIME_OFFSET', unit: 'DAYS', magnitude: 1 },
      context,
    );
    expect(spies.computeInstantOffsetValue).toHaveBeenCalledWith(
      new Date('2024-05-01T00:00:00Z').getTime(),
      'DATE',
      1,
      'DAYS',
    );
  });

  test('CREATED_TIME型フィールドがrecordに無い場合はnull', () => {
    const spies = makeCalcSpies();
    const context = { record: {}, ...spies };
    expect(
      resolveSetValue(
        'DATE',
        { type: 'CREATED_TIME_OFFSET', unit: 'DAYS', magnitude: 1 },
        context,
      ),
    ).toBeNull();
  });

  test('FIELD_OFFSETはrecordの指定フィールドの値・型をcomputeFieldOffsetValueへ渡す', () => {
    const spies = makeCalcSpies();
    const context = {
      record: { due_date: { type: 'DATE', value: '2024-01-01' } },
      ...spies,
    };
    const result = resolveSetValue(
      'DATE',
      {
        type: 'FIELD_OFFSET',
        fieldCode: 'due_date',
        unit: 'DAYS',
        magnitude: 5,
      },
      context,
    );
    expect(result).toBe('2024-02-01');
    expect(spies.computeFieldOffsetValue).toHaveBeenCalledWith(
      '2024-01-01',
      'DATE',
      5,
      'DAYS',
    );
  });

  test('FIELD_OFFSETで基準フィールドがrecordに存在しない場合はnull', () => {
    const spies = makeCalcSpies();
    expect(
      resolveSetValue(
        'DATE',
        {
          type: 'FIELD_OFFSET',
          fieldCode: 'missing',
          unit: 'DAYS',
          magnitude: 5,
        },
        { record: {}, ...spies },
      ),
    ).toBeNull();
  });

  test('ソース種別が不正な場合はnull', () => {
    const spies = makeCalcSpies();
    expect(
      resolveSetValue(
        'DATE',
        { type: 'FIXED', value: '2024-01-01' },
        { record: {}, ...spies },
      ),
    ).toBeNull();
  });

  test('計算関数が注入されていない場合はnull', () => {
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
