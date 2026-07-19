'use strict';

const ChartLite = require('../js/lib/chart-lite');

describe('niceScale', () => {
  test('きりのいい上限と目盛りを返す', () => {
    const s = ChartLite.niceScale(97, 4);
    expect(s.max).toBe(100);
    expect(s.step).toBe(20);
    expect(s.ticks).toEqual([0, 20, 40, 60, 80, 100]);
  });

  test('小さい値・小数も扱える', () => {
    const s = ChartLite.niceScale(0.7, 4);
    expect(s.max).toBeGreaterThanOrEqual(0.7);
    expect(s.ticks[0]).toBe(0);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
  });

  test('0以下・不正値はフォールバックする', () => {
    expect(ChartLite.niceScale(0, 4)).toEqual({
      max: 1,
      step: 1,
      ticks: [0, 1],
    });
    expect(ChartLite.niceScale(NaN, 4)).toEqual({
      max: 1,
      step: 1,
      ticks: [0, 1],
    });
  });
});

describe('donutArcPath', () => {
  test('半円のパスが外径・内径の座標を含む', () => {
    const d = ChartLite.donutArcPath(
      100,
      100,
      50,
      30,
      -Math.PI / 2,
      Math.PI / 2,
    );
    expect(d).toMatch(/^M /);
    expect(d).toContain('A 50 50');
    expect(d).toContain('A 30 30');
    expect(d).toMatch(/Z$/);
  });

  test('全周は2つの円弧に分割される(1つのarcでは描けないため)', () => {
    const d = ChartLite.donutArcPath(100, 100, 50, 30, 0, Math.PI * 2);
    expect(d.match(/M /g)).toHaveLength(2);
  });
});

describe('truncateLabel / formatNumber', () => {
  test('長いラベルは省略記号付きで切り詰める', () => {
    expect(ChartLite.truncateLabel('abcdef', 4)).toBe('abc…');
    expect(ChartLite.truncateLabel('abc', 4)).toBe('abc');
    expect(ChartLite.truncateLabel(null, 4)).toBe('');
  });

  test('数値は桁区切り・小数2桁までで整形する', () => {
    expect(ChartLite.formatNumber(1234.5678)).toBe('1,234.57');
    expect(ChartLite.formatNumber(10)).toBe('10');
  });
});
