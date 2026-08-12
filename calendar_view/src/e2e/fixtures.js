'use strict';

// このプラグインのe2eテストが必要とするデータを冪等に用意する。
//
// TEST_APP_ID_1には標準の文字列(1行)「文字列__1行_」・日時「日時」・ドロップダウン
// 「ドロップダウン」(選択肢: sample1/sample2)が既存で用意されている(CLAUDE.md記載の前提)ため、
// 新規フィールド作成は行わない。マーカーフィールドには他プラグインのfixtures.jsで未使用の
// 「文字列__1行__2」を使う(related_record_summaryが「文字列__1行__1」、self_lookupが
// 「文字列__1行__0」を使用済みのため衝突を避けた)。
//
// 日時の値は実行時刻からの相対値(+2時間/+4時間)にする。固定日付にすると、カレンダーの
// 既定表示(今日/今週)の範囲外になり、実行日によってはテストが失敗するため。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TITLE_FIELD_CODE = '文字列__1行_';
const START_FIELD_CODE = '日時';
const GROUP_FIELD_CODE = 'ドロップダウン';
const MARKER_FIELD_CODE = '文字列__1行__2';
// bulk_field_updateプラグインのe2eテストが追加した必須フィールド。TEST_APP_ID_1の他アプリ全体に
// 影響する必須制約のため、新規レコード作成時は値を埋める必要がある(このプラグイン固有の項目ではない)。
const REQUIRED_TEST_FIELD_CODE = 'bfu_required_test_field';

const SEED_RECORDS = [
  {
    markerSuffix: 'a',
    title: 'CVイベントA',
    hoursFromNow: 2,
    groupValue: 'sample1',
  },
  {
    markerSuffix: 'b',
    title: 'CVイベントB',
    hoursFromNow: 4,
    groupValue: 'sample2',
  },
];

const isoWithoutMillis = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const ensureSeedRecord = async (env, appId, seed) => {
  const markerValue = `cv_e2e_seed_${seed.markerSuffix}`;
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query: `${MARKER_FIELD_CODE} = "${markerValue}"`,
    },
  );

  const startValue = isoWithoutMillis(
    new Date(Date.now() + seed.hoursFromNow * 60 * 60 * 1000),
  );
  const record = {
    [TITLE_FIELD_CODE]: { value: seed.title },
    [START_FIELD_CODE]: { value: startValue },
    [GROUP_FIELD_CODE]: { value: seed.groupValue },
    [MARKER_FIELD_CODE]: { value: markerValue },
    [REQUIRED_TEST_FIELD_CODE]: { value: 'cv_e2e' },
  };

  if (existing.records && existing.records.length > 0) {
    const recordId = existing.records[0].$id.value;
    // 日時は実行のたびに「今から+N時間」で作り直す必要があるため、既存レコードも更新する。
    await kintoneAdmin.request(env, '/k/v1/record.json', 'PUT', {
      app: appId,
      id: recordId,
      record,
    });
    return { created: false, recordId };
  }

  const res = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record,
  });
  return { created: true, recordId: res.id };
};

const ensureSeedRecords = async (env, appId) => {
  const results = [];
  for (const seed of SEED_RECORDS) {
    results.push(await ensureSeedRecord(env, appId, seed));
  }
  return results;
};

module.exports = {
  TITLE_FIELD_CODE,
  START_FIELD_CODE,
  GROUP_FIELD_CODE,
  MARKER_FIELD_CODE,
  SEED_RECORDS,
  ensureSeedRecords,
};
