'use strict';

const KanjiNumber = require('../js/lib/kanji-number');

describe('KanjiNumber.toNumber (positional notation, contains 十/百/千/万)', () => {
  test.each([
    ['十', 10],
    ['十二', 12],
    ['二十', 20],
    ['二十三', 23],
    ['百', 100],
    ['百五', 105],
    ['三百', 300],
    ['九千八百七十六', 9876],
    ['一万', 10000],
    ['一万二千三百四十五', 12345],
    ['三万', 30000],
  ])('%s -> %i', (input, expected) => {
    expect(KanjiNumber.toNumber(input)).toBe(expected);
  });
});

describe('KanjiNumber.toNumber (digit-by-digit reading, no 十/百/千/万)', () => {
  test.each([
    ['〇', 0],
    ['二', 2],
    ['九', 9],
    ['二〇二四', 2024],
    ['〇七', 7],
  ])('%s -> %i', (input, expected) => {
    expect(KanjiNumber.toNumber(input)).toBe(expected);
  });
});

describe('KanjiNumber.toDigitString', () => {
  test('preserves leading zeros for digit-by-digit reading', () => {
    expect(KanjiNumber.toDigitString('〇七')).toBe('07');
  });

  test('does not add leading zeros for positional notation', () => {
    expect(KanjiNumber.toDigitString('十二')).toBe('12');
  });
});
