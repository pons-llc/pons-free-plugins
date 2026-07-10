(function (root) {
  'use strict';

  // 日付範囲(開始行の最小日〜終了行の最大日)を、ガント描画用のグリッド座標(x座標・幅)へ変換する。
  // 日/週/月の3スケールに対応する。月スケールは日数が月によって異なるため、
  // 「1ヶ月 = 30日相当」の近似幅で日単位のピクセル換算をし、グリッド線だけはカレンダー上の
  // 実際の月初日に合わせて描画する(将来、正確な月幅が必要になれば見直す)。

  const DAY_MS = 24 * 60 * 60 * 1000;

  const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const daysBetween = (from, to) =>
    Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

  // rows: RecordModel.buildRows() の戻り値。開始日・終了日が両方とも設定されている行のみが対象。
  const computeDateRange = (rows) => {
    const scheduled = (rows || []).filter(
      (row) => row.startDate && row.endDate,
    );
    if (scheduled.length === 0) {
      return null;
    }
    let min = scheduled[0].startDate;
    let max = scheduled[0].endDate;
    scheduled.forEach((row) => {
      if (row.startDate < min) {
        min = row.startDate;
      }
      if (row.endDate > max) {
        max = row.endDate;
      }
    });
    return { start: startOfDay(min), end: startOfDay(max) };
  };

  const UNIT_DAYS = { day: 1, week: 7, month: 30 };

  const formatLabel = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

  const buildGridLines = (range, unit, pixelsPerDay) => {
    const lines = [];
    if (unit === 'month') {
      let cursor = new Date(
        range.start.getFullYear(),
        range.start.getMonth(),
        1,
      );
      while (cursor <= range.end) {
        lines.push({
          date: new Date(cursor),
          x: daysBetween(range.start, cursor) * pixelsPerDay,
          label: `${cursor.getFullYear()}/${cursor.getMonth() + 1}`,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      return lines;
    }

    const stepDays = unit === 'week' ? 7 : 1;
    let cursor = new Date(range.start);
    while (cursor <= range.end) {
      lines.push({
        date: new Date(cursor),
        x: daysBetween(range.start, cursor) * pixelsPerDay,
        label: formatLabel(cursor),
      });
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + stepDays,
      );
    }
    return lines;
  };

  // range: computeDateRange() の戻り値。unit: 'day' | 'week' | 'month'。pixelsPerUnit: 1単位あたりの表示幅(px)。
  const createScale = (range, unit, pixelsPerUnit) => {
    if (!range) {
      return null;
    }
    const unitDays = UNIT_DAYS[unit] || 1;
    const pixelsPerDay = pixelsPerUnit / unitDays;
    const totalDays = daysBetween(range.start, range.end) + 1;
    const totalWidth = totalDays * pixelsPerDay;

    const dateToX = (date) => daysBetween(range.start, date) * pixelsPerDay;

    // startDate〜endDateを両端含む(inclusive)日数として幅を計算する。
    const dateToWidth = (startDate, endDate) =>
      (daysBetween(startDate, endDate) + 1) * pixelsPerDay;

    return {
      unit,
      pixelsPerDay,
      totalDays,
      totalWidth,
      dateToX,
      dateToWidth,
      gridLines: buildGridLines(range, unit, pixelsPerDay),
    };
  };

  const TimeScale = { computeDateRange, createScale, startOfDay, daysBetween };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeScale;
  } else {
    root.GanttChartView = root.GanttChartView || {};
    root.GanttChartView.TimeScale = TimeScale;
  }
})(typeof window !== 'undefined' ? window : globalThis);
