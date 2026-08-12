(function (root) {
  'use strict';

  // 定例(繰り返し)日程の展開ロジック(純粋関数)。idea.md「繰り返し(定例)日程展開」参照。
  // タイムゾーンに依存しないよう、日付は常にUTC基準のDateオブジェクトで扱う
  // (new Date('YYYY-MM-DD')はUTC 00:00として解釈される仕様を利用する)。

  const FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'];

  // 安全のための最大探索日数(約20年分)。COUNT/END_DATEの終了条件は必ず有限で満たされる設計だが、
  // 呼び出し側の設定ミス(例: 到達し得ない終了日)による無限ループを避けるための保険。
  const MAX_DAY_STEPS = 20 * 366;

  const parseDate = (value) => {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`不正な日付です: ${value}`);
    }
    return date;
  };

  const formatDate = (date) => date.toISOString().slice(0, 10);

  const addDays = (date, days) =>
    new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

  const validateRule = (rule) => {
    if (!rule || !rule.startDate) {
      throw new Error('startDateは必須です。');
    }
    if (!FREQUENCIES.includes(rule.frequency)) {
      throw new Error(`frequencyが不正です: ${rule.frequency}`);
    }
    if (rule.frequency === 'ONCE') {
      return;
    }
    if (rule.frequency === 'WEEKLY') {
      if (!Array.isArray(rule.weekdays) || rule.weekdays.length === 0) {
        throw new Error('WEEKLYの場合、weekdaysを1つ以上指定してください。');
      }
    }
    if (rule.frequency === 'MONTHLY') {
      if (!Array.isArray(rule.monthDays) || rule.monthDays.length === 0) {
        throw new Error('MONTHLYの場合、monthDaysを1つ以上指定してください。');
      }
    }
    const { endCondition } = rule;
    if (!endCondition || !endCondition.type) {
      throw new Error('endConditionを指定してください。');
    }
    if (endCondition.type === 'COUNT') {
      if (!Number.isInteger(endCondition.count) || endCondition.count <= 0) {
        throw new Error('countは1以上の整数で指定してください。');
      }
    } else if (endCondition.type === 'END_DATE') {
      if (!endCondition.endDate) {
        throw new Error('endDateを指定してください。');
      }
      if (parseDate(endCondition.endDate) < parseDate(rule.startDate)) {
        throw new Error('endDateはstartDate以降にしてください。');
      }
    } else {
      throw new Error(`endCondition.typeが不正です: ${endCondition.type}`);
    }
  };

  // startDateから1日ずつ進めながら、isOccurrenceDay(date)を満たす日だけ結果に加える。
  // DAILY/WEEKLY/MONTHLYはこの1つの日送り探索で共通に表現できる
  // (MONTHLYで対象日が存在しない月は、その日付自体が出現しないため自然にスキップされる)。
  const walkAndCollect = (startDate, endCondition, isOccurrenceDay) => {
    const results = [];
    let cursor = parseDate(startDate);
    const endDateUtc =
      endCondition.type === 'END_DATE' ? parseDate(endCondition.endDate) : null;

    for (let step = 0; step <= MAX_DAY_STEPS; step += 1) {
      if (endDateUtc && cursor > endDateUtc) {
        break;
      }
      if (isOccurrenceDay(cursor)) {
        results.push(formatDate(cursor));
        if (
          endCondition.type === 'COUNT' &&
          results.length >= endCondition.count
        ) {
          break;
        }
      }
      cursor = addDays(cursor, 1);
    }
    return results;
  };

  const OCCURRENCE_PREDICATES = {
    DAILY: () => () => true,
    WEEKLY: (rule) => (date) => rule.weekdays.includes(date.getUTCDay()),
    MONTHLY: (rule) => (date) => rule.monthDays.includes(date.getUTCDate()),
  };

  // rule: {
  //   startDate: 'YYYY-MM-DD',
  //   frequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
  //   weekdays: [0-6, ...],   // WEEKLYのみ必須(0=日曜 ... 6=土曜、Date#getUTCDay()と同じ)
  //   monthDays: [1-31, ...], // MONTHLYのみ必須
  //   endCondition: { type: 'COUNT', count } | { type: 'END_DATE', endDate: 'YYYY-MM-DD' },
  //     // ONCE以外は必須
  // }
  // 戻り値: 'YYYY-MM-DD'形式の日付文字列の配列(昇順、重複無し)
  const expandRecurrence = (rule) => {
    validateRule(rule);
    if (rule.frequency === 'ONCE') {
      return [rule.startDate];
    }
    const isOccurrenceDay = OCCURRENCE_PREDICATES[rule.frequency](rule);
    return walkAndCollect(rule.startDate, rule.endCondition, isOccurrenceDay);
  };

  const RecurrenceExpander = { expandRecurrence, FREQUENCIES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecurrenceExpander;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.RecurrenceExpander = RecurrenceExpander;
  }
})(typeof window !== 'undefined' ? window : globalThis);
