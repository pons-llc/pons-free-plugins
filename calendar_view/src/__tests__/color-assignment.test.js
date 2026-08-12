const { assignColors } = require('../js/lib/color-assignment');

describe('assignColors', () => {
  test('assigns the same color to the same key deterministically', () => {
    const map1 = assignColors(['alice', 'bob']);
    const map2 = assignColors(['alice', 'bob']);
    expect(map1.alice).toBe(map2.alice);
    expect(map1.bob).toBe(map2.bob);
  });

  test('always maps the empty key ("未設定") to a fixed gray', () => {
    const map = assignColors(['', 'alice']);
    expect(map['']).toBe('#bbbbbb');
  });

  test('uses a custom palette when provided', () => {
    const map = assignColors(['alice'], ['#111111']);
    expect(map.alice).toBe('#111111');
  });

  test('different keys can map to different colors across a small palette', () => {
    const map = assignColors(['a', 'b', 'c', 'd'], ['#111', '#222']);
    Object.values(map).forEach((color) => {
      expect(['#111', '#222']).toContain(color);
    });
  });
});
