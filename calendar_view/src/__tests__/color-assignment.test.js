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

  test('uses the admin-specified override color for a key when given', () => {
    const map = assignColors(['alice', 'bob'], undefined, { alice: '#ff0000' });
    expect(map.alice).toBe('#ff0000');
  });

  test('falls back to the deterministic palette color for keys without an override', () => {
    const withoutOverride = assignColors(['bob']);
    const withOverride = assignColors(['alice', 'bob'], undefined, {
      alice: '#ff0000',
    });
    expect(withOverride.bob).toBe(withoutOverride.bob);
  });

  test('ignores an invalid override value and falls back to the palette', () => {
    const map = assignColors(['alice'], undefined, {
      alice: 'javascript:alert(1)',
    });
    expect(map.alice).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('accepts an override for the empty ("未設定") key', () => {
    const map = assignColors([''], undefined, { '': '#123456' });
    expect(map['']).toBe('#123456');
  });
});
