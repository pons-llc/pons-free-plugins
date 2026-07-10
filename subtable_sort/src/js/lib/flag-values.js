(function (root) {
  'use strict';

  // MANUALモードのソート済フィールドに書き込む固定文字列(idea.mdの「ソート済フィールド」、
  // 判断記録.mdの2番参照)。
  const FlagValues = { PENDING: '未', DONE: '済' };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlagValues;
  } else {
    root.SubtableSort = root.SubtableSort || {};
    root.SubtableSort.FlagValues = FlagValues;
  }
})(typeof window !== 'undefined' ? window : globalThis);
