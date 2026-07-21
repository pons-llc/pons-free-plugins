(function (root) {
  'use strict';

  // 回答アプリの集計リスト・分析ダッシュボードで使う純粋ロジック。
  // DOMやkintoneオブジェクトには依存しない。

  // REST APIのフィールドタイプ名 → 表示用の日本語タイプ名
  const TYPE_MAP = {
    SINGLE_LINE_TEXT: '文字列',
    MULTI_LINE_TEXT: '文字列 (複数行)',
    RICH_TEXT: 'リッチエディター',
    NUMBER: '数値',
    DATE: '日付',
    DATETIME: '日時',
    TIME: '時刻',
    RADIO_BUTTON: 'ラジオボタン',
    DROP_DOWN: 'ドロップダウン',
    CHECK_BOX: 'チェックボックス',
    MULTI_SELECT: '複数選択',
    USER_SELECT: 'ユーザー選択',
    ORGANIZATION_SELECT: '組織選択',
    GROUP_SELECT: 'グループ選択',
    FILE: '添付ファイル',
    LINK: 'リンク',
    STATUS: 'ステータス',
    STATUS_ASSIGNEE: '作業者',
    CREATOR: '作成者',
    MODIFIER: '更新者',
    CREATED_TIME: '作成日時',
    UPDATED_TIME: '更新日時',
    CALC: '計算',
  };

  // 回答アプリの「未使用の予備フィールド」「管理用フィールド」を一覧・分析から除外する規約
  const SPARE_FIELD_PATTERN =
    /^(text_|multi_text|number_|date_|datetime_|time_)/;
  // json/title/description/requester/deadlineはルックアップで照会からコピーされる
  // 「照会ごとに一定」の値のため、回答の一覧・分析の列/グラフには出さない
  const IGNORE_EXACT_CODES = [
    'json',
    'title',
    'description',
    'requester',
    'deadline',
    'links',
    'lookup',
  ];
  const SYSTEM_IGNORE_CODES = ['$id', '$revision'];
  const IGNORE_TYPES = [
    'CATEGORY',
    'GROUP',
    'REFERENCE_TABLE',
    'RECORD_NUMBER',
    'SUBTABLE',
    'LABEL',
    'SPACER',
    'HR',
  ];

  const shouldIgnoreField = (code, type) =>
    SYSTEM_IGNORE_CODES.includes(code) ||
    IGNORE_TYPES.includes(type) ||
    IGNORE_EXACT_CODES.includes(code) ||
    SPARE_FIELD_PATTERN.test(code);

  // フォーム定義(レイアウト行)に、フォーム定義にない実フィールド(ステータス・作成者など)を
  // 追加した「マージ済みレイアウト」を作る。propertiesは GET /k/v1/app/form/fields の properties。
  const buildMergedLayout = (baseLayoutRows, properties) => {
    const merged = [...(baseLayoutRows || [])];
    const added = new Set(
      merged.map((entry) => entry.value.insert_column.value),
    );
    Object.entries(properties || {}).forEach(([code, prop]) => {
      if (added.has(code) || shouldIgnoreField(code, prop.type)) {
        return;
      }
      merged.push({
        value: {
          insert_column: { value: code },
          question: { value: prop.label },
          field_type: { value: TYPE_MAP[prop.type] || '文字列' },
        },
      });
    });
    return merged;
  };

  // 集計リスト用のカラム定義 [{label, f_code}](フォーム定義の項目を先頭に、実フィールドを後ろに)
  const buildTargetColumns = (baseLayoutRows, properties) =>
    buildMergedLayout(baseLayoutRows, properties).map((entry) => ({
      label: entry.value.question.value,
      f_code: entry.value.insert_column.value,
    }));

  // カンマ区切り(半角・全角・読点)を配列に分解する
  const parseCommaSeparated = (val) => {
    if (!val) {
      return [];
    }
    return String(val)
      .split(/[,、，]/)
      .map((v) => v.trim())
      .filter((v) => v !== '');
  };

  // ISO日時文字列を日本時間表記へ
  const toJST = (isoString, withSeconds) => {
    if (!isoString) {
      return '';
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return isoString;
    }
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    };
    if (withSeconds) {
      options.second = '2-digit';
    }
    return d.toLocaleString('ja-JP', options);
  };

  // レコードのフィールド値を分析・表示しやすい文字列に変換する
  const formatFieldValue = (type, value) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (['DATETIME', 'CREATED_TIME', 'UPDATED_TIME'].includes(type)) {
      return toJST(value);
    }
    if (type === 'RICH_TEXT') {
      // 表示はtextContent相当のプレーンテキストにする(タグを除去)
      return String(value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (type === 'SUBTABLE') {
      return '（テーブルデータ）';
    }
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        return value.map((v) => v.name || v.code || '').join(', ');
      }
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return value.name || value.code || '';
    }
    return value;
  };

  // {code: {type,value}} のレコード配列 → {code: 表示文字列} の行配列
  const normalizeRecords = (records) =>
    (records || []).map((r) => {
      const row = {};
      Object.keys(r).forEach((k) => {
        row[k] = formatFieldValue(r[k].type, r[k].value);
      });
      row.$id = r.$id ? r.$id.value : '';
      return row;
    });

  const getConfigMap = (layoutRows) => {
    const map = {};
    (layoutRows || []).forEach((item) => {
      const col = item.value.insert_column.value;
      map[col] = {
        label: item.value.question.value,
        type: item.value.field_type.value,
      };
    });
    return map;
  };

  const MULTI_VALUE_TYPES = ['チェックボックス', '複数選択'];
  const DATE_LIKE_TYPES = ['日付', '日時', '作成日時', '更新日時'];
  const TIMELINE_TYPES = ['日時', '日付', '時刻', '作成日時', '更新日時'];
  // 集計対象(measure)に選ぶと「選択肢ごとの内訳」になるフィールドタイプ。
  // この内訳表示はaggregateTimeline(折れ線)でしか系列分割していないため、
  // 横棒・円グラフ(aggregateCategory)ではこれらのタイプを集計対象の選択肢から外す
  // (desktop-answer-analysis.jsのchart-measure-select参照)。
  const CATEGORICAL_MEASURE_TYPES = [
    'チェックボックス',
    'ドロップダウン',
    'ラジオボタン',
    '複数選択',
  ];

  // フィルター定義 filters: {code: {operator, value}} を正規化済み行に適用する
  const applyFilters = (
    rows,
    filters,
    activeFilterKeys,
    fieldLogics,
    configMap,
  ) =>
    (rows || []).filter((row) =>
      Object.entries(filters || {}).every(([key, filterObj]) => {
        if (activeFilterKeys && !activeFilterKeys.includes(key)) {
          return true;
        }
        const { operator, value } = filterObj;
        const cellRaw = (row[key] || '').toString();
        const type = configMap[key] ? configMap[key].type : undefined;

        if (MULTI_VALUE_TYPES.includes(type)) {
          if (!value || value.length === 0) {
            return true;
          }
          const recordVals = parseCommaSeparated(cellRaw);
          const logic = (fieldLogics || {})[key] || 'AND';
          return logic === 'OR'
            ? value.some((v) => recordVals.includes(v))
            : value.every((v) => recordVals.includes(v));
        }

        if (operator === 'blank') {
          return cellRaw.trim() === '';
        }
        if (!operator || !value) {
          return true;
        }
        if (['文字列', 'ラジオボタン', 'ドロップダウン'].includes(type)) {
          return cellRaw === value;
        }

        // 日付系は「2026/07/19 10:00」「2026-07-19T10:00」表記を揃えてから比較する。
        // 文字列同士の場合は入力値の桁数に切り詰めて前方一致的に比較する(日付だけ指定して
        // 日時と比較するケースに対応)。
        const s = cellRaw.trim().replace(/\//g, '-').replace(' ', 'T');
        let compA = type === '数値' ? parseFloat(s) : s;
        const sB = String(value).trim().replace(/\//g, '-').replace(' ', 'T');
        const compB = type === '数値' ? parseFloat(sB) : sB;

        if (type === '数値' && (isNaN(compA) || isNaN(compB))) {
          return false;
        }
        if (typeof compA === 'string' && typeof compB === 'string') {
          compA = compA.substring(0, compB.length);
        }
        switch (operator) {
          case 'eq':
            return compA === compB;
          case 'gte':
            return compA >= compB;
          case 'lte':
            return compA <= compB;
          case 'gt':
            return compA > compB;
          case 'lt':
            return compA < compB;
          default:
            return true;
        }
      }),
    );

  // 時系列軸のラベル丸め(日時→日、時刻→時)
  const groupLabel = (val, type) => {
    if (!val) {
      return '(空白)';
    }
    if (['日時', '作成日時', '更新日時'].includes(type)) {
      return String(val).split(' ')[0];
    }
    if (type === '日付') {
      return String(val).replace(/-/g, '/');
    }
    if (type === '時刻') {
      return `${String(val).split(':')[0]}:00`;
    }
    return String(val);
  };

  // 1行から測定値(measure)を取り出す。_count=件数、数値=数値、その他=選択項目数
  const measureOf = (row, measureKey, configMap) => {
    if (measureKey === '_count') {
      return 1;
    }
    const mInfo = configMap[measureKey];
    if (mInfo && mInfo.type === '数値') {
      return parseFloat(row[measureKey]) || 0;
    }
    return parseCommaSeparated(row[measureKey]).length;
  };

  const isBlankValue = (v) => v === undefined || v === null || v === '';

  // 棒・円グラフ用のカテゴリ集計。戻り値 {labels, values}
  const aggregateCategory = (
    rows,
    key,
    info,
    measureKey,
    aggType,
    configMap,
    limit,
  ) => {
    const isTimeline = TIMELINE_TYPES.includes(info.type);
    const accumulator = {};
    (rows || []).forEach((row) => {
      let rawVal = row[key];
      if (isTimeline) {
        rawVal = groupLabel(rawVal, info.type);
      }
      const items = MULTI_VALUE_TYPES.includes(info.type)
        ? parseCommaSeparated(rawVal)
        : [rawVal || '(空白)'];
      if (items.length === 0) {
        items.push('(空白)');
      }
      items.forEach((label) => {
        const val = measureOf(row, measureKey, configMap);
        if (!accumulator[label]) {
          accumulator[label] = { sum: 0, count: 0, nonBlank: 0 };
        }
        accumulator[label].sum += val;
        accumulator[label].count += 1;
        if (!isBlankValue(row[measureKey])) {
          accumulator[label].nonBlank += 1;
        }
      });
    });

    const isNumericMeasure =
      measureKey !== '_count' &&
      configMap[measureKey] &&
      configMap[measureKey].type === '数値';
    const aggregated = Object.entries(accumulator).map(
      ([label, { sum, count, nonBlank }]) => {
        let value = sum;
        if (isNumericMeasure && aggType === 'avg') {
          value = count > 0 ? sum / count : 0;
        } else if (isNumericMeasure && aggType === 'count') {
          value = nonBlank;
        }
        return [label, value];
      },
    );

    // 時系列はラベル昇順、それ以外は値の大きい順+表示件数制限
    let sorted;
    if (isTimeline) {
      sorted = aggregated.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      sorted = aggregated.sort((a, b) => b[1] - a[1]);
      if (limit) {
        sorted = sorted.slice(0, limit);
      }
    }
    return { labels: sorted.map((d) => d[0]), values: sorted.map((d) => d[1]) };
  };

  // 折れ線グラフ用の時系列集計。戻り値 {buckets, datasets: [{label, data}]}
  const aggregateTimeline = (
    rows,
    key,
    info,
    measureKey,
    aggType,
    configMap,
  ) => {
    const mInfo = configMap[measureKey];
    const isCategorical = !!(
      mInfo && CATEGORICAL_MEASURE_TYPES.includes(mInfo.type)
    );

    let categories = ['Value'];
    if (isCategorical) {
      const catSet = new Set();
      (rows || []).forEach((r) =>
        parseCommaSeparated(r[measureKey]).forEach((v) => catSet.add(v)),
      );
      categories = Array.from(catSet).sort();
    }

    const buckets = Array.from(
      new Set((rows || []).map((r) => groupLabel(r[key], info.type))),
    ).sort();

    const datasets = categories.map((cat) => {
      const data = buckets.map((bucket) => {
        let sum = 0;
        let count = 0;
        let nonBlank = 0;
        (rows || [])
          .filter((r) => groupLabel(r[key], info.type) === bucket)
          .forEach((r) => {
            if (measureKey === '_count') {
              sum += 1;
              count += 1;
            } else if (mInfo && mInfo.type === '数値') {
              sum += parseFloat(r[measureKey]) || 0;
              count += 1;
              if (!isBlankValue(r[measureKey])) {
                nonBlank += 1;
              }
            } else if (mInfo) {
              if (parseCommaSeparated(r[measureKey]).includes(cat)) {
                sum += 1;
                count += 1;
              }
            }
          });
        if (mInfo && mInfo.type === '数値') {
          if (aggType === 'avg') {
            return count > 0 ? sum / count : 0;
          }
          if (aggType === 'count') {
            return nonBlank;
          }
        }
        return sum;
      });
      return { label: cat, data };
    });

    return { buckets, datasets, isCategorical };
  };

  // CSV生成(RFC4180風のダブルクォートエスケープ)。layoutRowsの並び順で列を出す。
  const buildCsv = (rows, layoutRows) => {
    const quote = (v) => {
      const s = String(v === undefined || v === null ? '' : v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const header = [
      'ID',
      ...(layoutRows || []).map((i) => quote(i.value.question.value)),
    ].join(',');
    const lines = (rows || []).map((row) =>
      [
        row.$id,
        ...(layoutRows || []).map((i) =>
          quote(row[i.value.insert_column.value] || ''),
        ),
      ].join(','),
    );
    return `${header}\n${lines.join('\n')}`;
  };

  // kintone公式ドキュメント記載の手順通り、バックスラッシュを先にエスケープしてからダブルクオートを
  // エスケープする(順序を逆にすると二重エスケープになる。self_lookupのquery-builder.jsと同じ方針)。
  const escapeQueryValue = (value) =>
    String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // 依頼レコードから最新のjson(フォーム定義)を直接取得するためのクエリ文字列を組み立てる。
  // 回答レコードのjsonはLOOKUPコピーのため依頼レコード編集後も反映が遅れる(kintoneのLOOKUP仕様、
  // desktop-answer-analysis.js/desktop-answer-list.jsのfetchLatestJson参照)。
  const buildRequestRecordQuery = (relatedKeyField, keyValue) =>
    `${relatedKeyField} = "${escapeQueryValue(keyValue)}" limit 1`;

  const AnalysisCore = {
    TYPE_MAP,
    SPARE_FIELD_PATTERN,
    IGNORE_EXACT_CODES,
    SYSTEM_IGNORE_CODES,
    IGNORE_TYPES,
    MULTI_VALUE_TYPES,
    DATE_LIKE_TYPES,
    TIMELINE_TYPES,
    CATEGORICAL_MEASURE_TYPES,
    shouldIgnoreField,
    buildMergedLayout,
    buildTargetColumns,
    parseCommaSeparated,
    toJST,
    formatFieldValue,
    normalizeRecords,
    getConfigMap,
    applyFilters,
    groupLabel,
    measureOf,
    isBlankValue,
    aggregateCategory,
    aggregateTimeline,
    buildCsv,
    escapeQueryValue,
    buildRequestRecordQuery,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisCore;
  } else {
    root.ResearchAnswer = root.ResearchAnswer || {};
    root.ResearchAnswer.AnalysisCore = AnalysisCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
