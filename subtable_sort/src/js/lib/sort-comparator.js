(function (root) {
  'use strict';

  // ソートキーの配列から比較関数を組み立て、サブテーブルのvalue配列をソートした新しい配列を返す。
  // 元の配列は変更しない。kintoneに依存しない純粋関数。

  const getColumnValue = (row, columnCode) => {
    const field = row && row.value ? row.value[columnCode] : undefined;
    return field ? field.value : undefined;
  };

  const compareValues = (a, b, valueType) => {
    if (valueType === 'NUMBER') {
      const numA = Number(a) || 0;
      const numB = Number(b) || 0;
      if (numA < numB) return -1;
      if (numA > numB) return 1;
      return 0;
    }
    const strA = a === undefined || a === null ? '' : String(a);
    const strB = b === undefined || b === null ? '' : String(b);
    if (strA < strB) return -1;
    if (strA > strB) return 1;
    return 0;
  };

  // 複数のソートキーを先頭から順に比較し、Excelの複数列ソートと同じ優先順位で比較結果を返す
  // (idea.mdの「ソートキー」参照)。
  const buildComparator = (sortKeys) => (rowA, rowB) => {
    for (const key of sortKeys) {
      const valueA = getColumnValue(rowA, key.columnCode);
      const valueB = getColumnValue(rowB, key.columnCode);
      const comparison = compareValues(valueA, valueB, key.valueType);
      if (comparison !== 0) {
        return key.order === 'DESC' ? -comparison : comparison;
      }
    }
    return 0;
  };

  // Array.prototype.sort()はES2019以降で安定性が仕様上保証されているため、追加実装なしで
  // 同順位の行の元の並び順を維持できる(idea.md参照)。
  const sortRows = (rows, sortKeys) => {
    const list = Array.isArray(rows) ? [...rows] : [];
    const keys = Array.isArray(sortKeys) ? sortKeys : [];
    if (keys.length === 0) {
      return list;
    }
    return list.sort(buildComparator(keys));
  };

  const SortComparator = { sortRows };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SortComparator;
  } else {
    root.SubtableSort = root.SubtableSort || {};
    root.SubtableSort.SortComparator = SortComparator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
