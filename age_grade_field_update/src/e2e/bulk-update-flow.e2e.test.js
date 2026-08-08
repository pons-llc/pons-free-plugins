'use strict';

// 一覧画面ボタン → 確認ダイアログ(kintone.createDialog、値を編集可能)→ 実行 → 書き戻しまでの
// 実環境テスト。config-screen.e2e.test.jsが設定画面の疎通確認なのに対し、こちらは
// 「確認ダイアログで値を編集してから実行すると、その編集後の値がレコードへ書き込まれるか」
// という機能面(このプラグインの中核。2026-08-08改訂で値を編集可能にした変更のリスクが最も高い部分)
// を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e
//
// NOTE: 一覧画面ボタンはkintone.user.getGroups()で判定した実行可能グループに所属する
// ユーザーにのみ表示される。検証環境のログインユーザー(.envのKINTONE_USERNAME)は
// "Administrators"グループに所属していることをkintone.user.getGroups()で事前確認済み。
//
// NOTE: kintone.createDialog()が生成するOK/キャンセルボタンはkintone内部のUIコンポーネント
// (`gaia-argoui-dialog-buttons-*`)のため、`button[name="ok"]`(name属性)で特定する
// (実環境で確認済み。common.jsのログイン画面セレクターと同様、kintoneの内部実装に依存するため
// 将来変更される可能性がある)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TARGET_DATE_FIELD_CODE = '日付';
const MARKER_FIELD_CODE = '文字列__1行_';
const MARKER_VALUE = 'agfu_e2e_bulk_update_seed';
const EDITED_DATE_VALUE = '2099-03-15';

// このテスト専用のレコードを1件だけ用意する(既存レコードを巻き込まない、
// 他のテストで作られたマーカー付きレコードがあれば使い回す冪等な実装)。
const ensureSeedRecord = async (env, appId) => {
  const query = `${MARKER_FIELD_CODE} = "${MARKER_VALUE}" limit 1`;
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query,
      fields: ['$id'],
    },
  );
  if (existing.records.length > 0) {
    return existing.records[0].$id.value;
  }
  const created = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: { [MARKER_FIELD_CODE]: { value: MARKER_VALUE } },
  });
  return created.id;
};

describe('一覧画面ボタンでの一括更新(実環境)', () => {
  let browser;
  let page;
  let env;
  let recordId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    recordId = await ensureSeedRecord(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 800 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 対象をこのテスト専用レコード1件だけに絞り込む設定で保存する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.select('.js-target-field', TARGET_DATE_FIELD_CODE);
    await page.evaluate((id) => {
      document.querySelector('.js-query').value = `$id = ${id}`;
      document.querySelector('.js-group-codes').value = 'Administrators';
    }, recordId);
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存はプレビューにしか反映されないため、明示的にデプロイする
    // (project_plugin_config_needs_deploy.mdの注意点)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('確認ダイアログの入力欄を編集してから実行すると、編集後の値がレコードへ書き込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.agfu-bulk-button'));
      },
      { timeout: 15000 },
    );

    await page.click('.agfu-bulk-button');
    await page.waitForSelector('.agfu-value-input', { timeout: 15000 });

    // 既定値は「今日」の日付になっている(idea.md「確認ダイアログ・実行」)。
    const defaultValue = await page.$eval(
      '.agfu-value-input',
      (el) => el.value,
    );
    const today = new Date();
    const expectedDefault = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(defaultValue).toBe(expectedDefault);

    // 既定値から編集する。
    await page.evaluate((value) => {
      const input = document.querySelector('.agfu-value-input');
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, EDITED_DATE_VALUE);

    // Puppeteerのpage.click()は要素の可視座標を要求するが、kintoneの内部ダイアログは
    // 位置計算の都合でこの判定に失敗することがある(common.jsのSPAリンクと同様の事情)ため、
    // DOM要素のclick()を直接呼び出す。
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button[name="ok"]');
      buttons[buttons.length - 1].click();
    });

    // 書き戻し完了後、編集後の値がレコードへ反映されるまで待つ
    // (完了時のalertはbeforeAllで登録したdialogハンドラーが自動acceptする)。
    await page.waitForFunction(
      (appId, id, fieldCode, expectedValue) =>
        kintone
          .api(kintone.api.url('/k/v1/record.json', true), 'GET', {
            app: appId,
            id,
          })
          .then((res) => res.record[fieldCode].value === expectedValue)
          .catch(() => false),
      { timeout: 30000, polling: 1000 },
      Number(env.TEST_APP_ID_1),
      recordId,
      TARGET_DATE_FIELD_CODE,
      EDITED_DATE_VALUE,
    );

    expect(pageErrors).toEqual([]);
  });
});
