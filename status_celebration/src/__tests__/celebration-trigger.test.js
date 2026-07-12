'use strict';

const {
  shouldCelebrate,
  resolvePattern,
  PATTERNS,
} = require('../js/lib/celebration-trigger');

describe('shouldCelebrate', () => {
  const rule = { triggerValues: ['完了', '承認済'] };

  test('前の値から対象の値に変わったときはtrue', () => {
    expect(shouldCelebrate(rule, '対応中', '完了')).toBe(true);
  });

  test('前の値と新しい値が同じ(変化なし)ときはfalse', () => {
    expect(shouldCelebrate(rule, '完了', '完了')).toBe(false);
  });

  test('新しい値が対象の値に含まれないときはfalse', () => {
    expect(shouldCelebrate(rule, '未着手', '対応中')).toBe(false);
  });

  test('新しい値が空文字のときはfalse', () => {
    expect(shouldCelebrate(rule, '完了', '')).toBe(false);
  });

  test('新しい値がnull/undefinedのときはfalse', () => {
    expect(shouldCelebrate(rule, '完了', null)).toBe(false);
    expect(shouldCelebrate(rule, '完了', undefined)).toBe(false);
  });

  test('前の値がundefined(初期化前)でも対象の値ならtrue', () => {
    expect(shouldCelebrate(rule, undefined, '完了')).toBe(true);
  });

  test('triggerValuesが空配列のときは常にfalse', () => {
    expect(shouldCelebrate({ triggerValues: [] }, '対応中', '完了')).toBe(
      false,
    );
  });

  test('ruleがnull/undefinedのときはfalse', () => {
    expect(shouldCelebrate(null, '対応中', '完了')).toBe(false);
  });

  test('triggerValuesがない不正なruleのときはfalse', () => {
    expect(shouldCelebrate({}, '対応中', '完了')).toBe(false);
  });
});

describe('resolvePattern', () => {
  test('KUSUDAMA/CRACKER/CONFETTIはそのまま返す', () => {
    expect(resolvePattern('KUSUDAMA')).toBe('KUSUDAMA');
    expect(resolvePattern('CRACKER')).toBe('CRACKER');
    expect(resolvePattern('CONFETTI')).toBe('CONFETTI');
  });

  test('RANDOMはpickRandomの結果を採用する', () => {
    const pickRandom = (candidates) => candidates[1];
    expect(resolvePattern('RANDOM', pickRandom)).toBe(PATTERNS[1]);
  });

  test('RANDOMでpickRandom未指定でも3パターンのいずれかを返す', () => {
    const result = resolvePattern('RANDOM');
    expect(PATTERNS).toContain(result);
  });

  test('未知のパターンはCONFETTIにフォールバックする', () => {
    expect(resolvePattern('UNKNOWN')).toBe('CONFETTI');
    expect(resolvePattern(undefined)).toBe('CONFETTI');
  });
});
