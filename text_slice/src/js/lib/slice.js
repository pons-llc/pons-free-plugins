(function (root) {
  'use strict';

  // Excelの LEFT/RIGHT/MID 関数と同じ仕様(1始まりのインデックス、範囲外は例外を投げず
  // 存在する分だけ・または空文字列を返す)で文字列の部分取得を行う純粋関数群。

  const leftOf = (value, length) => {
    if (!(length > 0)) {
      return '';
    }
    return value.slice(0, length);
  };

  const rightOf = (value, length) => {
    if (!(length > 0)) {
      return '';
    }
    return value.slice(Math.max(0, value.length - length));
  };

  // startは1始まり(Excelの MID(text, start_num, num_chars) と同じ)。1未満は1に丸める。
  const midOf = (value, start, length) => {
    if (!(length > 0)) {
      return '';
    }
    const clampedStart = start < 1 ? 1 : start;
    const zeroBasedIndex = clampedStart - 1;
    if (zeroBasedIndex >= value.length) {
      return '';
    }
    return value.slice(zeroBasedIndex, zeroBasedIndex + length);
  };

  // 元の文字列値+ルール({ func, start, length })から、切り出した部分文字列を返す。
  // 値が空/不正、または未知のfuncの場合は例外を投げず空文字列を返す(呼び出し側で毎回
  // try/catchしなくても安全に使えるようにするため)。
  const applySlice = (rawValue, rule) => {
    const value =
      rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const r = rule || {};

    if (r.func === 'LEFT') {
      return leftOf(value, r.length);
    }
    if (r.func === 'RIGHT') {
      return rightOf(value, r.length);
    }
    if (r.func === 'MID') {
      return midOf(value, r.start, r.length);
    }
    return '';
  };

  const Slice = { leftOf, rightOf, midOf, applySlice };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Slice;
  } else {
    root.TextSlice = root.TextSlice || {};
    root.TextSlice.Slice = Slice;
  }
})(typeof window !== 'undefined' ? window : globalThis);
