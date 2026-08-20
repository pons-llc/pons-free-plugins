'use strict';

const OffsetCalculator = require('../js/lib/offset-calculator');

describe('OffsetCalculator.resolveOffsetMagnitude', () => {
  test('FIXED: returns the finite fixedValue as-is', () => {
    expect(
      OffsetCalculator.resolveOffsetMagnitude(
        { offsetSource: 'FIXED', fixedValue: 10 },
        undefined,
      ),
    ).toBe(10);
  });

  test('FIXED: allows negative and decimal values', () => {
    expect(
      OffsetCalculator.resolveOffsetMagnitude(
        { offsetSource: 'FIXED', fixedValue: -5.5 },
        undefined,
      ),
    ).toBe(-5.5);
  });

  test('FIXED: returns null when fixedValue is not a finite number', () => {
    expect(
      OffsetCalculator.resolveOffsetMagnitude(
        { offsetSource: 'FIXED', fixedValue: NaN },
        undefined,
      ),
    ).toBeNull();
    expect(
      OffsetCalculator.resolveOffsetMagnitude(
        { offsetSource: 'FIXED', fixedValue: undefined },
        undefined,
      ),
    ).toBeNull();
  });

  test('FIELD: parses the raw field value as a number', () => {
    expect(
      OffsetCalculator.resolveOffsetMagnitude({ offsetSource: 'FIELD' }, '20'),
    ).toBe(20);
    expect(
      OffsetCalculator.resolveOffsetMagnitude(
        { offsetSource: 'FIELD' },
        '-3.5',
      ),
    ).toBe(-3.5);
  });

  test('FIELD: returns null when the raw field value is empty or non-numeric', () => {
    expect(
      OffsetCalculator.resolveOffsetMagnitude({ offsetSource: 'FIELD' }, ''),
    ).toBeNull();
    expect(
      OffsetCalculator.resolveOffsetMagnitude(
        { offsetSource: 'FIELD' },
        undefined,
      ),
    ).toBeNull();
    expect(
      OffsetCalculator.resolveOffsetMagnitude({ offsetSource: 'FIELD' }, 'abc'),
    ).toBeNull();
  });

  test('unknown offsetSource returns null', () => {
    expect(
      OffsetCalculator.resolveOffsetMagnitude({ offsetSource: 'X' }, '10'),
    ).toBeNull();
  });
});

describe('OffsetCalculator.applyOffset (DATE)', () => {
  test('adds whole days to a DATE value', () => {
    expect(OffsetCalculator.applyOffset('2026-08-20', 'DATE', 10, 'DAYS')).toBe(
      '2026-08-30',
    );
  });

  test('subtracts days with a negative magnitude', () => {
    expect(OffsetCalculator.applyOffset('2026-08-20', 'DATE', -5, 'DAYS')).toBe(
      '2026-08-15',
    );
  });

  test('crosses a month boundary', () => {
    expect(OffsetCalculator.applyOffset('2026-08-28', 'DATE', 5, 'DAYS')).toBe(
      '2026-09-02',
    );
  });

  test('crosses a year boundary', () => {
    expect(OffsetCalculator.applyOffset('2026-12-30', 'DATE', 5, 'DAYS')).toBe(
      '2027-01-04',
    );
  });

  test('is unaffected by DST-style local timezone shifts (pure UTC arithmetic)', () => {
    // ローカルタイムゾーンに関わらず常にUTC演算(idea.md参照)。
    expect(OffsetCalculator.applyOffset('2026-03-01', 'DATE', 1, 'DAYS')).toBe(
      '2026-03-02',
    );
  });

  test('returns null when the base value is empty', () => {
    expect(OffsetCalculator.applyOffset('', 'DATE', 10, 'DAYS')).toBeNull();
    expect(OffsetCalculator.applyOffset(null, 'DATE', 10, 'DAYS')).toBeNull();
    expect(
      OffsetCalculator.applyOffset(undefined, 'DATE', 10, 'DAYS'),
    ).toBeNull();
  });

  test('returns null when the magnitude is null', () => {
    expect(
      OffsetCalculator.applyOffset('2026-08-20', 'DATE', null, 'DAYS'),
    ).toBeNull();
  });
});

describe('OffsetCalculator.applyOffset (DATETIME)', () => {
  test('adds days to a DATETIME value', () => {
    expect(
      OffsetCalculator.applyOffset(
        '2026-08-20T11:30:00Z',
        'DATETIME',
        1,
        'DAYS',
      ),
    ).toBe('2026-08-21T11:30:00Z');
  });

  test('adds minutes to a DATETIME value', () => {
    expect(
      OffsetCalculator.applyOffset(
        '2026-08-20T11:30:00Z',
        'DATETIME',
        90,
        'MINUTES',
      ),
    ).toBe('2026-08-20T13:00:00Z');
  });

  test('subtracts minutes crossing an hour boundary', () => {
    expect(
      OffsetCalculator.applyOffset(
        '2026-08-20T11:30:00Z',
        'DATETIME',
        -31,
        'MINUTES',
      ),
    ).toBe('2026-08-20T10:59:00Z');
  });

  test('supports fractional day offsets (half a day)', () => {
    expect(
      OffsetCalculator.applyOffset(
        '2026-08-20T00:00:00Z',
        'DATETIME',
        0.5,
        'DAYS',
      ),
    ).toBe('2026-08-20T12:00:00Z');
  });

  test('returns null when the base value is empty', () => {
    expect(OffsetCalculator.applyOffset('', 'DATETIME', 1, 'DAYS')).toBeNull();
  });
});

describe('OffsetCalculator.isUnreliableInlineEditOffset', () => {
  test('true when offsetSource is FIELD and the offset field is a CALC field', () => {
    expect(
      OffsetCalculator.isUnreliableInlineEditOffset(
        { offsetSource: 'FIELD' },
        'CALC',
      ),
    ).toBe(true);
  });

  test('false when the offset field is a NUMBER field', () => {
    expect(
      OffsetCalculator.isUnreliableInlineEditOffset(
        { offsetSource: 'FIELD' },
        'NUMBER',
      ),
    ).toBe(false);
  });

  test('false when offsetSource is FIXED (no offset field involved)', () => {
    expect(
      OffsetCalculator.isUnreliableInlineEditOffset(
        { offsetSource: 'FIXED' },
        'CALC',
      ),
    ).toBe(false);
  });
});

describe('OffsetCalculator.computeTargetValue', () => {
  test('combines magnitude resolution and offset application (FIXED)', () => {
    const rule = {
      unit: 'DAYS',
      offsetSource: 'FIXED',
      fixedValue: 10,
    };
    expect(
      OffsetCalculator.computeTargetValue(
        rule,
        '2026-08-20',
        'DATE',
        undefined,
      ),
    ).toBe('2026-08-30');
  });

  test('combines magnitude resolution and offset application (FIELD)', () => {
    const rule = {
      unit: 'DAYS',
      offsetSource: 'FIELD',
    };
    expect(
      OffsetCalculator.computeTargetValue(rule, '2026-08-20', 'DATE', '20'),
    ).toBe('2026-09-09');
  });

  test('returns null (skip) when the offset field value is not numeric', () => {
    const rule = { unit: 'DAYS', offsetSource: 'FIELD' };
    expect(
      OffsetCalculator.computeTargetValue(rule, '2026-08-20', 'DATE', ''),
    ).toBeNull();
  });

  test('returns null (skip) when the base value is empty', () => {
    const rule = { unit: 'DAYS', offsetSource: 'FIXED', fixedValue: 10 };
    expect(
      OffsetCalculator.computeTargetValue(rule, '', 'DATE', undefined),
    ).toBeNull();
  });
});
