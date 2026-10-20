'use strict';

// 設定画面: getFormFields()/getFormLayout()から候補(文字列(複数行)・スペース)が描画されること、
// 未選択での保存がエラーになること(保存されない)を確認し、公開サイト用のスクリーンショットを撮る。
//
// 事前準備: pnpm run build && cli-kintone plugin upload(.env設定済み)
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'genogram';
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
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_2, pluginId);
    await fixtures.ensureFixtures(env, env.TEST_APP_ID_2);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);
  }, 180000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('候補が描画され、未選択では保存できない', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_2, pluginId);
    await page.waitForSelector(
      `#js-json-field option[value="${fixtures.JSON_FIELD}"]`,
      { timeout: 15000 },
    );

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('ジェノグラム作成プラグイン');

    const textOptions = await page.$$eval('#js-json-field option', (els) =>
      els.map((el) => el.value),
    );
    // 文字列(複数行)だけが候補(文字列(1行)は入らない)
    expect(textOptions).toContain(fixtures.JSON_FIELD);
    expect(textOptions).not.toContain('文字列__1行_');
    const spaceOptions = await page.$$eval('#js-space option', (els) =>
      els.map((el) => el.value),
    );
    expect(spaceOptions).toContain(fixtures.SPACE_ID);
    expect(await page.$eval('#js-no-text-warning', (el) => el.hidden)).toBe(
      true,
    );

    // 未選択で保存 → エラー表示、画面は遷移しない
    await page.select('#js-json-field', '');
    await page.select('#js-space', '');
    await page.$eval('.js-save-button', (el) => el.click());
    const error = await page.$eval('#js-errors', (el) => ({
      hidden: el.hidden,
      text: el.textContent,
    }));
    expect(error.hidden).toBe(false);
    expect(error.text).toContain('データを保存するフィールド');
    expect(error.text).toContain('スペースフィールド');
    expect(page.url()).toContain('plugin/config');

    // スクリーンショット用に、選択済みの状態にする(保存はしない)
    await page.$eval('#js-errors', (el) => {
      el.hidden = true;
    });
    await page.select('#js-json-field', fixtures.JSON_FIELD);
    await page.select('#js-space', fixtures.SPACE_ID);

    expect(pageErrors).toEqual([]);
    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
