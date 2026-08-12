'use strict';

// 一覧画面ボタン → ダイアログ(kintone.createDialog)でのメーター表示までの実環境テスト。
// TEST_APP_ID_1は他プラグインのe2eテストとも共有しており、集計対象フィールド(数値_0)の値は
// 他プラグインのテスト実行によって変わりうるため、期待値をハードコードせず、REST APIで
// 独立に計算した合計値と突き合わせる(related_record_summaryのe2eテストと同じ方針)。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { VIEW_NAME, ensureBudgetMeterView } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TARGET_FIELD_CODE = '数値_0';
const BUDGET = 1000;
const LABEL = 'E2E予算';
const ALLOWED_GROUP_CODE = 'Administrators';

// 一覧画面はcalendar_view等、他プラグインが描画する要素が同じヘッダー領域に密集しており、
// Puppeteerのpage.click()(要素の可視座標にマウスイベントを送る)がそれらに遮られて
// 意図した要素をクリックできないことがある(実際に検証環境で確認済み。common.jsの
// openPluginConfig()のコメントにある「DOM要素のclick()を直接呼び出す」 workaroundと同種の問題)。
// そのため、DOM要素の.click()を直接呼び出す。
const clickElement = async (page, selector) => {
  const handle = await page.$(selector);
  await page.evaluate((el) => el.click(), handle);
};

const computeExpectedSum = async (env, appId, fieldCode) => {
  let total = 0;
  let lastId;
  for (;;) {
    const query = lastId
      ? `$id > ${lastId} order by $id asc limit 500`
      : 'order by $id asc limit 500';
    const { records } = await kintoneAdmin.getRecords(env, appId, query);
    for (let i = 0; i < records.length; i += 1) {
      const raw = records[i][fieldCode] ? records[i][fieldCode].value : '';
      const n = Number(raw);
      if (raw !== '' && !Number.isNaN(n)) {
        total += n;
      }
    }
    if (records.length < 500) {
      break;
    }
    lastId = records[records.length - 1].$id.value;
  }
  return total;
};

describe('一覧画面の予算確認ボタン(実環境)', () => {
  let browser;
  let page;
  let env;
  let appId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    appId = env.TEST_APP_ID_1;
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, appId, pluginId);
    const viewId = await ensureBudgetMeterView(env, appId, TARGET_FIELD_CODE);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // このテスト専用の予算設定(対象の一覧・フィールド・予算額)を保存する
    // (他ファイルのテスト実行順に依存しないよう、ここで独立に用意する)。
    await common.openPluginConfig(page, env, appId, pluginId);
    const rowCount = await page.$$eval('.js-row', (rows) => rows.length);
    if (rowCount === 0) {
      await page.click('#js-row-add');
    }
    await page.select('.js-row-view', String(viewId));
    await page.select('.js-row-field', TARGET_FIELD_CODE);
    await page.evaluate(
      (budget, label) => {
        const budgetEl = document.querySelector('.js-row-budget');
        budgetEl.value = String(budget);
        budgetEl.dispatchEvent(new Event('input', { bubbles: true }));
        const labelEl = document.querySelector('.js-row-label');
        labelEl.value = label;
        labelEl.dispatchEvent(new Event('input', { bubbles: true }));
      },
      BUDGET,
      LABEL,
    );
    await page.evaluate((groupCode) => {
      const el = document.querySelector('.js-all-views-group-codes');
      el.value = groupCode;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ALLOWED_GROUP_CODE);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存はプレビューにしか反映されないため、明示的にデプロイする
    // (project_plugin_config_needs_deploy.mdの注意点)。
    await kintoneAdmin.deployApp(env, appId);
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('対象の一覧では「予算を確認」ボタンが表示され、押すとメーターが合計値を表示する', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const expectedSum = await computeExpectedSum(env, appId, TARGET_FIELD_CODE);

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await common.selectView(page, VIEW_NAME);

    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bm-check-button'));
      },
      { timeout: 15000 },
    );

    await clickElement(page, '.bm-check-button');
    await page.waitForSelector('.bm-meter', { timeout: 15000 });

    const titleText = await page.$eval(
      '.bm-meter-title',
      (el) => el.textContent,
    );
    expect(titleText).toBe(LABEL);

    const valuesText = await page.$eval(
      '.bm-meter-values',
      (el) => el.textContent,
    );
    const expectedPercentage =
      Math.round((expectedSum / BUDGET) * 100 * 10) / 10;
    expect(valuesText).toBe(
      `${expectedSum.toLocaleString()} / ${BUDGET.toLocaleString()} (${expectedPercentage}%)`,
    );

    // ダイアログを閉じる(kintone.createDialog()のOKボタン。common.jsのコメント通り
    // name属性で特定する。実環境で確認済み)。
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button[name="ok"]');
      buttons[buttons.length - 1].click();
    });

    expect(pageErrors).toEqual([]);
  });

  test('対象外の一覧(すべて)では「予算を確認」ボタンは表示されないが、「すべての予算を確認」ボタンは表示される', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await common.selectView(page, '（すべて）');

    const buttons = await page.evaluate(() => {
      const el = kintone.app.getHeaderMenuSpaceElement();
      return {
        hasCheckButton: !!(el && el.querySelector('.bm-check-button')),
        hasAllButton: !!(el && el.querySelector('.bm-all-button')),
      };
    });
    expect(buttons.hasCheckButton).toBe(false);
    expect(buttons.hasAllButton).toBe(true);
  });

  test('「すべての予算を確認」ボタンを押すと、一覧に保存された絞り込み条件で集計したメーターが表示される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const expectedSum = await computeExpectedSum(env, appId, TARGET_FIELD_CODE);

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await common.selectView(page, '（すべて）');
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bm-all-button'));
      },
      { timeout: 15000 },
    );

    await clickElement(page, '.bm-all-button');
    await page.waitForSelector('.bm-meter', { timeout: 15000 });

    const titleText = await page.$eval(
      '.bm-meter-title',
      (el) => el.textContent,
    );
    expect(titleText).toBe(`${VIEW_NAME}: ${LABEL}`);

    const valuesText = await page.$eval(
      '.bm-meter-values',
      (el) => el.textContent,
    );
    const expectedPercentage =
      Math.round((expectedSum / BUDGET) * 100 * 10) / 10;
    expect(valuesText).toBe(
      `${expectedSum.toLocaleString()} / ${BUDGET.toLocaleString()} (${expectedPercentage}%)`,
    );

    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button[name="ok"]');
      buttons[buttons.length - 1].click();
    });

    expect(pageErrors).toEqual([]);
  });
});
