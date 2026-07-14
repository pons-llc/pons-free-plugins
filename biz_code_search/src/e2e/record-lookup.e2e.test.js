'use strict';

// レコード追加画面での実際の動作(ボタン押下→gBizINFO実APIリクエスト→反映)を検証するPuppeteer
// テスト。config-screen.e2e.test.jsが画面の疎通・選択肢の絞り込みを見るのに対し、こちらは
// 「実際にgBizINFOへリクエストし、取得した値が反映されるか」という機能面を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// さらに、リポジトリルートの.envに`GBIZ_API_KEY`(gBizINFOのAPIトークン、利用者が自分で申請・
// 取得したもの、BYOD)が設定されていること。設定されていない場合はこのテストファイル全体を
// スキップする(idea.mdの「実運用APIキーが必要なE2Eシナリオの制約」参照)。
//
// 実行: pnpm run test:e2e
//
// NOTE: レコード追加画面(/edit)へは実際のユーザー導線(アプリ一覧画面→「レコードを追加する」
// リンクをクリック)で遷移する。直接page.goto()すると、kintone管理画面のSPA内部状態が
// 正しく設定されず、kintone.app.record.get()などが
// "The specified JavaScript API cannot be executed on this screen." で失敗する
// (common.jsのopenPluginConfig()と同種の問題、実環境で確認済み)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  ensureTargetAppFields,
  ensureButtonSpaces,
  NUMBER_BUTTON_SPACE_ELEMENT_ID,
  NAME_BUTTON_SPACE_ELEMENT_ID,
  KNOWN_CORPORATE_NUMBER,
  KNOWN_CORPORATE_NAME,
  SEARCH_NAME_QUERY,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const goToNewRecordScreen = async (page, env) => {
  await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
    waitUntil: 'networkidle0',
  });
  const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
  await page.evaluate((el) => el.click(), addLinkEl);
  await page.waitForFunction(() => location.href.includes('/edit'));
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});
};

describe('レコード追加画面でのgBizINFO実APIリクエスト(実環境)', () => {
  let browser;
  let page;
  let env;
  let hasApiKey;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    hasApiKey = !!env.GBIZ_API_KEY;
    if (!hasApiKey) {
      return;
    }

    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpaces(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定行を1件追加し、APIトークンとともに保存する。TEST_APP_ID_1に既に本テスト用の行が
    // 保存済み(再実行時)なら追加・保存をスキップする(ボタン設置スペースは設定行間で重複
    // できないため、冪等にする。self_lookupのrecord-lookup.e2e.test.jsと同じ方針)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const alreadyConfigured = await page.evaluate((spaceId) => {
      const rows = Array.from(document.querySelectorAll('.js-lookup-row'));
      return rows.some(
        (row) =>
          row.querySelector('.js-lookup-number-button-space')?.value ===
          spaceId,
      );
    }, NUMBER_BUTTON_SPACE_ELEMENT_ID);

    if (!alreadyConfigured) {
      await page.click('#js-lookup-add');
      const rows = await page.$$('.js-lookup-row');
      const newRow = rows[rows.length - 1];

      await (
        await newRow.$('.js-lookup-corporate-number')
      ).select('bcs_corporate_number');
      await (
        await newRow.$('.js-lookup-company-name')
      ).select('bcs_company_name');
      await (
        await newRow.$('.js-lookup-number-button-space')
      ).select(NUMBER_BUTTON_SPACE_ELEMENT_ID);
      await (
        await newRow.$('.js-lookup-name-button-space')
      ).select(NAME_BUTTON_SPACE_ELEMENT_ID);

      await (await newRow.$('.js-mapping-add')).click();
      let mappingRows = await newRow.$$('.js-mapping-row');
      await (await mappingRows[0].$('.js-mapping-attribute')).select('name');
      await (
        await mappingRows[0].$('.js-mapping-target')
      ).select('bcs_name_output');

      await (await newRow.$('.js-mapping-add')).click();
      mappingRows = await newRow.$$('.js-mapping-row');
      await (
        await mappingRows[1].$('.js-mapping-attribute')
      ).select('representative_name');
      await (
        await mappingRows[1].$('.js-mapping-target')
      ).select('bcs_rep_output');

      await page.type('#js-api-token', env.GBIZ_API_KEY);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);

      // プラグイン設定の保存(kintone.plugin.app.setConfig()/setProxyConfig())は、実際の
      // レコード画面に反映されるには明示的なアプリの更新(デプロイ)が必要(self_lookupの
      // 同種テストと同じ注意点)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('法人番号から取得ボタンを押すと、gBizINFOから取得した法人情報が反映される', async () => {
    if (!hasApiKey) {
      console.warn(
        '.envにGBIZ_API_KEYが設定されていないため、このテストをスキップします。',
      );
      return;
    }

    await goToNewRecordScreen(page, env);
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current.bcs_corporate_number.value = value;
      kintone.app.record.set({ record: current });
    }, KNOWN_CORPORATE_NUMBER);

    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      NUMBER_BUTTON_SPACE_ELEMENT_ID,
    );
    await page.evaluate((spaceId) => {
      kintone.app.record
        .getSpaceElement(spaceId)
        .querySelector('button')
        .click();
    }, NUMBER_BUTTON_SPACE_ELEMENT_ID);

    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.bcs_name_output.value === expected;
      },
      { timeout: 20000 },
      KNOWN_CORPORATE_NAME,
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record.bcs_name_output.value).toBe(KNOWN_CORPORATE_NAME);
    expect(record.bcs_rep_output.value.length).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);
  });

  test('法人名から検索ボタンを押すと、候補モーダルから選択した法人番号・法人情報が反映される', async () => {
    if (!hasApiKey) {
      console.warn(
        '.envにGBIZ_API_KEYが設定されていないため、このテストをスキップします。',
      );
      return;
    }

    await goToNewRecordScreen(page, env);
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current.bcs_company_name.value = value;
      kintone.app.record.set({ record: current });
    }, SEARCH_NAME_QUERY);

    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      NAME_BUTTON_SPACE_ELEMENT_ID,
    );
    await page.evaluate((spaceId) => {
      kintone.app.record
        .getSpaceElement(spaceId)
        .querySelector('button')
        .click();
    }, NAME_BUTTON_SPACE_ELEMENT_ID);

    await page.waitForSelector('.bcs-modal-row', { timeout: 20000 });
    const rowTexts = await page.$$eval('.bcs-modal-row', (rows) =>
      rows.map((r) => r.textContent),
    );
    expect(rowTexts.length).toBeGreaterThan(0);
    const targetIndex = rowTexts.findIndex((text) =>
      text.includes(KNOWN_CORPORATE_NAME),
    );
    expect(targetIndex).toBeGreaterThanOrEqual(0);

    const modalRows = await page.$$('.bcs-modal-row');
    await modalRows[targetIndex].click();

    // 候補選択後、法人番号フィールドの反映(同期)に続けて詳細取得API呼び出し(非同期)が完了し、
    // 転記項目まで反映されるのを待つ(法人番号だけを待つと、詳細取得が終わる前に読み取ってしまう
    // 競合が起きる)。
    await page.waitForFunction(
      (expectedName) => {
        const record = kintone.app.record.get().record;
        return record.bcs_name_output.value === expectedName;
      },
      { timeout: 20000 },
      KNOWN_CORPORATE_NAME,
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record.bcs_corporate_number.value).toBe(KNOWN_CORPORATE_NUMBER);
    expect(record.bcs_name_output.value).toBe(KNOWN_CORPORATE_NAME);

    expect(pageErrors).toEqual([]);
  });
});
