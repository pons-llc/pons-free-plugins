'use strict';

const CharType = require('../js/lib/char-type');

describe('CharType.TYPES', () => {
  test('10種類の文字種キーを持つ', () => {
    expect(CharType.TYPES.sort()).toEqual(
      [
        'fullWidthHiragana',
        'fullWidthKatakana',
        'halfWidthKatakana',
        'fullWidthAlnum',
        'halfWidthAlnum',
        'fullWidthSymbol',
        'halfWidthSymbol',
        'fullWidthAll',
        'halfWidthAll',
        'space',
      ].sort(),
    );
  });
});

describe('CharType.matches', () => {
  test('全角ひらがな', () => {
    expect(CharType.matches('fullWidthHiragana', 'あいう')).toBe(true);
    expect(CharType.matches('fullWidthHiragana', 'ゝ')).toBe(true); // 踊り字
    expect(CharType.matches('fullWidthHiragana', 'アイウ')).toBe(false);
    expect(CharType.matches('fullWidthHiragana', 'abc')).toBe(false);
  });

  test('全角カタカナ(長音・踊り字を含む)', () => {
    expect(CharType.matches('fullWidthKatakana', 'アイウ')).toBe(true);
    expect(CharType.matches('fullWidthKatakana', 'パーティー')).toBe(true); // 長音符ー
    expect(CharType.matches('fullWidthKatakana', 'ヽ')).toBe(true); // 踊り字
    expect(CharType.matches('fullWidthKatakana', 'あいう')).toBe(false);
  });

  test('半角カタカナ', () => {
    expect(CharType.matches('halfWidthKatakana', 'ｱｲｳ')).toBe(true);
    expect(CharType.matches('halfWidthKatakana', 'ﾊﾟ')).toBe(true); // 半角濁点・半濁点
    expect(CharType.matches('halfWidthKatakana', 'アイウ')).toBe(false);
  });

  test('全角英数字', () => {
    expect(CharType.matches('fullWidthAlnum', 'ABC123')).toBe(false);
    expect(CharType.matches('fullWidthAlnum', 'ＡＢＣ')).toBe(true);
    expect(CharType.matches('fullWidthAlnum', '１２３')).toBe(true);
    expect(CharType.matches('fullWidthAlnum', 'ａｂｃ')).toBe(true);
  });

  test('半角英数字', () => {
    expect(CharType.matches('halfWidthAlnum', 'ABC123abc')).toBe(true);
    expect(CharType.matches('halfWidthAlnum', 'ＡＢＣ')).toBe(false);
  });

  test('全角記号', () => {
    expect(CharType.matches('fullWidthSymbol', '、')).toBe(true);
    expect(CharType.matches('fullWidthSymbol', '（）')).toBe(true);
    expect(CharType.matches('fullWidthSymbol', '＃')).toBe(true);
    expect(CharType.matches('fullWidthSymbol', '　')).toBe(true); // 全角スペース
    expect(CharType.matches('fullWidthSymbol', 'ＡＢＣ')).toBe(false);
    expect(CharType.matches('fullWidthSymbol', 'あいう')).toBe(false);
  });

  test('半角記号', () => {
    expect(CharType.matches('halfWidthSymbol', '!"#')).toBe(true);
    expect(CharType.matches('halfWidthSymbol', '｡｢｣･')).toBe(true); // 半角句読点等
    expect(CharType.matches('halfWidthSymbol', 'ABC123')).toBe(false);
  });

  test('全角(すべて): ひらがな・カタカナ・漢字・英数字・記号のいずれにも一致する', () => {
    expect(CharType.matches('fullWidthAll', 'あ')).toBe(true);
    expect(CharType.matches('fullWidthAll', 'ア')).toBe(true);
    expect(CharType.matches('fullWidthAll', '漢')).toBe(true); // 漢字(既存の4分類には無い)
    expect(CharType.matches('fullWidthAll', 'Ａ')).toBe(true);
    expect(CharType.matches('fullWidthAll', '、')).toBe(true);
    expect(CharType.matches('fullWidthAll', 'A')).toBe(false); // 半角
    expect(CharType.matches('fullWidthAll', 'ｱ')).toBe(false); // 半角カタカナ
  });

  test('半角(すべて): 半角英数字・半角記号・半角カタカナのいずれにも一致する', () => {
    expect(CharType.matches('halfWidthAll', 'A')).toBe(true);
    expect(CharType.matches('halfWidthAll', '1')).toBe(true);
    expect(CharType.matches('halfWidthAll', '!')).toBe(true);
    expect(CharType.matches('halfWidthAll', 'ｱ')).toBe(true);
    expect(CharType.matches('halfWidthAll', 'ﾞ')).toBe(true); // 半角濁点
    expect(CharType.matches('halfWidthAll', 'あ')).toBe(false); // 全角
    expect(CharType.matches('halfWidthAll', ' ')).toBe(false); // 半角スペースは対象外(space種別で扱う)
  });

  test('スペース: 半角スペース・全角スペースのいずれにも一致する', () => {
    expect(CharType.matches('space', ' ')).toBe(true);
    expect(CharType.matches('space', '　')).toBe(true);
    expect(CharType.matches('space', 'a b')).toBe(true);
    expect(CharType.matches('space', 'abc')).toBe(false);
  });

  test('空文字列・未定義値はどの文字種にも一致しない', () => {
    expect(CharType.matches('fullWidthHiragana', '')).toBe(false);
    expect(CharType.matches('halfWidthAlnum', null)).toBe(false);
    expect(CharType.matches('halfWidthAlnum', undefined)).toBe(false);
  });
});

describe('CharType.detectForbiddenTypes', () => {
  const forbidAll = {
    fullWidthHiragana: true,
    fullWidthKatakana: true,
    halfWidthKatakana: true,
    fullWidthAlnum: true,
    halfWidthAlnum: true,
    fullWidthSymbol: true,
    halfWidthSymbol: true,
    fullWidthAll: true,
    halfWidthAll: true,
    space: true,
  };

  test('禁止した文字種のうち実際に含まれるものだけを返す', () => {
    expect(
      CharType.detectForbiddenTypes('あいうABC', forbidAll).sort(),
    ).toEqual(
      [
        'fullWidthHiragana',
        'fullWidthAll',
        'halfWidthAlnum',
        'halfWidthAll',
      ].sort(),
    );
  });

  test('禁止設定がfalseの文字種は含まれていても検出しない', () => {
    const forbid = { ...forbidAll, fullWidthHiragana: false };
    expect(CharType.detectForbiddenTypes('あいう', forbid)).toEqual([
      'fullWidthAll',
    ]);
  });

  test('該当なしなら空配列を返す', () => {
    expect(
      CharType.detectForbiddenTypes('あいう', forbidAll).length,
    ).toBeGreaterThan(0);
    expect(CharType.detectForbiddenTypes('', forbidAll)).toEqual([]);
  });

  test('forbidが未指定(undefined)や空オブジェクトでも例外を投げない', () => {
    expect(CharType.detectForbiddenTypes('あいう', {})).toEqual([]);
    expect(CharType.detectForbiddenTypes('あいう', undefined)).toEqual([]);
  });
});

describe('CharType.buildErrorMessage', () => {
  test('違反した文字種のラベルを結合したメッセージを返す', () => {
    const message = CharType.buildErrorMessage([
      'fullWidthHiragana',
      'halfWidthAlnum',
    ]);
    expect(message).toContain('全角ひらがな');
    expect(message).toContain('半角英数字');
    expect(message).toMatch(/使用できません/);
  });

  test('空配列の場合はnullを返す', () => {
    expect(CharType.buildErrorMessage([])).toBeNull();
  });
});
