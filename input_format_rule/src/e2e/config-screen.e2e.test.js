'use strict';

// 設定画面で実際にルールを追加・保存し、リロード後も内容が保持されることを確認する。
// また、バリデーションエラー時に保存されないことも確認する
// (fiscal_year_numbering/src/e2e/config-save.e2e.test.jsと同じ方針)。
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

const PLUGIN_NAME = 'input_format_rule';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TARGET_FIELD_CODE = '文字列__1行_';

// 既存のルール行をすべて削除する(他の実行・過去の失敗テストが残した行に依存しないため)。
const removeAllRules = async (page) => {
  for (;;) {
    const removeEl = await page.$('.js-rule-remove');
    if (!removeEl) {
      break;
    }
    await removeEl.click();
  }
};

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

  test('ルールを追加して保存でき、リロード後も内容が保持される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, appId, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('入力規則プラグイン');

    await removeAllRules(page);
    await page.click('#js-rule-add');

    const ruleRow = await page.$('.js-rule-row');
    expect(ruleRow).not.toBeNull();

    const fieldOptionValues = await ruleRow.$$eval(
      '.js-rule-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(fieldOptionValues).toContain(TARGET_FIELD_CODE);

    await (await ruleRow.$('.js-rule-field')).select(TARGET_FIELD_CODE);
    await (
      await ruleRow.$('.js-rule-forbid[data-type="halfWidthAlnum"]')
    ).click();
    await (
      await ruleRow.$('.js-rule-forbid[data-type="fullWidthSymbol"]')
    ).click();

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // 保存後、設定画面を開き直して内容が保持されているか確認する。
    await common.openPluginConfig(page, env, appId, pluginId);
    const reopenedRow = await page.$('.js-rule-row');
    expect(await reopenedRow.$eval('.js-rule-field', (el) => el.value)).toBe(
      TARGET_FIELD_CODE,
    );
    expect(
      await reopenedRow.$eval(
        '.js-rule-forbid[data-type="halfWidthAlnum"]',
        (el) => el.checked,
      ),
    ).toBe(true);
    expect(
      await reopenedRow.$eval(
        '.js-rule-forbid[data-type="fullWidthSymbol"]',
        (el) => el.checked,
      ),
    ).toBe(true);
    expect(
      await reopenedRow.$eval(
        '.js-rule-forbid[data-type="halfWidthKatakana"]',
        (el) => el.checked,
      ),
    ).toBe(false);

    expect(pageErrors).toEqual([]);
  });

  test('対象フィールド未選択・禁止文字種未選択の場合はエラーが表示され保存されない', async () => {
    await common.openPluginConfig(page, env, appId, pluginId);

    // 1件目(前のテストで保存した正常なルール)はそのまま、2件目を空のまま追加する。
    await page.click('#js-rule-add');
    await page.click('.kintoneplugin-button-dialog-ok');
    await new Promise((resolve) => setTimeout(resolve, 500));
    // バリデーションエラー時は画面遷移しない。
    expect(page.url()).toContain('plugin/config');

    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain('2件目');
    expect(errorText).toContain('対象フィールドが選択されていません');
    expect(errorText).toContain('禁止する文字種が1つも選択されていません');

    // 元に戻す(1件目のみの状態で保存し直し、後続テスト・他プラグインのE2Eへ影響を残さない)。
    const rows = await page.$$('.js-rule-row');
    await rows[rows.length - 1].$eval('.js-rule-remove', (el) => el.click());
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(page, env, appId, pluginId);
    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
