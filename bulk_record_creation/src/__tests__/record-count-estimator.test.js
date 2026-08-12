'use strict';

const {
  estimateRecordCount,
  DEFAULT_MAX_RECORDS,
} = require('../js/lib/record-count-estimator');

describe('estimateRecordCount', () => {
  test('対象者・日付のどちらも無ければ1件', () => {
    const result = estimateRecordCount({});
    expect(result).toEqual({
      count: 1,
      withinLimit: true,
      limit: DEFAULT_MAX_RECORDS,
    });
  });

  test('対象者のみの場合は対象者数がそのまま件数になる', () => {
    const result = estimateRecordCount({ assigneeCount: 5 });
    expect(result.count).toBe(5);
    expect(result.withinLimit).toBe(true);
  });

  test('対象者×日付の直積になる', () => {
    const result = estimateRecordCount({ assigneeCount: 3, dateCount: 4 });
    expect(result.count).toBe(12);
  });

  test('上限ちょうどはwithinLimit=true', () => {
    const result = estimateRecordCount({ assigneeCount: 500, limit: 500 });
    expect(result).toEqual({ count: 500, withinLimit: true, limit: 500 });
  });

  test('上限を超えるとwithinLimit=false', () => {
    const result = estimateRecordCount({ assigneeCount: 501, limit: 500 });
    expect(result.withinLimit).toBe(false);
  });

  test('limitを省略するとDEFAULT_MAX_RECORDSを使う', () => {
    const result = estimateRecordCount({
      assigneeCount: DEFAULT_MAX_RECORDS + 1,
    });
    expect(result.limit).toBe(DEFAULT_MAX_RECORDS);
    expect(result.withinLimit).toBe(false);
  });

  test('対象者0件なら件数0(withinLimitはtrueのまま、対象者0件自体のエラー判定は呼び出し側の責務)', () => {
    const result = estimateRecordCount({ assigneeCount: 0, dateCount: 5 });
    expect(result.count).toBe(0);
    expect(result.withinLimit).toBe(true);
  });
});
