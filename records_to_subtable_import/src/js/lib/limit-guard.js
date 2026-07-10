(function (root) {
  'use strict';

  // 取り込み件数の上限判定・打ち切りロジック。
  // 「1つのテーブルに大量の行を追加しない」というkintone公式の注意事項に対応するため、
  // 設定画面で指定した上限件数を超えた分は切り捨て、その旨をUI側に伝えるための情報を返す。

  const DEFAULT_MAX_ROWS = 300;

  const normalizeMax = (maxRows) => {
    const num = Number(maxRows);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : DEFAULT_MAX_ROWS;
  };

  // 行配列(または取得済みレコード配列)を上限件数で切り詰める。
  // truncated: 上限を超えていたため切り捨てが発生したかどうか。
  const applyLimit = (rows, maxRows) => {
    const max = normalizeMax(maxRows);
    const list = rows || [];
    const limited = list.slice(0, max);
    return {
      rows: limited,
      max,
      totalFetched: list.length,
      keptCount: limited.length,
      truncated: list.length > limited.length,
    };
  };

  // ページング取得中に、これ以上ページを取得する必要があるかどうかを判定する。
  // ちょうど上限件数に達しただけでは「本当に打ち切りが発生したか(まだ続きがあるか)」を
  // 区別できないため、上限件数を「超えた」時点(> max)で初めて打ち切り、
  // applyLimit()のtruncated判定を正しく機能させる。
  const hasReachedLimit = (fetchedCountSoFar, maxRows) => {
    const max = normalizeMax(maxRows);
    return (fetchedCountSoFar || 0) > max;
  };

  const LimitGuard = {
    DEFAULT_MAX_ROWS,
    applyLimit,
    hasReachedLimit,
    normalizeMax,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LimitGuard;
  } else {
    root.RecordsToSubtable = root.RecordsToSubtable || {};
    root.RecordsToSubtable.LimitGuard = LimitGuard;
  }
})(typeof window !== 'undefined' ? window : globalThis);
