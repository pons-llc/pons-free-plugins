'use strict';

const { expandTimeSlots, shiftTime } = require('../js/lib/time-slot-expander');

describe('expandTimeSlots', () => {
  test('9:00-17:00を1時間ごとに分割する(終了時刻は含まない、8枠)', () => {
    const slots = expandTimeSlots({
      startTime: '09:00',
      endTime: '17:00',
      intervalMinutes: 60,
    });
    expect(slots).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
  });

  test('間隔が範囲を割り切れない場合、終了時刻を超える枠は作らない', () => {
    const slots = expandTimeSlots({
      startTime: '09:00',
      endTime: '10:30',
      intervalMinutes: 60,
    });
    expect(slots).toEqual(['09:00', '10:00']);
  });

  test('30分刻みで分割できる', () => {
    const slots = expandTimeSlots({
      startTime: '13:00',
      endTime: '14:00',
      intervalMinutes: 30,
    });
    expect(slots).toEqual(['13:00', '13:30']);
  });

  test('日をまたぐ時刻(23:00-翌1:00等)は扱わない前提でHH:MM文字列のみを返す', () => {
    const slots = expandTimeSlots({
      startTime: '00:00',
      endTime: '00:30',
      intervalMinutes: 15,
    });
    expect(slots).toEqual(['00:00', '00:15']);
  });

  describe('バリデーション', () => {
    test('startTimeがendTime以上なら例外', () => {
      expect(() =>
        expandTimeSlots({
          startTime: '17:00',
          endTime: '09:00',
          intervalMinutes: 60,
        }),
      ).toThrow();
      expect(() =>
        expandTimeSlots({
          startTime: '09:00',
          endTime: '09:00',
          intervalMinutes: 60,
        }),
      ).toThrow();
    });

    test('intervalMinutesが0以下なら例外', () => {
      expect(() =>
        expandTimeSlots({
          startTime: '09:00',
          endTime: '17:00',
          intervalMinutes: 0,
        }),
      ).toThrow();
    });

    test('不正な時刻形式は例外', () => {
      expect(() =>
        expandTimeSlots({
          startTime: '9:00',
          endTime: '17:00',
          intervalMinutes: 60,
        }),
      ).toThrow();
      expect(() =>
        expandTimeSlots({
          startTime: '09:00',
          endTime: '25:00',
          intervalMinutes: 60,
        }),
      ).toThrow();
    });
  });
});

describe('shiftTime', () => {
  test('開始時刻に分を足した時刻を返す(枠の終了時刻の算出に使う)', () => {
    expect(shiftTime('09:00', 60)).toBe('10:00');
    expect(shiftTime('13:30', 90)).toBe('15:00');
  });

  test('0分を足すと同じ時刻を返す', () => {
    expect(shiftTime('09:00', 0)).toBe('09:00');
  });

  test('24:00を超える場合は例外(日をまたぐ時刻は扱わない)', () => {
    expect(() => shiftTime('23:30', 60)).toThrow();
  });

  test('不正な時刻形式・負の分は例外', () => {
    expect(() => shiftTime('9:00', 60)).toThrow();
    expect(() => shiftTime('09:00', -10)).toThrow();
  });
});
