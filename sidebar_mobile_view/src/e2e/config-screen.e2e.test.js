'use strict';

// このプラグイン固有のPuppeteerテスト。設定画面で実際に値を入力して保存し、リロード後も
// 内容が保持されることを確認する(fiscal_year_numbering/src/e2e/config-save.e2e.test.jsと
// 同じ方針)。加えてバリデーションエラー時に保存されないことも確認する。
// 公開サイト用のスクリーンショットはこのテストの最後で1枚撮る(e2e-testスキルの方針)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_2 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'sidebar_mobile_view';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let appId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    // TEST_APP_ID_1は検証環境の上限(20個)まで既に他プラグインが入っているため、
    // このプラグインはTEST_APP_ID_2で検証する。
    appId = env.TEST_APP_ID_2;
    // 新規プラグインのため、初回実行時はTEST_APP_ID_2にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, appId, pluginId);

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

  test('設定画面を開くと対象アプリIDが自動入力され、保存後もリロードで内容が保持される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, appId, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('サイドパネルモバイル表示プラグイン');

    // 対象アプリIDが未設定の場合、現在のアプリID(=appId)が自動的に補完されることを確認する
    // (ユーザー要望「設定画面で初期のアプリIDを指定する」への対応、idea.md参照)。
    const initialTargetAppId = await page.$eval(
      '.js-target-app-id',
      (el) => el.value,
    );
    expect(initialTargetAppId).toBe(String(appId));

    // 値を変更して保存する。
    await page.select('.js-default-view', 'IFRAME');
    await page.select('.js-default-native-state', 'HISTORY');
    await page.evaluate(() => {
      document.querySelector('.js-panel-width').value = '';
    });
    await page.type('.js-panel-width', '500');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // 保存後、設定画面を開き直して内容が保持されているか確認する。
    await common.openPluginConfig(page, env, appId, pluginId);

    expect(await page.$eval('.js-default-view', (el) => el.value)).toBe(
      'IFRAME',
    );
    expect(await page.$eval('.js-default-native-state', (el) => el.value)).toBe(
      'HISTORY',
    );
    expect(await page.$eval('.js-panel-width', (el) => el.value)).toBe('500');
    expect(await page.$eval('.js-target-app-id', (el) => el.value)).toBe(
      String(appId),
    );

    expect(pageErrors).toEqual([]);
  });

  test('パネル幅が許容範囲外の場合はエラーが表示され保存されない', async () => {
    await common.openPluginConfig(page, env, appId, pluginId);

    await page.evaluate(() => {
      document.querySelector('.js-panel-width').value = '';
    });
    await page.type('.js-panel-width', '50'); // 240未満で不正

    await page.click('.kintoneplugin-button-dialog-ok');
    // バリデーションエラー時は画面遷移しない(waitForNavigationを使わずURLが変わらないことを確認)。
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(page.url()).toContain('plugin/config');

    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain('240');

    // 元に戻す(後続テスト・他プラグインのE2Eへ影響を残さないため正常値へ復旧する)。
    await page.evaluate(() => {
      document.querySelector('.js-panel-width').value = '';
    });
    await page.type('.js-panel-width', '400');
    await page.select('.js-default-view', 'NATIVE');
    await page.select('.js-default-native-state', 'COMMENTS');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // 保存後は`../../flow?app=...`(アプリ設定画面)へ遷移してしまうため、公開サイト用の
    // スクリーンショットは撮り直しでプラグイン設定画面自体を開いてから撮る。
    await common.openPluginConfig(page, env, appId, pluginId);
    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
