(function (root) {
  'use strict';

  // 週表示の日付軸(日曜始まり、7セル)を扱う純粋計算。

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // 与えた日付が属する週の日曜日(0:00)を返す。
  const startOfWeek = (date) => {
    const day = startOfDay(date);
    day.setDate(day.getDate() - day.getDay());
    return day;
  };

  // weekStartからの経過日数(0〜6)。範囲外は-1を返す。
  const dayIndexInWeek = (date, weekStart) => {
    const diffDays = Math.round(
      (startOfDay(date).getTime() - weekStart.getTime()) / ONE_DAY_MS,
    );
    return diffDays >= 0 && diffDays < 7 ? diffDays : -1;
  };

  // イベント配列を、開始日が属する曜日インデックス(0=日曜〜6=土曜)ごとの7バケットに分配する。
  // 範囲外(週をまたいで表示中の週に含まれない)のイベントは無視する。
  const bucketEventsByDay = (events, weekStart) => {
    const buckets = Array.from({ length: 7 }, () => []);
    (events || []).forEach((evt) => {
      const idx = dayIndexInWeek(evt.start, weekStart);
      if (idx !== -1) {
        buckets[idx].push(evt);
      }
    });
    buckets.forEach((list) =>
      list.sort((a, b) => a.start.getTime() - b.start.getTime()),
    );
    return buckets;
  };

  const WeekGrid = {
    startOfDay,
    startOfWeek,
    dayIndexInWeek,
    bucketEventsByDay,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeekGrid;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.WeekGrid = WeekGrid;
  }
})(typeof window !== 'undefined' ? window : globalThis);
