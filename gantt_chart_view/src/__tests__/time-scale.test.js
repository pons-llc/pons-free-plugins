const TimeScale = require('../js/lib/time-scale');

// テストは常にローカル日付として構築する(タイムゾーンによる日付ズレを避けるため、
// 'YYYY-MM-DD' 文字列をそのまま new Date() に渡さない。ISO 8601の日付のみの文字列は
// UTC深夜0時として解釈される仕様があり、西経タイムゾーンでは前日にずれることがある)。
const localDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const row = (start, end) => ({
  startDate: start ? localDate(start) : null,
  endDate: end ? localDate(end) : null,
  isUnscheduled: !start,
});

const ymd = (date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

describe('TimeScale.computeDateRange', () => {
  test('returns the min start date and max end date across scheduled rows', () => {
    const rows = [
      row('2026-07-05', '2026-07-10'),
      row('2026-07-01', '2026-07-03'),
      row('2026-07-08', '2026-07-20'),
    ];
    const range = TimeScale.computeDateRange(rows);
    expect(ymd(range.start)).toBe('2026-7-1');
    expect(ymd(range.end)).toBe('2026-7-20');
  });

  test('unscheduled rows (no start/end) are ignored when computing the range', () => {
    const rows = [row('2026-07-05', '2026-07-10'), row(null, null)];
    const range = TimeScale.computeDateRange(rows);
    expect(ymd(range.start)).toBe('2026-7-5');
  });

  test('returns null when there are no scheduled rows at all', () => {
    expect(TimeScale.computeDateRange([row(null, null)])).toBeNull();
    expect(TimeScale.computeDateRange([])).toBeNull();
  });
});

describe('TimeScale.createScale — day unit', () => {
  const range = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 10) };
  const scale = TimeScale.createScale(range, 'day', 40);

  test('dateToX places the range start at x=0', () => {
    expect(scale.dateToX(new Date(2026, 6, 1))).toBe(0);
  });

  test('dateToX advances by pixelsPerUnit for each day', () => {
    expect(scale.dateToX(new Date(2026, 6, 3))).toBe(80);
  });

  test('dateToWidth for a single-day bar equals one unit width', () => {
    expect(scale.dateToWidth(new Date(2026, 6, 5), new Date(2026, 6, 5))).toBe(
      40,
    );
  });

  test('dateToWidth is inclusive of both start and end days', () => {
    // July 1 - July 3 inclusive = 3 days
    expect(scale.dateToWidth(new Date(2026, 6, 1), new Date(2026, 6, 3))).toBe(
      120,
    );
  });

  test('totalWidth spans the full range (10 days) at pixelsPerUnit each', () => {
    expect(scale.totalWidth).toBe(400);
  });
});

describe('TimeScale.createScale — week unit', () => {
  const range = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 15) };
  const scale = TimeScale.createScale(range, 'week', 70);

  test('dateToX advances by pixelsPerUnit for each 7-day span', () => {
    expect(scale.dateToX(new Date(2026, 6, 8))).toBe(70);
  });

  test('grid lines are placed every 7 days starting at range.start', () => {
    expect(scale.gridLines[0].date.getDate()).toBe(1);
    expect(scale.gridLines[1].date.getDate()).toBe(8);
  });
});

describe('TimeScale.createScale — month unit', () => {
  const range = { start: new Date(2026, 5, 15), end: new Date(2026, 8, 10) };
  const scale = TimeScale.createScale(range, 'month', 300);

  test('grid lines are placed at the 1st of each calendar month covering the range', () => {
    const labels = scale.gridLines.map(
      (l) => `${l.date.getFullYear()}-${l.date.getMonth() + 1}`,
    );
    expect(labels).toEqual(['2026-6', '2026-7', '2026-8', '2026-9']);
  });

  test('gridLines are in ascending x order', () => {
    for (let i = 1; i < scale.gridLines.length; i += 1) {
      expect(scale.gridLines[i].x).toBeGreaterThan(scale.gridLines[i - 1].x);
    }
  });
});

describe('TimeScale.createScale — null range', () => {
  test('returns null when given a null range (no scheduled rows)', () => {
    expect(TimeScale.createScale(null, 'day', 40)).toBeNull();
  });
});
