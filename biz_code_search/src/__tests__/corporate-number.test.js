'use strict';

const { isValidCorporateNumber } = require('../js/lib/corporate-number');

describe('isValidCorporateNumber', () => {
  test('13桁の数字はtrue', () => {
    expect(isValidCorporateNumber('4488443968535')).toBe(true);
  });

  test('12桁(桁数不足)はfalse', () => {
    expect(isValidCorporateNumber('123456789012')).toBe(false);
  });

  test('14桁(桁数超過)はfalse', () => {
    expect(isValidCorporateNumber('12345678901234')).toBe(false);
  });

  test('数字以外の文字を含む場合はfalse', () => {
    expect(isValidCorporateNumber('448844396853a')).toBe(false);
  });

  test('空文字列はfalse', () => {
    expect(isValidCorporateNumber('')).toBe(false);
  });

  test('undefined/nullはfalse', () => {
    expect(isValidCorporateNumber(undefined)).toBe(false);
    expect(isValidCorporateNumber(null)).toBe(false);
  });

  test('前後に空白を含む場合はfalse(呼び出し側でtrim済みの値を渡す前提)', () => {
    expect(isValidCorporateNumber(' 4488443968535 ')).toBe(false);
  });
});
