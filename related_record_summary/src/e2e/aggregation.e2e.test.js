'use strict';

// 詳細画面ボタン経由の実集計(config保存→デプロイ→ボタン押下→書き込み)を検証するPuppeteerテスト。
// config-screen.e2e.test.jsが選択肢の絞り込みを見るのに対し、こちらは「実際に参照先アプリへ
// クエリを発行し、正しい値が書き込まれるか」という機能面を検証する
// (idea.md「中核制約」: 関連レコード一覧フィールドの値そのものはAPIで取得できないため、
// このプラグインは自前でクエリを組み立てて参照先アプリへ問い合わせている。ここが正しく動くかが
// 最大のリスク)。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e
//
// 期待値は固定の数値をハードコードせず、参照先アプリ(TEST_APP_ID_2)へ実際にREST APIで
// クエリを発行して独立に計算する(js/lib/query-builder.js・js/lib/aggregator.jsをNode側でも
// requireして本番と同じロジックで組み立てる)。これにより、テストデータ(TEST_APP_ID_2の
// レコード内容)が将来変わっても追従できる。
//
// NOTE: TEST_APP_ID_1には(このテストとは別に)手動検証済みの設定行が既にあるため、
// 「関連レコード一覧」フィールド+このテスト専用の書き込み先フィールド(数値_1/数値_2)を
// 組み合わせた行が無い場合のみ新規追加する(既存行は触らない、冪等)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const QueryBuilder = require('../js/lib/query-builder');
const Aggregator = require('../js/lib/aggregator');
const {
  MATCH_VALUE,
  REFERENCE_FIELD_CODE,
  RELATED_TARGET_FIELD_CODE,
  WRITE_FIELD_SUM,
  WRITE_FIELD_COUNT,
  ensureSeedRecord,
  openRecordDetailViaIndex,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('詳細画面ボタンでの実集計(実環境)', () => {
  let browser;
  let page;
  let env;
  let seedRecordId;
  let expectedSum;
  let expectedCount;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

    const seed = await ensureSeedRecord(env, env.TEST_APP_ID_1);
    seedRecordId = seed.recordId;

    // 参照先アプリの実際のreferenceTable設定(手動設定済み)を取得し、本番と同じ
    // query-builder.jsでクエリを組み立てて独立に期待値を計算する。
    const app1Fields = await kintoneAdmin.getFormFields(env, env.TEST_APP_ID_1);
    const referenceTable = app1Fields[REFERENCE_FIELD_CODE].referenceTable;
    const query = QueryBuilder.build(referenceTable, {
      matchValue: MATCH_VALUE,
      isNumericMatchField: false,
    });
    const relatedAppId = referenceTable.relatedApp.app;
    const res = await kintoneAdmin.request(env, '/k/v1/records.json', 'GET', {
      app: relatedAppId,
      query,
      fields: ['$id', RELATED_TARGET_FIELD_CODE],
    });
    expectedCount = Aggregator.count(res.records);
    expectedSum = Aggregator.sum(res.records, RELATED_TARGET_FIELD_CODE);
    // このテストが意味を持つには、少なくとも1件の関連レコードがヒットする必要がある
    // (0件だと合計=0のままで「書き込みが実際に起きたか」を検証できない)。
    expect(expectedCount).toBeGreaterThan(0);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const alreadyConfigured = await page.evaluate(
      (refCode, sumCode, countCode) => {
        const rows = Array.from(document.querySelectorAll('.js-row'));
        const hasSum = rows.some(
          (row) =>
            row.querySelector('.js-row-reference-field')?.value === refCode &&
            row.querySelector('.js-row-write-field')?.value === sumCode,
        );
        const hasCount = rows.some(
          (row) =>
            row.querySelector('.js-row-reference-field')?.value === refCode &&
            row.querySelector('.js-row-write-field')?.value === countCode,
        );
        return hasSum && hasCount;
      },
      REFERENCE_FIELD_CODE,
      WRITE_FIELD_SUM,
      WRITE_FIELD_COUNT,
    );

    if (!alreadyConfigured) {
      // SUM行を追加
      await page.click('#js-row-add');
      let rows = await page.$$('.js-row');
      let newRow = rows[rows.length - 1];
      await (
        await newRow.$('.js-row-reference-field')
      ).select(REFERENCE_FIELD_CODE);
      await (await newRow.$('.js-row-summary-type')).select('SUM');
      await page.waitForFunction(
        (el) => el.querySelectorAll('option').length > 1,
        {},
        await newRow.$('.js-row-target-field'),
      );
      await (
        await newRow.$('.js-row-target-field')
      ).select(RELATED_TARGET_FIELD_CODE);
      await (await newRow.$('.js-row-write-field')).select(WRITE_FIELD_SUM);

      // COUNT行を追加
      await page.click('#js-row-add');
      rows = await page.$$('.js-row');
      newRow = rows[rows.length - 1];
      await (
        await newRow.$('.js-row-reference-field')
      ).select(REFERENCE_FIELD_CODE);
      // 集計種別は既定でCOUNTのため変更不要。
      await (await newRow.$('.js-row-write-field')).select(WRITE_FIELD_COUNT);

      // 詳細画面ボタンを有効化する。
      await page.evaluate(() => {
        document.querySelector('.js-trigger-detail').click();
      });

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);

      // プラグイン設定の保存は動作テスト環境相当にしか反映されないため、明示的にデプロイする
      // (self_lookupの実装で確認済みの注意点、CLAUDE.md/判断記録.md参照)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('詳細画面のボタンを押すと、参照先アプリを実際に集計した値が書き込まれる', async () => {
    await openRecordDetailViaIndex(page, env, env.TEST_APP_ID_1, seedRecordId);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.waitForFunction(() => {
      const headerEl = kintone.app.record.getHeaderMenuSpaceElement();
      return !!(headerEl && headerEl.querySelector('.rrs-detail-button'));
    });
    await page.evaluate(() => {
      document.querySelector('.rrs-detail-button').click();
    });

    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.数値_2 && record.数値_2.value === String(expected);
      },
      { timeout: 30000 },
      expectedCount,
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(Number(record.数値_1.value)).toBeCloseTo(expectedSum);
    expect(Number(record.数値_2.value)).toBe(expectedCount);

    expect(pageErrors).toEqual([]);
  });
});
