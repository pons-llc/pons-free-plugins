'use strict';

const ArrowState = require('../js/lib/arrow-state');

describe('ArrowState.computeArrowStates', () => {
  const steps = ['申請中', '承認中', '完了'];

  test('marks steps before the current value as DONE', () => {
    const result = ArrowState.computeArrowStates(steps, '完了');
    expect(result[0]).toEqual({ value: '申請中', state: 'DONE' });
    expect(result[1]).toEqual({ value: '承認中', state: 'DONE' });
  });

  test('marks the step matching the current value as ACTIVE', () => {
    const result = ArrowState.computeArrowStates(steps, '承認中');
    expect(result[1]).toEqual({ value: '承認中', state: 'ACTIVE' });
  });

  test('marks steps after the current value as PENDING', () => {
    const result = ArrowState.computeArrowStates(steps, '申請中');
    expect(result[1]).toEqual({ value: '承認中', state: 'PENDING' });
    expect(result[2]).toEqual({ value: '完了', state: 'PENDING' });
  });

  test('marks every step as PENDING when the current value matches no step', () => {
    const result = ArrowState.computeArrowStates(steps, '差し戻し');
    expect(result).toEqual([
      { value: '申請中', state: 'PENDING' },
      { value: '承認中', state: 'PENDING' },
      { value: '完了', state: 'PENDING' },
    ]);
  });

  test('marks every step as PENDING when the current value is empty', () => {
    const result = ArrowState.computeArrowStates(steps, '');
    expect(result.every((s) => s.state === 'PENDING')).toBe(true);
  });

  test('returns an empty array when steps is empty', () => {
    expect(ArrowState.computeArrowStates([], '申請中')).toEqual([]);
  });

  test('the first step is ACTIVE (not DONE) when it matches the current value', () => {
    const result = ArrowState.computeArrowStates(steps, '申請中');
    expect(result[0]).toEqual({ value: '申請中', state: 'ACTIVE' });
  });
});
