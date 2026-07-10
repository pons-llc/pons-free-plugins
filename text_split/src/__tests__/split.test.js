'use strict';

const Split = require('../js/lib/split');

describe('Split.escapeRegExp', () => {
  test('escapes regex special characters', () => {
    expect(Split.escapeRegExp('.*+?^${}()|[]\\')).toBe(
      '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
    );
  });

  test('leaves ordinary characters untouched', () => {
    expect(Split.escapeRegExp('abc-123')).toBe('abc\\-123');
  });
});

describe('Split.splitValue (CHARACTERS mode)', () => {
  test('splits on any of the configured delimiter characters', () => {
    const result = Split.splitValue('2024-07-09', {
      delimiterMode: 'CHARACTERS',
      delimiters: ['-'],
    });
    expect(result).toEqual(['2024', '07', '09']);
  });

  test('supports multiple different delimiter characters', () => {
    const result = Split.splitValue('東京都/新宿区 西新宿2-8-1', {
      delimiterMode: 'CHARACTERS',
      delimiters: ['/', ' ', '-'],
    });
    expect(result).toEqual(['東京都', '新宿区', '西新宿2', '8', '1']);
  });

  test('escapes delimiters that are regex special characters', () => {
    const result = Split.splitValue('a.b.c', {
      delimiterMode: 'CHARACTERS',
      delimiters: ['.'],
    });
    expect(result).toEqual(['a', 'b', 'c']);
  });

  test('returns the value unsplit when the delimiter list is empty', () => {
    const result = Split.splitValue('abc', {
      delimiterMode: 'CHARACTERS',
      delimiters: [],
    });
    expect(result).toEqual(['abc']);
  });
});

describe('Split.splitValue (REGEX mode)', () => {
  test('splits using the given regular expression', () => {
    const result = Split.splitValue('a1b22c333d', {
      delimiterMode: 'REGEX',
      pattern: '\\d+',
    });
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  test('falls back to an unsplit single-element array on an invalid pattern', () => {
    const result = Split.splitValue('abc', {
      delimiterMode: 'REGEX',
      pattern: '(unclosed',
    });
    expect(result).toEqual(['abc']);
  });

  test('returns the value unsplit when the pattern is empty', () => {
    const result = Split.splitValue('abc', {
      delimiterMode: 'REGEX',
      pattern: '',
    });
    expect(result).toEqual(['abc']);
  });
});

describe('Split.splitValue edge cases', () => {
  test('treats a missing value as an empty string', () => {
    expect(
      Split.splitValue(undefined, {
        delimiterMode: 'CHARACTERS',
        delimiters: ['-'],
      }),
    ).toEqual(['']);
  });

  test('returns the value unsplit for an unknown delimiterMode', () => {
    expect(Split.splitValue('abc', { delimiterMode: 'NOT_A_MODE' })).toEqual([
      'abc',
    ]);
  });
});
