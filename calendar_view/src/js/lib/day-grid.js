(function (root) {
  'use strict';

  // 日表示の時刻軸(0:00〜24:00)を扱う純粋計算。縦/横デザインいずれでも
  // 「時刻→ピクセル位置」の変換ロジック自体は共通で、描画側(縦=y座標/横=x座標)が
  // どちらの軸に適用するかを決める。

  const MINUTES_PER_DAY = 24 * 60;
  const SNAP_MINUTES = 15;

  const snapMinutes = (minutes) =>
    Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

  const minutesSinceMidnight = (date) =>
    date.getHours() * 60 + date.getMinutes();

  // pxPerMinute: 1分あたりのピクセル数
  const minutesToPixels = (minutes, pxPerMinute) => minutes * pxPerMinute;

  const pixelsToMinutes = (pixels, pxPerMinute) => {
    const raw = pixels / pxPerMinute;
    const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, raw));
    return snapMinutes(clamped);
  };

  const DayGrid = {
    MINUTES_PER_DAY,
    SNAP_MINUTES,
    snapMinutes,
    minutesSinceMidnight,
    minutesToPixels,
    pixelsToMinutes,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayGrid;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.DayGrid = DayGrid;
  }
})(typeof window !== 'undefined' ? window : globalThis);
