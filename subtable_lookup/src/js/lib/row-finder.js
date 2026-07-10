(function (root) {
  'use strict';

  // サブテーブルのvalue配列([{ id, value: { colCode: { type, value } } }])と設定行(lookup)から、
  // 条件に一致する1行(そのままの行オブジェクト)を返す。見つからない場合はnullを返す。
  // kintoneに依存しない純粋関数。

  const MODES = {
    PARTIAL_MATCH: 'PARTIAL_MATCH',
    EXACT_MATCH: 'EXACT_MATCH',
    LATEST: 'LATEST',
    OLDEST: 'OLDEST',
    TOP_ROW: 'TOP_ROW',
    BOTTOM_ROW: 'BOTTOM_ROW',
  };

  const DIRECTIONS = {
    TOP_TO_BOTTOM: 'TOP_TO_BOTTOM',
    BOTTOM_TO_TOP: 'BOTTOM_TO_TOP',
  };

  // サブテーブルの1行から、指定した列コードの値(型は問わず生の値)を取り出す。
  // 列が存在しない/行がnullの場合はundefinedを返す(空文字列とは区別する)。
  const getColumnValue = (row, columnCode) => {
    if (!row || !row.value || !columnCode) {
      return undefined;
    }
    const field = row.value[columnCode];
    return field ? field.value : undefined;
  };

  // 部分一致/完全一致の判定。値は文字列化して比較する(数値・選択肢型なども対象にできるように)。
  const matchesCondition = (rawValue, matchValue, mode) => {
    const stringValue =
      rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const target =
      matchValue === undefined || matchValue === null ? '' : String(matchValue);
    if (mode === MODES.PARTIAL_MATCH) {
      return stringValue.includes(target);
    }
    if (mode === MODES.EXACT_MATCH) {
      return stringValue === target;
    }
    return false;
  };

  const findByCondition = (rows, lookup) => {
    const ordered =
      lookup.direction === DIRECTIONS.BOTTOM_TO_TOP
        ? [...rows].reverse()
        : rows;
    const found = ordered.find((row) =>
      matchesCondition(
        getColumnValue(row, lookup.conditionFieldCode),
        lookup.matchValue,
        lookup.mode,
      ),
    );
    return found || null;
  };

  // DATE("YYYY-MM-DD")・DATETIME(ISO8601のUTC文字列)・TIME("HH:MM:SS")はいずれもゼロ埋めされた
  // 辞書式順序=時系列順序の文字列なので、Dateへの変換なしに文字列の大小比較だけで新旧を判定できる。
  const findByExtreme = (rows, lookup) => {
    let best = null;
    let bestValue = null;

    rows.forEach((row) => {
      const rawValue = getColumnValue(row, lookup.conditionFieldCode);
      if (!rawValue) {
        return;
      }
      if (best === null) {
        best = row;
        bestValue = rawValue;
        return;
      }
      const isBetter =
        lookup.mode === MODES.LATEST
          ? rawValue > bestValue
          : rawValue < bestValue;
      const isTie = rawValue === bestValue;
      // 同値のときは検索方向に従う: BOTTOM_TO_TOPなら後の出現で上書きし続けることで
      // 最終的にテーブル順で最後の同値行が残る。TOP_TO_BOTTOMは何もせず最初の出現を維持する。
      if (
        isBetter ||
        (isTie && lookup.direction === DIRECTIONS.BOTTOM_TO_TOP)
      ) {
        best = row;
        bestValue = rawValue;
      }
    });

    return best;
  };

  const findMatchedRow = (rows, lookup) => {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0 || !lookup) {
      return null;
    }

    switch (lookup.mode) {
      case MODES.TOP_ROW:
        return list[0] || null;
      case MODES.BOTTOM_ROW:
        return list[list.length - 1] || null;
      case MODES.PARTIAL_MATCH:
      case MODES.EXACT_MATCH:
        return findByCondition(list, lookup);
      case MODES.LATEST:
      case MODES.OLDEST:
        return findByExtreme(list, lookup);
      default:
        return null;
    }
  };

  const RowFinder = { MODES, DIRECTIONS, getColumnValue, findMatchedRow };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RowFinder;
  } else {
    root.SubtableLookup = root.SubtableLookup || {};
    root.SubtableLookup.RowFinder = RowFinder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
