(function (root) {
  'use strict';

  // レコード配列(kintoneのフィールド形式、record.<code>.value)→レーダーチャート描画用の
  // 系列データへの変換。グルーピング単位(config.groupingType)により2モードで動作する。
  //
  // - 'record': 1レコード=1系列。値は各軸フィールドの生値(数値でなければ0扱い)。
  //             badgeFieldCodesで選択した各フィールドの値を`badges`配列として個別に保持する
  //             (生成HTML側でカードにバッジ〈チップ〉として表示する。頂点のラベルとしてでは
  //             ない。idea.md参照)。badgesが空の場合、`label`(#$id等のフォールバック)を
  //             カードの見出しとして使う。
  // - 'field' : config.groupingFieldCode の値ごとにレコードをまとめ、1グループ=1系列。
  //             各軸フィールドの値はグループ内レコードの合計値(件数も併せて保持し、
  //             合計/平均の切り替えはjs/lib/radar-stats.jsが担う)。バッジは使用しない
  //             (`badges`は常に空配列。グループ化フィールドの値自体が`label`になるため)。

  const UNSET_GROUP_LABEL = '(未設定)';

  const fieldValue = (record, code) => {
    const field = record && record[code];
    return field && field.value !== undefined && field.value !== null
      ? field.value
      : '';
  };

  const parseNumberOrZero = (value) => {
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };

  const buildRecordLabel = (record, badgeFieldCodes) => {
    const parts = (badgeFieldCodes || [])
      .map((code) => fieldValue(record, code))
      .filter((value) => value !== '')
      .map(String);
    if (parts.length > 0) {
      return parts.join(' / ');
    }
    const id = fieldValue(record, '$id');
    return id === '' ? '(レコード)' : `#${id}`;
  };

  const buildRecordBadges = (record, badgeFieldCodes) =>
    (badgeFieldCodes || [])
      .map((code) => fieldValue(record, code))
      .filter((value) => value !== '')
      .map(String);

  const buildRecordSeries = (records, config) =>
    records.map((record) => ({
      label: buildRecordLabel(record, config.badgeFieldCodes),
      badges: buildRecordBadges(record, config.badgeFieldCodes),
      values: (config.axisFieldCodes || []).map((code) =>
        parseNumberOrZero(fieldValue(record, code)),
      ),
      count: 1,
    }));

  const buildFieldGroupedSeries = (records, config) => {
    const axisFieldCodes = config.axisFieldCodes || [];
    const order = [];
    const groups = new Map();

    records.forEach((record) => {
      const raw = fieldValue(record, config.groupingFieldCode);
      const label = raw === '' ? UNSET_GROUP_LABEL : String(raw);

      if (!groups.has(label)) {
        order.push(label);
        groups.set(label, {
          sums: axisFieldCodes.map(() => 0),
          count: 0,
        });
      }

      const group = groups.get(label);
      axisFieldCodes.forEach((code, i) => {
        group.sums[i] += parseNumberOrZero(fieldValue(record, code));
      });
      group.count += 1;
    });

    return order.map((label) => {
      const group = groups.get(label);
      return { label, badges: [], values: group.sums, count: group.count };
    });
  };

  // config: { groupingType, groupingFieldCode, axisFieldCodes, badgeFieldCodes }
  const buildSeries = (records, config) => {
    if (!records || records.length === 0) {
      return [];
    }
    return config.groupingType === 'field'
      ? buildFieldGroupedSeries(records, config)
      : buildRecordSeries(records, config);
  };

  const SeriesBuilder = { UNSET_GROUP_LABEL, buildSeries };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeriesBuilder;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.SeriesBuilder = SeriesBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
