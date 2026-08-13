'use strict';

// self-lookup記事(kintoneで同一アプリの別レコードを検索して値を取得する方法)用の
// ARTICLE_APP_IDセットアップスクリプト。scripts/templates/article-setup.template.jsを
// コピーして作成。selfLookupプラグインのe2eテスト(self_lookup/src/e2e/fixtures.js,
// record-lookup.e2e.test.js)のセレクター・手順を踏襲する。
//
// デモの筋書き: 「案件」を記録するアプリで、同じ取引先の案件を2件目以降登録するとき、
// 取引先コードを入力してボタンを押すだけで、過去の案件レコードから取引先名・担当者名を
// 自動転記する(同一アプリ内に別マスタアプリを持たずに済ませる、というセルフルックアップの
// 典型的な使い方)。
//
// 実行: node articles/self-lookup/setup.js

const path = require('path');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'self-lookup';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../self_lookup/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));

const BUTTON_SPACE_ELEMENT_ID = 'self_lookup_button_space';

const SEED_PARTNER_CODE = 'T001';
const SEED_PARTNER_NAME = '株式会社サンプル建設';
const SEED_STAFF_NAME = '山田太郎';
const SEED_PROJECT_NAME = '〇〇市 道路工事(第1期)';

const NEW_PROJECT_NAME = '〇〇市 道路工事(第2期)';

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await common.login(page, env);

    // 2. アプリを白紙に戻す。
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    // 3. 記事のデモに必要なフィールドを作成する。
    //    案件名: 案件を識別するための一般フィールド(ルックアップとは無関係)。
    //    取引先コード: 検索先キー・自レコードキーの両方に使う(同じフィールドコードを
    //      指定できる、self_lookup/idea.md参照)。
    //    取引先名・担当者名: フィールドマッピングの転記先(自レコード)であり、同時に
    //      過去レコード側では転記元の値としても使われる(同一アプリ内で同じフィールド構成を
    //      共有するため)。
    await kintoneAdmin.addFormFields(env, appId, {
      案件名: { type: 'SINGLE_LINE_TEXT', code: '案件名', label: '案件名' },
      取引先コード: {
        type: 'SINGLE_LINE_TEXT',
        code: '取引先コード',
        label: '取引先コード',
      },
      取引先名: {
        type: 'SINGLE_LINE_TEXT',
        code: '取引先名',
        label: '取引先名',
      },
      担当者名: {
        type: 'SINGLE_LINE_TEXT',
        code: '担当者名',
        label: '担当者名',
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(env, appId, BUTTON_SPACE_ELEMENT_ID);

    // 4. プラグインを追加。
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定画面を開いて入力・保存する(self_lookup/src/e2e/record-lookup.e2e.test.jsの
    //    セレクターを踏襲)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-lookup-add');
    const rows = await page.$$('.js-lookup-row');
    const newRow = rows[rows.length - 1];

    const otherKeySelect = await newRow.$('.js-lookup-other-key');
    await otherKeySelect.select('取引先コード');
    const selfKeySelect = await newRow.$('.js-lookup-self-key');
    await selfKeySelect.select('取引先コード');
    const spaceSelect = await newRow.$('.js-lookup-button-space');
    await spaceSelect.select(BUTTON_SPACE_ELEMENT_ID);

    const mappingAddButton1 = await newRow.$('.js-mapping-add');
    await mappingAddButton1.click();
    let mappingRows = await newRow.$$('.js-mapping-row');
    let mappingRow = mappingRows[mappingRows.length - 1];
    let mappingSourceSelect = await mappingRow.$('.js-mapping-source');
    await mappingSourceSelect.select('取引先名');
    let mappingTargetSelect = await mappingRow.$('.js-mapping-target');
    await mappingTargetSelect.select('取引先名');

    const mappingAddButton2 = await newRow.$('.js-mapping-add');
    await mappingAddButton2.click();
    mappingRows = await newRow.$$('.js-mapping-row');
    mappingRow = mappingRows[mappingRows.length - 1];
    mappingSourceSelect = await mappingRow.$('.js-mapping-source');
    await mappingSourceSelect.select('担当者名');
    mappingTargetSelect = await mappingRow.$('.js-mapping-target');
    await mappingTargetSelect.select('担当者名');

    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);

    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );

    // 設定画面のスクリーンショット(保存直後の状態を撮り直すため再度開く)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 6. デモ用のレコードを作成する。まず「過去の案件」(検索対象)をREST APIで1件投入する。
    await kintoneAdmin.addRecords(env, appId, [
      {
        案件名: { value: SEED_PROJECT_NAME },
        取引先コード: { value: SEED_PARTNER_CODE },
        取引先名: { value: SEED_PARTNER_NAME },
        担当者名: { value: SEED_STAFF_NAME },
      },
    ]);

    // 「2件目の案件」は実際にレコード追加画面でプラグインのボタンを操作して作成し、
    // 実処理(REST検索→モーダル→転記)を実際に走らせる。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await page.evaluate(
      (projectName, partnerCode) => {
        const current = kintone.app.record.get().record;
        current['案件名'].value = projectName;
        current['取引先コード'].value = partnerCode;
        kintone.app.record.set({ record: current });
      },
      NEW_PROJECT_NAME,
      SEED_PARTNER_CODE,
    );

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

    // モーダルが出た状態でスクリーンショットを撮る(実行結果セクション用)。
    await page.waitForSelector('.slk-modal-row');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await common.screenshotToDirectory(page, screenshotDir, 'lookup-modal');

    await page.click('.slk-modal-row');
    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record['取引先名'].value === expected;
      },
      {},
      SEED_PARTNER_NAME,
    );

    // 転記結果が反映された編集画面のまま保存する。
    const saveButtonHandle = await page.$('button.gaia-ui-actionmenu-save');
    await saveButtonHandle.evaluate((el) => el.click());
    await page.waitForFunction(() => location.href.includes('record='), {
      timeout: 60000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    // 7. 保存後の詳細画面のスクリーンショット(取引先名・担当者名が自動転記されている状態)。
    await common.screenshotToDirectory(page, screenshotDir, 'record-detail');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
