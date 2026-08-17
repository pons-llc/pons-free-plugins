'use strict';

// アプリ間突合プラグインの実環境E2E。
//
// 単体テスト(src/__tests__)では突合ロジックそのものを検証しているので、ここでは
// 「実際のkintone上でしか壊れ方が分からない」ところだけを通しで確認する。
//   - 設定画面から集計用フィールド(サブテーブル + 添付ファイル + スペース)をAPIで作れるか
//     → サブテーブルの中に添付ファイルフィールドを作れるか、を実地で確かめるのが主目的
//   - 保存した設定が詳細画面で読めるか(setConfigはデプロイまで反映されない既知事項)
//   - 「突合を実行」でJSONが添付され、履歴テーブルに1行増えるか
//   - 未提出者が画面に「未提出」として出るか
//   - 2回実行しても上書きされず履歴が2行になるか(追記スナップショット方式)

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'cross_app_check';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const {
  CAC_BASE_APP_ID,
  CAC_TARGET_APP_ID,
  CAC_SUMMARY_APP_ID,
  KEY_FIELD,
  NAME_FIELD,
  DATE_FIELD,
  EXPECTED,
} = fixtures;

describe('アプリ間突合プラグイン(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let summaryRecordId;
  const pageErrors = [];
  const consoleErrors = [];

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);

    await fixtures.ensureBaseAppFields(env);
    await fixtures.ensureTargetAppFields(env);
    await fixtures.resetRecords(env);
    await kintoneAdmin.ensurePluginAdded(env, CAC_SUMMARY_APP_ID, pluginId);
    summaryRecordId = await fixtures.resetSummaryRecord(env);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    // 既定の800px幅だと設定画面の右側(説明文や「フィールドを読み込む」ボタン)が
    // 見切れて公開サイト用のスクリーンショットに使えないため、明示的に広げる
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // レコード詳細画面は下方向に余白が長く続くため、ページ全体ではなく
  // 「実際に中身がある範囲」だけを切り出して公開サイト用のスクリーンショットにする。
  const screenshotRegion = async (label) => {
    const bottom = await page.evaluate(() => {
      const view = document.querySelector('.cac-view');
      return Math.ceil(view.getBoundingClientRect().bottom + window.scrollY);
    });
    const dir = path.join(
      repoRoot,
      'site',
      'plugins',
      PLUGIN_NAME,
      'screenshots',
    );
    await page.setViewport({ width: 1280, height: bottom + 24 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(dir, `${label}.png`) });
    await page.setViewport({ width: 1280, height: 900 });
  };

  test('設定画面で集計用フィールドを作成し、突合設定を保存できる', async () => {
    await common.openPluginConfig(page, env, CAC_SUMMARY_APP_ID, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('アプリ間突合プラグイン');

    // 集計用フィールドの状態確認が終わるまで待つ
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.js-schema-status')
          .textContent.includes('確認中'),
      { timeout: 30000 },
    );

    // 「集計用フィールドを作成」は確認ダイアログを出すので自動で承諾する
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    const alreadyCreated = await page.$eval(
      '.js-schema-create',
      (el) => el.disabled,
    );
    if (!alreadyCreated) {
      await page.click('.js-schema-create');
      await page.waitForFunction(
        () =>
          document
            .querySelector('.js-schema-status')
            .textContent.includes('作成済み'),
        { timeout: 120000 },
      );
    }

    // サブテーブルの中に添付ファイルフィールドが実際に作られたことをAPIで確認する
    const properties = await kintoneAdmin.getFormFields(
      env,
      CAC_SUMMARY_APP_ID,
    );
    expect(properties.cac_runs).toBeDefined();
    expect(properties.cac_runs.type).toBe('SUBTABLE');
    expect(properties.cac_runs.fields.cac_run_file.type).toBe('FILE');
    expect(properties.cac_runs.fields.cac_run_id.type).toBe('SINGLE_LINE_TEXT');

    // 結果表示用のスペースがレイアウトに入っていること
    const { layout } = await kintoneAdmin.getFormLayout(
      env,
      CAC_SUMMARY_APP_ID,
    );
    const hasSpacer = JSON.stringify(layout).includes('cac_view');
    expect(hasSpacer).toBe(true);

    // 基準アプリを設定
    await page.evaluate((appId) => {
      document.querySelector('.js-base-app-id').value = appId;
    }, CAC_BASE_APP_ID);
    await page.click('.js-base-app-fetch');
    await page.waitForFunction(
      () =>
        document
          .querySelector('.js-base-app-status')
          .textContent.includes('読み込みました'),
      { timeout: 30000 },
    );
    await page.select('.js-base-key-field', KEY_FIELD);
    await page.select('.js-base-name-field', NAME_FIELD);

    // 対象アプリを設定
    await page.evaluate((appId) => {
      document.querySelector('.js-target-app-id').value = appId;
    }, CAC_TARGET_APP_ID);
    await page.click('.js-target-app-fetch');
    await page.waitForFunction(
      () =>
        document
          .querySelector('.js-target-app-status')
          .textContent.includes('読み込みました'),
      { timeout: 30000 },
    );
    await page.select('.js-target-key-field', KEY_FIELD);
    await page.select('.js-target-date-field', DATE_FIELD);
    await page.evaluate(() => {
      document.querySelector('.js-target-label').value = '面談';
    });

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    await common.savePluginConfig(page);

    // setConfig()は動作テスト環境にしか反映されないため、詳細画面から読めるようデプロイする
    await kintoneAdmin.deployApp(env, CAC_SUMMARY_APP_ID);
  });

  test('詳細画面で突合を実行すると、履歴が1行増えて未提出者が表示される', async () => {
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${CAC_SUMMARY_APP_ID}/show#record=${summaryRecordId}`,
      { waitUntil: 'networkidle2' },
    );

    // 未実行のうちは案内メッセージが出ている
    await page.waitForSelector('.cac-view', { timeout: 30000 });
    const initialMessage = await page.$eval(
      '.cac-message',
      (el) => el.textContent,
    );
    expect(initialMessage).toContain('まだ突合を実行していません');

    await page.waitForSelector('#cac-run-button', { timeout: 30000 });
    await page.click('#cac-run-button');

    // 実行が終わると結果テーブルが描画される
    await page.waitForSelector('.cac-table', { timeout: 120000 });

    // 履歴テーブルに1行入り、結果JSONが添付されていること
    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: CAC_SUMMARY_APP_ID,
      id: summaryRecordId,
    });
    const rows = record.record.cac_runs.value;
    expect(rows).toHaveLength(1);
    expect(rows[0].value.cac_run_file.value).toHaveLength(1);
    expect(rows[0].value.cac_run_file.value[0].name).toMatch(/\.json$/);
    expect(rows[0].value.cac_run_summary.value).toBe(
      `対象${EXPECTED.baseCount}件 / 未提出${EXPECTED.unsubmitted}件`,
    );

    // 画面のサマリが期待どおりか
    const summaryText = await page.$eval(
      '.cac-summary',
      (el) => el.textContent,
    );
    expect(summaryText).toContain(`対象者 ${EXPECTED.baseCount} 件`);
    expect(summaryText).toContain(`いずれか未提出 ${EXPECTED.unsubmitted} 件`);
    expect(summaryText).toContain(
      `面談: 提出済 ${EXPECTED.submitted} / 未提出 ${EXPECTED.unsubmitted}`,
    );

    // 全4行が出ていて、未提出の人が「未提出」になっている
    const tableRows = await page.$$eval('.cac-tr', (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('.cac-td')).map((td) =>
          td.textContent.trim(),
        ),
      ),
    );
    expect(tableRows).toHaveLength(EXPECTED.baseCount);

    const byName = {};
    tableRows.forEach((cells) => {
      byName[cells[1]] = cells;
    });
    EXPECTED.unsubmittedNames.forEach((name) => {
      expect(byName[name][2]).toBe('未提出');
    });
    EXPECTED.submittedNames.forEach((name) => {
      expect(byName[name][2]).toContain('提出済');
    });
    // 同じキーで2件出している人は件数付きで、最終提出日が最新の日付になる
    expect(byName['山田花子'][2]).toBe('提出済(2件)');
    expect(byName['山田花子'][3]).toBe(EXPECTED.lastDateOfA001);

    // 対象アプリにしか居ない X-999 は母集団(基準アプリ)に居ないので行にならない
    const keys = tableRows.map((cells) => cells[0]);
    expect(keys).not.toContain('X-999');

    // 実行直後は結果ビューワだけが更新され、レコード上の「突合履歴」テーブルは
    // 再読み込みするまで古い(空の)ままになる。その旨が画面に出ていること。
    const doneMessage = await page.$eval(
      '.cac-message',
      (el) => el.textContent,
    );
    expect(doneMessage).toContain('突合を実行しました');
    expect(doneMessage).toContain('再読み込み');

    // 公開サイト用のスクリーンショットは、履歴テーブルにも行が入った状態にしたいので
    // 再読み込みしてから撮る(このプラグインの主役は結果の見える化なので、設定画面だけでは伝わらない)
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.cac-table', { timeout: 60000 });
    // common.screenshot()はページ全体を撮るため、レコード詳細画面だと結果の下に
    // 巨大な余白が入って公開サイトでは使いづらい。ここは結果部分だけを切り出して撮る。
    await screenshotRegion('result-view');
  });

  test('「未提出のみ表示」で未提出者だけに絞り込める', async () => {
    // page.click()はkintoneの固定ヘッダー/フッターに遮られて空振りすることがあるため、
    // 既存プラグインのE2Eと同じくDOMのclick()を直接呼ぶ(scripts/e2e/common.jsのopenPluginConfig参照)
    await page.$eval('.cac-unsubmitted-only', (el) => el.click());
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.cac-tr').length === expected,
      { timeout: 10000 },
      EXPECTED.unsubmitted,
    );

    const names = await page.$$eval('.cac-tr', (trs) =>
      trs.map((tr) => tr.querySelectorAll('.cac-td')[1].textContent.trim()),
    );
    expect(names.sort()).toEqual(EXPECTED.unsubmittedNames.slice().sort());

    // page.click()はkintoneの固定ヘッダー/フッターに遮られて空振りすることがあるため、
    // 既存プラグインのE2Eと同じくDOMのclick()を直接呼ぶ(scripts/e2e/common.jsのopenPluginConfig参照)
    await page.$eval('.cac-unsubmitted-only', (el) => el.click());
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.cac-tr').length === expected,
      { timeout: 10000 },
      EXPECTED.baseCount,
    );
  });

  test('もう一度実行すると上書きされず履歴が2行になる(追記スナップショット)', async () => {
    await page.click('#cac-run-button');

    // 履歴が2件になるまで待つ(ドロップダウンの選択肢の数で判定)
    await page.waitForFunction(
      () => document.querySelectorAll('.cac-run-select option').length === 2,
      { timeout: 120000 },
    );

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: CAC_SUMMARY_APP_ID,
      id: summaryRecordId,
    });
    const rows = record.record.cac_runs.value;
    expect(rows).toHaveLength(2);
    // 1回目の結果ファイルが消えていないこと
    expect(rows[0].value.cac_run_file.value).toHaveLength(1);
    expect(rows[1].value.cac_run_file.value).toHaveLength(1);
    expect(rows[0].value.cac_run_id.value).not.toBe(
      rows[1].value.cac_run_id.value,
    );
  });

  test('ドロップダウンで過去の実行結果に切り替えられる', async () => {
    const options = await page.$$eval('.cac-run-select option', (opts) =>
      opts.map((opt) => opt.value),
    );
    expect(options).toHaveLength(2);

    await page.select('.cac-run-select', options[1]);
    await page.waitForSelector('.cac-table', { timeout: 30000 });

    const tableRows = await page.$$eval('.cac-tr', (trs) => trs.length);
    expect(tableRows).toBe(EXPECTED.baseCount);
  });

  test('コンソールエラーが出ていない', () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
