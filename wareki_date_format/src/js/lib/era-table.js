(function (root) {
  'use strict';

  const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

  // 管理者が設定画面で追加する「ICU(ブラウザのIntl実装)がまだ知らない将来の元号」の一覧。
  // 既定は空配列(明治〜令和はwareki.jsがIntlの日本暦カレンダーで自動判定できるため、
  // このテーブルに登録する必要がない)。
  const DEFAULT_ERA_TABLE = [];

  const parseStartDate = (startDate) => {
    const matched = DATE_PATTERN.exec(startDate);
    if (!matched) {
      return null;
    }
    return {
      year: Number(matched[1]),
      month: Number(matched[2]),
      day: Number(matched[3]),
    };
  };

  const toComparable = ({ year, month, day }) =>
    year * 10000 + month * 100 + day;

  // 対象の暦日に該当する登録済み元号を、開始日が新しい順に確認して返す。
  // 該当なし(テーブルが空/対象日がどの開始日より前)ならnullを返し、
  // 呼び出し側(wareki.js)はIntlによる自動判定にフォールバックする。
  const findOverride = (eraTable, calendarParts) => {
    if (!Array.isArray(eraTable) || eraTable.length === 0) {
      return null;
    }
    const target = toComparable(calendarParts);
    const candidates = eraTable
      .map((era) => ({ era, start: parseStartDate(era && era.startDate) }))
      .filter(({ start }) => start !== null && toComparable(start) <= target)
      .sort((a, b) => toComparable(b.start) - toComparable(a.start));
    return candidates.length > 0 ? candidates[0] : null;
  };

  // 元号内の年数を組み立てる。1年目は他の元号(明治〜令和)と表記を揃え「元」とする。
  const eraYearLabel = (start, targetYear) => {
    const n = targetYear - start.year + 1;
    return n === 1 ? '元' : String(n);
  };

  const EraTable = {
    DEFAULT_ERA_TABLE,
    findOverride,
    eraYearLabel,
    parseStartDate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EraTable;
  } else {
    root.WarekiDateFormat = root.WarekiDateFormat || {};
    root.WarekiDateFormat.EraTable = EraTable;
  }
})(typeof window !== 'undefined' ? window : globalThis);
