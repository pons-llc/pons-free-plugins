const DayGrid = require('../js/lib/day-grid');

describe('snapMinutes', () => {
  test('rounds to the nearest 15-minute increment', () => {
    expect(DayGrid.snapMinutes(7)).toBe(0);
    expect(DayGrid.snapMinutes(8)).toBe(15);
    expect(DayGrid.snapMinutes(22)).toBe(15);
    expect(DayGrid.snapMinutes(23)).toBe(30);
  });
});

describe('minutesSinceMidnight', () => {
  test('extracts minutes-of-day from a Date', () => {
    expect(DayGrid.minutesSinceMidnight(new Date(2026, 0, 1, 9, 30))).toBe(
      9 * 60 + 30,
    );
  });
});

describe('minutesToPixels / pixelsToMinutes', () => {
  test('round-trips a value at pxPerMinute scale', () => {
    const px = DayGrid.minutesToPixels(120, 2);
    expect(px).toBe(240);
    expect(DayGrid.pixelsToMinutes(px, 2)).toBe(120);
  });

  test('pixelsToMinutes snaps to the nearest 15 minutes', () => {
    expect(DayGrid.pixelsToMinutes(121, 2)).toBe(60); // 60.5min -> snaps to 60
  });

  test('pixelsToMinutes clamps to [0, MINUTES_PER_DAY]', () => {
    expect(DayGrid.pixelsToMinutes(-50, 2)).toBe(0);
    expect(DayGrid.pixelsToMinutes(999999, 2)).toBe(DayGrid.MINUTES_PER_DAY);
  });
});
