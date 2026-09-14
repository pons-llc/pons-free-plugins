'use strict';

// レコード詳細画面での「コメント・変更履歴」⇔「モバイル版プレビュー」切り替えを検証する。
// 設定(config-screen.e2e.test.jsが保存した値)には依存せず、このテスト自身が冒頭で
// 既知の設定(初期表示=コメント・変更履歴、パネル幅=400px)をUI経由で保存してから検証する
// (budget_meter/src/e2e/budget-check.e2e.test.jsと同じ「他ファイルの実行順に依存しない」方針)。
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

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('レコード詳細画面(実環境, サイドパネル切り替え)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let appId;
  let recordId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    // TEST_APP_ID_1は検証環境の上限(20個)まで既に他プラグインが入っているため、
    // このプラグインはTEST_APP_ID_2で検証する。
    appId = env.TEST_APP_ID_2;
    await kintoneAdmin.ensurePluginAdded(env, appId, pluginId);

    const { records } = await kintoneAdmin.getRecords(env, appId, 'limit 1');
    if (records.length === 0) {
      throw new Error(
        `検証環境アプリ(${appId})にレコードが1件もありません。先にレコードを作成してください。`,
      );
    }
    recordId = records[0].$id.value;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // このテスト専用の既知の設定(初期表示=コメント・変更履歴、パネル幅=400px、対象アプリID=
    // このアプリ自身)を保存する(他ファイルのテスト実行順に依存しないよう、ここで独立に用意する)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.select('.js-default-view', 'NATIVE');
    await page.select('.js-default-native-state', 'COMMENTS');
    await page.evaluate(() => {
      document.querySelector('.js-panel-width').value = '';
    });
    await page.type('.js-panel-width', '400');
    await page.evaluate(() => {
      document.querySelector('.js-target-app-id').value = '';
    });
    await page.type('.js-target-app-id', String(appId));
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

  test('初期表示はコメント・変更履歴で、ボタンでモバイル版プレビューに切り替えられる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );

    // 初期表示: コメント・変更履歴(ネイティブのサイドバー)が開いており、切り替えボタンは
    // 「モバイル版を表示」ラベルになっている。
    await page.waitForSelector('.smv-toggle-button');
    const initialLabel = await page.$eval(
      '.smv-toggle-button',
      (el) => el.textContent,
    );
    expect(initialLabel).toBe('モバイル版を表示');

    const initialSideBarState = await page.evaluate(() =>
      kintone.app.record.getSideBarDisplayState(),
    );
    expect(initialSideBarState).toBe('COMMENTS');

    const panelHiddenInitially = await page.$eval(
      '#smv-panel',
      (el) => el.hidden,
    );
    expect(panelHiddenInitially).toBe(true);

    // ボタンをクリックしてモバイル版プレビューに切り替える。
    await page.click('.smv-toggle-button');
    await page.waitForFunction(
      () => document.getElementById('smv-panel').hidden === false,
    );

    const sideBarStateAfterToggle = await page.evaluate(() =>
      kintone.app.record.getSideBarDisplayState(),
    );
    expect(sideBarStateAfterToggle).toBe('CLOSED');

    const iframeSrc = await page.$eval('.smv-panel-iframe', (el) => el.src);
    expect(iframeSrc).toBe(
      `https://${env.KINTONE_DOMAIN}/k/m/${appId}/show?record=${recordId}`,
    );

    const panelWidth = await page.$eval('#smv-panel', (el) => el.style.width);
    expect(panelWidth).toBe('400px');

    const labelAfterToggle = await page.$eval(
      '.smv-toggle-button',
      (el) => el.textContent,
    );
    expect(labelAfterToggle).toBe('コメント・変更履歴を表示');

    // もう一度クリックしてコメント・変更履歴に戻す。
    await page.click('.smv-toggle-button');
    await page.waitForFunction(
      () => document.getElementById('smv-panel').hidden === true,
    );

    const sideBarStateAfterToggleBack = await page.evaluate(() =>
      kintone.app.record.getSideBarDisplayState(),
    );
    expect(sideBarStateAfterToggleBack).toBe('COMMENTS');

    expect(pageErrors).toEqual([]);
  });

  test('新規作成画面でも、ボタンでモバイル版プレビュー(このアプリの一覧)を表示できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 新規作成画面へは一覧画面から「追加」リンクをクリックして遷移する(field_encryptionの
    // encryption-flow.e2e.test.jsと同じ導線。kintone管理画面のSPA内部状態を正しく設定するため、
    // page.goto()での直接ハードナビゲーションは避ける)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    // 新規作成画面にはコメント・変更履歴が存在しないため、初期表示(NATIVE)ではパネルは
    // 非表示のまま、ボタンは単純な開閉ラベルになる(idea.md「新規作成画面」参照)。
    await page.waitForSelector('.smv-toggle-button');
    const initialLabel = await page.$eval(
      '.smv-toggle-button',
      (el) => el.textContent,
    );
    expect(initialLabel).toBe('モバイル版を表示');

    const panelHiddenInitially = await page.$eval(
      '#smv-panel',
      (el) => el.hidden,
    );
    expect(panelHiddenInitially).toBe(true);

    await page.click('.smv-toggle-button');
    await page.waitForFunction(
      () => document.getElementById('smv-panel').hidden === false,
    );

    // 新規作成画面にはまだレコードIDが存在しないため、レコード詳細ではなく
    // このアプリのモバイル版レコード一覧が表示される。
    const iframeSrc = await page.$eval('.smv-panel-iframe', (el) => el.src);
    expect(iframeSrc).toBe(`https://${env.KINTONE_DOMAIN}/k/m/${appId}/`);

    const labelAfterToggle = await page.$eval(
      '.smv-toggle-button',
      (el) => el.textContent,
    );
    expect(labelAfterToggle).toBe('モバイル版を閉じる');

    await page.click('.smv-toggle-button');
    await page.waitForFunction(
      () => document.getElementById('smv-panel').hidden === true,
    );

    expect(pageErrors).toEqual([]);
  });

  test('対象アプリIDを別アプリに変更すると、レコード詳細画面でもそのアプリのモバイル版一覧が表示される', async () => {
    const otherAppId = env.TEST_APP_ID_1;

    await common.openPluginConfig(page, env, appId, pluginId);
    await page.evaluate(() => {
      document.querySelector('.js-target-app-id').value = '';
    });
    await page.type('.js-target-app-id', String(otherAppId));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    try {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(
        `https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${recordId}`,
        { waitUntil: 'networkidle0' },
      );
      await page.waitForSelector('.smv-toggle-button');
      await page.click('.smv-toggle-button');
      await page.waitForFunction(
        () => document.getElementById('smv-panel').hidden === false,
      );

      // 現在のレコードID(このアプリのレコード)とは連動せず、対象アプリの一覧URLになる。
      const iframeSrc = await page.$eval('.smv-panel-iframe', (el) => el.src);
      expect(iframeSrc).toBe(
        `https://${env.KINTONE_DOMAIN}/k/m/${otherAppId}/`,
      );

      expect(pageErrors).toEqual([]);
    } finally {
      // 後続テスト・他プラグインのE2Eへ影響を残さないよう、対象アプリIDをこのアプリ自身に戻す。
      await common.openPluginConfig(page, env, appId, pluginId);
      await page.evaluate(() => {
        document.querySelector('.js-target-app-id').value = '';
      });
      await page.type('.js-target-app-id', String(appId));
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);
      await kintoneAdmin.deployApp(env, appId);
    }
  }, 120000);
});
