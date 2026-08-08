'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e
//
// このテストの主眼は、対象フィールド一覧が「値の登録・更新ができない/テーブル/組織選択・
// ユーザー選択・グループ選択/添付ファイル/ルックアップのコピー先」を正しく除外していること、
// ルックアップフィールド自体は対象に含まれ種類欄で見分けが付くこと(静的HTML・単体テストでは
// 検知できない。CLAUDE.mdの開発方針1参照)、必須フィールドに「必須」バッジが表示されること、
// 対象フィールドのON/OFFが保存後も読み直せることの確認。値そのものはこの設定画面では扱わない
// (実行のたびに確認ダイアログで入力する設計、idea.md参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'bulk_field_update';
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
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  const findRow = async (fieldCodeFragment) => {
    const rows = await page.$$('.js-row');
    for (const row of rows) {
      const label = await row.$eval(':nth-child(2)', (el) => el.textContent);
      if (label.includes(fieldCodeFragment)) {
        return row;
      }
    }
    throw new Error(`row not found: ${fieldCodeFragment}`);
  };

  const expectTypeColumnContains = async (fieldCodeFragment, substring) => {
    const row = await findRow(fieldCodeFragment);
    const text = await row.$eval(':nth-child(3)', (el) => el.textContent);
    expect(text).toContain(substring);
  };

  test('対象外フィールドが除外され、必須フィールドにはバッジが付き、ON/OFFが保存後も読み直せる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('特定フィールド一括更新プラグイン');

    // 対象フィールド一覧: ラベル文字列(コード付き)の集合を取得する。
    const rowLabels = await page.$$eval('.js-row', (rows) =>
      rows.map((row) => row.children[1].textContent),
    );
    // テーブル・組織選択・ユーザー選択・グループ選択・ルックアップのコピー先・自動採番系は
    // 含まれない。
    expect(rowLabels.some((l) => l.includes('テーブル'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('組織選択'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('ユーザー選択'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('グループ選択'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('(ne_lookup_out)'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('レコード番号'))).toBe(false);
    // 対象にできる通常フィールドは含まれる。
    expect(rowLabels.some((l) => l.includes('(文字列__1行__0)'))).toBe(true);
    expect(rowLabels.some((l) => l.includes('(チェックボックス)'))).toBe(true);
    // ルックアップフィールド自体は対象に含まれる(現在の値のまま更新して関連レコードを
    // 再取得する用途、idea.md「ルックアップフィールドの再取得」参照)。
    expect(rowLabels.some((l) => l.includes('(ne_lookup)'))).toBe(true);

    // ラジオボタン(このアプリではrequired:trueに設定済み)の行に「必須」バッジが付く。
    const radioRow = await findRow('(ラジオボタン)');
    const radioLabelHtml = await radioRow.$eval(
      ':nth-child(2)',
      (el) => el.innerHTML,
    );
    expect(radioLabelHtml).toContain('必須');

    // ルックアップフィールドの種類欄は「ルックアップ」を含み、通常の文字列(1行)と見分けが付く。
    await expectTypeColumnContains('(ne_lookup)', 'ルックアップ');

    // 文字列(1行)・チェックボックスフィールドをONにする。他のテストの実行順序によって
    // 既にON/OFFの状態が残っていることがあるため、.click()(トグル)ではなく
    // .checked = trueを直接設定して冪等にする。
    const textRow = await findRow('(文字列__1行__0)');
    await textRow.$eval('.js-row-enabled', (el) => {
      el.checked = true;
    });
    const checkboxRow = await findRow('(チェックボックス)');
    await checkboxRow.$eval('.js-row-enabled', (el) => {
      el.checked = true;
    });
    // ラジオボタンは今回のテスト対象外のためOFFに揃える。
    const radioRowForSetup = await findRow('(ラジオボタン)');
    await radioRowForSetup.$eval('.js-row-enabled', (el) => {
      el.checked = false;
    });

    await page.evaluate(() => {
      document.querySelector('.js-group-codes').value = 'Administrators';
    });

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const reloadedTextRow = await findRow('(文字列__1行__0)');
    const reloadedTextEnabled = await reloadedTextRow.$eval(
      '.js-row-enabled',
      (el) => el.checked,
    );
    expect(reloadedTextEnabled).toBe(true);

    const reloadedCheckboxRow = await findRow('(チェックボックス)');
    const reloadedCheckboxEnabled = await reloadedCheckboxRow.$eval(
      '.js-row-enabled',
      (el) => el.checked,
    );
    expect(reloadedCheckboxEnabled).toBe(true);

    const reloadedRadioRow = await findRow('(ラジオボタン)');
    const reloadedRadioEnabled = await reloadedRadioRow.$eval(
      '.js-row-enabled',
      (el) => el.checked,
    );
    expect(reloadedRadioEnabled).toBe(false);
  });
});
