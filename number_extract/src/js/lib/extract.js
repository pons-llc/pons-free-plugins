(function (root) {
  'use strict';

  const KanjiNumber =
    typeof module !== 'undefined' && module.exports
      ? require('./kanji-number')
      : root.NumberExtract.KanjiNumber;

  const KANJI_NUMERAL_PATTERN = /[〇一二三四五六七八九十百千万]+/g;
  const DIGIT_PATTERN = /\d+/g;

  // 全角数字(０-９、U+FF10-U+FF19)を同じ文字数のまま半角数字に変換する(位置がずれないようにする)。
  const toHalfWidthDigits = (str) =>
    str.replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    );

  const collectMatches = (str, pattern, convert) => {
    const matches = [];
    for (const match of str.matchAll(pattern)) {
      matches.push({ index: match.index, value: convert(match[0]) });
    }
    return matches;
  };

  // 元の文字列値+オプションから、数字(半角/全角/漢数字)の連続を左から出現順に抽出した文字列配列を返す。
  // 半角数字の連続と漢数字の連続はそれぞれ独立したまとまりとして抽出し、出現位置順にマージする
  // (idea.mdの「抽出対象の数字表記」参照)。
  const extractNumbers = (rawValue, options) => {
    const opts = options || {};
    const value =
      rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const normalized = opts.includeFullWidth ? toHalfWidthDigits(value) : value;

    const matches = collectMatches(normalized, DIGIT_PATTERN, (text) => text);
    if (opts.includeKanji) {
      matches.push(
        ...collectMatches(normalized, KANJI_NUMERAL_PATTERN, (text) =>
          KanjiNumber.toDigitString(text),
        ),
      );
    }

    matches.sort((a, b) => a.index - b.index);
    return matches.map((m) => m.value);
  };

  const Extract = { extractNumbers };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Extract;
  } else {
    root.NumberExtract = root.NumberExtract || {};
    root.NumberExtract.Extract = Extract;
  }
})(typeof window !== 'undefined' ? window : globalThis);
