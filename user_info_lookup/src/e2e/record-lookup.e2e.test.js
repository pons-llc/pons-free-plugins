'use strict';

// レコード追加画面での実際のルックアップ動作(ボタン押下→User API/kintone.user.getOrganizations()等の
// 呼び出し→反映)を検証するPuppeteerテスト。config-screen.e2e.test.jsが画面の疎通・選択肢の絞り込みを
// 見るのに対し、こちらは「実際に取得したユーザー情報の値が反映されるか」という機能面を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// 期待値(表示名・メールアドレス)はハードコードせず、テスト実行時にUser API(GET /v1/users.json)へ
// 実際にリクエストして取得した値と突き合わせる(検証環境のユーザー名が変わってもテストが壊れないため)。
//
// NOTE: レコード追加画面(/edit)へは実際のユーザー導線(アプリ一覧画面→「レコードを追加する」
// リンクをクリック)で遷移する。/edit へ直接page.goto()すると、kintone管理画面のSPA内部状態が
// 正しく設定されず、kintone.app.record.get()などが
// "The specified JavaScript API cannot be executed on this screen." で失敗する
// (common.jsのopenPluginConfig()と同種の問題、self_lookupで確認済み)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  ensureTargetAppFields,
  ensureButtonSpace,
  BUTTON_SPACE_ELEMENT_ID,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('レコード追加画面でのユーザー情報反映(実環境)', () => {
  let browser;
  let page;
  let env;
  let expectedUser;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpace(env, env.TEST_APP_ID_1);

    // 期待値はハードコードせず、User APIから実際の値を取得する(ログイン中のユーザー自身を対象にする)。
    const usersResp = await kintoneAdmin.request(env, '/v1/users.json', 'GET', {
      codes: [env.KINTONE_USERNAME],
    });
    expectedUser = usersResp.users[0];

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定行を1件追加して保存する(元フィールド=uil_user_code、発動条件=ボタン押下時、
    // ボタン設置スペース=uil_button_space、転記項目: 表示名→uil_out_name、メール→uil_out_email)。
    // TEST_APP_ID_1には手動検証済みの設定行が既にあることがあるため、常に最後の.js-rowを
    // スコープに操作し、既存行を巻き込まない。すでに本テスト用の行が保存済み(再実行時)なら
    // 追加・保存をスキップする(buttonSpaceElementIdは設定行間で重複できないため、冪等にする)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const alreadyConfigured = await page.evaluate((spaceId) => {
      const rows = Array.from(document.querySelectorAll('.js-row'));
      return rows.some(
        (row) => row.querySelector('.js-button-space')?.value === spaceId,
      );
    }, BUTTON_SPACE_ELEMENT_ID);

    if (!alreadyConfigured) {
      await page.click('#js-row-add');
      const rows = await page.$$('.js-row');
      const newRow = rows[rows.length - 1];

      await (await newRow.$('.js-source-field')).select('uil_user_code');
      await (
        await newRow.$('.js-button-space')
      ).select(BUTTON_SPACE_ELEMENT_ID);

      await (await newRow.$('.js-mapping-add')).click();
      let mappingRows = await newRow.$$('.js-mapping-row');
      await mappingRows[0]
        .$('.js-mapping-attribute')
        .then((el) => el.select('name'));
      await mappingRows[0]
        .$('.js-mapping-destination')
        .then((el) => el.select('uil_out_name'));

      await (await newRow.$('.js-mapping-add')).click();
      mappingRows = await newRow.$$('.js-mapping-row');
      await mappingRows[1]
        .$('.js-mapping-attribute')
        .then((el) => el.select('email'));
      await mappingRows[1]
        .$('.js-mapping-destination')
        .then((el) => el.select('uil_out_email'));

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);

      // プラグイン設定の保存(kintone.plugin.app.setConfig())は、フィールド/レイアウトの変更と
      // 同じく「テスト環境」相当の状態にしか反映されず、レコード追加・編集画面などの実際の画面に
      // 反映されるには明示的なアプリの更新(デプロイ)が必要(self_lookupの判断記録.mdの10番と同じ)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('元フィールドにユーザーコードを入力してボタンを押すと、User APIで取得した値が反映される', async () => {
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

    // 元フィールドにログイン中ユーザー自身のユーザーコードをセットする(公式JavaScript API経由)。
    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current.uil_user_code.value = value;
      kintone.app.record.set({ record: current });
    }, env.KINTONE_USERNAME);

    // ユーザー情報取得ボタン(設定したスペースフィールド内、自プラグインが動的に追加する)をクリックする。
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

    // ボタン押下後、出力先フィールドにUser APIから取得した実際の値が反映される。
    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.uil_out_name.value === expected;
      },
      { timeout: 15000 },
      expectedUser.name,
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record.uil_out_name.value).toBe(expectedUser.name);
    expect(record.uil_out_email.value).toBe(expectedUser.email);

    expect(pageErrors).toEqual([]);
  });
});
