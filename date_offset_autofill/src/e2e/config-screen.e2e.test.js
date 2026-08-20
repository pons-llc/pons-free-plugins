'use strict';

// このプラグイン固有のPuppeteerテスト。設定画面が開けること・DATE/DATETIME型への絞り込み・
// オフセット値の種類(固定値/フィールド参照)切り替え・保存内容の読み直しを確認する
// (静的HTML・単体テストでは検知できない実環境固有の挙動、CLAUDE.mdの開発方針1参照)。
// 公開サイト用のスクリーンショットもここで撮る(text_slice/number_extract等と同じ方針)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'date_offset_autofill';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const BASE_DATE_FIELD_CODE = '日付';
const TARGET_DATE_FIELD_CODE = '日付_0';
const NUMBER_FIELD_CODE = '数値';

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
    await fixtures.ensureCalcNumberField(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('ルールを追加し、フィールド候補の絞り込み・オフセット種別の切り替え・保存内容の読み直しができる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('日付自動入力プラグイン');

    // このテストは繰り返し実行される(前回保存した設定が残っている)ため、既存のルールを
    // すべて削除してから新規に1件だけ追加する状態に揃える(冪等にするため)。
    for (;;) {
      const removeButton = await page.$('.js-rule-remove');
      if (!removeButton) {
        break;
      }
      await removeButton.click();
    }

    await page.click('#js-rule-add');
    const ruleRow = await page.$('.js-rule-row');
    expect(ruleRow).not.toBeNull();

    // 基準・出力先フィールドの候補はDATE/DATETIME型のみ(数値フィールドは含まれない)。
    const baseOptionValues = await ruleRow.$$eval(
      '.js-rule-base option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(baseOptionValues).toContain(BASE_DATE_FIELD_CODE);
    expect(baseOptionValues).not.toContain(NUMBER_FIELD_CODE);

    await (await ruleRow.$('.js-rule-base')).select(BASE_DATE_FIELD_CODE);
    await (await ruleRow.$('.js-rule-target')).select(TARGET_DATE_FIELD_CODE);

    // 既定はFIXED(固定値)。固定値入力欄が見えており、フィールド参照欄は隠れている。
    const fixedRowVisibleInitially = await ruleRow.$eval(
      '.js-rule-fixed-row',
      (el) => el.style.display !== 'none',
    );
    expect(fixedRowVisibleInitially).toBe(true);
    await (await ruleRow.$('.js-rule-fixed-value')).type('10');

    // フィールド参照に切り替えると、固定値欄が隠れフィールド参照欄が表示される。
    // オフセット参照フィールドの候補には数値フィールドと表示書式が数値のCALCフィールドが含まれる。
    await (await ruleRow.$('.js-rule-source-field')).click();
    const fixedRowVisibleAfterSwitch = await ruleRow.$eval(
      '.js-rule-fixed-row',
      (el) => el.style.display !== 'none',
    );
    expect(fixedRowVisibleAfterSwitch).toBe(false);
    const offsetFieldOptionValues = await ruleRow.$$eval(
      '.js-rule-offset-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(offsetFieldOptionValues).toContain(NUMBER_FIELD_CODE);
    expect(offsetFieldOptionValues).toContain(fixtures.CALC_NUMBER_FIELD_CODE);
    await (await ruleRow.$('.js-rule-offset-field')).select(NUMBER_FIELD_CODE);

    // 単位「分数」はDATE型の基準フィールドでは保存時に弾かれる(バリデーション確認)。
    await (await ruleRow.$('.js-rule-unit')).select('MINUTES');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    await page.click('.kintoneplugin-button-dialog-ok');
    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain('分数');

    // 単位を「日数」に戻せば保存できる。
    await (await ruleRow.$('.js-rule-unit')).select('DAYS');
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const reloadedBase = await page.$eval('.js-rule-base', (el) => el.value);
    const reloadedTarget = await page.$eval(
      '.js-rule-target',
      (el) => el.value,
    );
    const reloadedUnit = await page.$eval('.js-rule-unit', (el) => el.value);
    const reloadedOffsetField = await page.$eval(
      '.js-rule-offset-field',
      (el) => el.value,
    );
    expect(reloadedBase).toBe(BASE_DATE_FIELD_CODE);
    expect(reloadedTarget).toBe(TARGET_DATE_FIELD_CODE);
    expect(reloadedUnit).toBe('DAYS');
    expect(reloadedOffsetField).toBe(NUMBER_FIELD_CODE);
  });
});
