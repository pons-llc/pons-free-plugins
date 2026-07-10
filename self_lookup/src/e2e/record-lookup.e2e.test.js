'use strict';

// レコード追加画面での実際のルックアップ動作(ボタン押下→REST検索→モーダル確認→反映)を
// 検証するPuppeteerテスト。config-screen.e2e.test.jsが画面の疎通・選択肢の絞り込みを見るのに
// 対し、こちらは「実際にヒットしたレコードの値が反映されるか」という機能面を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// NOTE: レコード追加画面(/edit)へは実際のユーザー導線(アプリ一覧画面→「レコードを追加する」
// リンクをクリック)で遷移する。/edit へ直接page.goto()すると、kintone管理画面のSPA内部状態が
// 正しく設定されず、kintone.app.record.get()などが
// "The specified JavaScript API cannot be executed on this screen." で失敗する
// (common.jsのopenPluginConfig()と同種の問題、実環境で確認済み)。
//
// NOTE: レコードのキーフィールドへの入力は、kintone側が動的に生成するDOM要素id
// (フィールドコードから予測できない)に依存したtype操作を避けるため、公式JavaScript API
// (kintone.app.record.set())で値をセットする。これは本プラグインのボタンクリック処理が
// kintone.app.record.get()で値を読む設計のため、実際のユーザー操作(手入力)と等価に扱える。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  ensureTargetAppFields,
  ensureButtonSpace,
  ensureSeedRecord,
  BUTTON_SPACE_ELEMENT_ID,
  SEED_KEY_VALUE,
  SEED_NAME_VALUE,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('レコード追加画面でのルックアップ(実環境)', () => {
  let browser;
  let page;
  let env;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpace(env, env.TEST_APP_ID_1);
    await ensureSeedRecord(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定行を1件追加して保存する(検索先=slk_key〈unique〉、自レコードキー=文字列__1行_、
    // マッピング: 文字列__1行__0→slk_copied_name、ボタン設置スペース=self_lookup_button_space)。
    // TEST_APP_ID_1には手動検証済みの設定行が既にあるため、常に最後の.js-lookup-rowを
    // スコープに操作し、既存行を巻き込まない。すでに本テスト用の行が保存済み(再実行時)なら
    // 追加・保存をスキップする(buttonSpaceElementIdは設定行間で重複できないため、冪等にする)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const alreadyConfigured = await page.evaluate((spaceId) => {
      const rows = Array.from(document.querySelectorAll('.js-lookup-row'));
      return rows.some(
        (row) =>
          row.querySelector('.js-lookup-button-space')?.value === spaceId,
      );
    }, BUTTON_SPACE_ELEMENT_ID);

    if (!alreadyConfigured) {
      await page.click('#js-lookup-add');
      const rows = await page.$$('.js-lookup-row');
      const newRow = rows[rows.length - 1];

      const otherKeySelect = await newRow.$('.js-lookup-other-key');
      await otherKeySelect.select('slk_key');
      const selfKeySelect = await newRow.$('.js-lookup-self-key');
      await selfKeySelect.select('文字列__1行_');
      const spaceSelect = await newRow.$('.js-lookup-button-space');
      await spaceSelect.select(BUTTON_SPACE_ELEMENT_ID);

      const mappingAddButton = await newRow.$('.js-mapping-add');
      await mappingAddButton.click();
      const mappingSourceSelect = await newRow.$('.js-mapping-source');
      await mappingSourceSelect.select('文字列__1行__0');
      const mappingTargetSelect = await newRow.$('.js-mapping-target');
      await mappingTargetSelect.select('slk_copied_name');

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);

      // プラグイン設定の保存(kintone.plugin.app.setConfig())は、フィールド/レイアウトの変更と
      // 同じく「テスト環境」相当の状態にしか反映されず、レコード追加・編集画面などの実際の画面に
      // 反映されるには明示的なアプリの更新(デプロイ)が必要(保存後のアラート文言「アプリを
      // 更新してください」の通り)。これを怠ると、設定は保存済みなのにレコード画面上のボタンが
      // いつまでも描画されず原因が分かりにくいので、忘れずにデプロイする。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('自レコードのキーを入力してボタンを押すと、モーダル経由で一致したレコードの値が反映される', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 自レコードのキーフィールドにシードレコードと同じ値をセットする(公式JavaScript API経由)。
    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current['文字列__1行_'].value = value;
      kintone.app.record.set({ record: current });
    }, SEED_KEY_VALUE);

    // ルックアップボタン(設定したスペースフィールド内、自プラグインが動的に追加する)をクリックする。
    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      BUTTON_SPACE_ELEMENT_ID,
    );
    await page.evaluate((spaceId) => {
      kintone.app.record
        .getSpaceElement(spaceId)
        .querySelector('button')
        .click();
    }, BUTTON_SPACE_ELEMENT_ID);

    // 1件ヒットの場合でも必ずモーダルで確認させる仕様(user-test.mdフィードバック反映、
    // 「ボタンを押すとモーダルが出ると思っていたが即時反映されていた」への対応の回帰テスト)。
    await page.waitForSelector('.slk-modal-row');
    const rowTexts = await page.$$eval('.slk-modal-row', (rows) =>
      rows.map((r) => r.textContent),
    );
    expect(rowTexts.length).toBe(1);
    expect(rowTexts[0]).toContain(SEED_NAME_VALUE);

    await page.click('.slk-modal-row');

    // モーダルで選択した後、出力先フィールドに一致レコードの値が反映される。
    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.slk_copied_name.value === expected;
      },
      {},
      SEED_NAME_VALUE,
    );

    expect(pageErrors).toEqual([]);
  });
});
