const RowValidator = require('../js/lib/row-validator');

const validRow = () => ({
  viewId: '1102',
  targetFieldCode: '金額',
  budget: 100000,
  warningThresholdPct: 80,
  dangerThresholdPct: 100,
  label: '',
});

describe('RowValidator.validateRow', () => {
  test('returns no errors for a fully valid row', () => {
    expect(RowValidator.validateRow(validRow())).toEqual([]);
  });

  test('requires viewId', () => {
    const row = { ...validRow(), viewId: '' };
    expect(RowValidator.validateRow(row)).toContain(
      '対象の一覧を選択してください',
    );
  });

  test('requires targetFieldCode', () => {
    const row = { ...validRow(), targetFieldCode: '' };
    expect(RowValidator.validateRow(row)).toContain(
      '集計対象フィールドを選択してください',
    );
  });

  test.each([0, -1, NaN, undefined, ''])(
    'rejects a budget that is not greater than 0 (%p)',
    (budget) => {
      const row = { ...validRow(), budget };
      expect(RowValidator.validateRow(row)).toContain(
        '予算額は0より大きい数値を入力してください',
      );
    },
  );

  test('rejects a negative warning threshold', () => {
    const row = { ...validRow(), warningThresholdPct: -1 };
    expect(RowValidator.validateRow(row)).toContain(
      '警告しきい値(%)は0以上の数値を入力してください',
    );
  });

  test('rejects a negative danger threshold', () => {
    const row = { ...validRow(), dangerThresholdPct: -1 };
    expect(RowValidator.validateRow(row)).toContain(
      '危険しきい値(%)は0以上の数値を入力してください',
    );
  });

  test('rejects warning threshold greater than danger threshold', () => {
    const row = {
      ...validRow(),
      warningThresholdPct: 90,
      dangerThresholdPct: 80,
    };
    expect(RowValidator.validateRow(row)).toContain(
      '警告しきい値(%)は危険しきい値(%)以下にしてください',
    );
  });

  test('allows danger threshold above 100 (over-budget alert use case)', () => {
    const row = {
      ...validRow(),
      warningThresholdPct: 80,
      dangerThresholdPct: 120,
    };
    expect(RowValidator.validateRow(row)).toEqual([]);
  });

  test('allows warning threshold equal to danger threshold', () => {
    const row = {
      ...validRow(),
      warningThresholdPct: 100,
      dangerThresholdPct: 100,
    };
    expect(RowValidator.validateRow(row)).toEqual([]);
  });
});

describe('RowValidator.isValidRow', () => {
  test('true for a valid row, false for an invalid one', () => {
    expect(RowValidator.isValidRow(validRow())).toBe(true);
    expect(RowValidator.isValidRow({ ...validRow(), budget: 0 })).toBe(false);
  });
});
