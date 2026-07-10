'use strict';

const Slice = require('../js/lib/slice');

describe('Slice.leftOf', () => {
  test('takes the first n characters', () => {
    expect(Slice.leftOf('ABCDEFG', 3)).toBe('ABC');
  });

  test('returns the whole string when n exceeds its length', () => {
    expect(Slice.leftOf('AB', 5)).toBe('AB');
  });

  test('returns an empty string when n is 0 or negative', () => {
    expect(Slice.leftOf('ABCDEFG', 0)).toBe('');
    expect(Slice.leftOf('ABCDEFG', -3)).toBe('');
  });
});

describe('Slice.rightOf', () => {
  test('takes the last n characters', () => {
    expect(Slice.rightOf('ABCDEFG', 3)).toBe('EFG');
  });

  test('returns the whole string when n exceeds its length', () => {
    expect(Slice.rightOf('AB', 5)).toBe('AB');
  });

  test('returns an empty string when n is 0 or negative', () => {
    expect(Slice.rightOf('ABCDEFG', 0)).toBe('');
    expect(Slice.rightOf('ABCDEFG', -3)).toBe('');
  });
});

describe('Slice.midOf', () => {
  test('takes length characters starting at the 1-based start position', () => {
    expect(Slice.midOf('ABCDEFG', 3, 2)).toBe('CD');
  });

  test('starts from the first character when start is 1', () => {
    expect(Slice.midOf('ABCDEFG', 1, 3)).toBe('ABC');
  });

  test('returns as many characters as exist when length exceeds the remaining string', () => {
    expect(Slice.midOf('ABCDEFG', 5, 10)).toBe('EFG');
  });

  test('returns an empty string when start is beyond the string length', () => {
    expect(Slice.midOf('ABC', 10, 2)).toBe('');
  });

  test('returns an empty string when length is 0 or negative', () => {
    expect(Slice.midOf('ABCDEFG', 2, 0)).toBe('');
    expect(Slice.midOf('ABCDEFG', 2, -1)).toBe('');
  });

  test('clamps a start position below 1 to the first character', () => {
    expect(Slice.midOf('ABCDEFG', 0, 3)).toBe('ABC');
    expect(Slice.midOf('ABCDEFG', -5, 3)).toBe('ABC');
  });
});

describe('Slice.applySlice', () => {
  test('dispatches to LEFT', () => {
    expect(Slice.applySlice('ABCDEFG', { func: 'LEFT', length: 2 })).toBe('AB');
  });

  test('dispatches to RIGHT', () => {
    expect(Slice.applySlice('ABCDEFG', { func: 'RIGHT', length: 2 })).toBe(
      'FG',
    );
  });

  test('dispatches to MID', () => {
    expect(
      Slice.applySlice('ABCDEFG', { func: 'MID', start: 2, length: 3 }),
    ).toBe('BCD');
  });

  test('treats a missing value as an empty string', () => {
    expect(Slice.applySlice(undefined, { func: 'LEFT', length: 3 })).toBe('');
  });

  test('returns an empty string for an unknown function', () => {
    expect(Slice.applySlice('ABC', { func: 'NOT_A_FUNC' })).toBe('');
  });
});
