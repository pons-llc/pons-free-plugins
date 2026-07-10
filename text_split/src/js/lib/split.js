(function (root) {
  'use strict';

  // 文字列を正規表現の一部として安全に埋め込めるようにエスケープする(記号・文字モードで
  // 区切り文字をそのまま正規表現へ変換すると、`.`や`*`等が意図しない文字にマッチしてしまうため)。
  // 文字クラス外では意味を持たない`-`も、保守的に含めてエスケープしておく。
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

  const buildCharactersRegExp = (delimiters) => {
    const list = Array.isArray(delimiters) ? delimiters.filter(Boolean) : [];
    if (list.length === 0) {
      return null;
    }
    return new RegExp(list.map(escapeRegExp).join('|'), 'g');
  };

  const buildCustomRegExp = (pattern) => {
    if (!pattern) {
      return null;
    }
    try {
      return new RegExp(pattern, 'g');
    } catch {
      return null;
    }
  };

  // 元の文字列値+区切り指定から分割結果の配列を返す。区切り指定が空/不正な場合は例外を投げず、
  // 分割せずに元の値1件だけの配列を返す(呼び出し側で毎回try/catchしなくても安全に使えるようにするため)。
  const splitValue = (rawValue, splitConfig) => {
    const value =
      rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const config = splitConfig || {};

    let regExp = null;
    if (config.delimiterMode === 'CHARACTERS') {
      regExp = buildCharactersRegExp(config.delimiters);
    } else if (config.delimiterMode === 'REGEX') {
      regExp = buildCustomRegExp(config.pattern);
    }

    if (!regExp) {
      return [value];
    }
    return value.split(regExp);
  };

  const Split = { escapeRegExp, splitValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Split;
  } else {
    root.TextSplit = root.TextSplit || {};
    root.TextSplit.Split = Split;
  }
})(typeof window !== 'undefined' ? window : globalThis);
