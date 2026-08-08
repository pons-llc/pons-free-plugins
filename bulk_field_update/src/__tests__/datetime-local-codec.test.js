'use strict';

const {
  decodeDatetimeLocal,
  encodeDatetimeLocal,
} = require('../js/lib/datetime-local-codec');

describe('decodeDatetimeLocal', () => {
  test('UTCのISO8601文字列をローカルのdatetime-local形式に変換する', () => {
    const utcValue = '2026-01-05T09:30:00Z';
    const result = decodeDatetimeLocal(utcValue);
    const expected = (() => {
      const d = new Date(utcValue);
      const pad2 = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    })();
    expect(result).toBe(expected);
  });

  test('空文字列/未指定は空文字列を返す', () => {
    expect(decodeDatetimeLocal('')).toBe('');
    expect(decodeDatetimeLocal(null)).toBe('');
    expect(decodeDatetimeLocal(undefined)).toBe('');
  });

  test('不正な値は空文字列を返す', () => {
    expect(decodeDatetimeLocal('not-a-date')).toBe('');
  });
});

describe('encodeDatetimeLocal', () => {
  test('ローカルのdatetime-local形式をUTCのISO8601文字列(秒あり・ミリ秒なし)に変換する', () => {
    const result = encodeDatetimeLocal('2026-01-05T09:30');
    const expected = new Date(2026, 0, 5, 9, 30, 0, 0)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    expect(result).toBe(expected);
  });

  test('空文字列/未指定は空文字列を返す', () => {
    expect(encodeDatetimeLocal('')).toBe('');
    expect(encodeDatetimeLocal(null)).toBe('');
  });

  test('不正な形式は空文字列を返す', () => {
    expect(encodeDatetimeLocal('not-a-date')).toBe('');
  });

  test('decodeDatetimeLocalとの往復変換が一致する', () => {
    const original = '2026-03-15T14:05';
    const roundTripped = decodeDatetimeLocal(encodeDatetimeLocal(original));
    expect(roundTripped).toBe(original);
  });
});
