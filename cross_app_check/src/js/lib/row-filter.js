(function (root) {
  'use strict';

  // ビューワ側の絞り込み。描画対象の行を決めるだけで、DOMには触らない。
  const ALL_TARGETS = -1;

  const matchesKeyword = (row, keyword) => {
    if (!keyword) {
      return true;
    }
    const needle = keyword.trim().toLowerCase();
    if (needle === '') {
      return true;
    }
    return (
      String(row.key || '')
        .toLowerCase()
        .indexOf(needle) !== -1 ||
      String(row.name || '')
        .toLowerCase()
        .indexOf(needle) !== -1
    );
  };

  // 「未提出のみ」の判定。
  // 対象アプリを1つ選んでいればそのアプリが未提出の行、
  // 「すべて」ならどれか1つでも未提出の行を残す。
  const isUnsubmitted = (row, targetIndex) => {
    const cells = row.targets || [];
    if (
      targetIndex === ALL_TARGETS ||
      targetIndex === null ||
      targetIndex === undefined
    ) {
      return cells.some((cell) => !cell.submitted);
    }
    const cell = cells[targetIndex];
    return Boolean(cell) && !cell.submitted;
  };

  const filterRows = (rows, options) => {
    const opts = options || {};
    const targetIndex =
      opts.targetIndex === undefined || opts.targetIndex === null
        ? ALL_TARGETS
        : Number(opts.targetIndex);

    return (rows || []).filter((row) => {
      if (!matchesKeyword(row, opts.keyword)) {
        return false;
      }
      if (opts.unsubmittedOnly && !isUnsubmitted(row, targetIndex)) {
        return false;
      }
      return true;
    });
  };

  const RowFilter = {
    ALL_TARGETS,
    filterRows,
    isUnsubmitted,
    matchesKeyword,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RowFilter;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.RowFilter = RowFilter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
