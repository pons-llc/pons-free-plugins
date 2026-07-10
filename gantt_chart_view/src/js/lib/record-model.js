(function (root) {
  'use strict';

  // レコード配列(kintoneのフィールド形式)を、ガント描画用の行データモデルへ変換する。
  // - 開始日フィールドが未設定/不正な値の行は「未仕訳」(isUnscheduled: true)として扱う。
  // - 開始日はあるが終了日が未設定/不正な値の行は、開始日=終了日の1日幅バーとして扱う(isEndInferred: true)。

  const UNSCHEDULED_GROUP_KEY = '__unscheduled__';

  const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  // DATE型は'YYYY-MM-DD'、DATETIME型はISO 8601(タイムゾーン付き)で値が返る。
  // 'YYYY-MM-DD'をそのままDateコンストラクタに渡すとUTC深夜0時として解釈される仕様があり、
  // 西経タイムゾーンのブラウザでは前日にずれる(既知のJSの罠)。DATE型は年月日そのものを
  // 表す値なので、ローカルの年月日として明示的に組み立てる。DATETIME型は時刻を含む瞬間を
  // 表す値なので、通常どおりDateコンストラクタでローカル時刻に変換する。
  // 不正な値は例外を投げず null を返す(1レコードの不正値で画面全体をクラッシュさせないため)。
  const parseDateValue = (rawValue) => {
    if (!rawValue) {
      return null;
    }
    if (DATE_ONLY_PATTERN.test(rawValue)) {
      const [year, month, day] = rawValue.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  };

  const fieldValue = (record, fieldCode) => {
    if (!fieldCode || !record[fieldCode]) {
      return '';
    }
    return record[fieldCode].value;
  };

  const buildRows = (records, config) => {
    const startFieldCode = config.startFieldCode;
    const endFieldCode = config.endFieldCode;

    return (records || []).map((record) => {
      const recordId = record.$id ? record.$id.value : undefined;
      const startDate = parseDateValue(fieldValue(record, startFieldCode));
      let endDate = parseDateValue(fieldValue(record, endFieldCode));
      let isEndInferred = false;

      if (startDate && !endDate) {
        endDate = startDate;
        isEndInferred = true;
      }

      return {
        recordId,
        startDate,
        endDate,
        isEndInferred,
        isUnscheduled: !startDate,
        record,
      };
    });
  };

  const RecordModel = { UNSCHEDULED_GROUP_KEY, parseDateValue, buildRows };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordModel;
  } else {
    root.GanttChartView = root.GanttChartView || {};
    root.GanttChartView.RecordModel = RecordModel;
  }
})(typeof window !== 'undefined' ? window : globalThis);
