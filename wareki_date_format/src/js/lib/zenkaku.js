(function (root) {
  'use strict';

  // 半角数字(0-9)だけを全角数字(０-９)に変換する。数字以外の文字(元号名・区切り文字・括弧等)には
  // 一切手を加えない。Unicodeの全角数字は半角数字 + 0xFEE0 の位置にあるため、コードポイント演算で変換する。
  const toZenkakuDigits = (str) => {
    if (typeof str !== 'string') {
      return str;
    }
    return str.replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 0xfee0),
    );
  };

  const Zenkaku = { toZenkakuDigits };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Zenkaku;
  } else {
    root.WarekiDateFormat = root.WarekiDateFormat || {};
    root.WarekiDateFormat.Zenkaku = Zenkaku;
  }
})(typeof window !== 'undefined' ? window : globalThis);
