(function (root) {
  'use strict';

  // 漢数字の連続を算用数字に変換する。idea.mdの方針通り、十/百/千/万のいずれかを含む場合は
  // 位取り表記(標準的な漢数字→算用数字アルゴリズム)、含まない場合は読み上げ表記
  // (1文字ずつを桁として連結、例: 二〇二四→2024)として扱う。億以上の位には対応しない(スコープ外)。

  const KANJI_DIGITS = {
    〇: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const KANJI_UNITS = { 十: 10, 百: 100, 千: 1000 };

  const isPositional = (str) => /[十百千]/.test(str);

  // 万を含まない部分文字列(位取り表記)を数値に変換する標準的なアルゴリズム。
  // 単位の直前に数字がない場合(例: "十"単独)は1が省略されているものとして扱う。
  const parseSmall = (str) => {
    let total = 0;
    let current = 0;
    for (const ch of str) {
      if (ch in KANJI_DIGITS) {
        current = KANJI_DIGITS[ch];
      } else if (ch in KANJI_UNITS) {
        total += (current || 1) * KANJI_UNITS[ch];
        current = 0;
      }
    }
    total += current;
    return total;
  };

  const toNumber = (str) => {
    if (str.includes('万')) {
      const [manPart, restPart] = str.split('万');
      const manValue = manPart ? parseSmall(manPart) : 1;
      const restValue = restPart ? parseSmall(restPart) : 0;
      return manValue * 10000 + restValue;
    }
    if (isPositional(str)) {
      return parseSmall(str);
    }
    // 読み上げ表記: 1文字ずつをその桁の数字として連結する。
    const digits = str
      .split('')
      .map((ch) => (ch in KANJI_DIGITS ? String(KANJI_DIGITS[ch]) : ''))
      .join('');
    return Number(digits);
  };

  // toNumber()と異なり、読み上げ表記の先頭ゼロを保持した文字列表現を返す(idea.mdの
  // 「先頭ゼロの扱い」参照。位取り表記には先頭ゼロの概念がないためtoNumber()の文字列化と同じ)。
  const toDigitString = (str) => {
    if (!str.includes('万') && !isPositional(str)) {
      return str
        .split('')
        .map((ch) => (ch in KANJI_DIGITS ? String(KANJI_DIGITS[ch]) : ''))
        .join('');
    }
    return String(toNumber(str));
  };

  const KanjiNumber = { toNumber, toDigitString };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KanjiNumber;
  } else {
    root.NumberExtract = root.NumberExtract || {};
    root.NumberExtract.KanjiNumber = KanjiNumber;
  }
})(typeof window !== 'undefined' ? window : globalThis);
