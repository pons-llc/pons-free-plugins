(function (root) {
  'use strict';

  // 期限フィールド(DATEまたはDATETIME)の表示用文字列化と、期限超過(ファイアマーク)判定。
  // idea.md「カードの表示項目」参照。日付のみで比較し、時刻は見ない。
  //
  // DATE値は "YYYY-MM-DD"(そのままカレンダー上の日付)。
  // DATETIME値は "2012-01-11T11:30:00Z" のようなUTC ISO文字列(kintoneドキュメントMCPで確認済み)
  // のため、実行環境のローカルタイムゾーンでの日付に変換してから比較する
  // (「今日」もローカル日付で判定するため、双方をローカル日付に揃える)。

  const localDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // DATE値("YYYY-MM-DD"、10文字)はそのまま、DATETIME値はローカル日付に変換して返す。
  const dueDatePart = (dueValue) => {
    if (!dueValue) {
      return null;
    }
    if (dueValue.length === 10) {
      return dueValue;
    }
    return localDateString(new Date(dueValue));
  };

  const formatDueDate = (dueValue) => dueDatePart(dueValue) || '';

  // now: 基準時刻(既定は実行時の現在時刻)。テストから固定日時を注入できるように引数化する。
  const isOverdue = (dueValue, now) => {
    const duePart = dueDatePart(dueValue);
    if (!duePart) {
      return false;
    }
    return duePart < localDateString(now || new Date());
  };

  const DueDate = { formatDueDate, isOverdue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DueDate;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.DueDate = DueDate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
