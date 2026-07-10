const EraTable = require('../js/lib/era-table');

describe('EraTable.DEFAULT_ERA_TABLE', () => {
  test('is an empty array (Intl handles Meiji〜Reiwa on its own)', () => {
    expect(EraTable.DEFAULT_ERA_TABLE).toEqual([]);
  });
});

describe('EraTable.parseStartDate', () => {
  test('parses a YYYY-MM-DD string into {year, month, day}', () => {
    expect(EraTable.parseStartDate('2040-03-01')).toEqual({
      year: 2040,
      month: 3,
      day: 1,
    });
  });

  test('returns null for a malformed string', () => {
    expect(EraTable.parseStartDate('2040/03/01')).toBeNull();
    expect(EraTable.parseStartDate('not-a-date')).toBeNull();
    expect(EraTable.parseStartDate('')).toBeNull();
    expect(EraTable.parseStartDate(undefined)).toBeNull();
  });
});

describe('EraTable.eraYearLabel', () => {
  test('the start year itself is 元年', () => {
    expect(EraTable.eraYearLabel({ year: 2040, month: 3, day: 1 }, 2040)).toBe(
      '元',
    );
  });

  test('the year increments once per calendar year after the start year', () => {
    expect(EraTable.eraYearLabel({ year: 2040, month: 3, day: 1 }, 2041)).toBe(
      '2',
    );
    expect(EraTable.eraYearLabel({ year: 2040, month: 3, day: 1 }, 2045)).toBe(
      '6',
    );
  });
});

describe('EraTable.findOverride', () => {
  const TABLE = [
    { name: '和新', startDate: '2040-03-01' },
    { name: '和心', startDate: '2060-08-15' },
  ];

  test('returns null when the table is empty/not an array', () => {
    expect(
      EraTable.findOverride([], { year: 2040, month: 3, day: 1 }),
    ).toBeNull();
    expect(
      EraTable.findOverride(null, { year: 2040, month: 3, day: 1 }),
    ).toBeNull();
    expect(
      EraTable.findOverride(undefined, { year: 2040, month: 3, day: 1 }),
    ).toBeNull();
  });

  test('returns null when the target date is before every registered start date', () => {
    expect(
      EraTable.findOverride(TABLE, { year: 2040, month: 2, day: 29 }),
    ).toBeNull();
  });

  test('matches the era whose start date is on the target date', () => {
    const result = EraTable.findOverride(TABLE, {
      year: 2040,
      month: 3,
      day: 1,
    });
    expect(result.era.name).toBe('和新');
  });

  test('picks the most recent applicable era when multiple start dates are <= target', () => {
    const result = EraTable.findOverride(TABLE, {
      year: 2065,
      month: 1,
      day: 1,
    });
    expect(result.era.name).toBe('和心');
  });

  test('an entry with an unparsable startDate is ignored rather than crashing', () => {
    const brokenTable = [{ name: '不正', startDate: 'garbage' }];
    expect(
      EraTable.findOverride(brokenTable, { year: 2040, month: 3, day: 1 }),
    ).toBeNull();
  });
});
