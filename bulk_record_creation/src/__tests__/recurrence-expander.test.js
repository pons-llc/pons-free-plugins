'use strict';

const { expandRecurrence } = require('../js/lib/recurrence-expander');

describe('expandRecurrence', () => {
  describe('ONCE', () => {
    test('開始日1件のみを返す(終了条件は無視する)', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'ONCE',
      });
      expect(dates).toEqual(['2024-01-01']);
    });

    test('終了条件が指定されていても無視する', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'ONCE',
        endCondition: { type: 'COUNT', count: 5 },
      });
      expect(dates).toEqual(['2024-01-01']);
    });
  });

  describe('DAILY', () => {
    test('回数指定で開始日から連続する日付を返す', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'DAILY',
        endCondition: { type: 'COUNT', count: 3 },
      });
      expect(dates).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });

    test('終了日指定で終了日を含めて連続する日付を返す', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'DAILY',
        endCondition: { type: 'END_DATE', endDate: '2024-01-03' },
      });
      expect(dates).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });

    test('月をまたいでも連続する', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-30',
        frequency: 'DAILY',
        endCondition: { type: 'COUNT', count: 3 },
      });
      expect(dates).toEqual(['2024-01-30', '2024-01-31', '2024-02-01']);
    });
  });

  describe('WEEKLY', () => {
    // 2024-01-01は月曜日(getUTCDay() === 1)であることを起点に検証する。
    test('複数曜日を回数指定で展開する', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'WEEKLY',
        weekdays: [1, 3, 5], // 月・水・金
        endCondition: { type: 'COUNT', count: 4 },
      });
      expect(dates).toEqual([
        '2024-01-01', // 月
        '2024-01-03', // 水
        '2024-01-05', // 金
        '2024-01-08', // 月(翌週)
      ]);
    });

    test('開始日が対象曜日でなくても、対象曜日の直後から展開する', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-02', // 火曜日
        frequency: 'WEEKLY',
        weekdays: [1, 5], // 月・金
        endCondition: { type: 'COUNT', count: 2 },
      });
      expect(dates).toEqual(['2024-01-05', '2024-01-08']);
    });

    test('終了日指定で終了日以前の該当曜日のみ返す', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'WEEKLY',
        weekdays: [1],
        endCondition: { type: 'END_DATE', endDate: '2024-01-15' },
      });
      expect(dates).toEqual(['2024-01-01', '2024-01-08', '2024-01-15']);
    });
  });

  describe('MONTHLY', () => {
    test('複数日付指定で開始日以降のみ展開する', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-10',
        frequency: 'MONTHLY',
        monthDays: [5, 20],
        endCondition: { type: 'COUNT', count: 3 },
      });
      // 1月5日は開始日(1月10日)より前なので対象外。
      expect(dates).toEqual(['2024-01-20', '2024-02-05', '2024-02-20']);
    });

    test('存在しない日(31日等)の月はスキップする', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-31',
        frequency: 'MONTHLY',
        monthDays: [31],
        endCondition: { type: 'COUNT', count: 3 },
      });
      // 2月(29日まで)・4月(30日まで)は31日が存在しないためスキップされる。
      expect(dates).toEqual(['2024-01-31', '2024-03-31', '2024-05-31']);
    });

    test('終了日指定で終了日以前のみ返す', () => {
      const dates = expandRecurrence({
        startDate: '2024-01-01',
        frequency: 'MONTHLY',
        monthDays: [1, 15],
        endCondition: { type: 'END_DATE', endDate: '2024-02-01' },
      });
      expect(dates).toEqual(['2024-01-01', '2024-01-15', '2024-02-01']);
    });
  });

  describe('バリデーション', () => {
    test('startDateが無ければ例外', () => {
      expect(() => expandRecurrence({ frequency: 'ONCE' })).toThrow();
    });

    test('frequencyが不正なら例外', () => {
      expect(() =>
        expandRecurrence({ startDate: '2024-01-01', frequency: 'YEARLY' }),
      ).toThrow();
    });

    test('WEEKLYでweekdaysが空なら例外', () => {
      expect(() =>
        expandRecurrence({
          startDate: '2024-01-01',
          frequency: 'WEEKLY',
          weekdays: [],
          endCondition: { type: 'COUNT', count: 1 },
        }),
      ).toThrow();
    });

    test('MONTHLYでmonthDaysが空なら例外', () => {
      expect(() =>
        expandRecurrence({
          startDate: '2024-01-01',
          frequency: 'MONTHLY',
          monthDays: [],
          endCondition: { type: 'COUNT', count: 1 },
        }),
      ).toThrow();
    });

    test('DAILY/WEEKLY/MONTHLYでendConditionが無ければ例外', () => {
      expect(() =>
        expandRecurrence({ startDate: '2024-01-01', frequency: 'DAILY' }),
      ).toThrow();
    });

    test('COUNTが0以下なら例外', () => {
      expect(() =>
        expandRecurrence({
          startDate: '2024-01-01',
          frequency: 'DAILY',
          endCondition: { type: 'COUNT', count: 0 },
        }),
      ).toThrow();
    });

    test('END_DATEがstartDateより前なら例外', () => {
      expect(() =>
        expandRecurrence({
          startDate: '2024-01-10',
          frequency: 'DAILY',
          endCondition: { type: 'END_DATE', endDate: '2024-01-01' },
        }),
      ).toThrow();
    });
  });
});
