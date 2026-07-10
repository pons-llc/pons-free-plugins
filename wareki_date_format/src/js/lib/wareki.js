(function (root) {
  'use strict';

  const Zenkaku =
    typeof module !== 'undefined' && module.exports
      ? require('./zenkaku')
      : root.WarekiDateFormat.Zenkaku;

  // DATETIME/CREATED_TIME/UPDATED_TIME はUTCのISO8601文字列で保存されている。和暦の年月日を
  // 求める際にどのタイムゾーンの暦日として扱うかの既定値。kintone側でユーザーのタイムゾーンを
  // 取得するJS APIはないため固定値とする(idea.mdの「タイムゾーンの扱い」参照。要確認事項)。
  const DEFAULT_TIME_ZONE = 'Asia/Tokyo';

  const PRESETS = {
    WAREKI_ONLY: 'WAREKI_ONLY',
    WAREKI_WITH_SEIREKI: 'WAREKI_WITH_SEIREKI',
  };

  const DATE_ONLY_TYPES = ['DATE'];
  const DATETIME_TYPES = ['DATETIME', 'CREATED_TIME', 'UPDATED_TIME'];

  const DATE_STRING_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

  // フィールドの型+値(kintoneのvalue文字列)から、タイムゾーンを考慮した暦日 {year, month, day} を
  // 取り出す。DATE型はタイムゾーンを持たない暦日そのものなので文字列から直接パースする。
  // DATETIME系はUTCのISO文字列なので、指定したタイムゾーン(既定 Asia/Tokyo)での暦日に変換する。
  const toCalendarParts = (fieldType, rawValue, timeZone) => {
    if (!rawValue) {
      return null;
    }

    if (DATE_ONLY_TYPES.includes(fieldType)) {
      const matched = DATE_STRING_PATTERN.exec(rawValue);
      if (!matched) {
        return null;
      }
      return {
        year: Number(matched[1]),
        month: Number(matched[2]),
        day: Number(matched[3]),
      };
    }

    if (DATETIME_TYPES.includes(fieldType)) {
      const date = new Date(rawValue);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || DEFAULT_TIME_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(date);
      const get = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? Number(part.value) : NaN;
      };
      const year = get('year');
      const month = get('month');
      const day = get('day');
      if ([year, month, day].some((n) => Number.isNaN(n))) {
        return null;
      }
      return { year, month, day };
    }

    return null;
  };

  // {year, month, day} から和暦の元号・年(元号内の年)・月・日を求める。Intl.DateTimeFormat の
  // 日本暦カレンダー('ja-JP-u-ca-japanese')に元号の判定を委ねているため、コード側に元号テーブルを
  // 一切持たない(将来の改元にブラウザ/ICUの更新で自動追従できる)。
  // Date を UTC正午で組み立てて timeZone: 'UTC' で読み出すことで、toCalendarParts で既に確定させた
  // 暦日をそのまま(それ以上のタイムゾーン変換なしに)和暦へ変換する。
  const toEraParts = ({ year, month, day }) => {
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const parts = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
      timeZone: 'UTC',
      era: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const get = (type) => {
      const part = parts.find((p) => p.type === type);
      return part ? part.value : '';
    };
    const eraYearRaw = get('year');
    return {
      era: get('era'),
      // 元号1年目は「元年」と表記する(公用文の慣例)。Intlは数値の"1"を返すためここだけ変換する。
      eraYear: eraYearRaw === '1' ? '元' : eraYearRaw,
      month: get('month'),
      day: get('day'),
    };
  };

  const applyZenkaku = (text, zenkaku) =>
    zenkaku ? Zenkaku.toZenkakuDigits(text) : text;

  const formatWarekiOnly = (calendarParts, zenkaku) => {
    const era = toEraParts(calendarParts);
    const text = `${era.era}${era.eraYear}年${era.month}月${era.day}日`;
    return applyZenkaku(text, zenkaku);
  };

  const formatWarekiWithSeireki = (calendarParts, zenkaku) => {
    const era = toEraParts(calendarParts);
    const text =
      `${calendarParts.year}年(${era.era}${era.eraYear}年)` +
      `${calendarParts.month}月${calendarParts.day}日`;
    return applyZenkaku(text, zenkaku);
  };

  // フィールドの型+値から、設定されたプリセット・全角半角オプションに従って和暦の文字列を組み立てる。
  // 値が空/不正な場合や対応していないフィールド型の場合は例外を投げず空文字列を返す
  // (呼び出し側のkintoneグルーコードで毎回try/catchしなくても安全に使えるようにするため)。
  const format = (fieldType, rawValue, options) => {
    const opts = options || {};
    const preset = opts.preset || PRESETS.WAREKI_ONLY;
    const zenkaku = Boolean(opts.zenkaku);

    const calendarParts = toCalendarParts(fieldType, rawValue, opts.timeZone);
    if (!calendarParts) {
      return '';
    }

    if (preset === PRESETS.WAREKI_WITH_SEIREKI) {
      return formatWarekiWithSeireki(calendarParts, zenkaku);
    }
    return formatWarekiOnly(calendarParts, zenkaku);
  };

  const SUPPORTED_SOURCE_FIELD_TYPES = [...DATE_ONLY_TYPES, ...DATETIME_TYPES];

  const Wareki = {
    PRESETS,
    DEFAULT_TIME_ZONE,
    SUPPORTED_SOURCE_FIELD_TYPES,
    toCalendarParts,
    format,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Wareki;
  } else {
    root.WarekiDateFormat = root.WarekiDateFormat || {};
    root.WarekiDateFormat.Wareki = Wareki;
  }
})(typeof window !== 'undefined' ? window : globalThis);
