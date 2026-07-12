'use strict';

const TimeBand = require('../js/lib/time-band');

describe('TimeBand.minutesToClock', () => {
  test('0分は00:00', () => {
    expect(TimeBand.minutesToClock(0)).toBe('00:00');
  });
  test('90分は01:30', () => {
    expect(TimeBand.minutesToClock(90)).toBe('01:30');
  });
  test('1440分は24:00(翌日0時)', () => {
    expect(TimeBand.minutesToClock(1440)).toBe('24:00');
  });
});

describe('TimeBand.formatBandLabel', () => {
  test('60分区切りの9:00開始は"09:00〜10:00"', () => {
    expect(TimeBand.formatBandLabel(540, 60)).toBe('09:00〜10:00');
  });
  test('最後の時間帯は24:00で終わる', () => {
    expect(TimeBand.formatBandLabel(1380, 60)).toBe('23:00〜24:00');
  });
});

describe('TimeBand.generateBands', () => {
  test('60分区切りは24個の時間帯になる', () => {
    const bands = TimeBand.generateBands(60);
    expect(bands).toHaveLength(24);
    expect(bands[0]).toEqual({ start: 0, label: '00:00〜01:00' });
    expect(bands[23]).toEqual({ start: 1380, label: '23:00〜24:00' });
  });

  test('720分区切りは2個の時間帯になる', () => {
    const bands = TimeBand.generateBands(720);
    expect(bands).toEqual([
      { start: 0, label: '00:00〜12:00' },
      { start: 720, label: '12:00〜24:00' },
    ]);
  });

  test('15分区切りは96個の時間帯になる', () => {
    expect(TimeBand.generateBands(15)).toHaveLength(96);
  });
});

describe('TimeBand.parseTimeValueToMinutes', () => {
  test('"11:30"は690分', () => {
    expect(TimeBand.parseTimeValueToMinutes('11:30')).toBe(690);
  });
  test('"00:00"は0分', () => {
    expect(TimeBand.parseTimeValueToMinutes('00:00')).toBe(0);
  });
  test('空文字・null・undefinedはnull', () => {
    expect(TimeBand.parseTimeValueToMinutes('')).toBeNull();
    expect(TimeBand.parseTimeValueToMinutes(null)).toBeNull();
    expect(TimeBand.parseTimeValueToMinutes(undefined)).toBeNull();
  });
  test('不正な文字列はnull', () => {
    expect(TimeBand.parseTimeValueToMinutes('not-a-time')).toBeNull();
  });
});

describe('TimeBand.parseDateTimeValueToMinutes', () => {
  test('UTC文字列をAsia/Tokyo(+9時間)で解釈する', () => {
    // 2012-01-11T11:30:00Z は Asia/Tokyo で 2012-01-11 20:30
    expect(
      TimeBand.parseDateTimeValueToMinutes(
        '2012-01-11T11:30:00Z',
        'Asia/Tokyo',
      ),
    ).toBe(20 * 60 + 30);
  });

  test('タイムゾーン変換で日付をまたぐケース(UTC深夜→Asia/Tokyoは翌日早朝)', () => {
    // 2012-01-11T23:15:00Z は Asia/Tokyo で 2012-01-12 08:15
    expect(
      TimeBand.parseDateTimeValueToMinutes(
        '2012-01-11T23:15:00Z',
        'Asia/Tokyo',
      ),
    ).toBe(8 * 60 + 15);
  });

  test('タイムゾーン変換で前日に戻るケース(UTC朝→アメリカは前日)', () => {
    // 2012-01-11T04:00:00Z は America/Los_Angeles(冬時間 UTC-8) で 2012-01-10 20:00
    expect(
      TimeBand.parseDateTimeValueToMinutes(
        '2012-01-11T04:00:00Z',
        'America/Los_Angeles',
      ),
    ).toBe(20 * 60);
  });

  test('空文字・不正な値はnull', () => {
    expect(TimeBand.parseDateTimeValueToMinutes('', 'Asia/Tokyo')).toBeNull();
    expect(
      TimeBand.parseDateTimeValueToMinutes('not-a-date', 'Asia/Tokyo'),
    ).toBeNull();
  });
});

describe('TimeBand.computeTimeBand', () => {
  test('TIME型: 9:45は60分区切りで"09:00〜10:00"・540', () => {
    const result = TimeBand.computeTimeBand({
      value: '09:45',
      fieldType: 'TIME',
      bandWidthMinutes: 60,
    });
    expect(result).toEqual({ label: '09:00〜10:00', number: 540 });
  });

  test('DATETIME型: タイムゾーンを考慮して算出する', () => {
    const result = TimeBand.computeTimeBand({
      value: '2012-01-11T11:30:00Z',
      fieldType: 'DATETIME',
      bandWidthMinutes: 30,
      timeZone: 'Asia/Tokyo',
    });
    // Asia/Tokyoで20:30 -> 30分区切りの開始は20:30
    expect(result).toEqual({ label: '20:30〜21:00', number: 20 * 60 + 30 });
  });

  test('値が空の場合はnull', () => {
    expect(
      TimeBand.computeTimeBand({
        value: '',
        fieldType: 'TIME',
        bandWidthMinutes: 60,
      }),
    ).toBeNull();
    expect(
      TimeBand.computeTimeBand({
        value: '',
        fieldType: 'DATETIME',
        bandWidthMinutes: 60,
        timeZone: 'Asia/Tokyo',
      }),
    ).toBeNull();
  });

  test('未対応のfieldTypeはnull', () => {
    expect(
      TimeBand.computeTimeBand({
        value: '2012-01-11',
        fieldType: 'DATE',
        bandWidthMinutes: 60,
      }),
    ).toBeNull();
  });
});
