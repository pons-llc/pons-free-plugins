(function (root) {
  'use strict';

  // 会議室予約枠のような「時間帯を一定間隔で分割する」繰り返しの展開ロジック(純粋関数)。
  // idea.md「繰り返し(定例)日程展開」の時刻版。DATETIME型の繰り返し用フィールドを設定した
  // 場合にのみ使う(recurrence-expander.jsが返す日付ごとに、ここで生成した時刻を掛け合わせる)。
  // 日をまたぐ時間帯(23:00〜翌1:00等)は扱わない(1日の中で完結する時間帯のみを対象とする)。

  const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const toMinutes = (time) => {
    const match = TIME_PATTERN.exec(time || '');
    if (!match) {
      throw new Error(`不正な時刻です: ${time}`);
    }
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const formatMinutes = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  // { startTime: 'HH:MM', endTime: 'HH:MM', intervalMinutes } => ['HH:MM', ...]
  // 終了時刻(endTime)は含まない(最後の枠の開始時刻はendTimeの1つ前になる。例:
  // 9:00-17:00を1時間ごとに分割すると、最後の枠は16:00開始・17:00終了となり、
  // 17:00開始の枠は作らない)。
  const expandTimeSlots = ({ startTime, endTime, intervalMinutes }) => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes >= endMinutes) {
      throw new Error('終了時刻は開始時刻より後にしてください。');
    }
    if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
      throw new Error('間隔は1分以上の整数で指定してください。');
    }

    const slots = [];
    for (let t = startMinutes; t < endMinutes; t += intervalMinutes) {
      slots.push(formatMinutes(t));
    }
    return slots;
  };

  // 開始時刻にminutesToAddを足した時刻を返す(終了日時フィールドの値を算出するために使う。
  // idea.md「終了日時フィールド」参照)。時間帯を一定間隔で分割するモードでは、各枠の終了時刻は
  // その枠の開始時刻+間隔で自動的に決まる。日をまたぐ時刻(24:00以降)は扱わないため例外にする。
  const shiftTime = (time, minutesToAdd) => {
    const startMinutes = toMinutes(time);
    if (!Number.isInteger(minutesToAdd) || minutesToAdd < 0) {
      throw new Error('加算する分は0以上の整数で指定してください。');
    }
    const resultMinutes = startMinutes + minutesToAdd;
    if (resultMinutes >= 24 * 60) {
      throw new Error(
        '終了時刻が24:00を超えます。間隔または時刻を見直してください。',
      );
    }
    return formatMinutes(resultMinutes);
  };

  const TimeSlotExpander = { expandTimeSlots, shiftTime };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSlotExpander;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.TimeSlotExpander = TimeSlotExpander;
  }
})(typeof window !== 'undefined' ? window : globalThis);
