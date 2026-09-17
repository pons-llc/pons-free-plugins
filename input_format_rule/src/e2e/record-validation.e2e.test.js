'use strict';

// レコード追加・編集画面での禁止文字チェック(値変更時のフィールドエラー表示・保存時のブロック)を
// 検証する。設定(config-screen.e2e.test.jsが保存した値)には依存せず、このテスト自身が冒頭で
// 既知の設定(対象フィールド=文字列__1行_、禁止する文字種=半角英数字)をUI経由で保存してから
// 検証する(budget_meter/src/e2e/budget-check.e2e.test.jsと同じ「他ファイルの実行順に依存しない」方針)。
//
// フィールドへの値の書き込みは、kintone.app.record.set()を使う(公式ドキュメント
// 「フィールドの値を変更したときのイベント」に、このAPIでの書き換えも change イベントの
// 発火条件として明記されている)。追加・編集画面では`kintone.app.record.getFieldElement()`が
// 利用できない(公式ドキュメント「利用できる画面」が詳細・印刷画面のみのため)ため、
// 実際に描画されたエラーメッセージの確認はDOMの`.input-error-cybozu`要素を直接調べる
// (実機で確認済みのクラス名)。
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
const TARGET_FIELD_CODE = '文字列__1行_';

const setFieldValue = (page, fieldCode, value) =>
  page.evaluate(
    async (code, val) => {
      const { record } = await kintone.app.record.get();
      record[code].value = val;
      await kintone.app.record.set({ record });
    },
    fieldCode,
    value,
  );

const getFieldErrorTexts = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.input-error-cybozu')).map((el) =>
      el.textContent.trim(),
    ),
  );

describe('レコード追加・編集画面(実環境, 禁止文字チェック)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let appId;
  let createdRecordId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
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

    // このテスト専用の既知の設定(対象フィールド=文字列__1行_、禁止=半角英数字のみ)を
    // 保存する(他ファイルのテスト実行順に依存しないよう、ここで独立に用意する)。
    await common.openPluginConfig(page, env, appId, pluginId);
    for (;;) {
      const removeEl = await page.$('.js-rule-remove');
      if (!removeEl) {
        break;
      }
      await removeEl.click();
    }
    await page.click('#js-rule-add');
    const ruleRow = await page.$('.js-rule-row');
    await (await ruleRow.$('.js-rule-field')).select(TARGET_FIELD_CODE);
    await (
      await ruleRow.$('.js-rule-forbid[data-type="halfWidthAlnum"]')
    ).click();
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
    // このテストで保存に成功したレコードを後片付けする
    // (feedback_shared_test_app_destructive_ops.mdの方針: 自分が作ったと確実に分かるレコードのみ削除)。
    if (createdRecordId) {
      await kintoneAdmin.deleteRecords(env, appId, [createdRecordId]);
    }
  });

  const gotoCreateScreen = async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
  };

  test('新規作成画面: 禁止文字を入力するとフィールドにエラーが表示され、修正すると消える', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await gotoCreateScreen();

    await setFieldValue(page, TARGET_FIELD_CODE, 'abc123');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await getFieldErrorTexts(page)).toEqual([
      '半角英数字は使用できません。',
    ]);

    await setFieldValue(page, TARGET_FIELD_CODE, 'あいう');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await getFieldErrorTexts(page)).toEqual([]);

    expect(pageErrors).toEqual([]);
  });

  test('新規作成画面: 禁止文字が含まれたままだと保存がブロックされ、修正すると保存できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await gotoCreateScreen();

    await setFieldValue(page, TARGET_FIELD_CODE, 'abc123');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.click('.gaia-ui-actionmenu-save');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 保存がブロックされていれば画面遷移せず/editのままで、画面上部にもエラーが出る。
    expect(page.url()).toContain('/edit');
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('入力内容にエラーがあります');

    // 修正して保存し直すと、レコード詳細画面に遷移して保存できる。
    await setFieldValue(page, TARGET_FIELD_CODE, 'あいう');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await Promise.all([
      page.waitForFunction(() => location.href.includes('/show')),
      page.click('.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const match = page.url().match(/record=(\d+)/);
    expect(match).not.toBeNull();
    createdRecordId = Number(match[1]);

    expect(pageErrors).toEqual([]);
  });

  test('編集画面: 禁止文字を入力するとフィールドにエラーが表示され、修正して保存できる', async () => {
    expect(createdRecordId).not.toBeUndefined();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${createdRecordId}`,
      { waitUntil: 'networkidle0' },
    );
    await common.goToEditScreenFromDetail(page);

    await setFieldValue(page, TARGET_FIELD_CODE, 'XYZ789');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await getFieldErrorTexts(page)).toEqual([
      '半角英数字は使用できません。',
    ]);

    await setFieldValue(page, TARGET_FIELD_CODE, 'えお');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await getFieldErrorTexts(page)).toEqual([]);

    await Promise.all([
      page.waitForFunction(
        (id) =>
          location.href.includes(`record=${id}`) &&
          !location.href.includes('mode=edit'),
        {},
        createdRecordId,
      ),
      page.click('.gaia-ui-actionmenu-save'),
    ]);

    expect(pageErrors).toEqual([]);
  });
});
