'use strict';

// 設定画面で実際に値を入力して保存し、リロード後も内容が保持されることを確認するテスト。
// 対象アプリ(TEST_APP_ID_1)には buka(ドロップダウン)/ seiban(採番結果保存用) フィールドが
// 必要で、fixtures.js の ensureTargetAppFields() が冪等に用意する。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_NAME = 'fiscal_year_numbering';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const COUNTER_APP_ID = process.env.FYN_COUNTER_APP_ID || '572';

describe('設定画面(保存とリロード後の永続化)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('セグメント・番号フィールド・カウンターアプリIDを設定して保存できる', async () => {
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    // セグメント追加: buka フィールドを選び、選択肢ごとの表示文字列を上書きする
    await page.select('.js-segment-field-picker', 'buka');
    await page.click('#js-segment-add');
    const overrideInputs = await page.$$('.js-segment-options input[type="text"]');
    expect(overrideInputs.length).toBe(2); // soumu / keiri の2択
    await overrideInputs[0].type('総務課');
    await overrideInputs[1].type('経理課');

    // 番号フォーマット
    await page.select('.js-number-field', 'seiban');
    await page.evaluate(() => {
      document.querySelector('.js-separator').value = '-';
      document.querySelector('.js-sequence-digits').value = '4';
    });

    // カウンター専用アプリ・一括採番グループ
    await page.evaluate((counterAppId) => {
      document.querySelector('.js-counter-app-id').value = counterAppId;
      document.querySelector('.js-bulk-group-code').value = 'kanri_group';
    }, COUNTER_APP_ID);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // 保存後、設定画面を開き直して内容が保持されているか確認する
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const numberFieldValue = await page.$eval('.js-number-field', (el) => el.value);
    expect(numberFieldValue).toBe('seiban');

    const counterAppIdValue = await page.$eval('.js-counter-app-id', (el) => el.value);
    expect(counterAppIdValue).toBe(COUNTER_APP_ID);

    const bulkGroupCodeValue = await page.$eval('.js-bulk-group-code', (el) => el.value);
    expect(bulkGroupCodeValue).toBe('kanri_group');

    const segmentTitle = await page.$eval('.js-segment-title', (el) => el.textContent);
    expect(segmentTitle).toContain('buka');

    const overrideValuesAfterReload = await page.$$eval(
      '.js-segment-options input[type="text"]',
      (inputs) => inputs.map((i) => i.value)
    );
    expect(overrideValuesAfterReload).toEqual(['総務課', '経理課']);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen-configured');
  });
});
