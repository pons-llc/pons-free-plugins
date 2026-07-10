'use strict';

const Extract = require('../js/lib/extract');

describe('Extract.extractNumbers', () => {
  test('extracts consecutive runs of half-width digits in order', () => {
    const result = Extract.extractNumbers('東京都新宿区西新宿2-8-1', {
      includeFullWidth: false,
      includeKanji: false,
    });
    expect(result).toEqual(['2', '8', '1']);
  });

  test('ignores full-width digits when includeFullWidth is false', () => {
    const result = Extract.extractNumbers('西新宿２-８-１', {
      includeFullWidth: false,
      includeKanji: false,
    });
    expect(result).toEqual([]);
  });

  test('normalizes full-width digits to half-width when includeFullWidth is true', () => {
    const result = Extract.extractNumbers('西新宿２-８-１', {
      includeFullWidth: true,
      includeKanji: false,
    });
    expect(result).toEqual(['2', '8', '1']);
  });

  test('ignores kanji numerals when includeKanji is false', () => {
    const result = Extract.extractNumbers('二丁目3番地', {
      includeFullWidth: false,
      includeKanji: false,
    });
    expect(result).toEqual(['3']);
  });

  test('extracts kanji numerals and converts them when includeKanji is true', () => {
    const result = Extract.extractNumbers('二丁目3番地', {
      includeFullWidth: false,
      includeKanji: true,
    });
    expect(result).toEqual(['2', '3']);
  });

  test('extracts positional kanji numerals', () => {
    const result = Extract.extractNumbers('十二丁目', {
      includeFullWidth: false,
      includeKanji: true,
    });
    expect(result).toEqual(['12']);
  });

  test('extracts digit-by-digit kanji readings such as years', () => {
    const result = Extract.extractNumbers('二〇二四年七月', {
      includeFullWidth: false,
      includeKanji: true,
    });
    expect(result).toEqual(['2024', '7']);
  });

  test('keeps original left-to-right order when digits and kanji are both present', () => {
    const result = Extract.extractNumbers('第3章 第四節', {
      includeFullWidth: false,
      includeKanji: true,
    });
    expect(result).toEqual(['3', '4']);
  });

  test('returns an empty array when nothing matches', () => {
    expect(
      Extract.extractNumbers('数字なし', {
        includeFullWidth: true,
        includeKanji: true,
      }),
    ).toEqual([]);
  });

  test('treats a missing value as an empty string and returns an empty array', () => {
    expect(
      Extract.extractNumbers(undefined, {
        includeFullWidth: true,
        includeKanji: true,
      }),
    ).toEqual([]);
  });
});
