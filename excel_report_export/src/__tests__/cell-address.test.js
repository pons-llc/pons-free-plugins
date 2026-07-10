const CellAddress = require('../js/lib/cell-address');

describe('CellAddress.isValid', () => {
  test('accepts ordinary A1-style addresses', () => {
    expect(CellAddress.isValid('A1')).toBe(true);
    expect(CellAddress.isValid('B2')).toBe(true);
    expect(CellAddress.isValid('Z99')).toBe(true);
    expect(CellAddress.isValid('AA10')).toBe(true);
    expect(CellAddress.isValid('XFD1048576')).toBe(true);
  });

  test('rejects malformed input', () => {
    expect(CellAddress.isValid('')).toBe(false);
    expect(CellAddress.isValid('1A')).toBe(false);
    expect(CellAddress.isValid('A0')).toBe(false);
    expect(CellAddress.isValid('A')).toBe(false);
    expect(CellAddress.isValid('1')).toBe(false);
    expect(CellAddress.isValid('A1:B2')).toBe(false);
    expect(CellAddress.isValid('a1')).toBe(false); // 小文字は許容しない(設定画面で大文字化する方針)
    expect(CellAddress.isValid(null)).toBe(false);
    expect(CellAddress.isValid(undefined)).toBe(false);
    expect(CellAddress.isValid('A1 ')).toBe(false);
  });
});

describe('CellAddress.parse', () => {
  test('splits column letters and row number', () => {
    expect(CellAddress.parse('A1')).toEqual({ column: 'A', row: 1 });
    expect(CellAddress.parse('B12')).toEqual({ column: 'B', row: 12 });
    expect(CellAddress.parse('AA100')).toEqual({ column: 'AA', row: 100 });
  });

  test('throws on invalid input rather than returning a bogus value', () => {
    expect(() => CellAddress.parse('bad')).toThrow();
  });
});

describe('CellAddress.build', () => {
  test('joins column letters and a row number into an address', () => {
    expect(CellAddress.build('B', 2)).toBe('B2');
    expect(CellAddress.build('AA', 100)).toBe('AA100');
  });

  test('normalizes lowercase column letters to uppercase', () => {
    expect(CellAddress.build('b', 2)).toBe('B2');
  });

  test('throws on a non-positive row', () => {
    expect(() => CellAddress.build('A', 0)).toThrow();
    expect(() => CellAddress.build('A', -1)).toThrow();
  });
});
