'use strict';

// 設定画面: 保存で依頼アプリにフィールド・スペースが作成され、プロセス管理(既定の承認フロー)がONになり、
// 運用環境へ反映されることを実環境で確認する。公開サイト用の設定画面スクリーンショットもここで撮る。
//
// 事前準備: pnpm run build のうえ cli-kintone plugin upload で検証環境へアップロード済みであること。
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const FieldDefs = require('../js/lib/field-defs.js');
const { REQUEST_APP_ID } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

let browser;
let page;
let env;
let repoRoot;
let pluginId;
const pageErrors = [];
const alerts = [];

const openConfig = async () => {
  await common.openPluginConfig(page, env, REQUEST_APP_ID, pluginId);
  await page.waitForSelector('#js-field-status[data-loaded="1"]', {
    timeout: 30000,
  });
};

describe('設定画面(実環境)', () => {
  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, REQUEST_APP_ID, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、保存時に行う内容と承認経路の注意書きが表示される', async () => {
    await openConfig();
    const value = await page.$eval('.js-complete-status', (el) => el.value);
    expect(value).toBe('完了');
    const fieldStatus = await page.$eval(
      '#js-field-status',
      (el) => el.textContent,
    );
    expect(fieldStatus).toMatch(/フィールド:/);
    const processStatus = await page.$eval(
      '#js-process-status',
      (el) => el.textContent,
    );
    expect(processStatus).toMatch(/プロセス管理:/);
    const notice = await page.$eval('.asr-notice', (el) => el.textContent);
    expect(notice).toContain('承認経路');
    expect(notice).toContain('アプリ管理権限');

    await common.screenshot(
      page,
      repoRoot,
      'app_settings_request',
      'config-screen',
    );
    expect(pageErrors).toEqual([]);
  }, 120000);

  test('完了ステータス名が空なら保存しない', async () => {
    await openConfig();
    await page.$eval('.js-complete-status', (el) => {
      el.value = '';
    });
    await page.$eval('.kintoneplugin-button-dialog-ok', (el) => el.click());
    await page.waitForFunction(
      () => document.getElementById('js-errors').textContent !== '',
    );
    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain('完了ステータス名を入力してください');
    expect(page.url()).toContain('plugin/config');
    expect(pageErrors).toEqual([]);
  }, 120000);

  test('保存するとフィールド・スペース・プロセス管理が作成され運用環境へ反映される', async () => {
    await openConfig();
    alerts.length = 0;
    await Promise.all([
      page.waitForFunction(() => location.href.includes('/flow'), {
        timeout: 180000,
      }),
      page.$eval('.kintoneplugin-button-dialog-ok', (el) => el.click()),
    ]);
    expect(alerts.some((m) => m.includes('プラグインの設定を保存'))).toBe(true);

    // 運用環境に反映されていることをREST(運用環境)で確認する。
    const fields = await kintoneAdmin.getFormFields(env, REQUEST_APP_ID);
    FieldDefs.FIELD_DEFINITIONS.forEach((def) => {
      expect(fields[def.code]).toBeDefined();
    });
    const layout = await kintoneAdmin.request(
      env,
      '/k/v1/app/form/layout.json',
      'GET',
      { app: REQUEST_APP_ID },
    );
    expect(
      FieldDefs.hasSpacer(layout.layout, FieldDefs.SPACER_ELEMENT_ID),
    ).toBe(true);
    const status = await kintoneAdmin.request(
      env,
      '/k/v1/app/status.json',
      'GET',
      { app: REQUEST_APP_ID },
    );
    expect(status.enable).toBe(true);
    expect(Object.keys(status.states)).toContain('完了');
    expect(status.actions.some((a) => a.to === '完了')).toBe(true);
    expect(pageErrors).toEqual([]);
  }, 240000);

  test('2回目の保存は既存の設定を壊さない(冪等)', async () => {
    const before = await kintoneAdmin.request(
      env,
      '/k/v1/app/status.json',
      'GET',
      { app: REQUEST_APP_ID },
    );
    await openConfig();
    const processStatus = await page.$eval(
      '#js-process-status',
      (el) => el.textContent,
    );
    expect(processStatus).toContain('ONで、完了ステータスがあります');
    await Promise.all([
      page.waitForFunction(() => location.href.includes('/flow'), {
        timeout: 180000,
      }),
      page.$eval('.kintoneplugin-button-dialog-ok', (el) => el.click()),
    ]);
    const after = await kintoneAdmin.request(
      env,
      '/k/v1/app/status.json',
      'GET',
      { app: REQUEST_APP_ID },
    );
    expect(after.states).toEqual(before.states);
    expect(after.actions).toEqual(before.actions);
    expect(pageErrors).toEqual([]);
  }, 240000);
});
