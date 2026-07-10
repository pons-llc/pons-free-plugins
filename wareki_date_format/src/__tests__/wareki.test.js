const Wareki = require('../js/lib/wareki');

describe('Wareki.PRESETS', () => {
  test('exposes the two supported preset identifiers', () => {
    expect(Wareki.PRESETS.WAREKI_ONLY).toBe('WAREKI_ONLY');
    expect(Wareki.PRESETS.WAREKI_WITH_SEIREKI).toBe('WAREKI_WITH_SEIREKI');
  });
});

describe('Wareki.format — DATE field (no timezone conversion)', () => {
  test('WAREKI_ONLY, half-width (default)', () => {
    expect(Wareki.format('DATE', '2024-07-09', { preset: 'WAREKI_ONLY' })).toBe(
      '令和6年7月9日',
    );
  });

  test('WAREKI_ONLY, full-width', () => {
    expect(
      Wareki.format('DATE', '2024-07-09', {
        preset: 'WAREKI_ONLY',
        zenkaku: true,
      }),
    ).toBe('令和６年７月９日');
  });

  test('WAREKI_WITH_SEIREKI, half-width', () => {
    expect(
      Wareki.format('DATE', '2024-07-09', { preset: 'WAREKI_WITH_SEIREKI' }),
    ).toBe('2024年(令和6年)7月9日');
  });

  test('WAREKI_WITH_SEIREKI, full-width (seireki year stays half-width: only single-digit numbers are converted)', () => {
    expect(
      Wareki.format('DATE', '2024-07-09', {
        preset: 'WAREKI_WITH_SEIREKI',
        zenkaku: true,
      }),
    ).toBe('2024年(令和６年)７月９日');
  });

  test('the first year of an era is rendered as 元年, not 1年', () => {
    // 平成31年4月30日が平成最後の日、令和元年5月1日が令和最初の日。
    expect(Wareki.format('DATE', '2019-05-01', { preset: 'WAREKI_ONLY' })).toBe(
      '令和元年5月1日',
    );
    expect(
      Wareki.format('DATE', '2019-05-01', { preset: 'WAREKI_WITH_SEIREKI' }),
    ).toBe('2019年(令和元年)5月1日');
  });

  test('era boundary: the day before a new era still uses the old era', () => {
    expect(Wareki.format('DATE', '2019-04-30', { preset: 'WAREKI_ONLY' })).toBe(
      '平成31年4月30日',
    );
  });

  test('default preset is WAREKI_ONLY when omitted', () => {
    expect(Wareki.format('DATE', '2024-07-09')).toBe('令和6年7月9日');
  });

  test('single-digit month/day are not zero-padded in half-width mode', () => {
    expect(Wareki.format('DATE', '2024-01-05', { preset: 'WAREKI_ONLY' })).toBe(
      '令和6年1月5日',
    );
  });
});

describe('Wareki.format — zenkaku applies only to single-digit numbers', () => {
  test('two-digit day stays half-width while single-digit era-year/month become full-width', () => {
    // 令和8年7月10日: 年(8)・月(7)は1桁なので全角、日(10)は2桁なのでそのまま半角。
    expect(
      Wareki.format('DATE', '2026-07-10', {
        preset: 'WAREKI_ONLY',
        zenkaku: true,
      }),
    ).toBe('令和８年７月10日');
  });

  test('two-digit era year and two-digit month both stay half-width', () => {
    expect(
      Wareki.format('DATE', '2033-11-12', {
        preset: 'WAREKI_ONLY',
        zenkaku: true,
      }),
    ).toBe('令和15年11月12日');
  });

  test('元年(first year of an era) is unaffected by zenkaku since it is not a digit', () => {
    expect(
      Wareki.format('DATE', '2019-05-01', {
        preset: 'WAREKI_ONLY',
        zenkaku: true,
      }),
    ).toBe('令和元年５月１日');
  });
});

describe('Wareki.format — DATETIME field (UTC value, Asia/Tokyo calendar day)', () => {
  test('a UTC instant that is still the previous day in Asia/Tokyo (early UTC hours) is unaffected here', () => {
    // 2024-07-09T01:00:00Z は Asia/Tokyo では 2024-07-09 10:00 なので同じ日。
    expect(
      Wareki.format('DATETIME', '2024-07-09T01:00:00Z', {
        preset: 'WAREKI_ONLY',
      }),
    ).toBe('令和6年7月9日');
  });

  test('a UTC instant late in the day rolls over to the next day in Asia/Tokyo', () => {
    // 2024-07-09T15:30:00Z は Asia/Tokyo では 2024-07-10 00:30 なので日付が繰り上がる。
    expect(
      Wareki.format('DATETIME', '2024-07-09T15:30:00Z', {
        preset: 'WAREKI_ONLY',
      }),
    ).toBe('令和6年7月10日');
  });

  test('a custom timeZone option overrides the Asia/Tokyo default', () => {
    // 2024-07-09T15:30:00Z はUTCではそのまま7/9。
    expect(
      Wareki.format('DATETIME', '2024-07-09T15:30:00Z', {
        preset: 'WAREKI_ONLY',
        timeZone: 'UTC',
      }),
    ).toBe('令和6年7月9日');
  });

  test('CREATED_TIME/UPDATED_TIME use the same ISO/UTC handling as DATETIME', () => {
    expect(
      Wareki.format('CREATED_TIME', '2024-07-09T01:00:00Z', {
        preset: 'WAREKI_ONLY',
      }),
    ).toBe('令和6年7月9日');
    expect(
      Wareki.format('UPDATED_TIME', '2024-07-09T01:00:00Z', {
        preset: 'WAREKI_ONLY',
      }),
    ).toBe('令和6年7月9日');
  });
});

describe('Wareki.format — empty/invalid input handling', () => {
  test('empty string value returns empty string (field not yet filled in)', () => {
    expect(Wareki.format('DATE', '', { preset: 'WAREKI_ONLY' })).toBe('');
    expect(Wareki.format('DATETIME', '', { preset: 'WAREKI_ONLY' })).toBe('');
  });

  test('null/undefined value returns empty string', () => {
    expect(Wareki.format('DATE', null)).toBe('');
    expect(Wareki.format('DATE', undefined)).toBe('');
  });

  test('unsupported field type returns empty string', () => {
    expect(Wareki.format('SINGLE_LINE_TEXT', '2024-07-09')).toBe('');
  });

  test('malformed DATE string returns empty string rather than throwing', () => {
    expect(Wareki.format('DATE', 'not-a-date')).toBe('');
  });

  test('malformed DATETIME string returns empty string rather than throwing', () => {
    expect(Wareki.format('DATETIME', 'not-a-date')).toBe('');
  });
});

describe('Wareki.format — eraTable overrides (manually registered future eras)', () => {
  const FUTURE_ERA_TABLE = [{ name: '和新', startDate: '2040-03-01' }];

  test('a date before the override start date still uses Intl (令和)', () => {
    expect(
      Wareki.format('DATE', '2040-02-29', {
        preset: 'WAREKI_ONLY',
        eraTable: FUTURE_ERA_TABLE,
      }),
    ).toBe('令和22年2月29日');
  });

  test('the override start date itself is 元年', () => {
    expect(
      Wareki.format('DATE', '2040-03-01', {
        preset: 'WAREKI_ONLY',
        eraTable: FUTURE_ERA_TABLE,
      }),
    ).toBe('和新元年3月1日');
  });

  test('the era year increments on the next Jan 1, not on the start-date anniversary', () => {
    expect(
      Wareki.format('DATE', '2041-01-01', {
        preset: 'WAREKI_ONLY',
        eraTable: FUTURE_ERA_TABLE,
      }),
    ).toBe('和新2年1月1日');
  });

  test('WAREKI_WITH_SEIREKI also honors the override', () => {
    expect(
      Wareki.format('DATE', '2040-03-01', {
        preset: 'WAREKI_WITH_SEIREKI',
        eraTable: FUTURE_ERA_TABLE,
      }),
    ).toBe('2040年(和新元年)3月1日');
  });

  test('an empty/omitted eraTable falls back to Intl only (existing behavior)', () => {
    expect(Wareki.format('DATE', '2040-03-01', { preset: 'WAREKI_ONLY' })).toBe(
      Wareki.format('DATE', '2040-03-01', {
        preset: 'WAREKI_ONLY',
        eraTable: [],
      }),
    );
  });
});

describe('Wareki.toCalendarParts', () => {
  test('DATE parses year/month/day directly from the string, no Date object timezone math', () => {
    expect(Wareki.toCalendarParts('DATE', '2024-07-09')).toEqual({
      year: 2024,
      month: 7,
      day: 9,
    });
  });

  test('DATETIME converts the UTC instant to Asia/Tokyo calendar day by default', () => {
    expect(Wareki.toCalendarParts('DATETIME', '2024-07-09T15:30:00Z')).toEqual({
      year: 2024,
      month: 7,
      day: 10,
    });
  });

  test('returns null for empty/invalid input', () => {
    expect(Wareki.toCalendarParts('DATE', '')).toBeNull();
    expect(Wareki.toCalendarParts('DATE', 'garbage')).toBeNull();
    expect(Wareki.toCalendarParts('DATETIME', 'garbage')).toBeNull();
    expect(Wareki.toCalendarParts('UNKNOWN_TYPE', '2024-07-09')).toBeNull();
  });
});
