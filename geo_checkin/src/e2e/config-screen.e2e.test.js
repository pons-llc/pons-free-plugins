'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && (cli-kintone plugin upload等で)このプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e
//
// このテストの主眼は「緯度」「経度」プルダウンが実際に数値フィールドのみに絞り込まれること
// (config.js冒頭のNUMBER型フィルタが実際に効いているかの回帰確認、CLAUDE.mdの既知の落とし穴参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_NAME = 'geo_checkin';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境)', () => {
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
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、緯度・経度プルダウンが数値フィールドのみに絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('位置情報強制登録プラグイン');

    const latOptionValues = await page.$$eval(
      '#js-latitude-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(latOptionValues).toContain('geoc_lat');
    expect(latOptionValues).toContain('geoc_lng');
    expect(latOptionValues).not.toContain('文字列__1行_');

    const lngOptionValues = await page.$$eval(
      '#js-longitude-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(lngOptionValues).toContain('geoc_lat');
    expect(lngOptionValues).toContain('geoc_lng');

    await page.select('#js-latitude-field', 'geoc_lat');
    await page.select('#js-longitude-field', 'geoc_lng');
    const showMapCheckbox = await page.$('#js-show-map');
    const isChecked = await showMapCheckbox.evaluate((el) => el.checked);
    if (!isChecked) {
      await showMapCheckbox.click();
    }

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });

  test('緯度・経度に同じフィールドを選ぶと保存前バリデーションでエラーが表示される', async () => {
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    await page.select('#js-latitude-field', 'geoc_lat');
    await page.select('#js-longitude-field', 'geoc_lat');
    await page.click('.kintoneplugin-button-dialog-ok');

    await page.waitForFunction(
      () => document.getElementById('js-errors').textContent.length > 0,
    );
    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain(
      '緯度フィールドと経度フィールドには異なるフィールドを選択してください。',
    );
  });
});
