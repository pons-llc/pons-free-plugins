'use strict';

// 設定画面の回帰確認。バックアップ方式の切り替えでアーカイブ設定欄の表示/非表示が実際に
// 切り替わること、「フィールドを取得」ボタンでプルダウンの選択肢が実際に絞り込まれること
// (JSON保存先は文字列系のみ・添付ファイル保存先はFILE型のみ)を確認する。CLAUDE.mdの開発方針1
// (kintone.app.getFormFields()等の戻り値の落とし穴)と同種の、静的HTML・単体テストでは
// 検知できない回帰を防ぐのが目的。
//
// このテストはSaveを押さないため、既存の保存済み設定を書き換えない
// (delete-*-flow.e2e.test.jsが実行順序に依存せず動くよう、各flowテストが自分で必要な設定を
// 保存する設計にしている)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { DBACK_ARCHIVE_APP_ID, ensureArchiveAppFields } = require('./fixtures');

const PLUGIN_NAME = 'delete_backup';
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
    await ensureArchiveAppFields(env, DBACK_ARCHIVE_APP_ID);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('バックアップ方式の切り替えとフィールド取得で選択肢が絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('削除バックアッププラグイン');

    // デフォルトはzip方式で、アーカイブ設定欄は非表示。
    expect(await page.$eval('.js-archive-section', (el) => el.hidden)).toBe(
      true,
    );

    // アーカイブ方式に切り替えると設定欄が表示される。
    await page.click('.js-mode-archive');
    expect(await page.$eval('.js-archive-section', (el) => el.hidden)).toBe(
      false,
    );

    // zip方式に戻すと再び非表示になる。
    await page.click('.js-mode-zip');
    expect(await page.$eval('.js-archive-section', (el) => el.hidden)).toBe(
      true,
    );
    await page.click('.js-mode-archive');

    // アーカイブ先アプリIDに専用テストアプリを入力してフィールドを取得する。
    await page.evaluate((appId) => {
      document.querySelector('.js-archive-app-id').value = appId;
    }, DBACK_ARCHIVE_APP_ID);
    await page.click('.js-fetch-fields');
    await page.waitForFunction(
      () => document.querySelector('.js-json-field').options.length > 1,
    );

    // JSON保存先: 文字列系のみ(fixtures.jsで用意したdback_archive_jsonを含み、
    // FILE型のdback_archive_filesは含まれない)。
    const jsonFieldOptionValues = await page.$$eval(
      '.js-json-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(jsonFieldOptionValues).toContain('dback_archive_json');
    expect(jsonFieldOptionValues).not.toContain('dback_archive_files');

    // 添付ファイル保存先: FILE型のみ。
    const attachmentFieldOptionValues = await page.$$eval(
      '.js-attachment-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(attachmentFieldOptionValues).toContain('dback_archive_files');
    expect(attachmentFieldOptionValues).not.toContain('dback_archive_json');

    expect(await page.$eval('.js-json-field', (el) => el.disabled)).toBe(false);
    expect(await page.$eval('.js-attachment-field', (el) => el.disabled)).toBe(
      false,
    );

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
    expect(pageErrors).toEqual([]);
  });
});
