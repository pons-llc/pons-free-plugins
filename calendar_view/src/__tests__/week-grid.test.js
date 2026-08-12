const WeekGrid = require('../js/lib/week-grid');

describe('startOfWeek', () => {
  test('returns the preceding Sunday at midnight for a mid-week date', () => {
    // 2026-08-12 is a Wednesday
    const result = WeekGrid.startOfWeek(new Date(2026, 7, 12, 15, 30));
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(0);
  });

  test('returns the same day when given a Sunday', () => {
    const sunday = new Date(2026, 7, 9);
    const result = WeekGrid.startOfWeek(sunday);
    expect(result.getDate()).toBe(9);
  });
});

describe('dayIndexInWeek', () => {
  const weekStart = WeekGrid.startOfWeek(new Date(2026, 7, 12));

  test('returns 0 for the week-start day itself', () => {
    expect(WeekGrid.dayIndexInWeek(weekStart, weekStart)).toBe(0);
  });

  test('returns 3 for a Wednesday in that week', () => {
    expect(WeekGrid.dayIndexInWeek(new Date(2026, 7, 12), weekStart)).toBe(3);
  });

  test('returns -1 for a date outside the week', () => {
    expect(WeekGrid.dayIndexInWeek(new Date(2026, 7, 20), weekStart)).toBe(-1);
  });
});

describe('bucketEventsByDay', () => {
  const weekStart = WeekGrid.startOfWeek(new Date(2026, 7, 12));
  const evt = (date) => ({ start: date, end: date });

  test('distributes events into 7 buckets by start-date weekday', () => {
    const buckets = WeekGrid.bucketEventsByDay(
      [evt(new Date(2026, 7, 9, 10)), evt(new Date(2026, 7, 12, 8))],
      weekStart,
    );
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toHaveLength(1);
    expect(buckets[3]).toHaveLength(1);
  });

  test('drops events outside the displayed week', () => {
    const buckets = WeekGrid.bucketEventsByDay(
      [evt(new Date(2026, 6, 1))],
      weekStart,
    );
    expect(buckets.every((b) => b.length === 0)).toBe(true);
  });

  test('sorts events within a day bucket by start time', () => {
    const buckets = WeekGrid.bucketEventsByDay(
      [evt(new Date(2026, 7, 9, 15)), evt(new Date(2026, 7, 9, 8))],
      weekStart,
    );
    expect(buckets[0][0].start.getHours()).toBe(8);
    expect(buckets[0][1].start.getHours()).toBe(15);
  });
});
