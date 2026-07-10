const Zenkaku = require('../js/lib/zenkaku');

describe('Zenkaku.toZenkakuDigits', () => {
  test('converts each half-width ASCII digit to its full-width counterpart', () => {
    expect(Zenkaku.toZenkakuDigits('0123456789')).toBe('０１２３４５６７８９');
  });

  test('leaves non-digit characters untouched', () => {
    expect(Zenkaku.toZenkakuDigits('令和7年7月9日')).toBe('令和７年７月９日');
    expect(Zenkaku.toZenkakuDigits('R7.7.9')).toBe('R７.７.９');
    expect(Zenkaku.toZenkakuDigits('2026年(令和7年)7月9日')).toBe(
      '２０２６年(令和７年)７月９日',
    );
  });

  test('already full-width digits are left as-is (idempotent-ish, no double conversion)', () => {
    expect(Zenkaku.toZenkakuDigits('７')).toBe('７');
  });

  test('empty string returns empty string', () => {
    expect(Zenkaku.toZenkakuDigits('')).toBe('');
  });

  test('non-string input is returned unchanged', () => {
    expect(Zenkaku.toZenkakuDigits(null)).toBe(null);
    expect(Zenkaku.toZenkakuDigits(undefined)).toBe(undefined);
    expect(Zenkaku.toZenkakuDigits(7)).toBe(7);
  });
});
