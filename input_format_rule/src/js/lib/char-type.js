(function (root) {
  'use strict';

  // 文字種ごとの判定用正規表現(半角/全角×かな・カタカナ・英数字・記号の組み合わせのうち
  // 実在する7種類。半角ひらがなはJIS上存在しないため対象外。idea.md「禁止できる文字種」参照)。
  // ESLint(no-useless-escape)がregex literal中の\uXXXXを実際のUnicode文字へ自動修正して
  // しまい、ソースコードに見分けの付きにくい全角スペース等の文字がそのまま埋め込まれる
  // (レビュー時に気づきにくい・エディタによって表示が崩れる)ため、文字列からRegExpを
  // 構築する方式にして、ソース上は常に\uXXXX形式のままにしている。
  const RANGES = {
    fullWidthHiragana: new RegExp('[\\u3041-\\u3096\\u309D\\u309E]'),
    // ー(長音符、U+30FC)・ヽヾ(踊り字、U+30FD-30FE)は見た目上カタカナ表記に使われるため含める。
    fullWidthKatakana: new RegExp('[\\u30A1-\\u30FA\\u30FC-\\u30FE]'),
    // 半角濁点(ﾞ)・半濁点(ﾟ)を含む半角カタカナブロック。
    halfWidthKatakana: new RegExp('[\\uFF66-\\uFF9F]'),
    fullWidthAlnum: new RegExp(
      '[\\uFF10-\\uFF19\\uFF21-\\uFF3A\\uFF41-\\uFF5A]',
    ),
    halfWidthAlnum: /[0-9A-Za-z]/,
    // 全角スペース・CJK記号(U+3000-303F)、全角ASCII記号のうち英数字を除いた範囲、全角通貨記号。
    fullWidthSymbol: new RegExp(
      '[\\u3000-\\u303F\\uFF01-\\uFF0F\\uFF1A-\\uFF20\\uFF3B-\\uFF40\\uFF5B-\\uFF60\\uFFE0-\\uFFE6]',
    ),
    // 半角ASCII記号、半角CJK句読点(｡｢｣､･)、半角記号(￨￩￪￫￬)。
    halfWidthSymbol: new RegExp(
      '[\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E\\uFF61-\\uFF65\\uFFE8-\\uFFEE]',
    ),
  };

  const TYPES = Object.keys(RANGES);

  const LABELS = {
    fullWidthHiragana: '全角ひらがな',
    fullWidthKatakana: '全角カタカナ',
    halfWidthKatakana: '半角カタカナ',
    fullWidthAlnum: '全角英数字',
    halfWidthAlnum: '半角英数字',
    fullWidthSymbol: '全角記号',
    halfWidthSymbol: '半角記号',
  };

  // 指定した文字種の文字が1つでも値に含まれるか。
  const matches = (type, value) => {
    const range = RANGES[type];
    if (!range || typeof value !== 'string' || value.length === 0) {
      return false;
    }
    return range.test(value);
  };

  // forbid(チェックボックスの選択状態、キーはTYPESの文字種)のうち、trueに設定された文字種で
  // 実際に値に含まれているものだけを配列で返す。forbidが未指定でも例外を投げない。
  const detectForbiddenTypes = (value, forbid) => {
    const safeForbid = forbid || {};
    return TYPES.filter((type) => safeForbid[type] && matches(type, value));
  };

  // 違反した文字種の配列から、フィールドに表示するエラーメッセージを組み立てる。
  const buildErrorMessage = (violatedTypes) => {
    if (!violatedTypes || violatedTypes.length === 0) {
      return null;
    }
    const labels = violatedTypes.map((type) => LABELS[type] || type);
    return `${labels.join('・')}は使用できません。`;
  };

  const CharType = {
    TYPES,
    LABELS,
    matches,
    detectForbiddenTypes,
    buildErrorMessage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharType;
  } else {
    root.InputFormatRule = root.InputFormatRule || {};
    root.InputFormatRule.CharType = CharType;
  }
})(typeof window !== 'undefined' ? window : globalThis);
